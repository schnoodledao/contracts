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
    private readonly NftMintingService _nftMintingService;
    private static CancellationTokenSource s_cts = new();

    public NftController(ILogger<NftController> logger, FilePinningService filePinningService, NftMintingService nftMintingService)
    {
        _logger = logger;
        _filePinningService = filePinningService;
        _nftMintingService = nftMintingService;
    }

    [HttpGet("serviceaccount")]
    public ActionResult<string> GetServiceAccount()
    {
        return Ok(_nftMintingService.ServiceAccount);
    }

    [HttpGet("gatewaybaseurl")]
    public ActionResult<string> GetGatewayBaseUrl()
    {
        return Ok(_filePinningService.GatewayBaseUrl);
    }

    [HttpGet("mintfee")]
    public ActionResult<long> GetMintFee()
    {
        return Ok(_nftMintingService.MintFee);
    }

    [HttpPost("generateasset")]
    [Route("generateasset/{to}/{paymentTxHash}")]
    public async Task<ActionResult<NftAssetItem>> GenerateAsset(string to, string paymentTxHash)
    {
        try
        {
            Reset();
            return Ok(await _nftMintingService.GenerateAsset(to, paymentTxHash, s_cts.Token));
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
