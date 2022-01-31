using System.Numerics;
using System.Text.Json;
using Azure.Storage.Files.Shares;
using Microsoft.Extensions.Options;
using SchnoodleDApp.Exceptions;
using SchnoodleDApp.Extensions;
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

    public async Task<IReadOnlyDictionary<string, Dictionary<string, AssetConfig>>> GetConfigs(CancellationToken cancellationToken = default)
    {
        var configs = new Dictionary<string, Dictionary<string, AssetConfig>>();
        var rootDirectory = GetClient().GetRootDirectoryClient();

        // Go through all the directories in the root directory and find all asset configs.
        await foreach (var rootItem in rootDirectory.GetFilesAndDirectoriesAsync(cancellationToken: cancellationToken))
        {
            await using var stream = new MemoryStream();
            await (await rootDirectory.GetSubdirectoryClient(rootItem.Name).GetFileClient("config.json").DownloadAsync(cancellationToken: cancellationToken)).Value.Content.CopyToAsync(stream, cancellationToken);
            stream.Position = 0;
            configs.Add(rootItem.Name, (await JsonSerializer.DeserializeAsync<Dictionary<string, AssetConfig>>(stream, cancellationToken: cancellationToken))!);
        }

        return configs;
    }

    public async Task<Stream> Create3DAsset(string assetName, string configName, IEnumerable<string> components, CancellationToken cancellationToken = default)
    {
        var componentArray = components.ToArrayOrCast();
        var config = (await GetConfigs(cancellationToken))[assetName][configName];

        // Validate the specified components against config to prevent a scene being built with incompatible components.
        var invalidComponents = componentArray.Except(config.Optional).ToArray();
        if (invalidComponents.Any())
        {
            throw new ComponentsNotFoundException($"Invalid components specified for asset ${assetName} and config ${configName}.", invalidComponents);
        }

        // Retrieve the asset directory in the root that contains all the assets to build the scene.
        var assetDirectory = GetClient().GetDirectoryClient(assetName);

        if (!await assetDirectory.ExistsAsync(cancellationToken))
        {
            throw new DirectoryNotFoundException($"The asset '{assetName}' could not be found.");
        }

        var sceneBuilder = new SceneBuilder();

        foreach (var component in componentArray.Concat(config.Required))
        {
            // Retrieve the component directory that contains one of the assets to add to the overall scene.
            var componentDirectory = assetDirectory.GetSubdirectoryClient(component);

            if (!await componentDirectory.ExistsAsync(cancellationToken))
            {
                throw new DirectoryNotFoundException($"The component '{component}' could not be found.");
            }

            // This is the local path where all assets will be stored for loading the scene later.
            var assetsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Assets");
            const string gltfFileExtension = ".gltf";
            await BuildSceneFromDirectory(componentDirectory);

            // Recursively called function for finding all scenes (glTFs) within the asset directory to add to the overall scene.
            async Task BuildSceneFromDirectory(ShareDirectoryClient directory)
            {
                var gltfFilePath = String.Empty;
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

                if (!String.IsNullOrEmpty(gltfFilePath))
                {
                    sceneBuilder.AddScene(SceneBuilder.Load(gltfFilePath), Matrix4x4.Identity);
                }
            }
        }

        if (!sceneBuilder.Instances.Any())
        {
            throw new FileNotFoundException($"No 3D assets found for '${String.Join(',', componentArray)}' on the server.");
        }

        var glbStream = new MemoryStream();
        sceneBuilder.ToGltf2().WriteGLB(glbStream);
        glbStream.Position = 0;
        return glbStream;
    }

    private ShareClient GetClient()
    {
        return new ShareClient($"DefaultEndpointsProtocol=https;AccountName={_filesOptions.AccountName};AccountKey={_filesOptions.Key};EndpointSuffix=core.windows.net", "assets");
    }
}
