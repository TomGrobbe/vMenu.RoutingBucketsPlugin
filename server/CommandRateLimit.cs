using CitizenFX.FiveM.Server;

namespace RoutingBucketsPlugin.Server;

public static class CommandRateLimit
{
    private const int Allowance = 15;

    private const long WindowMs = 10000;

    private const string DroppedEvent = "playerDropped";

    private static readonly Dictionary<int, Window> Windows = [];

    private static bool _registered;

    public static void Register()
    {
        if (_registered)
        {
            return;
        }

        _registered = true;

        API.OnEvent(DroppedEvent, new Action<int, string?>(OnPlayerDropped), false);
    }

    public static bool TryTake(int serverId)
    {
        var now = DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond;

        if (!Windows.TryGetValue(serverId, out var window) || now - window.StartedMs >= WindowMs)
        {
            Windows[serverId] = new Window { StartedMs = now, Used = 1 };

            return true;
        }

        if (window.Used >= Allowance)
        {
            return false;
        }

        window.Used++;

        return true;
    }

    private static void OnPlayerDropped(int source, string? reason) => Windows.Remove(source);

    private sealed class Window
    {
        public long StartedMs { get; set; }

        public int Used { get; set; }
    }
}
