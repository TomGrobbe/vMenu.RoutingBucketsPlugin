using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Shared;

using RoutingBucketsPlugin.Shared;

using System.Globalization;
using System.Text.Json;

namespace RoutingBucketsPlugin.Server;

public static class ServerCommandRouter
{
    private static bool _registered;

    public static void Register()
    {
        if (_registered)
        {
            return;
        }

        _registered = true;

        API.OnEvent(BucketEvents.ServerCommand, new Action<string, string, string>(OnServerCommand), false);
    }

    private static void OnServerCommand(string id, string action, string paramsJson)
    {
        var detail = string.Empty;
        int outcome;

        if (!Settings.IsEnabled())
        {
            Reply(id, BucketOutcome.Denied, detail);

            return;
        }

        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrEmpty(paramsJson) ? "{}" : paramsJson);
            var p = document.RootElement;

            outcome = action switch
            {
                "world-create" => Create(p, ref detail),
                "world-rename" => Rename(p),
                "world-settings" => WorldSettings(p),
                "world-delete" => Delete(p),
                "world-move-one" => MoveOne(p),
                "world-move-all" => MoveAll(p),
                "world-move-ids" => MoveIds(p),
                "world-empty" => Empty(p),
                "world-transfer" => Transfer(p),
                _ => BucketOutcome.Failed,
            };
        }
        catch (JsonException)
        {
            outcome = BucketOutcome.Failed;
        }

        Reply(id, outcome, detail);

        if (outcome is BucketOutcome.Ok or BucketOutcome.SaveFailed)
        {
            BucketBroadcast.PushNow();
        }
    }

    private static int Create(JsonElement p, ref string detail)
    {
        if (BucketRules.NormalizeName(ReadString(p, "name")) is not { } name)
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

        Log($"created world '{created.Name}' (bucket {created.Id}).");

        detail = created.Id.ToString(CultureInfo.InvariantCulture);

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Rename(JsonElement p)
    {
        if (!TryId(p, "id", out var id))
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

        if (BucketRules.NormalizeName(ReadString(p, "name")) is not { } name)
        {
            return BucketOutcome.BadName;
        }

        if (BucketRegistry.NameTaken(name, exceptId: id))
        {
            return BucketOutcome.NameTaken;
        }

        BucketRegistry.Rename(id, name);

        Log($"renamed world {id} to '{name}'.");

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int WorldSettings(JsonElement p)
    {
        if (!TryId(p, "id", out var id))
        {
            return BucketOutcome.Failed;
        }

        if (!BucketRegistry.Exists(id))
        {
            return BucketOutcome.UnknownBucket;
        }

        if (p.TryGetProperty("population", out var pop)
            && pop.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            BucketRegistry.SetPopulation(id, pop.ValueKind == JsonValueKind.True);
        }

        var lockdown = ReadString(p, "lockdown");
        if (lockdown.Length > 0)
        {
            if (!BucketRules.IsValidLockdown(lockdown))
            {
                return BucketOutcome.Failed;
            }

            BucketRegistry.SetLockdown(id, lockdown);
        }

        Log($"updated settings for world {id}.");

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int Delete(JsonElement p)
    {
        if (!TryId(p, "id", out var id))
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

        Log($"deleted world {id}.");

        return Saved() ? BucketOutcome.Ok : BucketOutcome.SaveFailed;
    }

    private static int MoveOne(JsonElement p)
    {
        if (!TryInt(p, "serverId", out var serverId) || !TryId(p, "world", out var world))
        {
            return BucketOutcome.Failed;
        }

        if (world != BucketRules.DefaultBucket && !BucketRegistry.Exists(world))
        {
            return BucketOutcome.UnknownBucket;
        }

        if (!Native.DoesPlayerExist(BucketOccupancy.Handle(serverId)))
        {
            return BucketOutcome.UnknownPlayer;
        }

        MoveAndTell(serverId, world, ReadString(p, "operator"));

        Log($"moved player {serverId} to world {world}.");

        return BucketOutcome.Ok;
    }

    private static int MoveAll(JsonElement p)
    {
        if (!TryId(p, "world", out var world))
        {
            return BucketOutcome.Failed;
        }

        if (world != BucketRules.DefaultBucket && !BucketRegistry.Exists(world))
        {
            return BucketOutcome.UnknownBucket;
        }

        var actor = ReadString(p, "operator");
        var moved = 0;

        foreach (var occupant in BucketOccupancy.Snapshot())
        {
            if (occupant.Bucket == world)
            {
                continue;
            }

            MoveAndTell(occupant.ServerId, world, actor);
            moved++;
        }

        Log($"moved {moved} player(s) to world {world}.");

        return BucketOutcome.Ok;
    }

    private static int MoveIds(JsonElement p)
    {
        if (!TryId(p, "world", out var world))
        {
            return BucketOutcome.Failed;
        }

        if (world != BucketRules.DefaultBucket && !BucketRegistry.Exists(world))
        {
            return BucketOutcome.UnknownBucket;
        }

        if (!p.TryGetProperty("serverIds", out var ids) || ids.ValueKind != JsonValueKind.Array)
        {
            return BucketOutcome.Failed;
        }

        var actor = ReadString(p, "operator");
        var moved = 0;

        foreach (var element in ids.EnumerateArray())
        {
            if (element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out var serverId))
            {
                MoveAndTell(serverId, world, actor);
                moved++;
            }
        }

        Log($"moved {moved} listed player(s) to world {world}.");

        return BucketOutcome.Ok;
    }

    private static int Empty(JsonElement p)
    {
        if (!TryId(p, "id", out var id))
        {
            return BucketOutcome.Failed;
        }

        if (id == BucketRules.DefaultBucket)
        {
            return BucketOutcome.CannotModifyDefault;
        }

        var actor = ReadString(p, "operator");
        var moved = BucketOccupancy.MoveAllTo(id, BucketRules.DefaultBucket);

        foreach (var serverId in moved)
        {
            Tell(serverId, id, BucketRules.DefaultBucket, actor);
        }

        Log($"emptied world {id} ({moved.Count} player(s)).");

        return BucketOutcome.Ok;
    }

    private static int Transfer(JsonElement p)
    {
        if (!TryId(p, "from", out var from) || !TryId(p, "to", out var to))
        {
            return BucketOutcome.Failed;
        }

        if (to != BucketRules.DefaultBucket && !BucketRegistry.Exists(to))
        {
            return BucketOutcome.UnknownBucket;
        }

        var actor = ReadString(p, "operator");
        var moved = BucketOccupancy.MoveAllTo(from, to);

        foreach (var serverId in moved)
        {
            Tell(serverId, from, to, actor);
        }

        Log($"transferred {moved.Count} player(s) from world {from} to {to}.");

        return BucketOutcome.Ok;
    }

    private static void MoveAndTell(int serverId, int bucket, string actor)
    {
        var from = BucketOccupancy.BucketOf(serverId);

        if (!BucketOccupancy.Move(serverId, bucket))
        {
            return;
        }

        Tell(serverId, from, bucket, actor);
    }

    private static void Tell(int serverId, int from, int to, string actor)
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

    private static void Reply(string id, int outcome, string detail) =>
        API.EmitLocal(BucketEvents.ServerCommandResult, id, outcome, detail);

    private static bool Saved() => BucketRegistry.Save();

    private static string ReadString(JsonElement p, string name) =>
        p.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : string.Empty;

    private static bool TryInt(JsonElement p, string name, out int value)
    {
        value = 0;

        return p.TryGetProperty(name, out var element)
            && element.ValueKind == JsonValueKind.Number
            && element.TryGetInt32(out value);
    }

    private static bool TryId(JsonElement p, string name, out int id) =>
        TryInt(p, name, out id) && BucketRules.IsValidId(id);

    private static void Log(string message) => SharedAPI.Log.Debug($"[RoutingBuckets] {message}");
}
