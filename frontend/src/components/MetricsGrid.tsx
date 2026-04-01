'use client';

import { useFlightStore } from '@/store/useFlightStore';

const formatter = (val?: number, unit?: string) =>
  val !== undefined ? `${val.toFixed(1)} ${unit ?? ''}` : '--';

export function MetricsGrid() {
  const { metrics } = useFlightStore();

  const items = [
    { label: 'Duration', value: formatter(metrics?.total_duration_sec, 's') },
    {
      label: 'Total distance',
      value: formatter(metrics?.total_distance_m, 'm'),
    },
    {
      label: 'Max altitude gain',
      value: formatter(metrics?.max_altitude_gain_m, 'm'),
    },
    {
      label: 'Max horizontal speed',
      value: formatter(metrics?.max_horizontal_speed_mps, 'm/s'),
    },
    {
      label: 'Max vertical speed',
      value: formatter(metrics?.max_vertical_speed_mps, 'm/s'),
    },
    {
      label: 'Max acceleration',
      value: formatter(metrics?.max_acceleration_mps2, 'm/s²'),
    },
  ];

  return (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
