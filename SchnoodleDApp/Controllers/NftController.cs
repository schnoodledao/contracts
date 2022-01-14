using Microsoft.AspNetCore.Mvc;
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

        [HttpPost("mint")]
        [Route("mint/{to}")]
        public async Task<IActionResult> Mint(string to)
        {
            Reset();
            await using var fs = System.IO.File.Create(@"C:\Snood.jpg");
            var hash = await _filePinningService.CreateNftAsset(fs, "Snood.jpg", "image/jpg", "Test Name", "Test Description", s_cts.Token);
            await _nftMintingService.MintNft(to, hash);

            return Ok();
        }

        private static void Reset()
        {
            s_cts.Dispose();
            s_cts = new CancellationTokenSource();
        }
    }
}
