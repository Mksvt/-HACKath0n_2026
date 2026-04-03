from __future__ import annotations

import json
import os
from urllib import error, request

from loguru import logger

from app.schemas.metrics import FlightMetrics


class SimpleAISummarizer:
    """LLM-enabled summarizer with fallback for offline/local environments."""

    def __init__(self) -> None:
        # OpenAI-compatible config (works with OpenRouter, many self-hosted gateways, etc.)
        self.api_key = os.getenv("LLM_API_KEY")
        self.base_url = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
        self.model = os.getenv("LLM_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
        self.timeout_sec = float(os.getenv("LLM_TIMEOUT_SEC", "20"))

    def summarize(self, flight_id: str, metrics: FlightMetrics, prompt: str | None = None) -> str:
        metrics_context = self._build_metrics_context(flight_id, metrics)
        effective_prompt = (
            prompt
            or "Provide a concise post-flight analysis. Mention potential risks, anomalies, and one next action."
        )

        if self.api_key:
            llm_response = self._call_llm(metrics_context, effective_prompt)
            if llm_response:
                return llm_response

        return self._fallback_summary(flight_id, metrics, prompt)

    def _build_metrics_context(self, flight_id: str, metrics: FlightMetrics) -> str:
        return "\n".join(
            [
                f"Flight ID: {flight_id}",
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

        # OpenRouter accepts these optional headers for tracking/rate insights.
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
        except Exception as exc:  # noqa: BLE001 - fallback should handle all network/runtime errors.
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

    def _fallback_summary(self, flight_id: str, metrics: FlightMetrics, prompt: str | None = None) -> str:
        risk_flags: list[str] = []
        if metrics.max_vertical_speed_mps > 8:
            risk_flags.append("aggressive climb/descent profile")
        if metrics.max_acceleration_mps2 > 20:
            risk_flags.append("high acceleration spikes")
        if metrics.max_horizontal_speed_mps > 25:
            risk_flags.append("high horizontal speed")

        lines = [
            f"Flight {flight_id} summary:",
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
        if prompt:
            lines.append(f"Prompt: {prompt}")
        lines.append("Note: Fallback summary used (set LLM_API_KEY + LLM_MODEL to enable live LLM analysis).")
        return "\n".join(lines)
