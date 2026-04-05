import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  AnalysisResponse,
  FlightMetrics,
  TelemetryPoint,
  TrajectoryPoint,
  DroneAttitude,
} from '@/types/api';

type FlightState = {
  flightId?: string;
  metrics?: FlightMetrics;
  telemetry?: TelemetryPoint[];
  trajectory?: TrajectoryPoint[];
  trajectoryWithAttitude?: DroneAttitude[];
  origin?: { lat: number; lon: number; alt: number };
  analysis?: AnalysisResponse;
  aiSummary?: string;
  setFlightId: (id?: string) => void;
  setMetrics: (metrics?: FlightMetrics) => void;
  setTelemetry: (points?: TelemetryPoint[]) => void;
  setTrajectory: (points?: TrajectoryPoint[]) => void;
  setTrajectoryWithAttitude: (points?: DroneAttitude[]) => void;
  setOrigin: (origin?: { lat: number; lon: number; alt: number }) => void;
  setAnalysis: (analysis?: AnalysisResponse) => void;
  setAiSummary: (text?: string) => void;
  resetFlight: () => void;
};

type FlightDataState = Pick<
  FlightState,
  | 'flightId'
  | 'metrics'
  | 'telemetry'
  | 'trajectory'
  | 'trajectoryWithAttitude'
  | 'origin'
  | 'analysis'
  | 'aiSummary'
>;

const initialFlightData: FlightDataState = {
  flightId: undefined,
  metrics: undefined,
  telemetry: undefined,
  trajectory: undefined,
  trajectoryWithAttitude: undefined,
  origin: undefined,
  analysis: undefined,
  aiSummary: undefined,
};

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      ...initialFlightData,
      setFlightId: (flightId) => set({ flightId }),
      setMetrics: (metrics) => set({ metrics }),
      setTelemetry: (telemetry) => set({ telemetry }),
      setTrajectory: (trajectory) => set({ trajectory }),
      setTrajectoryWithAttitude: (trajectoryWithAttitude) =>
        set({ trajectoryWithAttitude }),
      setOrigin: (origin) => set({ origin }),
      setAnalysis: (analysis) => set({ analysis }),
      setAiSummary: (aiSummary) => set({ aiSummary }),
      resetFlight: () => set(initialFlightData),
    }),
    {
      name: 'flight-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        flightId: state.flightId,
      }),
    },
  ),
);
