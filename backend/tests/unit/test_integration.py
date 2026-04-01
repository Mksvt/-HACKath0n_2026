import numpy as np

from app.utils.integration import trapezoidal_integrate


def test_trapezoidal_integrate_linear_accel():
    time = np.array([0.0, 1.0, 2.0, 3.0])
    accel = np.array([1.0, 1.0, 1.0, 1.0])
    vel = trapezoidal_integrate(time, accel)
    assert vel.tolist() == [0.0, 1.0, 2.0, 3.0]


def test_trapezoidal_handles_empty():
    time = np.array([])
    accel = np.array([])
    vel = trapezoidal_integrate(time, accel)
    assert vel.size == 0
