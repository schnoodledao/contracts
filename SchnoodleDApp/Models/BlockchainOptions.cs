namespace SchnoodleDApp.Models;

public class BlockchainOptions
{
    public const string SectionName = "Blockchain";

    public string PrivateKey { get; set; } = String.Empty;

    public List<ChainOptions> Chains { get; } = new();

    public long NftMintFee { get; set; }

    public class ChainOptions
    {
        public int Id { get; set; }

        public string Web3Url { get; set; } = String.Empty;

        public string MoontronContractAddress { get; set; } = String.Empty;
    }
}
