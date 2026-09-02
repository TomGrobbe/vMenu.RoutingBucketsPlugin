using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Shared.Serialization;

using RoutingBucketsPlugin.Shared;

using System.Text;

using vMenu.Enhanced.ServerAPI;

namespace RoutingBucketsPlugin.Server;

public static class BucketBroadcast
{
    private const long TickMs = 2000;

    private const string DroppedEvent = "playerDropped";

    private static string _lastBuckets = string.Empty;

    private static string _lastOccupants = string.Empty;

    private static bool _registered;

    public static void Register()
    {
        if (_registered)
        {
            return;
        }

        _registered = true;

        API.OnEvent(DroppedEvent, new Action<int, string?>(OnPlayerDropped), false);

        API.SetInterval(Tick, TickMs);
    }

    public static void PushNow()
    {
        Build(out var buckets, out var occupants);

        _lastBuckets = buckets;
        _lastOccupants = occupants;

        foreach (var occupant in BucketOccupancy.Snapshot())
        {
            SendTo(occupant.ServerId, occupant.Bucket, buckets, occupants);
        }
    }

    public static void PushTo(int serverId)
    {
        Build(out var buckets, out var occupants);

        SendTo(serverId, BucketOccupancy.BucketOf(serverId), buckets, occupants);
    }

    private static void OnPlayerDropped([FromSource] int source, string? reason = null) => _lastOccupants = string.Empty;

    private static void Tick()
    {
        Build(out var buckets, out var occupants);

        if (buckets == _lastBuckets && occupants == _lastOccupants)
        {
            return;
        }

        _lastBuckets = buckets;
        _lastOccupants = occupants;

        foreach (var occupant in BucketOccupancy.Snapshot())
        {
            SendTo(occupant.ServerId, occupant.Bucket, buckets, occupants);
        }
    }

    private static void Build(out string buckets, out string occupants)
    {
        var snapshot = BucketOccupancy.Snapshot();
        var counts = new Dictionary<int, int>();

        foreach (var occupant in snapshot)
        {
            counts[occupant.Bucket] = counts.GetValueOrDefault(occupant.Bucket) + 1;
        }

        var bucketBuilder = new StringBuilder();

        foreach (var definition in BucketRegistry.All())
        {
            BucketWire.AppendBucket(
                bucketBuilder,
                definition.Id,
                BucketWire.FlagManaged,
                definition.PopulationEnabled,
                BucketRules.LockdownToIndex(definition.LockdownMode),
                counts.GetValueOrDefault(definition.Id),
                definition.Name);
        }

        foreach (var pair in counts)
        {
            if (BucketRegistry.Exists(pair.Key))
            {
                continue;
            }

            BucketWire.AppendBucket(bucketBuilder, pair.Key, 0, true, 0, pair.Value, string.Empty);
        }

        var occupantBuilder = new StringBuilder();

        foreach (var occupant in snapshot)
        {
            BucketWire.AppendOccupant(occupantBuilder, occupant.Bucket, occupant.ServerId, occupant.Name);
        }

        buckets = bucketBuilder.ToString();
        occupants = occupantBuilder.ToString();
    }

    private static void SendTo(int serverId, int viewerBucket, string buckets, string occupants)
    {
        var handle = BucketOccupancy.Handle(serverId);

        if (!Native.DoesPlayerExist(handle) || !VMenuServer.IsPlayerAllowed(handle, Permissions.View))
        {
            return;
        }

        API.EmitClient(serverId, BucketEvents.State, viewerBucket, buckets, occupants);
    }
}
