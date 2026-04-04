'use client';

import { AnalysisPanel } from '@/components/AnalysisPanel';
import { CesiumViewer } from '@/components/CesiumViewer';
import { DroneViewer } from '@/components/DroneViewer';
import { MetricsGrid } from '@/components/MetricsGrid';
import { TelemetryCharts } from '@/components/TelemetryCharts';
import { UploadPanel } from '@/components/UploadPanel';
import { useFlightStore } from '@/store/useFlightStore';
import { useState } from 'react';

export default function Home() {
  const { trajectory, origin, trajectoryWithAttitude, telemetry } = useFlightStore();
  const [viewMode, setViewMode] = useState<'cesium' | 'drone'>('drone');

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-950 px-4 pb-12 pt-10 md:px-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            UAV Telemetry Analysis & 3D Flight Visualization
          </p>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">
            Ardupilot .BIN to metrics, charts, and 3D visualization
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Upload Ardupilot binary logs, parse GPS/IMU/ATT, compute key metrics,
            convert WGS-84 to local ENU, and explore the flight in interactive
            3D viewers (Three.js & Cesium).
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 shadow-lg">
          <p className="font-semibold">Pipeline</p>
          <p className="text-slate-400">
            Upload → Parse GPS/IMU/ATT → Metrics → ENU → 3D visualization
          </p>
        </div>
      </header>

      <UploadPanel />

      <MetricsGrid />

      <section className="space-y-4">
        {/* View Mode Toggle */}
        <div className="flex gap-2 bg-slate-900 p-4 rounded-lg">
          <button
            onClick={() => setViewMode('drone')}
            className={`px-4 py-2 rounded font-semibold transition ${
              viewMode === 'drone'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🚁 Three.js 3D Дрон
          </button>
          <button
            onClick={() => setViewMode('cesium')}
            className={`px-4 py-2 rounded font-semibold transition ${
              viewMode === 'cesium'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            🌍 Cesium Map
          </button>
        </div>

        {/* 3D Visualization — drone view gets negative margins for wider feel */}
        {viewMode === 'drone' ? (
          <div className="-mx-4 md:-mx-10">
            <DroneViewer trajectory={trajectoryWithAttitude} telemetry={telemetry} />
          </div>
        ) : (
          <CesiumViewer
            trajectory={trajectory}
            trajectoryWithAttitude={trajectoryWithAttitude}
            telemetry={telemetry}
            origin={origin}
            colorMode="speed"
          />
        )}
        
        <TelemetryCharts />
      </section>

      <AnalysisPanel />
    </main>
  );
}
