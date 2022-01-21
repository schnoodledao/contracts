using System.Text.Json.Serialization;

namespace SchnoodleDApp.Models;

public class NftAssetMetadata
{
    public NftAssetMetadata(string name, string description, string image, string animationUrl)
    {
        Name = name;
        Description = description;
        Image = image;
        AnimationUrl = animationUrl;
    }

    [JsonPropertyName("image")]
    public string Image { get; }

    [JsonPropertyName("name")]
    public string Name { get; }

    [JsonPropertyName("description")]
    public string Description { get; }

    [JsonPropertyName("animation_url")]
    public string AnimationUrl { get; }
}
