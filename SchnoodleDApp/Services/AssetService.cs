using Azure.Storage.Files.Shares;
using Microsoft.Extensions.Options;
using SchnoodleDApp.Models;
using Scrutor.AspNetCore;
using SharpGLTF.Schema2;

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

            var tempPath = Path.GetTempPath();
            const string gltfFileExtension = ".gltf";
            var mainFilePath = await DownloadFiles(mainDirectory);

            async Task<string?> DownloadFiles(ShareDirectoryClient directory)
            {
                string? gltfFilePath = null;
                await foreach (var item in directory.GetFilesAndDirectoriesAsync(cancellationToken: cancellationToken))
                {
                    if (item.IsDirectory)
                    {
                        gltfFilePath = await DownloadFiles(directory.GetSubdirectoryClient(item.Name)) ?? gltfFilePath;
                    }
                    else
                    {
                        var file = directory.GetFileClient(item.Name);
                        var localFilePath = Path.Combine(tempPath, file.Path);
                        Directory.CreateDirectory(Path.GetDirectoryName(localFilePath)!);

                        await using var stream = File.OpenWrite(localFilePath);
                        await (await file.DownloadAsync(cancellationToken: cancellationToken)).Value.Content.CopyToAsync(stream, cancellationToken);

                        if (Path.GetExtension(localFilePath) == gltfFileExtension)
                        {
                            gltfFilePath = localFilePath;
                        }
                    }
                }

                return gltfFilePath;
            }

            if (mainFilePath is null)
            {
                throw new FileNotFoundException($"No file with extension '{gltfFileExtension}' exists in the directory.");
            }

            var model = ModelRoot.Load(mainFilePath);
            var glbStream = new MemoryStream();
            model.WriteGLB(glbStream);
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
