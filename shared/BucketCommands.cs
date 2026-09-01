namespace RoutingBucketsPlugin.Shared;

public static class BucketCommands
{
    public const string Create = "create";

    public const string Rename = "rename";

    public const string Delete = "delete";

    public const string Join = "join";

    public const string Leave = "leave";

    public const string Population = "population";

    public const string Lockdown = "lockdown";

    public const string Evict = "evict";

    public const string Bring = "bring";

    public const string Send = "send";

    public const string Goto = "goto";

    public const string MoveEntity = "moveentity";

    public const string MoveNearby = "movenearby";
}

public static class ResultDetails
{
    public const string Created = "created";

    public const string Renamed = "renamed";

    public const string Evicted = "evicted";

    public const string MovedNearby = "movednearby";

    public const string MovedEntity = "movedentity";

    public static string Pack(string tag, params string[] values) =>
        values.Length == 0 ? tag : tag + BucketWire.FieldSeparator + string.Join(BucketWire.FieldSeparator, values);

    public static string[] Unpack(string detail) => detail.Split(BucketWire.FieldSeparator);
}

public static class BucketOutcome
{
    public const int Ok = 0;

    public const int Denied = 1;

    public const int UnknownBucket = 2;

    public const int NameTaken = 3;

    public const int BadName = 4;

    public const int TooManyBuckets = 5;

    public const int CannotModifyDefault = 6;

    public const int BucketNotEmpty = 7;

    public const int UnknownPlayer = 8;

    public const int SaveFailed = 9;

    public const int RateLimited = 10;

    public const int UnknownEntity = 11;

    public const int Failed = 12;

    public const int Count = 13;
}
