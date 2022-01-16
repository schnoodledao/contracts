namespace SchnoodleDApp.Models
{
    public class DataOptions
    {
        public const string SectionName = "Data";

        public string Account { get; set; } = string.Empty;

        public string Key { get; set; } = string.Empty;

        public string DatabaseName { get; set; } = string.Empty;

        public string ContainerName { get; set; } = string.Empty;
    }
}
