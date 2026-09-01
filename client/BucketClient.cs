using CitizenFX.FiveM.Client;

using RoutingBucketsPlugin.Shared;

namespace RoutingBucketsPlugin.Client;

public sealed class BucketClient
{
    private bool _registered;

    public event Action<int, List<BucketRow>, List<OccupantRow>>? StateChanged;

    public event Action<int, string>? ResultReceived;

    public event Action<string, string, string>? Moved;

    public void Register()
    {
        if (_registered)
        {
            return;
        }

        _registered = true;

        API.OnNetEvent(BucketEvents.State, new Action<int, string, string>(OnState), false);
        API.OnNetEvent(BucketEvents.Result, new Action<int, string>(OnResult), false);
        API.OnNetEvent(BucketEvents.Moved, new Action<string, string, string>(OnMoved), false);
    }

    public static void RequestState() => API.EmitServer(BucketEvents.RequestState);

    public static void Send(string command, params string[] args) =>
        API.EmitServer(BucketEvents.Command, command, args);

    private void OnState(int viewerBucket, string buckets, string occupants) =>
        StateChanged?.Invoke(viewerBucket, BucketWire.ParseBuckets(buckets), BucketWire.ParseOccupants(occupants));

    private void OnResult(int outcome, string detail) => ResultReceived?.Invoke(outcome, detail);

    private void OnMoved(string fromName, string toName, string actor) => Moved?.Invoke(fromName, toName, actor);
}
