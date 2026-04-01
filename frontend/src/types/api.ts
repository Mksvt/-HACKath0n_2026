export type FlightUploadResponse = {
  flight_id: string;
  filename: string;
  uploaded_at: string;
};

export type FlightMetrics = {
  total_duration_sec: number;
  max_horizontal_speed_mps: number;
  max_vertical_speed_mps: number;
  max_acceleration_mps2: number;
  max_altitude_gain_m: number;
  total_distance_m: number;
};

export type TelemetryPoint = {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude_m: number;
  enu_x: number | null;
  enu_y: number | null;
  enu_z: number | null;
  speed_mps: number | null;
  vertical_speed_mps: number | null;
  acceleration_mps2: number | null;
};

export type TrajectoryPoint = {
  x: number;
  y: number;
  z: number;
  color?: string | null;
};

export type TelemetryResponse = {
  flight_id: string;
  telemetry: TelemetryPoint[];
};

export type TrajectoryResponse = {
  flight_id: string;
  trajectory: TrajectoryPoint[];
  origin_lat: number;
  origin_lon: number;
  origin_alt: number;
};

export type AnalysisResponse = {
  flight_id: string;
  notes: string[];
};

export type AISummaryResponse = {
  flight_id: string;
  summary: string;
  metrics: FlightMetrics;
};
