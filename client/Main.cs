using CitizenFX.FiveM.Client;
using CitizenFX.FiveM.Shared.Script;

using RoutingBucketsPlugin.Shared;

using vMenu.Enhanced.ClientAPI;

namespace RoutingBucketsPlugin.Client;

public sealed class Main : IScript
{
    private VMenuPlugin? _plugin;

    private BucketClient? _client;

    private BucketMenu? _menu;

    private PlayerActionRows? _actions;

    public async void Initialize()
    {
        var plugin = VMenuPlugin.Create(Text.Key("rb.name"));

        _plugin = plugin;
        plugin.DescriptionKey = "rb.description";

        Translations.Add(plugin);

        plugin.RootMenu.Subtitle = Text.Key("rb.subtitle");

        var enabled = plugin.Settings.Bool(
            SettingNames.Enabled,
            true,
            "Turns the Routing Buckets plugin on or off.");

        var allowSelfJoin = plugin.Settings.Bool(
            SettingNames.AllowSelfJoin,
            true,
            "Lets staff move themselves between worlds.");

        var client = new BucketClient();
        _client = client;

        client.Register();

        var tools = new WorldTools();
        tools.Start();

        _menu = new BucketMenu(plugin, client, enabled, allowSelfJoin, tools);

        _actions = new PlayerActionRows(plugin, client, enabled, allowSelfJoin);

        client.StateChanged += OnState;
        client.ResultReceived += OnResult;
        client.Moved += OnMoved;

        plugin.RootMenu.Opened += BucketClient.RequestState;

        plugin.RegistrationAnswered += _ => BucketClient.RequestState();

        var result = await plugin.ConnectAsync();

        API.Log.Debug($"[RoutingBuckets] Registered with vMenu: {result.Accepted}.");

        BucketClient.RequestState();
    }

    private void OnState(int viewerBucket, List<BucketRow> buckets, List<OccupantRow> occupants)
    {
        _menu?.Apply(viewerBucket, buckets, occupants);
        _actions?.SetWorlds(buckets);
    }

    private void OnMoved(string fromName, string toName, string actor)
    {
        if (_plugin is not { } plugin)
        {
            return;
        }

        var message = actor.Length == 0
            ? Text.Key("rb.moved.self", ("from", Text.Literal(fromName)), ("to", Text.Literal(toName)))
            : Text.Key(
                "rb.moved.other",
                ("actor", Text.Literal(actor)),
                ("from", Text.Literal(fromName)),
                ("to", Text.Literal(toName)));

        plugin.Notify(NotifyStyle.Info, message);
    }

    private void OnResult(int outcome, string detail)
    {
        if (_plugin is not { } plugin)
        {
            return;
        }

        if (outcome == BucketOutcome.Ok)
        {
            if (detail.Length == 0)
            {
                return;
            }

            if (Announcement(detail) is { } message)
            {
                plugin.Notify(NotifyStyle.Success, message);
            }

            return;
        }

        _menu?.CancelReopen();

        var style = outcome is BucketOutcome.SaveFailed or BucketOutcome.RateLimited
            ? NotifyStyle.Warning
            : NotifyStyle.Error;

        plugin.Notify(style, Text.Key(Key(outcome)));
    }

    private static Text? Announcement(string detail)
    {
        var parts = ResultDetails.Unpack(detail);

        return parts switch
        {
            [ResultDetails.Created, var name, var id] => Text.Key(
                "rb.created",
                ("name", Text.Literal(name)),
                ("id", Text.Literal(id))),
            [ResultDetails.Renamed, var name] => Text.Key("rb.renamed", ("name", Text.Literal(name))),
            [ResultDetails.Evicted, var count] => Text.Key("rb.evicted", ("count", Text.Literal(count))),
            [ResultDetails.MovedEntity, var world] => Text.Key("rb.movedentity", ("world", Text.Literal(world))),
            [ResultDetails.MovedNearby, var count, var world] => Text.Key(
                "rb.movednearby",
                ("count", Text.Literal(count)),
                ("world", Text.Literal(world))),
            _ => (Text?)null,
        };
    }

    private static string Key(int outcome) =>
        outcome is >= 0 and < BucketOutcome.Count ? "rb.result." + outcome : "rb.result." + BucketOutcome.Failed;
}
