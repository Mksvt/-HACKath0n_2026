import {
  AISummaryResponse,
  AnalysisResponse,
  FlightMetrics,
  FlightUploadResponse,
  TelemetryResponse,
  TrajectoryResponse,
  TrajectoryWithAttitudeResponse,
  DroneAttitude,
} from '@/types/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Request failed');
  }
  return res.json() as Promise<T>;
}

export async function uploadLog(file: File): Promise<FlightUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/flights/upload`, {
    method: 'POST',
    body: form,
  });
  return handleResponse<FlightUploadResponse>(res);
}

export async function fetchMetrics(flightId: string): Promise<FlightMetrics> {
  const res = await fetch(`${API_BASE}/flights/${flightId}/metrics`);
  return handleResponse<FlightMetrics>(res);
}

export async function fetchTelemetry(
  flightId: string,
): Promise<TelemetryResponse> {
  const res = await fetch(`${API_BASE}/flights/${flightId}/telemetry`);
  return handleResponse<TelemetryResponse>(res);
}

export async function fetchTrajectory(
  flightId: string,
): Promise<TrajectoryResponse> {
  const res = await fetch(`${API_BASE}/flights/${flightId}/trajectory`);
  return handleResponse<TrajectoryResponse>(res);
}

export async function fetchTrajectoryWithAttitude(
  flightId: string,
): Promise<DroneAttitude[]> {
  // This endpoint will return the raw JSON array from the backend
  const res = await fetch(`${API_BASE}/flights/${flightId}/trajectory/with-attitude`);
  return handleResponse<DroneAttitude[]>(res);
}

export async function fetchAnalysis(
  flightId: string,
): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/flights/${flightId}/analysis`);
  return handleResponse<AnalysisResponse>(res);
}

export async function fetchAISummary(
  flightId: string,
  prompt?: string,
): Promise<AISummaryResponse> {
  const res = await fetch(`${API_BASE}/flights/${flightId}/ai-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return handleResponse<AISummaryResponse>(res);
}
