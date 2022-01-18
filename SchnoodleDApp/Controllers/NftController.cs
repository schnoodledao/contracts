using Microsoft.AspNetCore.Mvc;
using SchnoodleDApp.Models;
using SchnoodleDApp.Services;

namespace SchnoodleDApp.Controllers;

[ApiController]
[Route("[controller]")]
public class NftController : ControllerBase
{
    private readonly ILogger<NftController> _logger;
    private readonly AssetService _assetService;
    private readonly FilePinningService _filePinningService;
    private readonly NftMintingService _nftMintingService;
    private static CancellationTokenSource s_cts = new();

    public NftController(ILogger<NftController> logger, AssetService assetService, FilePinningService filePinningService, NftMintingService nftMintingService)
    {
        _logger = logger;
        _assetService = assetService;
        _filePinningService = filePinningService;
        _nftMintingService = nftMintingService;
    }

    [HttpGet("serviceaccount")]
    public ActionResult<string> GetServiceAccount()
    {
        return Ok(_nftMintingService.GetServiceAccount());
    }

    [HttpPost("preparemint")]
    [Route("preparemint/{to}")]
    public async Task<ActionResult<NftMintItem>> PrepareMint(string to)
    {
        try
        {
            Reset();
            await using var stream = await _assetService.Create3DAsset("Test");
            var hash = await _filePinningService.CreateNftAsset(stream, "Test.glb", "model/gltf-binary", "Test Name", "Test Description", s_cts.Token);

            return Ok(await _nftMintingService.PrepareMintNft(to, hash));
        }
        catch (Exception e)
        {
            return BadRequest(e);
        }
    }

    [HttpPost("mint")]
    [Route("mint/{id}/{paymentTxHash}")]
    public async Task<IActionResult> Mint(string id, string paymentTxHash)
    {
        try
        {
            return Ok(await _nftMintingService.MintNft(id, paymentTxHash));
        }
        catch (Exception e)
        {
            return BadRequest(e);
        }
    }

    private static void Reset()
    {
        s_cts.Dispose();
        s_cts = new CancellationTokenSource();
    }
}
