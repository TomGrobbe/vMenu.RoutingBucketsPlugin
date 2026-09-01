using CitizenFX.FiveM.Server;

using RoutingBucketsPlugin.Shared;

using System.Globalization;

namespace RoutingBucketsPlugin.Server;

public sealed class Occupant(int serverId, string name, int bucket)
{
    public int ServerId { get; } = serverId;

    public string Name { get; } = name;

    public int Bucket { get; } = bucket;
}

public static class BucketOccupancy
{
    private const int DriverSeat = -1;


    public static List<Occupant> Snapshot()
    {
        var occupants = new List<Occupant>();
        var count = Native.GetNumPlayerIndices();

        for (var index = 0; index < count; index++)
        {
            var handle = Native.GetPlayerFromIndex(index);

            if (string.IsNullOrEmpty(handle) || !int.TryParse(handle, NumberStyles.Integer, CultureInfo.InvariantCulture, out var serverId))
            {
                continue;
            }

            var name = Native.GetPlayerName(handle);

            if (string.IsNullOrWhiteSpace(name))
            {
                name = "#" + handle;
            }

            occupants.Add(new Occupant(serverId, name, Native.GetPlayerRoutingBucket(handle)));
        }

        return occupants;
    }

    public static int CountIn(int bucketId)
    {
        var total = 0;

        foreach (var occupant in Snapshot())
        {
            if (occupant.Bucket == bucketId)
            {
                total++;
            }
        }

        return total;
    }

    public static List<int> MoveAllTo(int fromBucket, int toBucket)
    {
        var moved = new List<int>();

        foreach (var occupant in Snapshot())
        {
            if (occupant.Bucket != fromBucket)
            {
                continue;
            }

            Native.SetPlayerRoutingBucket(Handle(occupant.ServerId), toBucket);
            TakeVehicleAlong(occupant.ServerId, toBucket);
            moved.Add(occupant.ServerId);
        }

        return moved;
    }

    public static int BucketOf(int serverId) => Native.GetPlayerRoutingBucket(Handle(serverId));

    public static bool Move(int serverId, int bucket)
    {
        if (!BucketRules.IsValidId(bucket) || !Native.DoesPlayerExist(Handle(serverId)))
        {
            return false;
        }

        Native.SetPlayerRoutingBucket(Handle(serverId), bucket);

        TakeVehicleAlong(serverId, bucket);

        return true;
    }

    public static void TakeVehicleAlong(int serverId, int bucket)
    {
        var ped = Native.GetPlayerPed(Handle(serverId));

        if (ped == 0 || !Native.DoesEntityExist(ped))
        {
            return;
        }

        var vehicle = Native.GetVehiclePedIsIn(ped, false);

        if (vehicle == 0 || !Native.DoesEntityExist(vehicle))
        {
            return;
        }

        if (Native.GetPedInVehicleSeat(vehicle, DriverSeat) != ped)
        {
            return;
        }

        Native.SetEntityRoutingBucket(vehicle, bucket);
    }

    public static string Handle(int serverId) => serverId.ToString(CultureInfo.InvariantCulture);
}
