using Newtonsoft.Json;

namespace SchnoodleDApp.Models;

public class NftAssetItem
{
    [JsonProperty(PropertyName = "id")]
    public string Id { get; set; } = String.Empty;

    public string To { get; set; } = String.Empty;

    public string AssetHash { get; set; } = String.Empty;
}
