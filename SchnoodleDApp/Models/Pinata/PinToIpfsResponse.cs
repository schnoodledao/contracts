namespace SchnoodleDApp.Models.Pinata;

public class PinToIpfsResponse
{
    public PinToIpfsResponse(string ipfsHash, int pinSize, DateTime timestamp)
    {
        IpfsHash = ipfsHash;
        PinSize = pinSize;
        Timestamp = timestamp;
    }

    public string IpfsHash { get; }

    public int PinSize { get; }

    public DateTime Timestamp { get; }
}
