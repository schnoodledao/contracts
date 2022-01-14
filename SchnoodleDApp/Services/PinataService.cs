using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using SchnoodleDApp.Models;
using SchnoodleDApp.Models.Pinata;
using Scrutor.AspNetCore;

namespace SchnoodleDApp.Services
{
    public sealed class PinataService : ISelfScopedLifetime
    {
        private readonly PinataOptions _pinataOptions;

        public PinataService(IOptions<PinataOptions> pinataOptions)
        {
            _pinataOptions = pinataOptions.Value;
        }

        public async Task<PinToIpfsResponse> PinFile(Stream stream, string fileName, string contentType, CancellationToken cancellationToken)
        {
            using var streamContent = new StreamContent(stream)
            {
                Headers = { ContentLength = stream.Length, ContentType = new MediaTypeHeaderValue(contentType) }
            };

            using var formDataContent = new MultipartFormDataContent { { streamContent, "file", fileName } };

            using var client = GetClient();
            var response = await client.PostAsync("pinning/pinFileToIPFS", formDataContent, cancellationToken);
            response.EnsureSuccessStatusCode();
            return (await response.Content.ReadFromJsonAsync<PinToIpfsResponse>(cancellationToken: cancellationToken))!;
        }

        public async Task<PinToIpfsResponse> PinJson<T>(T json, CancellationToken cancellationToken)
        {
            using var client = GetClient();
            var response = await client.PostAsJsonAsync("pinning/pinJSONToIPFS", json, cancellationToken);
            response.EnsureSuccessStatusCode();
            return (await response.Content.ReadFromJsonAsync<PinToIpfsResponse>(cancellationToken: cancellationToken))!;
        }

        private HttpClient GetClient()
        {
            var client = new HttpClient { BaseAddress = new Uri(_pinataOptions.ApiUrl) };
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _pinataOptions.Jwt);
            return client;
        }
    }
}
