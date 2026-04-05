'use client';

import { useState } from 'react';
import {
  Battery,
  Camera,
  Cog,
  Cpu,
  Package,
  Satellite,
  Square,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  DroneConfig,
  DronePart,
  PartCategory,
  FlightPattern,
  FreeFlightConfig,
} from '@/types/api';
import {
  PARTS_CATALOG,
  CATEGORY_LABELS,
  ALL_CATEGORIES,
  computeModifiers,
  DroneModifiers,
  DEFAULT_FREE_FLIGHT,
} from '@/lib/droneparts';

interface Props {
  config: DroneConfig;
  onChange: (config: DroneConfig) => void;
  freeFlightConfig: FreeFlightConfig;
  onFreeFlightChange: (cfg: FreeFlightConfig) => void;
  hasTrajectory: boolean;
}

const PATTERN_LABELS: Record<FlightPattern, string> = {
  line: 'Straight Line',
  circle: 'Circle',
  figure8: 'Figure 8',
  square: 'Square',
  random: 'Random',
  helix: 'Helix',
};

const CATEGORY_ICON_COMPONENTS: Record<PartCategory, LucideIcon> = {
  frame: Square,
  motors: Cog,
  propellers: Wind,
  esc: Zap,
  battery: Battery,
  flightController: Cpu,
  gps: Satellite,
  camera: Camera,
  payload: Package,
};

