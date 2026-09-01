using RoutingBucketsPlugin.Shared;

using System.Globalization;

using vMenu.Enhanced.ClientAPI;

namespace RoutingBucketsPlugin.Client;

public sealed class BucketMenu(
    VMenuPlugin plugin,
    BucketClient client,
    PluginBoolSetting enabled,
    PluginBoolSetting allowSelfJoin,
    WorldTools tools)
{

    private const int RowBudget = 1800;

    private const int MaxOccupantRows = 20;

    private readonly VMenuPlugin _plugin = plugin;

    private readonly BucketClient _client = client;

    private readonly PluginBoolSetting _enabled = enabled;

    private readonly PluginBoolSetting _allowSelfJoin = allowSelfJoin;

    private readonly WorldTools _tools = tools;

    private PluginList? _entityDestination;

    private PluginList? _nearbyDestination;

    private PluginList? _radius;

    private PluginCheckbox? _includeSelf;

    private int[] _destinationIds = [];

    private bool _reopenRoot;

    private readonly Dictionary<int, WorldRows> _worlds = [];

    private PluginButton? _current;

    private PluginButton? _leave;

    private List<int> _shape = [];

    private int _viewerBucket;

    private PluginGate ViewGate => PluginGate.Permission(Permissions.View) & PluginGate.Setting(_enabled);

    private PluginGate JoinGate =>
        PluginGate.Permission(Permissions.Join) & PluginGate.Setting(_enabled) & PluginGate.Setting(_allowSelfJoin);

    private PluginGate ManageGate => PluginGate.Permission(Permissions.Manage) & PluginGate.Setting(_enabled);

    private PluginGate WorldGate => PluginGate.Permission(Permissions.World) & PluginGate.Setting(_enabled);

    private PluginGate MoveGate => PluginGate.Permission(Permissions.Move) & PluginGate.Setting(_enabled);

    public void Apply(int viewerBucket, List<BucketRow> buckets, List<OccupantRow> occupants)
    {
        _viewerBucket = viewerBucket;

        var shape = new List<int>(buckets.Count);

        foreach (var bucket in buckets)
        {
            shape.Add(bucket.Id);
        }

        using (_plugin.BeginBatch())
        {
            if (!SameShape(shape))
            {
                _shape = shape;

                Rebuild(buckets);
            }

            Refresh(buckets, occupants);
        }
    }

    private bool SameShape(List<int> shape)
    {
        if (shape.Count != _shape.Count)
        {
            return false;
        }

        for (var index = 0; index < shape.Count; index++)
        {
            if (shape[index] != _shape[index])
            {
                return false;
            }
        }

        return true;
    }

    private void Rebuild(List<BucketRow> buckets)
    {
        _plugin.RootMenu.Clear();
        _worlds.Clear();

        var budget = RowBudget;
        var root = _plugin.RootMenu;

        root.AddSeparator(Text.Key("rb.section.you"));

        _current = root.AddButton(Text.Literal(string.Empty));
        _current.Description = Text.Key("rb.current.desc");
        _current.Gate = ViewGate;
        _current.HideWhenLocked = true;

        _leave = root.AddButton(Text.Key("rb.leave"));
        _leave.Description = Text.Key("rb.leave.desc");
        _leave.Gate = JoinGate;
        _leave.HideWhenLocked = true;
        _leave.Selected += () => BucketClient.Send(BucketCommands.Leave);

        root.AddSeparator(Text.Key("rb.section.worlds"));

        var skipped = 0;

        foreach (var bucket in buckets)
        {
            var cost = 11 + Math.Min(bucket.Occupants, MaxOccupantRows);

            if (budget - cost < 0)
            {
                skipped++;

                continue;
            }

            budget -= cost;

            _worlds[bucket.Id] = BuildWorld(bucket);
        }

        if (skipped > 0)
        {
            var note = root.AddButton(Text.Literal($"{skipped} more world(s) not shown"));
            note.Description = Text.Literal(
                "There are more worlds than this menu can hold. Lower MaxWorlds or delete some.");
            note.Enabled = false;
        }

        BuildTools(root);

        root.AddSeparator(Text.Key("rb.section.manage"));

        var create = root.AddButton(Text.Key("rb.create"));
        create.Description = Text.Key("rb.create.desc");
        create.Gate = ManageGate;
        create.HideWhenLocked = true;
        create.Selected += () => _ = CreateAsync();
    }

    private void BuildTools(PluginMenu root)
    {
        root.AddSeparator(Text.Key("rb.section.tools"));

        var entity = root.AddSubmenu(Text.Key("rb.entity"), subtitle: Text.Key("rb.subtitle"));
        entity.Description = Text.Key("rb.entity.desc");
        entity.Gate = MoveGate;
        entity.HideWhenLocked = true;

        var selectRow = entity.Menu.AddButton(Text.Key("rb.entity.select"));
        selectRow.Description = Text.Key("rb.entity.select.desc");
        selectRow.Selected += () => _plugin.Notify(
            _tools.SelectLookedAt() ? NotifyStyle.Success : NotifyStyle.Warning,
            Text.Key(_tools.HasSelection ? "rb.entity.selected" : "rb.entity.none"));

        var clearRow = entity.Menu.AddButton(Text.Key("rb.entity.clear"));
        clearRow.Description = Text.Key("rb.entity.clear.desc");
        clearRow.Selected += () =>
        {
            _tools.Clear();
            _plugin.Notify(NotifyStyle.Info, Text.Key("rb.entity.cleared"));
        };

        _entityDestination = entity.Menu.AddList(Text.Key("rb.entity.move"), [Text.Key("rb.players.none")]);
        _entityDestination.Description = Text.Key("rb.entity.move.desc");
        _entityDestination.Selected += index => MoveSelection(index);

        var nearby = root.AddSubmenu(Text.Key("rb.nearby"), subtitle: Text.Key("rb.subtitle"));
        nearby.Description = Text.Key("rb.nearby.desc");
        nearby.Gate = MoveGate;
        nearby.HideWhenLocked = true;

        var options = new List<Text>(BucketRules.Radii.Length);

        foreach (var metres in BucketRules.Radii)
        {
            options.Add(Text.Key("rb.nearby.metres", ("metres", Text.Literal(Id(metres)))));
        }

        _radius = nearby.Menu.AddList(Text.Key("rb.nearby.radius"), options);
        _radius.Description = Text.Key("rb.nearby.radius.desc");

        _nearbyDestination = nearby.Menu.AddList(Text.Key("rb.nearby.destination"), [Text.Key("rb.players.none")]);
        _nearbyDestination.Description = Text.Key("rb.nearby.destination.desc");

        _includeSelf = nearby.Menu.AddCheckbox(
            Text.Key("rb.nearby.self"),
            initiallyChecked: false,
            id: "nearby.includeSelf",
            persist: true);
        _includeSelf.Description = Text.Key("rb.nearby.self.desc");

        var bring = nearby.Menu.AddConfirmButton(Text.Key("rb.nearby.bring"));
        bring.Description = Text.Key("rb.nearby.bring.desc");
        bring.ConfirmationDescription = Text.Key("rb.nearby.bring.confirm");
        bring.Confirmed += MoveNearby;
        _radius.Highlighted += () => _tools.ShowSphere(SelectedRadius());
        _radius.IndexChanged += (_, _) => _tools.ShowSphere(SelectedRadius());
        _nearbyDestination.Highlighted += _tools.HideSphere;
        _includeSelf.Highlighted += () => _tools.ShowSphere(SelectedRadius());
        bring.Highlighted += () => _tools.ShowSphere(SelectedRadius());
        nearby.Menu.Closed += _tools.HideSphere;
    }

    private int SelectedRadius()
    {
        var index = _radius?.SelectedIndex ?? 0;

        return index >= 0 && index < BucketRules.Radii.Length ? BucketRules.Radii[index] : BucketRules.Radii[0];
    }

    private void MoveSelection(int index)
    {
        if (!_tools.HasSelection)
        {
            _plugin.Notify(NotifyStyle.Warning, Text.Key("rb.entity.nothing"));

            return;
        }

        if (index < 0 || index >= _destinationIds.Length)
        {
            _plugin.Notify(NotifyStyle.Warning, Text.Key("rb.pa.stale"));

            return;
        }

        BucketClient.Send(BucketCommands.MoveEntity, Id(_tools.SelectedNetworkId), Id(_destinationIds[index]));
    }

    private void MoveNearby()
    {
        var index = _nearbyDestination?.SelectedIndex ?? 0;

        if (index < 0 || index >= _destinationIds.Length)
        {
            _plugin.Notify(NotifyStyle.Warning, Text.Key("rb.pa.stale"));

            return;
        }

        BucketClient.Send(
            BucketCommands.MoveNearby,
            Id(SelectedRadius()),
            Id(_destinationIds[index]),
            _includeSelf?.Checked == true ? "1" : "0");
    }

    private void RefreshDestinations(List<BucketRow> buckets)
    {
        var options = new List<Text>(buckets.Count);
        var ids = new int[buckets.Count];

        for (var index = 0; index < buckets.Count; index++)
        {
            options.Add(NameOf(buckets[index]));
            ids[index] = buckets[index].Id;
        }

        _destinationIds = ids;

        var clamped = Math.Max(ids.Length - 1, 0);

        _entityDestination?.SetOptions(options, Math.Clamp(_entityDestination.SelectedIndex, 0, clamped));
        _nearbyDestination?.SetOptions(options, Math.Clamp(_nearbyDestination.SelectedIndex, 0, clamped));
    }

    private WorldRows BuildWorld(BucketRow bucket)
    {
        var id = bucket.Id;
        var rows = new WorldRows
        {
            Link = _plugin.RootMenu.AddSubmenu(
                Text.Literal(bucket.Name),
                subtitle: Text.Key("rb.world.subtitle", ("id", Text.Literal(Id(id)))))
        };
        rows.Link.Description = bucket.IsManaged
            ? Text.Key("rb.world.desc", ("id", Text.Literal(Id(id))))
            : Text.Key("rb.world.unmanaged.desc", ("id", Text.Literal(Id(id))));
        rows.Link.Gate = ViewGate;
        rows.Link.HideWhenLocked = true;

        var menu = rows.Link.Menu;

        rows.Occupants = menu.AddSubmenu(
            Text.Key("rb.occupants"),
            subtitle: Text.Key("rb.world.subtitle", ("id", Text.Literal(Id(id)))));
        rows.Occupants.Description = Text.Key("rb.occupants.desc");
        rows.Occupants.Gate = ViewGate;

        rows.Goto = menu.AddButton(Text.Key("rb.goto"));
        rows.Goto.Description = Text.Key("rb.goto.desc");
        rows.Goto.Gate = JoinGate;
        rows.Goto.HideWhenLocked = true;
        rows.Goto.Selected += () => BucketClient.Send(BucketCommands.Join, Id(id));

        rows.Population = menu.AddCheckbox(Text.Key("rb.population"), bucket.PopulationEnabled);
        rows.Population.Description = Text.Key("rb.population.desc");
        rows.Population.Gate = WorldGate;
        rows.Population.HideWhenLocked = true;
        rows.Population.Visible = bucket.IsManaged;
        rows.Population.Changed += checkedNow =>
            BucketClient.Send(BucketCommands.Population, Id(id), checkedNow ? "1" : "0");

        rows.Lockdown = menu.AddList(
            Text.Key("rb.lockdown"),
            [Text.Key("rb.lockdown.inactive"), Text.Key("rb.lockdown.relaxed"), Text.Key("rb.lockdown.strict")],
            bucket.Lockdown);
        rows.Lockdown.Description = Text.Key("rb.lockdown.desc");
        rows.Lockdown.Gate = WorldGate;
        rows.Lockdown.HideWhenLocked = true;
        rows.Lockdown.Visible = bucket.IsManaged;

        rows.Lockdown.Selected += index =>
            BucketClient.Send(BucketCommands.Lockdown, Id(id), BucketRules.LockdownFromIndex(index));

        rows.Reset = menu.AddButton(Text.Key("rb.reset"));
        rows.Reset.Description = Text.Key("rb.reset.desc");
        rows.Reset.Gate = WorldGate;
        rows.Reset.HideWhenLocked = true;
        rows.Reset.Visible = bucket.IsManaged;
        rows.Reset.Selected += () =>
        {
            BucketClient.Send(BucketCommands.Population, Id(id), "1");
            BucketClient.Send(BucketCommands.Lockdown, Id(id), BucketRules.LockdownInactive);
        };

        rows.Evict = menu.AddConfirmButton(Text.Key("rb.evict"));
        rows.Evict.Description = Text.Key("rb.evict.desc");
        rows.Evict.ConfirmationDescription = Text.Key("rb.evict.confirm");
        rows.Evict.Gate = MoveGate;
        rows.Evict.HideWhenLocked = true;
        rows.Evict.Visible = id != BucketRules.DefaultBucket;
        rows.Evict.Confirmed += () => BucketClient.Send(BucketCommands.Evict, Id(id));

        rows.Rename = menu.AddButton(Text.Key("rb.rename"));
        rows.Rename.Description = Text.Key("rb.rename.desc");
        rows.Rename.Gate = ManageGate;
        rows.Rename.HideWhenLocked = true;
        rows.Rename.Visible = bucket.IsManaged && id != BucketRules.DefaultBucket;
        rows.Rename.Selected += () => _ = RenameAsync(id);

        rows.Delete = menu.AddConfirmButton(Text.Key("rb.delete"));
        rows.Delete.ConfirmationDescription = Text.Key("rb.delete.confirm");
        rows.Delete.Gate = ManageGate;
        rows.Delete.HideWhenLocked = true;
        rows.Delete.Visible = bucket.IsManaged && id != BucketRules.DefaultBucket;
        rows.Delete.Confirmed += () =>
        {
            BucketClient.Send(BucketCommands.Delete, Id(id));

            _reopenRoot = true;
        };

        return rows;
    }

    private void Refresh(List<BucketRow> buckets, List<OccupantRow> occupants)
    {
        var byBucket = new Dictionary<int, List<OccupantRow>>();

        foreach (var occupant in occupants)
        {
            if (!byBucket.TryGetValue(occupant.BucketId, out var list))
            {
                list = [];
                byBucket[occupant.BucketId] = list;
            }

            list.Add(occupant);
        }

        foreach (var bucket in buckets)
        {
            if (bucket.Id == _viewerBucket && _current is { } current)
            {
                current.Text = Text.Key("rb.current", ("world", NameOf(bucket)));
                current.Label = Text.Key("rb.bucket.label", ("id", Text.Literal(Id(bucket.Id))));
                current.Description = Text.Key("rb.current.desc", ("id", Text.Literal(Id(bucket.Id))));
            }

            if (!_worlds.TryGetValue(bucket.Id, out var rows))
            {
                continue;
            }

            rows.Link!.Text = NameOf(bucket);
            rows.Link.Label = Headcount(bucket.Occupants);
            rows.Link.Menu.Title = NameOf(bucket);

            rows.Goto!.Enabled = bucket.Id != _viewerBucket;
            rows.Goto.Description = bucket.Id == _viewerBucket ? Text.Key("rb.goto.here") : Text.Key("rb.goto.desc");

            rows.Population!.Checked = bucket.PopulationEnabled;
            rows.Lockdown!.SelectedIndex = bucket.Lockdown;

            rows.Evict!.Enabled = bucket.Occupants > 0;

            rows.Delete!.Enabled = bucket.Occupants == 0;
            rows.Delete.Description = bucket.Occupants == 0
                ? Text.Key("rb.delete.desc")
                : Text.Key("rb.delete.occupied");

            FillOccupants(rows, byBucket.GetValueOrDefault(bucket.Id) ?? []);
        }

        if (_leave is { } leave)
        {
            leave.Visible = _viewerBucket != BucketRules.DefaultBucket;
        }

        RefreshDestinations(buckets);

        if (_reopenRoot)
        {
            _reopenRoot = false;

            _plugin.RootMenu.Open();
        }
    }

    private static void FillOccupants(WorldRows rows, List<OccupantRow> occupants)
    {
        var menu = rows.Occupants!.Menu;

        menu.Clear();

        if (occupants.Count == 0)
        {
            var empty = menu.AddButton(Text.Key("rb.occupants.none"));
            empty.Enabled = false;

            return;
        }

        var shown = 0;

        foreach (var occupant in occupants)
        {
            if (shown >= MaxOccupantRows)
            {
                var more = menu.AddButton(Text.Literal($"and {occupants.Count - shown} more"));
                more.Enabled = false;

                break;
            }

            var row = menu.AddButton(Text.Key(
                "rb.occupant",
                ("name", Text.Literal(occupant.Name)),
                ("id", Text.Literal(Id(occupant.ServerId)))));

            row.Enabled = false;

            shown++;
        }
    }

    private async Task CreateAsync()
    {
        var typed = await _plugin.GetTextAsync(Text.Key("rb.create.prompt"), BucketRules.MaxNameLength);

        if (typed is null)
        {
            return;
        }

        BucketClient.Send(BucketCommands.Create, typed);

        _reopenRoot = true;
    }

    public void CancelReopen() => _reopenRoot = false;

    private async Task RenameAsync(int id)
    {
        var typed = await _plugin.GetTextAsync(Text.Key("rb.rename.prompt"), BucketRules.MaxNameLength);

        if (typed is not null)
        {
            BucketClient.Send(BucketCommands.Rename, Id(id), typed);
        }
    }

    private static Text NameOf(BucketRow bucket) => bucket.IsManaged && bucket.Name.Length > 0
        ? Text.Literal(bucket.Name)
        : Text.Key("rb.world.unmanaged", ("id", Text.Literal(Id(bucket.Id))));

    private static Text Headcount(int occupants) => occupants switch
    {
        0 => Text.Key("rb.players.none"),
        1 => Text.Key("rb.players.one"),
        _ => Text.Key("rb.players.many", ("count", Text.Literal(Id(occupants)))),
    };

    private static string Id(int value) => value.ToString(CultureInfo.InvariantCulture);

    private sealed class WorldRows
    {
        public PluginSubmenu? Link { get; set; }

        public PluginSubmenu? Occupants { get; set; }

        public PluginButton? Goto { get; set; }

        public PluginCheckbox? Population { get; set; }

        public PluginList? Lockdown { get; set; }

        public PluginButton? Reset { get; set; }

        public PluginConfirmButton? Evict { get; set; }

        public PluginButton? Rename { get; set; }

        public PluginConfirmButton? Delete { get; set; }
    }
}
