using Nethereum.Signer;

namespace SchnoodleDApp.Models;

public class BlockchainOptions
{
    public const string SectionName = "Blockchain";

    public string PrivateKey { get; set; } = String.Empty;

    public Chain Chain { get; set; }

    public string Web3Url { get; set; } = String.Empty;

    public string MoontronContractAddress { get; set; } = String.Empty;

    public long MintFee { get; set; }
}
