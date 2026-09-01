using CitizenFX.FiveM.Server;
using CitizenFX.FiveM.Shared.Script;

using RoutingBucketsPlugin.Shared;

using vMenu.Enhanced.ServerAPI;

namespace RoutingBucketsPlugin.Server;

public sealed class Main : IScript
{
    public async void Initialize()
    {
        BucketRegistry.Load();

        CommandRateLimit.Register();
        CommandRouter.Register();
        BucketBroadcast.Register();

        var declaration = new ServerPluginDeclaration("Routing Buckets")
            .AddPermission(
                Permissions.View,
                "Lets someone open the Routing Buckets menu and see which worlds exist and who is in them.",
                staffOnly: true)
            .AddPermission(
                Permissions.Join,
                "Lets someone move themselves between worlds, including to whichever world another player is in.",
                staffOnly: true)
            .AddPermission(
                Permissions.Manage,
                "Lets someone create, rename and delete worlds.",
                staffOnly: true)
            .AddPermission(
                Permissions.World,
                "Lets someone turn a world's ambient traffic and pedestrians on or off, and change its entity lockdown.",
                staffOnly: true)
            .AddPermission(
                Permissions.Move,
                "Lets someone move other players between worlds, and empty a world back into the main one.",
                staffOnly: true)
            .AddBoolSetting(
                SettingNames.Enabled,
                true,
                "Turns the Routing Buckets plugin on or off. Off hides every row and refuses every action.")
            .AddBoolSetting(
                SettingNames.AllowSelfJoin,
                true,
                "Lets staff move themselves between worlds. Off leaves them able to move other players only.")
            .AddIntSetting(
                SettingNames.MaxWorlds,
                32,
                "How many worlds may exist at once, not counting the main world. Raising this a long way "
                + "can make the menu big enough that vMenu starts skipping rows.")
            .AddStringSetting(
                SettingNames.DefaultLockdown,
                "inactive",
                "The entity lockdown a newly created world starts with: strict, relaxed or inactive.")
            .AddBoolSetting(
                SettingNames.Persist,
                true,
                "Saves world names and settings to buckets.json so they survive a restart. Needs "
                + "add_filesystem_permission in your server.cfg.");

        var result = await VMenuServer.RegisterAsync(declaration);

        API.Log.Info(
            $"[RoutingBuckets] Registered with vMenu: {result.Accepted}. {BucketRegistry.Count} world(s) loaded.");
    }
}
