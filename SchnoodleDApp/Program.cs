using Microsoft.Azure.Cosmos;
using SchnoodleDApp.Models;
using SchnoodleDApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllersWithViews();

builder.Services.Configure<PinataOptions>(builder.Configuration.GetSection(PinataOptions.SectionName));
builder.Services.Configure<BlockchainOptions>(builder.Configuration.GetSection(BlockchainOptions.SectionName));
builder.Services.Configure<DataOptions>(builder.Configuration.GetSection(DataOptions.SectionName));

builder.Services.AddSingleton(InitializeCosmosClientInstance(builder.Configuration.GetSection(DataOptions.SectionName)).GetAwaiter().GetResult());
builder.Services.AddAdvancedDependencyInjection();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAdvancedDependencyInjection();


app.MapControllerRoute("default", "{controller}/{action=Index}/{id?}");

app.MapFallbackToFile("index.html");

app.Run();

static async Task<NftMintDbService> InitializeCosmosClientInstance(IConfiguration configurationSection)
{
    var options = new DataOptions();
    configurationSection.Bind(options);

    var client = new CosmosClient(options.Account, options.Key);
    var database = await client.CreateDatabaseIfNotExistsAsync(options.DatabaseName);
    await database.Database.CreateContainerIfNotExistsAsync(options.ContainerName, "/id");

    return new NftMintDbService(client.GetContainer(options.DatabaseName, options.ContainerName));
}
