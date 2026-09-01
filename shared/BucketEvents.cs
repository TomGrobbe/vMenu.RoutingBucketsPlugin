namespace RoutingBucketsPlugin.Shared;

public static class BucketEvents
{
    private const string Prefix = "vMenu.RoutingBucketsPlugin:";

    public const string RequestState = Prefix + "RequestState";

    public const string Command = Prefix + "Command";

    public const string State = Prefix + "State";

    public const string Result = Prefix + "Result";

    public const string Moved = Prefix + "Moved";
}
