'use client';

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import { useFlightStore } from '@/store/useFlightStore';

export function TelemetryCharts() {
  const { telemetry } = useFlightStore();

  if (!telemetry || telemetry.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">
        Upload a log to view altitude, speed, and acceleration charts.
      </div>
    );
  }

  const data = telemetry.map((p) => ({
    t: Number(p.timestamp.toFixed(2)),
    altitude: p.altitude_m,
    speed: p.speed_mps ?? 0,
    acc: p.acceleration_mps2 ?? 0,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard title="Altitude (m)">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
          />
          <XAxis dataKey="t" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
            }}
          />
          <Line
            type="monotone"
            dataKey="altitude"
            stroke="#22d3ee"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ChartCard>

      <ChartCard title="Speed (m/s)">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
          />
          <XAxis dataKey="t" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
            }}
          />
          <Line
            type="monotone"
            dataKey="speed"
            stroke="#a855f7"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ChartCard>

      <ChartCard title="Acceleration (m/s²)">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.08)"
          />
          <XAxis dataKey="t" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
            }}
          />
          <Line
            type="monotone"
            dataKey="acc"
            stroke="#f97316"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="mb-2 text-sm text-slate-300">{title}</div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
