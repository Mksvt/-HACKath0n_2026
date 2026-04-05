'use client';

import {
  fetchAnalysis,
  fetchMetrics,
  fetchTelemetry,
  fetchTrajectory,
  fetchTrajectoryWithAttitude,
} from '@/lib/api';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { CesiumViewer } from '@/components/CesiumViewer';
import { DroneViewer } from '@/components/DroneViewer';
import { MetricsGrid } from '@/components/MetricsGrid';
import { TelemetryCharts } from '@/components/TelemetryCharts';
import { UploadPanel } from '@/components/UploadPanel';
import { useFlightStore } from '@/store/useFlightStore';
import { Globe, Plane } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Home() {
  const {
    flightId,
    trajectory,
    origin,
    trajectoryWithAttitude,
    telemetry,
    setMetrics,
    setTelemetry,
    setTrajectory,
    setTrajectoryWithAttitude,
    setOrigin,
    setAnalysis,
    setAiSummary,
    resetFlight,
  } = useFlightStore();
  const [viewMode, setViewMode] = useState<'cesium' | 'drone'>('cesium');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const hasFlightPath = Boolean(trajectory?.length && origin);

  useEffect(() => {
    if (!flightId || hasFlightPath) return;

    let cancelled = false;

    const restoreFlight = async () => {
      setIsRestoring(true);
      setRestoreError(null);

      try {
        const [
          metrics,
          telemetryRes,
          trajectoryRes,
          trajectoryWithAttitudeRes,
          analysisRes,
        ] = await Promise.all([
          fetchMetrics(flightId),
          fetchTelemetry(flightId),
          fetchTrajectory(flightId),
          fetchTrajectoryWithAttitude(flightId),
          fetchAnalysis(flightId),
        ]);

        if (cancelled) return;

        setMetrics(metrics);
        setTelemetry(telemetryRes.telemetry);
        setTrajectory(trajectoryRes.trajectory);
        setTrajectoryWithAttitude(trajectoryWithAttitudeRes);
        setOrigin({
          lat: trajectoryRes.origin_lat,
          lon: trajectoryRes.origin_lon,
          alt: trajectoryRes.origin_alt,
        });
        setAnalysis(analysisRes);
        setAiSummary(undefined);
      } catch (err) {
        console.error('[Home] Flight restore failed:', err);
        if (cancelled) return;

        setRestoreError(
          err instanceof Error ? err.message : 'Failed to restore flight data',
        );
        resetFlight();
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    };

    void restoreFlight();

    return () => {
      cancelled = true;
    };
  }, [
    flightId,
    hasFlightPath,
    resetFlight,
    setAiSummary,
    setAnalysis,
    setMetrics,
    setOrigin,
    setTelemetry,
    setTrajectory,
    setTrajectoryWithAttitude,
  ]);

  useEffect(() => {
    if (trajectory?.length && origin) {
      setViewMode('cesium');
    }
  }, [trajectory, origin]);

  return (
    <main className="relative min-h-screen overflow-x-clip bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-350 flex-col gap-8 px-4 pb-12 pt-10 md:px-10">
        <header className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium tracking-wide text-cyan-300/90">
                UAV Telemetry Analysis & Flight Replay
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                ArduPilot .BIN → карта польоту, метрики та 3D-конструктор
              </h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Завантажуй BIN-лог, отримуй траєкторію ENU, ключові метрики,
                графіки та інтерактивну візуалізацію польоту.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 shadow-lg">
              <p className="font-semibold text-cyan-300">Пайплайн</p>
              <p className="text-slate-400">
                BIN Upload → Parsing → ENU Trajectory → Map Replay → Analytics
              </p>
            </div>
          </div>
        </header>

        <UploadPanel />

        {isRestoring && (
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Восстанавливаем последний полет из сохраненного BIN...
          </div>
        )}

        {restoreError && (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            Не удалось восстановить предыдущий полет: {restoreError}
          </div>
        )}

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 backdrop-blur md:p-4">
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Режим візуалізації
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <button
                onClick={() => setViewMode('cesium')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  viewMode === 'cesium'
                    ? 'border-cyan-300/60 bg-cyan-500/15 text-white shadow-lg shadow-cyan-900/20'
                    : 'border-white/10 bg-slate-800/80 text-slate-300 hover:border-cyan-200/30 hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Globe className="h-4 w-4" />
                  <span>Карта польоту (Cesium)</span>
                </span>
                <p className="mt-1 text-xs text-slate-400">
                  Траєкторія на мапі, висота, швидкість і replay польоту.
                </p>
              </button>

              <button
                onClick={() => setViewMode('drone')}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  viewMode === 'drone'
                    ? 'border-blue-300/60 bg-blue-500/15 text-white shadow-lg shadow-blue-900/20'
                    : 'border-white/10 bg-slate-800/80 text-slate-300 hover:border-blue-200/30 hover:bg-slate-800'
                }`}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Plane className="h-4 w-4" />
                  <span>Конструктор дрона (Three.js)</span>
                </span>
                <p className="mt-1 text-xs text-slate-400">
                  Налаштування конфігурації та перегляд 3D-моделі дрона.
                </p>
              </button>
            </div>
          </div>

          {viewMode === 'cesium' ? (
            <CesiumViewer
              trajectory={trajectory}
              trajectoryWithAttitude={trajectoryWithAttitude}
              telemetry={telemetry}
              origin={origin}
              colorMode="speed"
            />
          ) : (
            <div className="-mx-4 md:-mx-10">
              <DroneViewer
                trajectory={trajectoryWithAttitude}
                telemetry={telemetry}
              />
            </div>
          )}
        </section>

        <MetricsGrid />

        <TelemetryCharts />

        <AnalysisPanel />
      </div>
    </main>
  );
}
