using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Signer;
using Nethereum.Web3;
using Nethereum.Web3.Accounts;
using SchnoodleDApp.Contracts;
using SchnoodleDApp.Models;
using Scrutor.AspNetCore;

namespace SchnoodleDApp.Services;

public sealed class NftMintingService : ISelfScopedLifetime
{
    private readonly BlockchainOptions _blockchainOptions;
    private readonly NftMintDbService _nftMintDbService;
    private readonly Web3 _web3;
    private readonly MoontronService _moontronService;

    private static readonly ConcurrentDictionary<string, Mutex> MintingIds = new();

    public NftMintingService(IOptions<BlockchainOptions> blockchainOptions, NftMintDbService nftMintDbService)
    {
        _blockchainOptions = blockchainOptions.Value;
        _nftMintDbService = nftMintDbService;
        _web3 = new Web3(new Account(_blockchainOptions.PrivateKey, Chain.Rinkeby), _blockchainOptions.Web3Url);
        _moontronService = new MoontronService(_web3, _blockchainOptions.ContractAddress);
    }

    public string GetServiceAccount()
    {
        return new EthECKey(_blockchainOptions.PrivateKey.HexToByteArray(), true).GetPublicAddress();
    }

    public async Task<NftMintItem> PrepareMintNft(string to, string hash)
    {
        var gas = (long)(await _moontronService.ContractHandler.EstimateGasAsync(new MintIpfsFunction {To = to, Hash = hash})).Value;
        var gasPrice = (long)(await _web3.Eth.GasPrice.SendRequestAsync()).Value;
        var nftMintItem = new NftMintItem {To = to, IpfsHash = hash, Gas = gas, GasPrice = gasPrice, Id = Guid.NewGuid().ToString()};
        await _nftMintDbService.AddItemAsync(nftMintItem);
        return nftMintItem;
    }

    public async Task<string> MintNft(string id, string paymentTxHash)
    {
        var idMutex = MintingIds.GetOrAdd(id, _ => new Mutex());
        idMutex.WaitOne();

        try
        {
            Thread.Sleep(10000);
            var nftMintItem = await _nftMintDbService.GetItemAsync(id);
            var transaction = await _web3.Eth.Transactions.GetTransactionByHash.SendRequestAsync(paymentTxHash);

            if (transaction.From != nftMintItem.To)
            {
                throw new InvalidOperationException($"Payment transaction sender (${transaction.From}) does not match the address being minted to (${nftMintItem.To}).");
            }

            var amount = (long)transaction.Value.Value;
            var fee = nftMintItem.Gas * nftMintItem.GasPrice;
            if (amount < fee)
            {
                throw new InvalidOperationException($"Payment transaction amount (${amount}) is less than the required fee to mint (${fee}).");
            }

            var mintTxHash = await _moontronService.MintIpfsRequestAsync(nftMintItem.To, nftMintItem.IpfsHash);

            // Delete the item from the database so it can no longer be minted against.
            await _nftMintDbService.DeleteItemAsync(id);

            return mintTxHash;
        }
        finally
        {
            if (MintingIds.TryRemove(id, out var mutex))
            {
                mutex.ReleaseMutex();
            }
        }
    }
}
