using Microsoft.Azure.Cosmos;
using SchnoodleDApp.Models;

namespace SchnoodleDApp.Services;

public class NftMintDbService
{
    private readonly Container _container;

    public NftMintDbService(Container container)
    {
        _container = container;
    }

    public async Task AddItemAsync(NftAssetItem item) => await _container.CreateItemAsync(item);

    public async Task DeleteItemAsync(string id) => await _container.DeleteItemAsync<NftAssetItem>(id, new PartitionKey(id));

    public async Task UpdateItemAsync(NftAssetItem item) => await _container.UpsertItemAsync(item);

    public async Task<NftAssetItem> GetItemAsync(string id) => (await _container.ReadItemAsync<NftAssetItem>(id, new PartitionKey(id))).Resource;

    public async Task<IEnumerable<NftAssetItem>> GetItemsAsync(string queryString)
    {
        var query = _container.GetItemQueryIterator<NftAssetItem>(new QueryDefinition(queryString));
        List<NftAssetItem> results = new();

        while (query.HasMoreResults)
        {
            results.AddRange((await query.ReadNextAsync()).AsEnumerable());
        }

        return results;
    }
}
