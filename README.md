# vMenu Routing Buckets

A [vMenu Enhanced](https://github.com/TomGrobbe/vMenu) plugin for managing routing buckets, the
separate worlds FiveM can split a server into. People in different worlds share the server but
cannot see each other at all.

It lets staff create worlds and name them, see who is in each one, move themselves and other players
between them, choose how busy each world is, and change its entity lockdown. Names and settings are
saved, so a restart keeps them.

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
| `World` | admin | Changing how busy a world is, and its entity lockdown |
| `Move` | admin | Moving other players between worlds, and emptying a world |

```ini
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.All" allow
add_ace builtin.everyone "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Join" allow
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Manage" allow
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Move" allow
add_ace builtin.everyone "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.View" allow
add_ace group.admin "vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.World" allow
```

## How busy a world is

Every world has four lists in its menu, one for each kind of thing the game fills the city with on its
own:

- **Pedestrians**, the people walking around.
- **People at spots**, the people sitting on benches, standing at bars or smoking outside shops.
- **Traffic**, the cars driving around.
- **Parked cars**, the cars standing along the streets and in car parks.

Each one goes from 0.0 to 1.0 in steps of 0.1. Think of it as a percentage: 1.0 is what the game
normally does, 0.5 is half of that, and 0.0 is none at all. So you could have a quiet world with a few
people walking around (0.1), half the usual parked cars (0.5) and almost normal traffic (0.9).

A change only stops new people and cars from appearing. Whatever is already standing or driving around
stays until the game cleans it up on its own, which happens once you move away from it.

### Letting another script handle it

If you already have a script that controls pedestrians and traffic, the plugin and that script would
fight over it. Turn off the `ManageDensity` setting in the configuration file and the plugin keeps its
hands off completely. The four lists disappear from the menu, and the plugin no longer changes how
many people and cars there are, so your other script is in charge.

```ini
setr vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.ManageDensity false
```

The values you set earlier stay saved, so turning the setting back on later brings them back. If you
turn it off while the server is running, restart the server once afterwards so FiveM forgets the
settings the plugin had already given it.

## Seeing what happens

By default the plugin keeps the server console quiet. If you want a line in the console every time
somebody creates, changes or deletes a world, or moves a player between worlds, turn on the `Debug`
setting in the configuration file:

```ini
setr vMenu.Enhanced.Plugins.vMenu_RoutingBucketsPlugin.Debug true
```

## Building it yourself

You only need this if you want to change the plugin. Everyone else can grab the zip from the releases
page.

The plugin is written in TypeScript, which is JavaScript with types added on top so mistakes are caught
before the code ever runs. Your server cannot run TypeScript directly, so a build step turns it into two
plain JavaScript files, one for the players' game (`client.js`) and one for the server (`server.js`).

1. Install [Node.js](https://nodejs.org/) version 22 or newer. This is the program that runs the build.
2. Open a terminal in this folder and run `npm ci`. That downloads the tools the build needs, including
   vMenu's plugin library, into a `node_modules` folder.
3. Run `npm run build`. It checks the code for mistakes first, and when everything is fine it writes the
   finished resource to `build/vMenu.RoutingBucketsPlugin/`.
4. Copy that folder into your server's resources, exactly like the zip from the releases page.

The code lives in `src/`. Anything in `src/client` runs in the game of each player, anything in
`src/server` runs on the server, and `src/shared` holds the bits both of them use.

## License

GPL-3.0-or-later, the same as vMenu. See `LICENSE.md`.
