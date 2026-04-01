from __future__ import annotations

from app.schemas.metrics import FlightMetrics


class SimpleAISummarizer:
    """Placeholder summarizer. Integrate LLM of choice here."""

    def summarize(self, flight_id: str, metrics: FlightMetrics, prompt: str | None = None) -> str:
        lines = [
            f"Flight {flight_id} summary:",
            f"- Duration: {metrics.total_duration_sec:.1f} s",
            f"- Total distance: {metrics.total_distance_m:.1f} m",
            f"- Max altitude gain: {metrics.max_altitude_gain_m:.1f} m",
            f"- Max horizontal speed: {metrics.max_horizontal_speed_mps:.1f} m/s",
            f"- Max vertical speed: {metrics.max_vertical_speed_mps:.1f} m/s",
            f"- Max acceleration: {metrics.max_acceleration_mps2:.1f} m/s^2",
        ]
        if prompt:
            lines.append(f"Prompt: {prompt}")
        lines.append("Note: Replace this stub with a real LLM call for richer insights.")
        return "\n".join(lines)
