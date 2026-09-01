using System.Numerics;

using CitizenFX.FiveM.Client;

using RoutingBucketsPlugin.Shared;

namespace RoutingBucketsPlugin.Client;

public sealed class WorldTools
{
    private const float ProbeLength = 100f;

    private const int ProbeEverything = -1;

    private const int ProbeOptions = 4;

    private const int SphereMarker = 28;

    private const int OutlineRed = 90;

    private const int OutlineGreen = 200;

    private const int OutlineBlue = 255;

    private const int OutlineAlpha = 255;

    private int _selected;

    private int _selectedNetworkId;

    private int _sphereRadius;

    private bool _sphereVisible;

    public int SelectedNetworkId => _selectedNetworkId;

    public bool HasSelection => _selected != 0 && Native.DoesEntityExist(_selected);

    public event Action? SelectionChanged;

    public void Start() => _ = DrawLoopAsync();

    public bool SelectLookedAt()
    {
        var ped = Native.PlayerPedId();
        var start = Native.GetGameplayCamCoord();
        var end = start + (DirectionFrom(Native.GetGameplayCamRot(2)) * ProbeLength);

        var probe = Native.StartExpensiveSynchronousShapeTestLosProbe(
            start.X,
            start.Y,
            start.Z,
            end.X,
            end.Y,
            end.Z,
            ProbeEverything,
            ped,
            ProbeOptions);

        Native.GetShapeTestResult(probe, out var hit, out _, out _, out var entity);

        if (hit == 0 || entity == 0 || entity == ped || !Native.DoesEntityExist(entity))
        {
            return false;
        }

        if (!Native.NetworkGetEntityIsNetworked(entity))
        {
            return false;
        }

        Clear();

        _selected = entity;
        _selectedNetworkId = Native.NetworkGetNetworkIdFromEntity(entity);

        Native.SetEntityDrawOutlineColor(OutlineRed, OutlineGreen, OutlineBlue, OutlineAlpha);
        Native.SetEntityDrawOutline(entity, true);

        SelectionChanged?.Invoke();

        return true;
    }

    public void Clear()
    {
        if (_selected != 0 && Native.DoesEntityExist(_selected))
        {
            Native.SetEntityDrawOutline(_selected, false);
        }

        _selected = 0;
        _selectedNetworkId = 0;

        SelectionChanged?.Invoke();
    }

    public void ShowSphere(int radius)
    {
        _sphereRadius = radius;
        _sphereVisible = true;
    }

    public void HideSphere() => _sphereVisible = false;

    private async Task DrawLoopAsync()
    {
        while (true)
        {
            await API.Delay(0);

            if (_selected != 0 && !Native.DoesEntityExist(_selected))
            {
                Clear();
            }

            if (!_sphereVisible || _sphereRadius <= 0)
            {
                continue;
            }

            var ped = Native.PlayerPedId();

            if (ped == 0)
            {
                continue;
            }

            var centre = Native.GetEntityCoords(ped, true);
            var size = _sphereRadius * 2f;

            Native.DrawMarker(
                SphereMarker,
                centre.X,
                centre.Y,
                centre.Z,
                0f,
                0f,
                0f,
                0f,
                0f,
                0f,
                size,
                size,
                size,
                OutlineRed,
                OutlineGreen,
                OutlineBlue,
                60,
                false,
                false,
                2,
                false,
                null,
                null,
                false);
        }
    }

    private static Vector3 DirectionFrom(Vector3 rotation)
    {
        var z = rotation.Z * ((float)Math.PI / 180f);
        var x = rotation.X * ((float)Math.PI / 180f);
        var flat = Math.Abs((float)Math.Cos(x));

        return new Vector3(
            (float)-Math.Sin(z) * flat,
            (float)Math.Cos(z) * flat,
            (float)Math.Sin(x));
    }
}
