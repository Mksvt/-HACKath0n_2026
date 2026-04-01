import { create } from 'zustand';

import {
  AnalysisResponse,
  FlightMetrics,
  TelemetryPoint,
  TrajectoryPoint,
} from '@/types/api';

type FlightState = {
  flightId?: string;
  metrics?: FlightMetrics;
  telemetry?: TelemetryPoint[];
  trajectory?: TrajectoryPoint[];
  origin?: { lat: number; lon: number; alt: number };
  analysis?: AnalysisResponse;
  aiSummary?: string;
  setFlightId: (id?: string) => void;
  setMetrics: (metrics?: FlightMetrics) => void;
  setTelemetry: (points?: TelemetryPoint[]) => void;
  setTrajectory: (points?: TrajectoryPoint[]) => void;
  setOrigin: (origin?: { lat: number; lon: number; alt: number }) => void;
  setAnalysis: (analysis?: AnalysisResponse) => void;
  setAiSummary: (text?: string) => void;
};

export const useFlightStore = create<FlightState>((set) => ({
  flightId: undefined,
  metrics: undefined,
  telemetry: undefined,
  trajectory: undefined,
  origin: undefined,
  analysis: undefined,
  aiSummary: undefined,
  setFlightId: (flightId) => set({ flightId }),
  setMetrics: (metrics) => set({ metrics }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setTrajectory: (trajectory) => set({ trajectory }),
  setOrigin: (origin) => set({ origin }),
  setAnalysis: (analysis) => set({ analysis }),
  setAiSummary: (aiSummary) => set({ aiSummary }),
}));
