namespace SchnoodleDApp.Models;

public class PinataOptions
{
    public const string SectionName = "Pinata";

    public string ApiBaseUrl { get; set; } = String.Empty;

    public string GatewayBaseUrl { get; set; } = String.Empty;

    public string Jwt { get; set; } = String.Empty;
}
