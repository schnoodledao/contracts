using Microsoft.AspNetCore.Mvc;
using SchnoodleDApp.Models;
using SchnoodleDApp.Services;

namespace SchnoodleDApp.Controllers;

[ApiController]
[Route("[controller]")]
public class NftController : ControllerBase
{
    private readonly ILogger<NftController> _logger;
    private readonly FilePinningService _filePinningService;
    private readonly AssetService _assetService;
    private readonly NftMintingService _nftMintingService;
    private static CancellationTokenSource s_cts = new();

    public NftController(ILogger<NftController> logger, FilePinningService filePinningService, AssetService assetService, NftMintingService nftMintingService)
    {
        _logger = logger;
        _filePinningService = filePinningService;
        _assetService = assetService;
        _nftMintingService = nftMintingService;
    }

    [HttpGet("gatewaybaseurl")]
    public ActionResult<string> GetGatewayBaseUrl()
    {
        return Ok(_filePinningService.GatewayBaseUrl);
    }

    [HttpGet("serviceaccount")]
    public ActionResult<string> GetServiceAccount()
    {
        return Ok(_nftMintingService.ServiceAccount);
    }

    [HttpGet("mintfee")]
    public ActionResult<long> GetMintFee()
    {
        return Ok(_nftMintingService.MintFee);
    }

    [HttpGet("assetconfigs")]
    public async Task<ActionResult<IReadOnlyDictionary<string, Dictionary<string, AssetConfig>>>> GetAssetConfigs()
    {
        return Ok(await _assetService.GetConfigs(s_cts.Token));
    }

    [HttpPost("generateasset")]
    [Route("generateasset/{assetName}/{configName}/{to}/{chainId:int}/{paymentTxHash}")]
    public async Task<ActionResult<NftAssetItem>> GenerateAsset(string assetName, string configName, [FromQuery] string[] components, string to, int chainId, string paymentTxHash)
    {
        try
        {
            Reset();
            return Ok(await _nftMintingService.GenerateAsset(assetName, configName, components, to, chainId, paymentTxHash, s_cts.Token));
        }
        catch (DirectoryNotFoundException e)
        {
            return NotFound(e);
        }
        catch (Exception e)
        {
            return BadRequest(e);
        }
    }

    [HttpPost("mint")]
    [Route("mint/{id}")]
    public async Task<IActionResult> Mint([FromForm] IFormFile image, string id)
    {
        try
        {
            Reset();
            return Ok(await _nftMintingService.Mint(id, image.OpenReadStream(), s_cts.Token));
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
