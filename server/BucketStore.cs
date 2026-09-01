using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Shared;

using RoutingBucketsPlugin.Shared;

using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RoutingBucketsPlugin.Server;

public sealed class BucketDefinition
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool PopulationEnabled { get; set; } = true;

    public string LockdownMode { get; set; } = BucketRules.LockdownInactive;
}

public sealed class BucketFile
{
    public List<BucketDefinition> Buckets { get; set; } = [];
}

public static class BucketStore
{

    private const string FileName = "buckets.json";

    private static readonly JsonSerializerOptions Options = CreateOptions();

    public static List<BucketDefinition> Load()
    {
        var contents = Native.LoadResourceFile(Native.GetCurrentResourceName(), FileName);

        if (string.IsNullOrWhiteSpace(contents))
        {
            return [];
        }

        try
        {
            var file = JsonSerializer.Deserialize<BucketFile>(contents, Options);

            return file?.Buckets ?? [];
        }
        catch (JsonException exception)
        {
            SharedAPI.Log.Error(
                $"[RoutingBuckets] {FileName} did not read ({exception.Message}). Starting with no saved "
                + "worlds. The next change you make will overwrite the file, so move it aside now if you "
                + "want to keep it.");

            return [];
        }
    }

    public static bool Save(IReadOnlyList<BucketDefinition> buckets)
    {
        if (!Settings.PersistsToDisk())
        {
            return true;
        }

        var file = new BucketFile { Buckets = [.. buckets] };
        var json = JsonSerializer.Serialize(file, Options);

        if (Native.SaveResourceFile(Native.GetCurrentResourceName(), FileName, Encoding.UTF8.GetBytes(json)))
        {
            return true;
        }

        var resource = Native.GetCurrentResourceName();

        SharedAPI.Log.Warn(
            $"[RoutingBuckets] Could not write {FileName}. Add 'add_filesystem_permission {resource} "
            + $"write {resource}' to your server.cfg, above the line that starts the resource. World "
            + "names and settings will not survive a restart until you do.");

        return false;
    }

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
            NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,

            WriteIndented = true,
        };

        ApplyReadableEncoder(options);

        return options;
    }

    private static void ApplyReadableEncoder(JsonSerializerOptions options)
    {
        try { options.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping; } catch { }
    }
}
