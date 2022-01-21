using Newtonsoft.Json;

namespace SchnoodleDApp.Models;

public class NftAssetItem
{
    [JsonProperty(PropertyName = "id")]
    public string Id { get; set; } = string.Empty;

    public string To { get; set; } = string.Empty;

    public string AssetHash { get; set; } = string.Empty;
}
