using SchnoodleDApp.Models;
using Scrutor.AspNetCore;

namespace SchnoodleDApp.Services;

public sealed class FilePinningService : ISelfScopedLifetime
{
    private readonly PinataService _pinataService;

    public FilePinningService(PinataService pinataService)
    {
        _pinataService = pinataService;
    }

    public string GatewayBaseUrl => _pinataService.GatewayBaseUrl;

    public async Task<string> CreateNftAsset(Stream stream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        return (await _pinataService.PinFile(stream, fileName, contentType, cancellationToken)).IpfsHash;
    }

    public async Task<string> CreateNftMetadata(string imageHash, string animationHash, string name, string description, CancellationToken cancellationToken)
    {
        // Upload the JSON metadata to IPFS.
        return (await _pinataService.PinJson(new NftAssetMetadata(name, description, CidToIpfsUri(imageHash), CidToIpfsUri(animationHash)), cancellationToken)).IpfsHash;

        static string CidToIpfsUri(string cid) => new UriBuilder("ipfs", cid).ToString();
    }
}
