using Newtonsoft.Json;

namespace SchnoodleDApp.Models;

public class NftMintItem
{
    [JsonProperty(PropertyName = "id")]
    public string Id { get; set; } = string.Empty;

    public string To { get; set; } = string.Empty;

    public string IpfsHash { get; set; } = string.Empty;

    public long Gas { get; set; }

    public long GasPrice { get; set; }
}