export function DroneConstructor({
  config,
  onChange,
  freeFlightConfig,
  onFreeFlightChange,
  hasTrajectory,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<PartCategory>('frame');
  const [tab, setTab] = useState<'parts' | 'flight'>('parts');
  const mods = computeModifiers(config);

  const handleSelect = (part: DronePart) => {
    onChange({ ...config, [part.category]: part });
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-md text-white hover:bg-slate-800 transition shadow-lg"
        title="Open Constructor"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute top-0 left-0 bottom-0 z-30 flex flex-col w-80 border-r border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">
          Constructor
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M10.5 2L8 4.5 5.5 2 4 3.5 6.5 6 4 8.5 5.5 10 8 7.5 10.5 10 12 8.5 9.5 6 12 3.5z" />
          </svg>
        </button>
      </div>

      {/* Main tabs: Parts / Flight */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setTab('parts')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition ${
            tab === 'parts'
              ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Parts
        </button>
        <button
          onClick={() => setTab('flight')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition ${
            tab === 'flight'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Flight{' '}
          {!hasTrajectory && <span className="text-yellow-400 ml-1">*</span>}
        </button>
      </div>

      {tab === 'parts' ? (
        <>
          {/* Category Tabs - scrollable row */}
          <div className="flex overflow-x-auto border-b border-white/10 scrollbar-none">
            {ALL_CATEGORIES.map((cat) => {
              const CategoryIcon = CATEGORY_ICON_COMPONENTS[cat];

              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 py-2.5 text-center text-xs font-medium transition ${
                    activeCategory === cat
                      ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={CATEGORY_LABELS[cat]}
                >
                  <div className="flex items-center justify-center leading-none">
                    <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="mt-1 text-[10px] leading-none whitespace-nowrap">
                    {CATEGORY_LABELS[cat]}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Parts List */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {PARTS_CATALOG[activeCategory].map((part) => {
              const isSelected = config[activeCategory]?.id === part.id;
              return (
                <button
                  key={part.id}
                  onClick={() => handleSelect(part)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    isSelected
                      ? 'border-blue-500/60 bg-blue-500/10 shadow-md shadow-blue-500/10'
                      : 'border-white/5 bg-white/2 hover:border-white/15 hover:bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-lg border border-white/10 shrink-0"
                      style={{ backgroundColor: part.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}
                        >
                          {part.name}
                        </span>
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          {part.weight_g}g
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">
                        {part.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2.5 flex-wrap">
                    <StatPill
                      label="SPD"
                      value={part.speedFactor}
                      sel={isSelected}
                    />
                    <StatPill
                      label="AGI"
                      value={part.agilityFactor}
                      sel={isSelected}
                    />
                    <StatPill
                      label="ROT"
                      value={part.rotationRate}
                      sel={isSelected}
                    />
                    <StatPill label="SCL" value={part.scale} sel={isSelected} />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <FlightTab
          cfg={freeFlightConfig}
          onChange={onFreeFlightChange}
          mods={mods}
          hasTrajectory={hasTrajectory}
        />
      )}

      <StatsFooter mods={mods} />
    </div>
  );
}

// ── Flight Config Tab ─────────────────────────────────────────────────────────

function FlightTab({
  cfg,
  onChange,
  mods,
  hasTrajectory,
}: {
  cfg: FreeFlightConfig;
  onChange: (c: FreeFlightConfig) => void;
  mods: DroneModifiers;
  hasTrajectory: boolean;
}) {
  const update = (patch: Partial<FreeFlightConfig>) =>
    onChange({ ...cfg, ...patch });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {hasTrajectory && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-[11px] text-yellow-300">
          Flight data loaded from .BIN file. These settings modify the replay.
        </div>
      )}
      {!hasTrajectory && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[11px] text-emerald-300">
          No .BIN file — free flight simulation active. Configure your flight
          below.
        </div>
      )}

      <SliderField
        label="Distance"
        value={cfg.distance_m}
        min={10}
        max={2000}
        step={10}
        unit="m"
        onChange={(v) => update({ distance_m: v })}
      />
      <SliderField
        label="Altitude"
        value={cfg.altitude_m}
        min={5}
        max={500}
        step={5}
        unit="m"
        onChange={(v) => update({ altitude_m: v })}
      />
      <SliderField
        label="Start X"
        value={cfg.startX}
        min={-500}
        max={500}
        step={10}
        unit="m"
        onChange={(v) => update({ startX: v })}
      />
      <SliderField
        label="Start Y"
        value={cfg.startY}
        min={-500}
        max={500}
        step={10}
        unit="m"
        onChange={(v) => update({ startY: v })}
      />

      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Flight Pattern
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PATTERN_LABELS) as FlightPattern[]).map((pat) => (
            <button
              key={pat}
              onClick={() => update({ pattern: pat })}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                cfg.pattern === pat
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/5 bg-white/2 text-slate-400 hover:border-white/15 hover:text-slate-200'
              }`}
            >
              {PATTERN_LABELS[pat]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white/3 border border-white/5 p-3 space-y-1.5 mt-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Computed Flight
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Est. max speed</span>
          <span className="text-emerald-400 font-bold tabular-nums">
            {mods.estMaxSpeed_mps} m/s
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Est. flight time</span>
          <span className="text-cyan-400 font-bold tabular-nums">
            {mods.estFlightTime_min} min
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Thrust/weight</span>
          <span className="text-purple-400 font-bold tabular-nums">
            {mods.thrustToWeight}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">Rotation rate</span>
          <span className="text-orange-400 font-bold tabular-nums">
            {mods.rotationMultiplier}x
          </span>
        </div>
      </div>

      {!hasTrajectory && (
        <button
          onClick={() => onChange({ ...DEFAULT_FREE_FLIGHT })}
          className="w-full rounded-lg border border-white/10 bg-white/3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/6 transition mt-2"
        >
          Reset to defaults
        </button>
      )}
    </div>
  );
}

// ── Reusable slider ───────────────────────────────────────────────────────────

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span className="text-xs text-slate-200 font-bold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500"
      />
    </div>
  );
}

// ── Stat pills ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  sel,
}: {
  label: string;
  value: number;
  sel: boolean;
}) {
  const pct = Math.round((value - 1) * 100);
  const sign = pct >= 0 ? '+' : '';
  const color =
    pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-rose-400' : 'text-slate-400';

  return (
    <div
      className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ${sel ? 'bg-blue-500/10' : 'bg-white/3'}`}
    >
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={`font-bold tabular-nums ${color}`}>
        {sign}
        {pct}%
      </span>
    </div>
  );
}

// ── Stats Footer ──────────────────────────────────────────────────────────────

function StatsFooter({ mods }: { mods: DroneModifiers }) {
  const speedPct = Math.round((mods.speedMultiplier - 1) * 100);
  const speedSign = speedPct >= 0 ? '+' : '';

  return (
    <div className="border-t border-white/10 px-4 py-3 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        Build Stats
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <FooterStat label="Weight" value={`${mods.totalWeight_g}g`} />
        <FooterStat
          label="Speed"
          value={`${speedSign}${speedPct}%`}
          accent={speedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <FooterStat label="Max Spd" value={`${mods.estMaxSpeed_mps} m/s`} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <FooterStat label="Flight" value={`${mods.estFlightTime_min} min`} />
        <FooterStat label="Rotation" value={`${mods.rotationMultiplier}x`} />
        <FooterStat label="T/W" value={`${mods.thrustToWeight}`} />
      </div>
    </div>
  );
}

function FooterStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-white/3 px-2 py-1.5 text-center">
      <div className="text-[9px] text-slate-500 uppercase">{label}</div>
      <div
        className={`text-xs font-bold tabular-nums ${accent ?? 'text-slate-200'}`}
      >
        {value}
      </div>
    </div>
  );
}
