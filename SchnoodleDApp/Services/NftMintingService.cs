using Microsoft.Extensions.Options;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.JsonRpc.WebSocketClient;
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
    private readonly AssetService _assetService;
    private readonly FilePinningService _filePinningService;
    private readonly NftMintDbService _nftMintDbService;

    public NftMintingService(IOptions<BlockchainOptions> blockchainOptions, AssetService assetService, FilePinningService filePinningService, NftMintDbService nftMintDbService)
    {
        _blockchainOptions = blockchainOptions.Value;
        _assetService = assetService;
        _filePinningService = filePinningService;
        _nftMintDbService = nftMintDbService;

        ServiceAccount = new EthECKey(_blockchainOptions.PrivateKey.HexToByteArray(), true).GetPublicAddress();
        MintFee = _blockchainOptions.NftMintFee;
    }

    public string ServiceAccount { get; }

    public long MintFee { get; }

    public async Task<NftAssetItem> GenerateAsset(string assetName, string configName, IEnumerable<string> components, string to, int chainId, string paymentTxHash, CancellationToken cancellationToken = default)
    {
        // Validate the payment transaction.
        var transaction = await GetChainResult(chainId, async w => await w.Eth.Transactions.GetTransactionByHash.SendRequestAsync(paymentTxHash));
        ValidateAddresses(transaction.To, ServiceAccount, $"Payment transaction recipient (${transaction.To}) does not match the service account (${ServiceAccount}).");
        ValidateAddresses(transaction.From, to, $"Payment transaction sender (${transaction.From}) does not match the address being minted to (${to}).");

        static void ValidateAddresses(string addressA, string addressB, string errorMessage)
        {
            if (String.Compare(addressA, addressB, StringComparison.InvariantCultureIgnoreCase) != 0) throw new InvalidOperationException(errorMessage);
        }

        var amount = (long)transaction.Value.Value;
        if (amount < _blockchainOptions.NftMintFee) throw new InvalidOperationException($"Payment transaction amount (${amount}) is less than the required fee to mint (${_blockchainOptions.NftMintFee}).");

        // Generate the NFT asset.
        await using var stream = await _assetService.Create3DAsset(assetName, configName, components, cancellationToken);
        var hash = await _filePinningService.CreateNftAsset(stream, $"{assetName}.glb", "model/gltf-binary", cancellationToken);

        var nftAssetItem = new NftAssetItem { Id = Guid.NewGuid().ToString(), ChainId = chainId, To = to, AssetHash = hash };
        await _nftMintDbService.AddItemAsync(nftAssetItem);
        return nftAssetItem;
    }

    public async Task<string> Mint(string id, Stream imageStream, CancellationToken cancellationToken = default)
    {
        using var mutex = new Mutex(false, id, out var createdNew);
        if (!createdNew) throw new InvalidOperationException($"Minting is already in progress for ID {id}.");

        var nftMintItem = await _nftMintDbService.GetItemAsync(id);
        var imageHash = await _filePinningService.CreateNftAsset(imageStream, "Preview.png", "image/png", cancellationToken);
        var metadataHash = await _filePinningService.CreateNftMetadata(imageHash, nftMintItem.AssetHash, "Krypto", "This is Krypto, Schnoodle's venerable mascot.", cancellationToken);

        // Mint the NFT.
        var chainOptions = _blockchainOptions.Chains.Single(c => c.Id == nftMintItem.ChainId);
        var mintTxHash = await GetChainResult(chainOptions, async w => await (new MoontronService(w, chainOptions.MoontronContractAddress)).SafeMintRequestAsync(nftMintItem.To, metadataHash));

        // Delete the item from the database so it can no longer be minted against.
        await _nftMintDbService.DeleteItemAsync(id);

        return mintTxHash;
    }

    private async Task<T> GetChainResult<T>(int chainId, Func<Web3, Task<T>> func)
    {
        return await GetChainResult<T>(_blockchainOptions.Chains.Single(c => c.Id == chainId), func);
    }

    private async Task<T> GetChainResult<T>(BlockchainOptions.ChainOptions chainOptions, Func<Web3, Task<T>> resultFactory)
    {
        var web3Uri = new Uri(chainOptions.Web3Url);
        var account = new Account(_blockchainOptions.PrivateKey, chainOptions.Id);

        if (web3Uri.Scheme == Uri.UriSchemeHttp || web3Uri.Scheme == Uri.UriSchemeHttps)
        {
            return await getWeb3Result(new Web3(account, web3Uri.ToString()));
        }
        else if (web3Uri.Scheme == Uri.UriSchemeWss)
        {
            using var client = new WebSocketClient(chainOptions.Web3Url);
            return await getWeb3Result(new Web3(account, client));
        }
        else
        {
            throw new ArgumentOutOfRangeException(nameof(chainOptions), chainOptions, $"Scheme {web3Uri.Scheme} in chain options not supported.");
        }

        async Task<T> getWeb3Result(Web3 web3)
        {
            // Possible issue with EIP-1559. See: https://discord.com/channels/765580668327034880/765580668327034886/945867847513554994
            if (chainOptions.Id == (int)Chain.Private)
            {
                web3.TransactionManager.UseLegacyAsDefault = true;
            }

            return await resultFactory(web3);
        }
    }
}
