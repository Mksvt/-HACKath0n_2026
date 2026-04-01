from __future__ import annotations

import numpy as np


def trapezoidal_integrate(time_s: np.ndarray, values: np.ndarray) -> np.ndarray:
    """Integrate using the composite trapezoidal rule.

    For acceleration arrays, this recovers velocity by summing trapezoid areas:
    v[i] = v[i-1] + 0.5 * (a[i] + a[i-1]) * dt. This keeps the integration
    drift explicit; users should be aware IMU double integration accumulates
    error over time.
    """

    if len(time_s) == 0:
        return np.array([])
    if len(time_s) == 1:
        return np.array([0.0])

    result = np.zeros_like(values, dtype=float)
    for idx in range(1, len(time_s)):
        dt = time_s[idx] - time_s[idx - 1]
        result[idx] = result[idx - 1] + 0.5 * (values[idx] + values[idx - 1]) * dt
    return result
