namespace SchnoodleDApp.Models;

public class BlockchainOptions
{
    public const string SectionName = "Blockchain";

    public string PrivateKey { get; set; } = string.Empty;

    public string Web3Url { get; set; } = string.Empty;

    public string ContractAddress { get; set; } = string.Empty;

    public long MintFee { get; set; }
}
