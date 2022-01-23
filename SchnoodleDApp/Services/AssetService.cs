using System.Numerics;
using Azure.Storage.Files.Shares;
using Microsoft.Extensions.Options;
using SchnoodleDApp.Models;
using Scrutor.AspNetCore;
using SharpGLTF.Scenes;

namespace SchnoodleDApp.Services;

public sealed class AssetService : ISelfScopedLifetime
{
    private readonly FilesOptions _filesOptions;

    public AssetService(IOptions<FilesOptions> filesOptions)
    {
        _filesOptions = filesOptions.Value;
    }

    public async Task<Stream> Create3DAsset(string directoryName, CancellationToken cancellationToken = default)
    {
        try
        {
            var share = new ShareClient($"DefaultEndpointsProtocol=https;AccountName={_filesOptions.AccountName};AccountKey={_filesOptions.Key};EndpointSuffix=core.windows.net", "assets");
            var mainDirectory = share.GetDirectoryClient(directoryName);

            if (!await mainDirectory.ExistsAsync(cancellationToken))
            {
                throw new DirectoryNotFoundException($"The directory '{directoryName}' does not exist on the file share.");
            }

            var assetsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Assets");
            const string gltfFileExtension = ".gltf";
            var sceneBuilder = new SceneBuilder();
            await BuildSceneFromDirectory(mainDirectory);

            async Task BuildSceneFromDirectory(ShareDirectoryClient directory)
            {
                var gltfFilePath = string.Empty;
                await foreach (var item in directory.GetFilesAndDirectoriesAsync(cancellationToken: cancellationToken))
                {
                    if (item.IsDirectory)
                    {
                        await BuildSceneFromDirectory(directory.GetSubdirectoryClient(item.Name));
                    }
                    else
                    {
                        var file = directory.GetFileClient(item.Name);
                        var filePath = Path.Combine(assetsPath, file.Path);
                        if (!Directory.CreateDirectory(Path.GetDirectoryName(filePath)!).Exists) continue;

                        if ((await file.GetPropertiesAsync(cancellationToken)).Value.SmbProperties.FileCreatedOn!.Value > File.GetCreationTime(filePath).ToUniversalTime())
                        {
                            await using var stream = File.OpenWrite(filePath);
                            await (await file.DownloadAsync(cancellationToken: cancellationToken)).Value.Content.CopyToAsync(stream, cancellationToken);
                        }

                        if (Path.GetExtension(filePath) == gltfFileExtension)
                        {
                            gltfFilePath = filePath;
                        }
                    }
                }

                if (!string.IsNullOrEmpty(gltfFilePath))
                {
                    sceneBuilder.AddScene(SceneBuilder.Load(gltfFilePath), Matrix4x4.CreateTranslation(0, 0, 0));
                }
            }

            if (!sceneBuilder.Instances.Any())
            {
                throw new FileNotFoundException($"No 3D assets exists in directory '${directoryName}' on the server.");
            }

            var glbStream = new MemoryStream();
            sceneBuilder.ToGltf2().WriteGLB(glbStream);
            glbStream.Position = 0;
            return glbStream;
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            throw;
        }
    }
}
