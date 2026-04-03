import pandas as pd  # type: ignore[import-untyped]

from app.services.analytics.metrics_calculator import MetricsCalculator


def sample_data():
    gps_df = pd.DataFrame(
        {
            "time_s": [0.0, 1.0, 2.0],
            "lat": [0.0, 0.0, 0.0],
            "lon": [0.0, 0.00001, 0.00002],
            "alt_m": [0.0, 1.0, 2.0],
            "spd_mps": [0.0, 5.0, 5.0],
            "vz_mps": [0.0, 1.0, 1.0],
        }
    )
    imu_df = pd.DataFrame({"time_s": [0.0, 1.0, 2.0], "acc_mag_mps2": [0.0, 1.0, 1.0]})
    return gps_df, imu_df


def test_metrics_computation():
    gps_df, imu_df = sample_data()
    telemetry = MetricsCalculator.compute_telemetry(gps_df, imu_df)
    metrics = MetricsCalculator.compute_metrics(telemetry)
    assert metrics.total_duration_sec == 2.0
    assert metrics.max_vertical_speed_mps >= 1.0
    assert metrics.max_horizontal_speed_mps >= 5.0
    assert metrics.total_distance_m > 0


def test_filter_gps_outliers_drops_isolated_first_glitch():
    gps_df = pd.DataFrame(
        {
            "time_s": [0.0, 1.0, 2.0, 3.0],
            "lat": [0.0, 48.0, 48.00001, 48.00002],
            "lon": [0.0, 2.0, 2.00001, 2.00002],
            "alt_m": [10.0, 10.1, 10.2, 10.3],
        }
    )

    filtered, dropped = MetricsCalculator.filter_gps_outliers(gps_df, max_segment_m=1000.0, max_speed_mps=120.0)

    assert dropped == 1
    assert len(filtered) == 3
    assert filtered.iloc[0]["lat"] == 48.0
