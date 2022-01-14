using Microsoft.Extensions.Options;
using Nethereum.Signer;
using Nethereum.Web3;
using Nethereum.Web3.Accounts;
using SchnoodleDApp.Contracts;
using SchnoodleDApp.Models;
using Scrutor.AspNetCore;

namespace SchnoodleDApp.Services
{
    public sealed class NftMintingService : ISelfScopedLifetime
    {
        private readonly BlockchainOptions _blockchainOptions;

        public NftMintingService(IOptions<BlockchainOptions> blockchainOptions)
        {
            _blockchainOptions = blockchainOptions.Value;
        }

        public async Task<string> MintNft(string to, string hash)
        {
            var moontron = new MoontronService(new Web3(new Account(_blockchainOptions.PrivateKey, Chain.Rinkeby), _blockchainOptions.Web3Url), "0x753b78eF4C1948e2F2c48e6fCF037173adD57Bd0");
            return await moontron.MintIpfsRequestAsync(to, hash);
        }
    }
}
