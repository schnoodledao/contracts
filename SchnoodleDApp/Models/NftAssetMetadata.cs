using System.Text.Json.Serialization;

namespace SchnoodleDApp.Models;

public class NftAssetMetadata
{
    public NftAssetMetadata(string image, string name, string description)
    {
        Image = image;
        Name = name;
        Description = description;
    }

    [JsonPropertyName("image")]
    public string Image { get; }

    [JsonPropertyName("name")]
    public string Name { get; }

    [JsonPropertyName("description")]
    public string Description { get; }
}
