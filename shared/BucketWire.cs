using System.Globalization;
using System.Text;

namespace RoutingBucketsPlugin.Shared;

public static class BucketWire
{
    public const char FieldSeparator = (char)31;

    public const char RecordSeparator = (char)30;

    public const int FlagManaged = 1;

    private const int BucketFieldCount = 6;

    private const int OccupantFieldCount = 3;

    public static void AppendBucket(
        StringBuilder into,
        int id,
        int flags,
        bool populationEnabled,
        int lockdown,
        int occupants,
        string name)
    {
        if (into.Length > 0)
        {
            into.Append(RecordSeparator);
        }

        into.Append(id.ToString(CultureInfo.InvariantCulture));
        into.Append(FieldSeparator);
        into.Append(flags.ToString(CultureInfo.InvariantCulture));
        into.Append(FieldSeparator);
        into.Append(populationEnabled ? '1' : '0');
        into.Append(FieldSeparator);
        into.Append(lockdown.ToString(CultureInfo.InvariantCulture));
        into.Append(FieldSeparator);
        into.Append(occupants.ToString(CultureInfo.InvariantCulture));
        into.Append(FieldSeparator);

        into.Append(Clean(name));
    }

    public static void AppendOccupant(StringBuilder into, int bucketId, int serverId, string name)
    {
        if (into.Length > 0)
        {
            into.Append(RecordSeparator);
        }

        into.Append(bucketId.ToString(CultureInfo.InvariantCulture));
        into.Append(FieldSeparator);
        into.Append(serverId.ToString(CultureInfo.InvariantCulture));
        into.Append(FieldSeparator);
        into.Append(Clean(name));
    }

    public static List<BucketRow> ParseBuckets(string? payload)
    {
        var rows = new List<BucketRow>();

        if (string.IsNullOrEmpty(payload))
        {
            return rows;
        }

        foreach (var record in payload.Split(RecordSeparator))
        {
            if (TryParseBucket(record, out var row))
            {
                rows.Add(row);
            }
        }

        return rows;
    }

    public static List<OccupantRow> ParseOccupants(string? payload)
    {
        var rows = new List<OccupantRow>();

        if (string.IsNullOrEmpty(payload))
        {
            return rows;
        }

        foreach (var record in payload.Split(RecordSeparator))
        {
            if (TryParseOccupant(record, out var row))
            {
                rows.Add(row);
            }
        }

        return rows;
    }

    public static string Clean(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(text.Length);

        foreach (var character in text)
        {
            if (character == FieldSeparator || character == RecordSeparator || char.IsControl(character))
            {
                continue;
            }

            builder.Append(character);
        }

        return builder.ToString();
    }

    private static bool TryParseBucket(string record, out BucketRow row)
    {
        row = new BucketRow();

        var fields = record.Split(FieldSeparator);

        if (fields.Length != BucketFieldCount)
        {
            return false;
        }

        if (!TryInt(fields[0], out var id)
            || !TryInt(fields[1], out var flags)
            || !TryInt(fields[3], out var lockdown)
            || !TryInt(fields[4], out var occupants))
        {
            return false;
        }

        row.Id = id;
        row.Flags = flags;
        row.PopulationEnabled = fields[2] == "1";
        row.Lockdown = lockdown;
        row.Occupants = occupants;
        row.Name = fields[5];

        return true;
    }

    private static bool TryParseOccupant(string record, out OccupantRow row)
    {
        row = new OccupantRow();

        var fields = record.Split(FieldSeparator);

        if (fields.Length != OccupantFieldCount)
        {
            return false;
        }

        if (!TryInt(fields[0], out var bucketId) || !TryInt(fields[1], out var serverId))
        {
            return false;
        }

        row.BucketId = bucketId;
        row.ServerId = serverId;
        row.Name = fields[2];

        return true;
    }

    private static bool TryInt(string value, out int parsed) =>
        int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed);
}

public sealed class BucketRow
{
    public int Id { get; set; }

    public int Flags { get; set; }

    public bool PopulationEnabled { get; set; }

    public int Lockdown { get; set; }

    public int Occupants { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool IsManaged => (Flags & BucketWire.FlagManaged) != 0;
}

public sealed class OccupantRow
{
    public int BucketId { get; set; }

    public int ServerId { get; set; }

    public string Name { get; set; } = string.Empty;
}
