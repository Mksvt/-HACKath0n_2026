import numpy as np

from app.utils.geo import haversine_distance_m, total_haversine_distance, wgs84_to_enu


def test_haversine_zero_distance():
    assert haversine_distance_m(0, 0, 0, 0) == 0


def test_haversine_known_distance():
    # Approx distance between two nearby points in meters
    d = haversine_distance_m(37.7749, -122.4194, 37.7750, -122.4184)
    assert 80 < d < 100


def test_total_haversine():
    coords = [(0, 0), (0, 1), (0, 2)]
    d = total_haversine_distance(coords)
    assert d > 2 * 1000 * 100  # rough sanity check


def test_wgs84_to_enu_zero_origin():
    lat = np.array([10.0, 10.0])
    lon = np.array([20.0, 20.0001])
    alt = np.array([5.0, 5.5])
    east, north, up = wgs84_to_enu(lat, lon, alt, 10.0, 20.0, 5.0)
    assert east[0] == 0 and north[0] == 0 and up[0] == 0
    assert east[1] > 0
    assert up[1] > 0
