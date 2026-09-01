using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Shared;

using RoutingBucketsPlugin.Shared;

using System.Globalization;

namespace RoutingBucketsPlugin.Server;

public static class BucketRegistry
{
    public const string DefaultName = "Main World";

    private static readonly Dictionary<int, BucketDefinition> Buckets = [];

    public static int Count => Buckets.Count;

    public static void Load()
    {
        Buckets.Clear();

        foreach (var definition in BucketStore.Load())
        {
            if (!BucketRules.IsValidId(definition.Id) || Buckets.ContainsKey(definition.Id))
            {
                continue;
            }

            if (!BucketRules.IsValidLockdown(definition.LockdownMode))
            {
                definition.LockdownMode = BucketRules.LockdownInactive;
            }

            Buckets[definition.Id] = definition;
        }

        EnsureDefault();

        foreach (var definition in Buckets.Values)
        {
            Apply(definition);
        }
    }

    public static IReadOnlyList<BucketDefinition> All()
    {
        var all = new List<BucketDefinition>(Buckets.Values);

        all.Sort(static (left, right) => left.Id.CompareTo(right.Id));

        return all;
    }

    public static bool Exists(int id) => Buckets.ContainsKey(id);

    public static string DisplayName(int id) =>
        Buckets.GetValueOrDefault(id) is { } definition && definition.Name.Length > 0
            ? definition.Name
            : "World " + id.ToString(CultureInfo.InvariantCulture);

    public static BucketDefinition? Find(int id) => Buckets.GetValueOrDefault(id);

    public static bool NameTaken(string name, int exceptId)
    {
        foreach (var definition in Buckets.Values)
        {
            if (definition.Id != exceptId
                && string.Equals(definition.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    public static int NextFreeId()
    {
        for (var id = BucketRules.DefaultBucket + 1; id <= BucketRules.MaxId; id++)
        {
            if (!Buckets.ContainsKey(id))
            {
                return id;
            }
        }

        return -1;
    }

    public static BucketDefinition? Create(string normalizedName)
    {
        var id = NextFreeId();

        if (id < 0)
        {
            return null;
        }

        var definition = new BucketDefinition
        {
            Id = id,
            Name = normalizedName,
            PopulationEnabled = true,
            LockdownMode = Settings.NewWorldLockdown(),
        };

        Buckets[id] = definition;

        Apply(definition);

        return definition;
    }

    public static bool Rename(int id, string normalizedName)
    {
        if (Buckets.GetValueOrDefault(id) is not { } definition)
        {
            return false;
        }

        definition.Name = normalizedName;

        return true;
    }

    public static bool Delete(int id) => id != BucketRules.DefaultBucket && Buckets.Remove(id);

    public static bool SetPopulation(int id, bool enabled)
    {
        if (Buckets.GetValueOrDefault(id) is not { } definition)
        {
            return false;
        }

        definition.PopulationEnabled = enabled;

        Apply(definition);

        return true;
    }

    public static bool SetLockdown(int id, string mode)
    {
        if (Buckets.GetValueOrDefault(id) is not { } definition)
        {
            return false;
        }

        definition.LockdownMode = mode;

        Apply(definition);

        return true;
    }

    public static bool Save() => BucketStore.Save(All());

    private static void EnsureDefault()
    {
        if (Buckets.TryGetValue(BucketRules.DefaultBucket, out var existing))
        {

            existing.Name = DefaultName;

            return;
        }

        Buckets[BucketRules.DefaultBucket] = new BucketDefinition
        {
            Id = BucketRules.DefaultBucket,
            Name = DefaultName,
        };
    }

    private static void Apply(BucketDefinition definition)
    {
        try
        {
            Native.SetRoutingBucketPopulationEnabled(definition.Id, definition.PopulationEnabled);
            Native.SetRoutingBucketEntityLockdownMode(definition.Id, definition.LockdownMode);
        }
        catch (Exception exception)
        {
            SharedAPI.Log.Error($"[RoutingBuckets] Could not apply settings to world {definition.Id}: {exception.Message}");
        }
    }
}
