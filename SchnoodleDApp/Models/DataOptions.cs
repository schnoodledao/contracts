namespace SchnoodleDApp.Models;

public class DataOptions
{
    public const string SectionName = "Data";

    public string Account { get; set; } = String.Empty;

    public string Key { get; set; } = String.Empty;

    public string DatabaseName { get; set; } = String.Empty;

    public string ContainerName { get; set; } = String.Empty;
}
