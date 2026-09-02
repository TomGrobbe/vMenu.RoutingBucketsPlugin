# vMenu Routing Buckets

A [vMenu Enhanced](https://github.com/TomGrobbe/vMenu) plugin for managing routing buckets, the
separate worlds FiveM can split a server into. People in different worlds share the server but
cannot see each other at all.

It lets staff create worlds and name them, see who is in each one, move themselves and other players
between them, and turn a world's ambient traffic and entity lockdown on or off. Names and settings
are saved, so a restart keeps them.

## Installing

Drop the `vMenu.RoutingBucketsPlugin` folder into your resources and start it once, so vMenu writes
two `.example` config files into `vMenu.Enhanced/config/plugins/`. Copy each one, drop the
`.example` off the end, edit the copy, then add this to `server.cfg`:

```ini
exec @vMenu.Enhanced/config/plugins/vMenu.RoutingBucketsPlugin.permissions.cfg
exec @vMenu.Enhanced/config/plugins/vMenu.RoutingBucketsPlugin.configuration.cfg

add_filesystem_permission vMenu.RoutingBucketsPlugin write vMenu.RoutingBucketsPlugin

ensure vMenu.Enhanced
ensure vMenu.RoutingBucketsPlugin
```

The `add_filesystem_permission` line is what lets the plugin save world names. Without it everything
still works, but names are forgotten on every restart.

## Permissions

Every permission is prefixed with `vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.`, and `.All`
grants all of them at once. The example config gives everyone the two harmless ones and keeps the
rest for admins, which you can of course change to whatever suits your server.

| Permission | Default | What it allows |
| --- | --- | --- |
| `View` | everyone | Opening the menu, seeing the worlds and who is in them |
| `Join` | everyone | Moving yourself between worlds |
| `Manage` | admin | Creating, renaming and deleting worlds |
| `World` | admin | Changing a world's ambient traffic and entity lockdown |
| `Move` | admin | Moving other players between worlds, and emptying a world |

```ini
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.All" allow
add_ace builtin.everyone "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Join" allow
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Manage" allow
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Move" allow
add_ace builtin.everyone "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.View" allow
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.World" allow
```

## License

GPL-3.0-or-later, the same as vMenu. See `LICENSE.md`.
