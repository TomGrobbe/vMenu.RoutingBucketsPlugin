using CitizenFX.FiveM.Server;

using RoutingBucketsPlugin.Shared;

namespace RoutingBucketsPlugin.Server;

public static class Settings
{
    private const string Prefix = "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.";

    private const int MinWorldCap = 1;

    private const int MaxWorldCap = 512;

    public static bool IsEnabled() => Native.GetConvarBool(Prefix + SettingNames.Enabled, true);

    public static bool AllowsSelfJoin() => Native.GetConvarBool(Prefix + SettingNames.AllowSelfJoin, true);

    public static bool PersistsToDisk() => Native.GetConvarBool(Prefix + SettingNames.Persist, true);

    public static int MaxWorldCount() =>
        Math.Clamp(Native.GetConvarInt(Prefix + SettingNames.MaxWorlds, 32), MinWorldCap, MaxWorldCap);

    public static string NewWorldLockdown()
    {
        var configured = Native.GetConvar(Prefix + SettingNames.DefaultLockdown, BucketRules.LockdownInactive);

        return BucketRules.IsValidLockdown(configured) ? configured : BucketRules.LockdownInactive;
    }
}
