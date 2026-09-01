using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Server.Entities;
using CitizenFX.FiveM.Shared;
using CitizenFX.FiveM.Shared.Serialization;

using RoutingBucketsPlugin.Shared;

using System.Globalization;
using System.Numerics;

using vMenu.Enhanced.ServerAPI;

namespace RoutingBucketsPlugin.Server;

public static class CommandRouter
{
    private static bool _registered;

    private static string _detail = string.Empty;

    public static void Register()
    {
        if (_registered)
        {
            return;
        }

        _registered = true;

        API.OnNetEvent(BucketEvents.RequestState, new Action<Player>(OnStateRequested), false);
        API.OnNetEvent(BucketEvents.Command, new Action<Player, string, string[]>(OnCommand), false);
    }

    private static void OnStateRequested([FromSource] Player source)
    {
        if (!Settings.IsEnabled() || !Allowed(source, Permissions.View))
        {
            return;
        }

        BucketBroadcast.PushTo(source.Handle);
    }

    private static void OnCommand([FromSource] Player source, string command, string[] args)
    {
        if (!Settings.IsEnabled())
        {
            Reply(source, BucketOutcome.Denied);

            return;
        }

        if (!CommandRateLimit.TryTake(source.Handle))
        {
            Reply(source, BucketOutcome.RateLimited);

            return;
        }

        args ??= [];

        var outcome = command switch
        {
            BucketCommands.Create => Create(source, args),
            BucketCommands.Rename => Rename(source, args),
            BucketCommands.Delete => Delete(source, args),
            BucketCommands.Evict => Evict(source, args),
            BucketCommands.Join => Join(source, args),
            BucketCommands.Leave => Leave(source),
            BucketCommands.Population => Population(source, args),
            BucketCommands.Lockdown => Lockdown(source, args),
            BucketCommands.Bring => Bring(source, args),
            BucketCommands.Send => Send(source, args),
            BucketCommands.Goto => Goto(source, args),
            BucketCommands.MoveEntity => MoveEntity(source, args),
            BucketCommands.MoveNearby => MoveNearby(source, args),
            _ => BucketOutcome.Failed,
        };

        Reply(source, outcome, _detail);

        if (outcome is BucketOutcome.Ok or BucketOutcome.SaveFailed)
        {
            BucketBroadcast.PushNow();
        }

        _detail = string.Empty;
    }

