using vMenu.Enhanced.ClientAPI;

namespace RoutingBucketsPlugin.Client;

public static class Translations
{
    public static void Add(VMenuPlugin plugin) => plugin.Translations.Add("en", English);

    private static Dictionary<string, string> English => new()
    {
        ["rb.name"] = "Routing Buckets",
        ["rb.description"] = "Separate worlds on this server, and who is in them.",
        ["rb.subtitle"] = "Routing Buckets",
        ["rb.world.subtitle"] = "Routing bucket {id}",
        ["rb.bucket.label"] = "Bucket {id}",

        ["rb.section.you"] = "Where you are",
        ["rb.section.worlds"] = "Worlds",
        ["rb.section.manage"] = "Manage",
        ["rb.section.tools"] = "Tools",

        ["rb.entity"] = "Move a single thing",
        ["rb.entity.desc"] = "Pick out one vehicle, person or object by looking at it, then send it to another world.",
        ["rb.entity.select"] = "Select what you are looking at",
        ["rb.entity.select.desc"] = "Aim at something and press this. It gets an outline so you can see what you picked.",
        ["rb.entity.selected"] = "Selected. It is outlined so you can see which one.",
        ["rb.entity.none"] = "Nothing there. Aim closer at something the server knows about.",
        ["rb.entity.clear"] = "Clear the selection",
        ["rb.entity.clear.desc"] = "Drops the current selection and removes the outline.",
        ["rb.entity.cleared"] = "Selection cleared.",
        ["rb.entity.nothing"] = "Nothing is selected yet.",
        ["rb.entity.move"] = "Send it to",
        ["rb.entity.move.desc"] = "Pick a world and press to move whatever you have selected into it.",

        ["rb.nearby"] = "Move everyone nearby",
        ["rb.nearby.desc"] = "Sweep up every player around you and move them to another world in one go.",
        ["rb.nearby.radius"] = "How far",
        ["rb.nearby.radius.desc"] = "While this row is highlighted a sphere is drawn around you, so you can see exactly who is inside it.",
        ["rb.nearby.metres"] = "{metres} m",
        ["rb.nearby.destination"] = "Send them to",
        ["rb.nearby.destination.desc"] = "The world everybody inside the sphere ends up in.",
        ["rb.nearby.self"] = "Take yourself along",
        ["rb.nearby.self.desc"] = "Whether you go with them. Off leaves you standing where you are, in the world you are already in.",
        ["rb.nearby.bring"] = "Move everyone in the sphere",
        ["rb.nearby.bring.desc"] = "Moves every player inside the sphere, and the car they are driving. They stay where they are standing.",
        ["rb.nearby.bring.confirm"] = "Press again to move everybody inside the sphere.",

        ["rb.current"] = "You are in {world}",
        ["rb.current.desc"] =
            "This is routing bucket {id}, the number to use from your own scripts. A world is a "
            + "separate copy of the server: people in different worlds share the server but cannot see "
            + "each other at all, not each other's cars and not each other's gunfire.",

        ["rb.leave"] = "Back to the main world",
        ["rb.leave.desc"] = "Puts you back in the world everybody else is in. You stay exactly where you are standing.",

        ["rb.create"] = "Create a world",
        ["rb.create.desc"] = "Makes a new empty world and gives it a name. Nobody is moved into it.",
        ["rb.create.prompt"] = "Name this world",

        ["rb.world.desc"] =
            "Routing bucket {id}. Open it to see who is in it, change how it behaves, or move yourself "
            + "into it.",
        ["rb.world.unmanaged"] = "World {id}",
        ["rb.world.unmanaged.desc"] =
            "Routing bucket {id}. Somebody is in it, but it has no name here. Another resource probably "
            + "made it, or the saved names were lost. You can still empty it back into the main world.",

        ["rb.players.none"] = "Empty",
        ["rb.players.one"] = "1 player",
        ["rb.players.many"] = "{count} players",

        ["rb.occupants"] = "Who is here",
        ["rb.occupants.desc"] = "Everybody currently in this world.",
        ["rb.occupants.none"] = "Nobody is in this world",
        ["rb.occupant"] = "{name} [{id}]",

        ["rb.goto"] = "Go to this world",
        ["rb.goto.desc"] = "Moves you into this world. You stay where you are standing, the world around you changes.",
        ["rb.goto.here"] = "You are already in this world.",

        ["rb.population"] = "Ambient traffic and pedestrians",
        ["rb.population.desc"] =
            "Whether the game spawns its usual traffic and people in this world. Off leaves an empty city, "
            + "which is what you usually want for an event.",

        ["rb.lockdown"] = "Entity lockdown",
        ["rb.lockdown.desc"] =
            "How strictly this world stops players creating things. Inactive is normal play. Relaxed keeps "
            + "players from making new vehicles and props but leaves what is already there. Strict allows "
            + "nothing new at all, which is the setting for a world you have laid out yourself.",
        ["rb.lockdown.inactive"] = "Inactive",
        ["rb.lockdown.relaxed"] = "Relaxed",
        ["rb.lockdown.strict"] = "Strict",

        ["rb.reset"] = "Reset this world's settings",
        ["rb.reset.desc"] = "Puts ambient traffic back on and entity lockdown back to inactive.",

        ["rb.evict"] = "Move everyone to the main world",
        ["rb.evict.desc"] =
            "Sends everybody in this world back to the main one. They stay where they are standing. Do this "
            + "before deleting a world.",
        ["rb.evict.confirm"] = "Press again to move everybody here back to the main world.",

        ["rb.rename"] = "Rename this world",
        ["rb.rename.desc"] = "Changes the name shown in this menu. Nothing else about the world changes.",
        ["rb.rename.prompt"] = "New name for this world",

        ["rb.delete"] = "Delete this world",
        ["rb.delete.desc"] = "Forgets this world and its settings. Only possible once nobody is in it.",
        ["rb.delete.confirm"] = "Press again to delete this world.",
        ["rb.delete.occupied"] = "Somebody is still in this world. Move everyone out first.",

        ["rb.pa.header"] = "Worlds",
        ["rb.pa.bring"] = "Bring to my world",
        ["rb.pa.bring.desc"] =
            "Moves this player into the world you are in. It does not teleport them, they stay where they "
            + "are standing.",
        ["rb.pa.send"] = "Send to a world",
        ["rb.pa.send.desc"] =
            "Moves this player into the world picked here. The same choice is shared by every player, so it "
            + "is whatever you last set it to.",
        ["rb.pa.goto"] = "Go to their world",
        ["rb.pa.goto.desc"] = "Moves you into whichever world this player is in. You are not teleported to them.",
        ["rb.pa.stale"] = "That world is gone. Open the menu again to refresh the list.",

        ["rb.result.0"] = "Done.",
        ["rb.result.1"] = "You are not allowed to do that.",
        ["rb.result.2"] = "That world no longer exists.",
        ["rb.result.3"] = "There is already a world with that name.",
        ["rb.result.4"] = "That name will not do. Use 1 to 32 characters, with at least one letter or number.",
        ["rb.result.5"] = "There are already as many worlds as this server allows.",
        ["rb.result.6"] = "The main world cannot be renamed or deleted.",
        ["rb.result.7"] = "Somebody is still in that world. Move everyone out first.",
        ["rb.result.8"] = "That player is no longer on the server.",
        ["rb.result.9"] = "That worked, but it could not be saved, so it will be forgotten on the next restart.",
        ["rb.result.10"] = "You are doing that too quickly. Wait a moment.",
        ["rb.result.11"] = "That thing is gone. Select something else.",
        ["rb.result.12"] = "That did not work.",

        ["rb.moved.self"] = "You left ~y~{from}~s~ and are now in ~g~{to}~s~.",
        ["rb.moved.other"] = "~y~{actor}~s~ moved you from ~y~{from}~s~ to ~g~{to}~s~.",

        ["rb.created"] = "Created ~g~{name}~s~ as routing bucket ~g~{id}~s~.",
        ["rb.renamed"] = "Renamed to ~g~{name}~s~.",
        ["rb.movedentity"] = "Moved it to ~g~{world}~s~.",
        ["rb.movednearby"] = "Moved ~g~{count}~s~ player(s) to ~g~{world}~s~.",
        ["rb.evicted"] = "Moved ~g~{count}~s~ player(s) back to the main world.",
    };
}
