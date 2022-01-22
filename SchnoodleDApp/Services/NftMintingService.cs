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
    private readonly AssetService _assetService;
    private readonly FilePinningService _filePinningService;
    private readonly NftMintDbService _nftMintDbService;
    private readonly Web3 _web3;
    private readonly MoontronService _moontronService;

    public NftMintingService(IOptions<BlockchainOptions> blockchainOptions, AssetService assetService, FilePinningService filePinningService, NftMintDbService nftMintDbService)
    {
        _blockchainOptions = blockchainOptions.Value;
        _assetService = assetService;
        _filePinningService = filePinningService;
        _nftMintDbService = nftMintDbService;

        _web3 = new Web3(new Account(_blockchainOptions.PrivateKey, Chain.Rinkeby), _blockchainOptions.Web3Url);
        _moontronService = new MoontronService(_web3, _blockchainOptions.ContractAddress);
        ServiceAccount = new EthECKey(_blockchainOptions.PrivateKey.HexToByteArray(), true).GetPublicAddress();
        MintFee = _blockchainOptions.MintFee;
    }

    public string ServiceAccount { get; }

    public long MintFee { get; }

    public async Task<NftAssetItem> PrepareMintNft(string to, string paymentTxHash, CancellationToken cancellationToken = default)
    {
        // Validate the payment transaction.
        var transaction = await _web3.Eth.Transactions.GetTransactionByHash.SendRequestAsync(paymentTxHash);
        ValidateAddresses(transaction.To, ServiceAccount, $"Payment transaction recipient (${transaction.To}) does not match the service account (${ServiceAccount}).");
        ValidateAddresses(transaction.From, to, $"Payment transaction sender (${transaction.From}) does not match the address being minted to (${to}).");

        static void ValidateAddresses(string addressA, string addressB, string errorMessage)
        {
            if (string.Compare(addressA, addressB, StringComparison.InvariantCultureIgnoreCase) != 0) throw new InvalidOperationException(errorMessage);
        }

        var amount = (long)transaction.Value.Value;
        if (amount < _blockchainOptions.MintFee) throw new InvalidOperationException($"Payment transaction amount (${amount}) is less than the required fee to mint (${_blockchainOptions.MintFee}).");

        // Generate the NFT asset.
        await using var stream = await _assetService.Create3DAsset("Test", cancellationToken);
        var hash = await _filePinningService.CreateNftAsset(stream, "Test.glb", "model/gltf-binary", cancellationToken);

        var nftAssetItem = new NftAssetItem {Id = Guid.NewGuid().ToString(), To = to, AssetHash = hash};
        await _nftMintDbService.AddItemAsync(nftAssetItem);
        return nftAssetItem;
    }

    public async Task<string> MintNft(string id, Stream imageStream, CancellationToken cancellationToken = default)
    {
        using var mutex = new Mutex(false, id, out var createdNew);
        if (!createdNew) throw new InvalidOperationException($"Minting is already is progress for ID {id}.");

        var nftMintItem = await _nftMintDbService.GetItemAsync(id);
        var imageHash = await _filePinningService.CreateNftAsset(imageStream, "Preview.png", "image/png", cancellationToken);
        var metadataHash = await _filePinningService.CreateNftMetadata(imageHash, nftMintItem.AssetHash, "Test Name", "Test Description", cancellationToken);

        // Mint the NFT
        var mintTxHash = await _moontronService.MintIpfsRequestAsync(nftMintItem.To, metadataHash);

        // Delete the item from the database so it can no longer be minted against.
        await _nftMintDbService.DeleteItemAsync(id);

        return mintTxHash;
    }
}
