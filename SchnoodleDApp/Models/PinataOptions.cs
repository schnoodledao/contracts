namespace SchnoodleDApp.Models;

public class PinataOptions
{
    public const string SectionName = "Pinata";

    public string ApiBaseUrl { get; set; } = string.Empty;

    public string GatewayBaseUrl { get; set; } = string.Empty;

    public string Jwt { get; set; } = string.Empty;
}
