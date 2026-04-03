from __future__ import annotations

import pandas as pd

from google import genai

from app.schemas.metrics import FlightMetrics
from app.config import get_settings

mock_analysis_data = [
    "68.614072: Sudden high acceleration - Acceleration jumped from ~9.81 m/s^2 to ~42.06 m/s^2, marking a severe impact or violent event.",
    "68.614072: Inconsistent vertical movement data - From this point, altitude continually increases while vertical speed indicates a continuous descent, suggesting sensor malfunction or data processing error.",
    "69.21487: Absolute peak acceleration - Acceleration reached an extreme ~82.85 m/s^2 (8.4G).",
    "70.6144: Near-zero acceleration magnitude - Total acceleration drops to ~0.35 m/s^2 and remains very low, indicating freefall or severe sensor malfunction after the initial high-G event.",
    "99.014854: Altitude below sea level - The drone's altitude drops below 0 meters ASL, suggesting a crash into water or a critical altimeter malfunction.",
]

mock_summary_data = """The drone completed a brief flight lasting approximately 52 seconds. During this period, it achieved a maximum altitude gain of 16 meters, with a peak vertical ascent rate of approximately 1.1 meters per second. The recorded maximum horizontal speed was exceptionally low at 0.5 meters per second.

However, the total distance covered during this short flight was a remarkable 1259 meters (over 1.2 kilometers). This substantial distance, combined with the very low reported maximum horizontal speed, presents a significant inconsistency, suggesting either an exceptionally complex and winding flight path at unrecorded higher average speeds or a potential data anomaly. Further raising concerns is the recorded maximum acceleration of over 82.8 meters per second squared, which is an unusually high value for a drone and could indicate a sudden, violent maneuver, a collision, or more likely, a sensor spike or data error. Based on these conflicting metrics, it is difficult to definitively characterize this as a typical 'stable' or 'dynamic' flight; instead, the flight data appears to contain significant anomalies that warrant further investigation into the sensor readings and flight conditions.
"""

settings = get_settings()
client = genai.Client(api_key=settings.gemini_api_key)

def _build_summarize_prompt(metrics: FlightMetrics) -> str:
    return (
        "You are an aviation analyst. Based on the following drone flight data, create a clear and concise flight summary using plain text.\n\n"
        "Flight Data:\n"
        f"- Total Duration: {metrics.total_duration_sec} seconds\n"
        f"- Maximum Horizontal Speed: {metrics.max_horizontal_speed_mps} m/s\n"
        f"- Maximum Vertical Speed: {metrics.max_vertical_speed_mps} m/s\n"
        f"- Maximum Acceleration: {metrics.max_acceleration_mps2} m/s²\n"
        f"- Maximum Altitude Gain: {metrics.max_altitude_gain_m} m\n"
        f"- Total Distance: {metrics.total_distance_m} m\n\n"
        "Instructions:\n"
        "Write 1-2 paragraphs summarizing the flight.\n"
        "Highlight the key metrics: speed, altitude, and distance.\n"
        "Provide a brief assessment of the flight performance, e.g., 'stable flight' or 'dynamic flight'.\n"
        "Use plain text only, organize the summary logically with introduction, highlights, and assessment, and make it easy to read."
    )

def _build_analysis_prompt(telemetry_pd: pd.DataFrame) -> str:
    return (
        "You are an aviation analyst. Analyze the following drone telemetry data for anomalous events.\n\n"
        "Data Description:\n"
        "- timestamp: time in seconds since the start of the flight\n"
        "- latitude: GPS latitude in decimal degrees\n"
        "- longitude: GPS longitude in decimal degrees\n"
        "- altitude_m: altitude above sea level in meters\n"
        "- speed_mps: horizontal speed in meters per second\n"
        "- vertical_speed_mps: vertical speed in meters per second (positive = ascending, negative = descending)\n"
        "- acceleration_mps2: total acceleration magnitude in meters per second squared\n\n"
        "Telemetry Data:\n"
        + "\n".join(
            f"{tp.time_s},{tp.latitude},{tp.longitude},{tp.altitude_m},{tp.speed_mps},{tp.vertical_speed_mps},{tp.acc_mag_mps2}"
            for _, tp in telemetry_pd.iterrows()
        )
        + "\n\nInstructions:\n"
        "- Identify any anomalous events such as sudden spikes in speed, abrupt altitude changes, or unusual acceleration.\n"
        "- For each anomaly, provide a single line in the following format:\n"
        "  <timestamp>: <type of anomaly> - <brief description>\n"
        "- Do not add extra text or summaries. Return only the list of anomalies, each separated by a newline character '\\n'.\n"
        "- Use plain text only."
    )

class SimpleAISummarizer:
    def summarize(self, metrics: FlightMetrics) -> str:
        if settings.mock_mode:
            return mock_summary_data

        prompt = _build_summarize_prompt(metrics)
        response = client.models.generate_content(model=settings.gemini_chat_model, contents=prompt).text
        return response.strip() or "No flight summary was generated."

    def get_analysis(self, telemetry_pd: pd.DataFrame) -> list[str]:
        if settings.mock_mode:
            return mock_analysis_data

        prompt = _build_analysis_prompt(telemetry_pd)
        response = client.models.generate_content(model=settings.gemini_chat_model, contents=prompt).text
        return response.strip().split("\n")