    private static int Create(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Manage))
        {
            return BucketOutcome.Denied;
        }

        if (BucketRules.NormalizeName(args.Length > 0 ? args[0] : null) is not { } name)
        {
            return BucketOutcome.BadName;
        }

        if (BucketRegistry.NameTaken(name, exceptId: -1))
        {
            return BucketOutcome.NameTaken;
        }

        if (BucketRegistry.Count - 1 >= Settings.MaxWorldCount())
        {
            return BucketOutcome.TooManyBuckets;
        }

        if (BucketRegistry.Create(name) is not { } created)
        {
            return BucketOutcome.TooManyBuckets;
        }

        Log($"{source.Name} created world '{created.Name}' (bucket {created.Id}).");

        _detail = ResultDetails.Pack(
            ResultDetails.Created,
            created.Name,
            created.Id.ToString(CultureInfo.InvariantCulture));

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Rename(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Manage))
        {
            return BucketOutcome.Denied;
        }

        if (!TryId(args, 0, out var id))
        {
            return BucketOutcome.Failed;
        }

        if (id == BucketRules.DefaultBucket)
        {
            return BucketOutcome.CannotModifyDefault;
        }

        if (!BucketRegistry.Exists(id))
        {
            return BucketOutcome.UnknownBucket;
        }

        if (BucketRules.NormalizeName(args.Length > 1 ? args[1] : null) is not { } name)
        {
            return BucketOutcome.BadName;
        }

        if (BucketRegistry.NameTaken(name, exceptId: id))
        {
            return BucketOutcome.NameTaken;
        }

        BucketRegistry.Rename(id, name);

        Log($"{source.Name} renamed world {id} to '{name}'.");

        _detail = ResultDetails.Pack(ResultDetails.Renamed, name);

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Delete(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Manage))
        {
            return BucketOutcome.Denied;
        }

        if (!TryId(args, 0, out var id))
        {
            return BucketOutcome.Failed;
        }

        if (id == BucketRules.DefaultBucket)
        {
            return BucketOutcome.CannotModifyDefault;
        }

        if (!BucketRegistry.Exists(id))
        {
            return BucketOutcome.UnknownBucket;
        }

        if (BucketOccupancy.CountIn(id) > 0)
        {
            return BucketOutcome.BucketNotEmpty;
        }

        BucketRegistry.Delete(id);

        Log($"{source.Name} deleted world {id}.");

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Evict(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Move))
        {
            return BucketOutcome.Denied;
        }

        if (!TryId(args, 0, out var id))
        {
            return BucketOutcome.Failed;
        }

        if (id == BucketRules.DefaultBucket)
        {
            return BucketOutcome.CannotModifyDefault;
        }

        var moved = BucketOccupancy.MoveAllTo(id, BucketRules.DefaultBucket);

        foreach (var serverId in moved)
        {
            Tell(serverId, id, BucketRules.DefaultBucket, source.Name);
        }

        Log($"{source.Name} moved {moved.Count} player(s) out of world {id}.");

        _detail = ResultDetails.Pack(
            ResultDetails.Evicted,
            moved.Count.ToString(CultureInfo.InvariantCulture));

        return BucketOutcome.Ok;
    }

    private static int Join(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Join) || !Settings.AllowsSelfJoin())
        {
            return BucketOutcome.Denied;
        }

        if (!TryId(args, 0, out var id))
        {
            return BucketOutcome.Failed;
        }

        if (id != BucketRules.DefaultBucket && !BucketRegistry.Exists(id))
        {
            return BucketOutcome.UnknownBucket;
        }

        MoveAndTell(source.Handle, id, actor: null);

        Log($"{source.Name} moved themselves into world {id}.");

        return BucketOutcome.Ok;
    }

    private static int Leave(Player source)
    {
        if (!Allowed(source, Permissions.Join) || !Settings.AllowsSelfJoin())
        {
            return BucketOutcome.Denied;
        }

        MoveAndTell(source.Handle, BucketRules.DefaultBucket, actor: null);

        Log($"{source.Name} moved themselves back to the main world.");

        return BucketOutcome.Ok;
    }

    private static int Population(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.World))
        {
            return BucketOutcome.Denied;
        }

        if (!TryId(args, 0, out var id) || args.Length < 2 || (args[1] != "0" && args[1] != "1"))
        {
            return BucketOutcome.Failed;
        }

        if (!BucketRegistry.SetPopulation(id, args[1] == "1"))
        {
            return BucketOutcome.UnknownBucket;
        }

        Log($"{source.Name} set ambient population in world {id} to {args[1] == "1"}.");

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Lockdown(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.World))
        {
            return BucketOutcome.Denied;
        }

        if (!TryId(args, 0, out var id) || args.Length < 2 || !BucketRules.IsValidLockdown(args[1]))
        {
            return BucketOutcome.Failed;
        }

        if (!BucketRegistry.SetLockdown(id, args[1]))
        {
            return BucketOutcome.UnknownBucket;
        }

        Log($"{source.Name} set entity lockdown in world {id} to {args[1]}.");

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Bring(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Move))
        {
            return BucketOutcome.Denied;
        }

        if (!TryTarget(args, 0, out var target))
        {
            return BucketOutcome.UnknownPlayer;
        }

        var bucket = BucketOccupancy.BucketOf(source.Handle);

        MoveAndTell(target, bucket, source.Name);

        Log($"{source.Name} brought {Native.GetPlayerName(BucketOccupancy.Handle(target))} into world {bucket}.");

        return BucketOutcome.Ok;
    }

    private static int Send(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Move))
        {
            return BucketOutcome.Denied;
        }

        if (!TryTarget(args, 0, out var target))
        {
            return BucketOutcome.UnknownPlayer;
        }

        if (!TryId(args, 1, out var id))
        {
            return BucketOutcome.Failed;
        }

        if (id != BucketRules.DefaultBucket && !BucketRegistry.Exists(id))
        {
            return BucketOutcome.UnknownBucket;
        }

        MoveAndTell(target, id, source.Name);

        Log($"{source.Name} sent {Native.GetPlayerName(BucketOccupancy.Handle(target))} to world {id}.");

        return BucketOutcome.Ok;
    }

    private static int Goto(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Join) || !Settings.AllowsSelfJoin())
        {
            return BucketOutcome.Denied;
        }

        if (!TryTarget(args, 0, out var target))
        {
            return BucketOutcome.UnknownPlayer;
        }

        var bucket = BucketOccupancy.BucketOf(target);

        MoveAndTell(source.Handle, bucket, actor: null);

        Log($"{source.Name} moved themselves into world {bucket}.");

        return BucketOutcome.Ok;
    }

    private static int MoveEntity(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Move))
        {
            return BucketOutcome.Denied;
        }

        if (args.Length < 1
            || !int.TryParse(args[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var networkId)
            || !TryId(args, 1, out var bucket))
        {
            return BucketOutcome.Failed;
        }

        if (bucket != BucketRules.DefaultBucket && !BucketRegistry.Exists(bucket))
        {
            return BucketOutcome.UnknownBucket;
        }

        var entity = Native.NetworkGetEntityFromNetworkId(networkId);

        if (entity == 0 || !Native.DoesEntityExist(entity))
        {
            return BucketOutcome.UnknownEntity;
        }

        Native.SetEntityRoutingBucket(entity, bucket);

        Log($"{source.Name} moved entity {entity} to world {bucket}.");

        _detail = ResultDetails.Pack(ResultDetails.MovedEntity, BucketRegistry.DisplayName(bucket));

        return BucketOutcome.Ok;
    }

    private static int MoveNearby(Player source, string[] args)
    {
        if (!Allowed(source, Permissions.Move))
        {
            return BucketOutcome.Denied;
        }

        if (args.Length < 1
            || !int.TryParse(args[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var radius)
            || !BucketRules.IsValidRadius(radius)
            || !TryId(args, 1, out var bucket))
        {
            return BucketOutcome.Failed;
        }

        if (bucket != BucketRules.DefaultBucket && !BucketRegistry.Exists(bucket))
        {
            return BucketOutcome.UnknownBucket;
        }

        var ped = Native.GetPlayerPed(source.StrHandle);

        if (ped == 0 || !Native.DoesEntityExist(ped))
        {
            return BucketOutcome.Failed;
        }

        var includeSelf = args.Length > 2 && args[2] == "1";
        var centre = Native.GetEntityCoords(ped);
        var moved = 0;

        foreach (var occupant in BucketOccupancy.Snapshot())
        {
            var isSelf = occupant.ServerId == source.Handle;

            if ((isSelf && !includeSelf) || occupant.Bucket == bucket)
            {
                continue;
            }

            var theirPed = Native.GetPlayerPed(BucketOccupancy.Handle(occupant.ServerId));

            if (theirPed == 0 || !Native.DoesEntityExist(theirPed))
            {
                continue;
            }

            if (Vector3.Distance(centre, Native.GetEntityCoords(theirPed)) > radius)
            {
                continue;
            }

            var from = occupant.Bucket;

            if (!BucketOccupancy.Move(occupant.ServerId, bucket))
            {
                continue;
            }

            Tell(occupant.ServerId, from, bucket, isSelf ? null : source.Name);

            moved++;
        }

        Log($"{source.Name} moved {moved} player(s) within {radius}m to world {bucket}.");

        _detail = ResultDetails.Pack(
            ResultDetails.MovedNearby,
            moved.ToString(CultureInfo.InvariantCulture),
            BucketRegistry.DisplayName(bucket));

        return BucketOutcome.Ok;
    }

    private static void MoveAndTell(int serverId, int bucket, string? actor)
    {
        var from = BucketOccupancy.BucketOf(serverId);

        if (!BucketOccupancy.Move(serverId, bucket))
        {
            return;
        }

        Tell(serverId, from, bucket, actor);
    }

    private static void Tell(int serverId, int from, int to, string? actor)
    {

        if (from == to || !Native.DoesPlayerExist(BucketOccupancy.Handle(serverId)))
        {
            return;
        }

        API.EmitClient(
            serverId,
            BucketEvents.Moved,
            BucketRegistry.DisplayName(from),
            BucketRegistry.DisplayName(to),
            actor ?? string.Empty);
    }

    private static bool Saved() => BucketRegistry.Save();

    private static bool Allowed(Player source, string permission) =>
        VMenuServer.IsPlayerAllowed(source.StrHandle, permission);

    private static bool TryId(string[] args, int index, out int id)
    {
        id = 0;

        return args.Length > index
            && int.TryParse(args[index], NumberStyles.Integer, CultureInfo.InvariantCulture, out id)
            && BucketRules.IsValidId(id);
    }

    private static bool TryTarget(string[] args, int index, out int serverId)
    {
        serverId = 0;

        return args.Length > index
            && int.TryParse(args[index], NumberStyles.Integer, CultureInfo.InvariantCulture, out serverId)
            && Native.DoesPlayerExist(BucketOccupancy.Handle(serverId));
    }

    private static void Reply(Player source, int outcome, string detail = "")
    {
        if (!Native.DoesPlayerExist(source.StrHandle))
        {
            return;
        }

        API.EmitClient(source.Handle, BucketEvents.Result, outcome, detail);
    }

    private static void Log(string message) => SharedAPI.Log.Debug($"[RoutingBuckets] {message}");
}
