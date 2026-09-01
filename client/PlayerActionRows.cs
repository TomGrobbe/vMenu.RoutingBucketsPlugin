using RoutingBucketsPlugin.Shared;

using System.Globalization;

using vMenu.Enhanced.ClientAPI;

namespace RoutingBucketsPlugin.Client;

public sealed class PlayerActionRows
{
    private readonly BucketClient _client;

    private readonly VMenuPlugin _plugin;

    private readonly PluginPlayerList _send;

    private int[] _sendIds = [];

    public PlayerActionRows(
        VMenuPlugin plugin,
        BucketClient client,
        PluginBoolSetting enabled,
        PluginBoolSetting allowSelfJoin)
    {
        _plugin = plugin;
        _client = client;

        var move = PluginGate.Permission(Permissions.Move) & PluginGate.Setting(enabled);
        var join = PluginGate.Permission(Permissions.Join) & PluginGate.Setting(enabled) & PluginGate.Setting(allowSelfJoin);

        plugin.PlayerActions.AddSeparator(Text.Key("rb.pa.header"));

        var bring = plugin.PlayerActions.AddButton(Text.Key("rb.pa.bring"));
        bring.Description = Text.Key("rb.pa.bring.desc");
        bring.Gate = move;
        bring.HideWhenLocked = true;
        bring.Selected += target => BucketClient.Send(BucketCommands.Bring, Id(target.ServerId));

        _send = plugin.PlayerActions.AddList(Text.Key("rb.pa.send"), [Text.Key("rb.players.none")]);
        _send.Description = Text.Key("rb.pa.send.desc");
        _send.Gate = move;
        _send.HideWhenLocked = true;
        _send.Selected += SendTo;

        var go = plugin.PlayerActions.AddButton(Text.Key("rb.pa.goto"));
        go.Description = Text.Key("rb.pa.goto.desc");
        go.Gate = join;
        go.HideWhenLocked = true;
        go.Selected += target => BucketClient.Send(BucketCommands.Goto, Id(target.ServerId));
    }

    public void SetWorlds(List<BucketRow> buckets)
    {
        var options = new List<Text>(buckets.Count);
        var ids = new int[buckets.Count];

        for (var index = 0; index < buckets.Count; index++)
        {
            var bucket = buckets[index];

            options.Add(bucket.IsManaged && bucket.Name.Length > 0
                ? Text.Literal(bucket.Name)
                : Text.Key("rb.world.unmanaged", ("id", Text.Literal(Id(bucket.Id)))));

            ids[index] = bucket.Id;
        }

        _sendIds = ids;

        var selected = Math.Clamp(_send.SelectedIndex, 0, Math.Max(ids.Length - 1, 0));

        _send.SetOptions(options, selected);
    }

    private void SendTo(PlayerTarget target, int index)
    {
        if (index < 0 || index >= _sendIds.Length)
        {
            _plugin.Notify(NotifyStyle.Warning, Text.Key("rb.pa.stale"));

            return;
        }

        BucketClient.Send(BucketCommands.Send, Id(target.ServerId), Id(_sendIds[index]));
    }

    private static string Id(int value) => value.ToString(CultureInfo.InvariantCulture);
}
