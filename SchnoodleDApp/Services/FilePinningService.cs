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

    public async Task<string> CreateNftAsset(Stream stream, string fileName, string contentType, string name, string description, CancellationToken cancellationToken)
    {
        // Upload the file asset and JSON metadata to IPFS.
        var pinFileResponse = await _pinataService.PinFile(stream, fileName, contentType, cancellationToken);
        var pinJsonResponse = await _pinataService.PinJson(new NftAssetMetadata(CidToIpfsUri(pinFileResponse.IpfsHash), name, description), cancellationToken);
        return pinJsonResponse.IpfsHash;

        static string CidToIpfsUri(string cid) => new UriBuilder("ipfs", cid).ToString();
    }
}
