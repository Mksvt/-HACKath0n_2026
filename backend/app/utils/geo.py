from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
from typing import Iterable, Tuple

import numpy as np
from pymap3d import geodetic2enu

EARTH_RADIUS_M = 6371000.0


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance using the haversine formula.

    The formula computes the central angle between two points on a sphere and
    multiplies by Earth radius: 2 * R * arcsin(sqrt(a)), where a is the
    haversine of the latitude/longitude deltas.
    """

    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = sin(d_phi / 2.0) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2.0) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def total_haversine_distance(coords: Iterable[Tuple[float, float]]) -> float:
    pairs = list(coords)
    if len(pairs) < 2:
        return 0.0

    distance = 0.0
    for idx in range(1, len(pairs)):
        lat1, lon1 = pairs[idx - 1]
        lat2, lon2 = pairs[idx]
        distance += haversine_distance_m(lat1, lon1, lat2, lon2)
    return distance


def wgs84_to_enu(
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    altitudes_m: np.ndarray,
    origin_lat: float,
    origin_lon: float,
    origin_alt: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Convert WGS-84 geodetic coordinates to local ENU in meters.

    ENU axes are defined as x=East, y=North, z=Up. The first valid GPS point is
    used as the local tangent plane origin so downstream consumers can work in
    meters instead of degrees.
    """

    east, north, up = geodetic2enu(
        latitudes,
        longitudes,
        altitudes_m,
        origin_lat,
        origin_lon,
        origin_alt,
    )
    return np.array(east), np.array(north), np.array(up)


def sampling_frequency(time_seconds: np.ndarray) -> float | None:
    if len(time_seconds) < 2:
        return None
    deltas = np.diff(time_seconds)
    positive = deltas[deltas > 0]
    if len(positive) == 0:
        return None
    return float(1.0 / np.median(positive))
