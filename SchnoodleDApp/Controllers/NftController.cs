using Microsoft.AspNetCore.Mvc;
using SchnoodleDApp.Models;
using SchnoodleDApp.Services;

namespace SchnoodleDApp.Controllers
{
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
            return Ok(_nftMintingService.GetServiceAccount());
        }

        [HttpPost("preparemint")]
        [Route("preparemint/{to}")]
        public async Task<ActionResult<NftMintItem>> PrepareMint(string to)
        {
            Reset();
            await using var fs = System.IO.File.Create(@"C:\Users\micro\OneDrive\Downloads\DarkSnood.jpg");
            var hash = await _filePinningService.CreateNftAsset(fs, "DarkSnood.jpg", "image/jpg", "Test Name", "Test Description", s_cts.Token);

            return Ok(await _nftMintingService.PrepareMintNft(to, hash));
        }

        [HttpPost("mint")]
        [Route("mint/{id}/{paymentTxHash}")]
        public async Task<IActionResult> Mint(string id, string paymentTxHash)
        {
            return Ok(await _nftMintingService.MintNft(id, paymentTxHash));
        }

        private static void Reset()
        {
            s_cts.Dispose();
            s_cts = new CancellationTokenSource();
        }
    }
}
