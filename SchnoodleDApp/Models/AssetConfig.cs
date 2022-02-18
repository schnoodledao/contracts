namespace SchnoodleDApp.Models;

public class AssetConfig
{
    public ICollection<string> Required { get; set; } = null!;

    public ICollection<string> Optional { get; set; } = null!;
}
