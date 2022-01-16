using System.Net;
using Microsoft.Azure.Cosmos;
using SchnoodleDApp.Models;

namespace SchnoodleDApp.Services
{
    public class NftMintDbService
    {
        private readonly Container _container;

        public NftMintDbService(Container container)
        {
            _container = container;
        }

        public async Task AddItemAsync(NftMintItem item) => await _container.CreateItemAsync(item);

        public async Task DeleteItemAsync(string id) => await _container.DeleteItemAsync<NftMintItem>(id, new PartitionKey(id));

        public async Task UpdateItemAsync(NftMintItem item) => await _container.UpsertItemAsync(item);

        public async Task<NftMintItem?> GetItemAsync(string id)
        {
            try
            {
                return (await _container.ReadItemAsync<NftMintItem>(id, new PartitionKey(id))).Resource;
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                return null;
            }
        }

        public async Task<IEnumerable<NftMintItem>> GetItemsAsync(string queryString)
        {
            var query = _container.GetItemQueryIterator<NftMintItem>(new QueryDefinition(queryString));
            List<NftMintItem> results = new();

            while (query.HasMoreResults)
            {
                results.AddRange((await query.ReadNextAsync()).AsEnumerable());
            }

            return results;
        }
    }
}
