'use client';

import { AnalysisPanel } from '@/components/AnalysisPanel';
import { CesiumViewer } from '@/components/CesiumViewer';
import { MetricsGrid } from '@/components/MetricsGrid';
import { TelemetryCharts } from '@/components/TelemetryCharts';
import { UploadPanel } from '@/components/UploadPanel';
import { useFlightStore } from '@/store/useFlightStore';

export default function Home() {
  const { trajectory, origin } = useFlightStore();

  return (
    <main className="flex min-h-screen flex-col gap-8 bg-slate-950 px-4 pb-12 pt-10 md:px-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-300">
            UAV Telemetry Analysis & 3D Flight Visualization
          </p>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">
            Ardupilot .BIN to metrics, charts, and Cesium 3D
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Upload Ardupilot binary logs, parse GPS/IMU, compute key metrics,
            convert WGS-84 to local ENU, and explore the flight in an
            interactive Cesium viewer.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200 shadow-lg">
          <p className="font-semibold">Pipeline</p>
          <p className="text-slate-400">
            Upload → Parse → Metrics → ENU → 3D path
          </p>
        </div>
      </header>

      <UploadPanel />

      <MetricsGrid />

      <section className="space-y-4">
        <CesiumViewer
          trajectory={trajectory}
          origin={origin}
          colorMode="speed"
        />
        <TelemetryCharts />
      </section>

      <AnalysisPanel />
    </main>
  );
}
