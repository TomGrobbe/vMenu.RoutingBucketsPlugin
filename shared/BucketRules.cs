using System.Text;

namespace RoutingBucketsPlugin.Shared;

public static class BucketRules
{
    public const int MinId = 0;

    public const int MaxId = 65535;

    public const int DefaultBucket = 0;

    public const int MinNameLength = 1;

    public const int MaxNameLength = 32;

    public const int MaxRadius = 100;

    public static readonly int[] Radii = [5, 10, 25, 50, 100];

    public const string LockdownStrict = "strict";

    public const string LockdownRelaxed = "relaxed";

    public const string LockdownInactive = "inactive";

    public static bool IsValidId(int id) => id is >= MinId and <= MaxId;

    public static bool IsValidRadius(int metres) => metres is > 0 and <= MaxRadius;

    public static bool IsValidLockdown(string? mode) =>
        mode is LockdownInactive or LockdownRelaxed or LockdownStrict;

    public static int LockdownToIndex(string? mode) => mode switch
    {
        LockdownRelaxed => 1,
        LockdownStrict => 2,
        _ => 0,
    };

    public static string LockdownFromIndex(int index) => index switch
    {
        1 => LockdownRelaxed,
        2 => LockdownStrict,
        _ => LockdownInactive,
    };

    public static string? NormalizeName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var builder = new StringBuilder(raw.Length);
        var pendingSpace = false;
        var hasContent = false;

        foreach (var character in raw)
        {
            if (char.IsWhiteSpace(character))
            {
                pendingSpace = builder.Length > 0;

                continue;
            }

            if (char.IsControl(character) || character == BucketWire.FieldSeparator || character == BucketWire.RecordSeparator)
            {
                continue;
            }

            if (pendingSpace)
            {
                builder.Append(' ');
                pendingSpace = false;
            }

            builder.Append(character);

            hasContent |= char.IsLetterOrDigit(character);
        }

        if (!hasContent || builder.Length < MinNameLength || builder.Length > MaxNameLength)
        {
            return null;
        }

        return builder.ToString();
    }
}
