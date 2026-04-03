from __future__ import annotations

import json
import os
from urllib import error, request

from loguru import logger
import pandas as pd

from app.schemas.metrics import FlightMetrics

class SimpleAISummarizer:
    """LLM-enabled summarizer with fallback for offline/local environments."""

    def __init__(self) -> None:
        self.api_key = os.getenv("LLM_API_KEY")
        self.base_url = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
        self.model = os.getenv("LLM_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
        self.timeout_sec = float(os.getenv("LLM_TIMEOUT_SEC", "20"))

    def summarize(self, metrics: FlightMetrics) -> str:
        prompt = "Provide a concise post-flight analysis with key risks and one suggested next action."
        metrics_context = self._build_metrics_context(metrics)

        if self.api_key:
            llm_response = self._call_llm(metrics_context, prompt)
            if llm_response:
                return llm_response

        return self._fallback_summary(metrics)

    def get_analysis(self, telemetry_pd: pd.DataFrame) -> list[str]:
        notes: list[str] = []

        if telemetry_pd is None or telemetry_pd.empty:
            return ["Telemetry data is empty; no anomaly analysis available."]

        if "vertical_speed_mps" in telemetry_pd.columns:
            max_abs_vz = float(telemetry_pd["vertical_speed_mps"].abs().max())
            if max_abs_vz > 10:
                notes.append("Detected aggressive climb/descent profile (|vertical speed| > 10 m/s).")

        if "acc_mag_mps2" in telemetry_pd.columns:
            max_acc = float(telemetry_pd["acc_mag_mps2"].max())
            if max_acc > 25:
                notes.append("Detected acceleration spike above 25 m/s^2.")

        if "speed_mps" in telemetry_pd.columns and len(telemetry_pd) > 0:
            missing_ratio = float(telemetry_pd["speed_mps"].isna().sum()) / float(len(telemetry_pd))
            if missing_ratio > 0.2:
                notes.append("Large portion of horizontal speed samples is missing; GPS dropout suspected.")

        if "altitude_m" in telemetry_pd.columns:
            min_alt = float(telemetry_pd["altitude_m"].min())
            if min_alt < 0:
                notes.append("Altitude dropped below sea level; potential crash or altimeter anomaly.")

        if not notes:
            notes.append("No obvious anomalies detected by heuristic checks.")

        return notes

    def _build_metrics_context(self, metrics: FlightMetrics) -> str:
        return "\n".join(
            [
                f"Duration: {metrics.total_duration_sec:.2f} s",
                f"Total distance: {metrics.total_distance_m:.2f} m",
                f"Max altitude gain: {metrics.max_altitude_gain_m:.2f} m",
                f"Max horizontal speed: {metrics.max_horizontal_speed_mps:.2f} m/s",
                f"Max vertical speed: {metrics.max_vertical_speed_mps:.2f} m/s",
                f"Max acceleration: {metrics.max_acceleration_mps2:.2f} m/s^2",
            ]
        )

    def _call_llm(self, metrics_context: str, prompt: str) -> str | None:
        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": self.model,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a UAV telemetry analyst. "
                        "Write a short, technical but readable post-flight report."
                    ),
                },
                {
                    "role": "user",
                    "content": f"{prompt}\n\nTelemetry metrics:\n{metrics_context}",
                },
            ],
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if "openrouter.ai" in self.base_url:
            headers["HTTP-Referer"] = os.getenv("LLM_APP_URL", "http://localhost")
            headers["X-Title"] = os.getenv("LLM_APP_NAME", "UAV Telemetry Analysis")

        req = request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=self.timeout_sec) as resp:
                body = resp.read().decode("utf-8")
                data = json.loads(body)
        except error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore") if exc.fp else ""
            logger.warning("LLM request failed with HTTP {}: {}", exc.code, details)
            return None
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM request failed: {}", exc)
            return None

        choices = data.get("choices") or []
        if not choices:
            logger.warning("LLM response did not include choices")
            return None

        message = choices[0].get("message") or {}
        content = message.get("content")
        if not content:
            logger.warning("LLM response did not include message content")
            return None
        return str(content).strip()

    def _fallback_summary(self, metrics: FlightMetrics) -> str:
        risk_flags: list[str] = []
        if metrics.max_vertical_speed_mps > 8:
            risk_flags.append("aggressive climb/descent profile")
        if metrics.max_acceleration_mps2 > 20:
            risk_flags.append("high acceleration spikes")
        if metrics.max_horizontal_speed_mps > 25:
            risk_flags.append("high horizontal speed")

        lines = [
            "Flight summary:",
            f"- Duration: {metrics.total_duration_sec:.1f} s",
            f"- Total distance: {metrics.total_distance_m:.1f} m",
            f"- Max altitude gain: {metrics.max_altitude_gain_m:.1f} m",
            f"- Max horizontal speed: {metrics.max_horizontal_speed_mps:.1f} m/s",
            f"- Max vertical speed: {metrics.max_vertical_speed_mps:.1f} m/s",
            f"- Max acceleration: {metrics.max_acceleration_mps2:.1f} m/s^2",
        ]
        if risk_flags:
            lines.append(f"- Risk flags: {', '.join(risk_flags)}")
        else:
            lines.append("- Risk flags: none detected by rule-based fallback")
        lines.append("Note: Fallback summary used (set LLM_API_KEY + LLM_MODEL to enable live LLM analysis).")
        return "\n".join(lines)
