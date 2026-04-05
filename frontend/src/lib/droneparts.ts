import {
  DronePart,
  DroneConfig,
  DroneAttitude,
  PartCategory,
  FreeFlightConfig,
} from '@/types/api';

// ── Helper to build parts ─────────────────────────────────────────────────────
function p(
  id: string,
  name: string,
  cat: PartCategory,
  tier: number,
  w: number,
  col: string,
  spd: number,
  agi: number,
  rot: number,
  sc: number,
  desc: string,
): DronePart {
  return {
    id,
    name,
    category: cat,
    tier,
    weight_g: w,
    color: col,
    speedFactor: spd,
    agilityFactor: agi,
    rotationRate: rot,
    scale: sc,
    description: desc,
  };
}

// ── FRAMES ────────────────────────────────────────────────────────────────────
const frames: DronePart[] = [
  p(
    'frame-micro',
    'Micro Whoop',
    'frame',
    0,
    28,
    '#6366f1',
    1.3,
    1.5,
    1.6,
    0.6,
    'Tiny indoor frame. Extremely agile, very fragile.',
  ),
  p(
    'frame-carbon-lite',
    'Carbon Lite',
    'frame',
    1,
    85,
    '#1e293b',
    1.15,
    1.3,
    1.3,
    0.85,
    'Ultra-light carbon for racing. Fragile but fast.',
  ),
  p(
    'frame-standard',
    'Standard 250',
    'frame',
    2,
    150,
    '#334155',
    1.0,
    1.0,
    1.0,
    1.0,
    'Balanced all-purpose frame. Good for most missions.',
  ),
  p(
    'frame-heavy',
    'Heavy Lift X8',
    'frame',
    3,
    280,
    '#475569',
    0.8,
    0.7,
    0.7,
    1.25,
    'Reinforced for heavy payloads. Slow but stable.',
  ),
  p(
    'frame-titan',
    'Titan Industrial',
    'frame',
    4,
    520,
    '#0f172a',
    0.55,
    0.5,
    0.4,
    1.6,
    'Industrial-grade hex frame. Max payload, min agility.',
  ),
];

// ── MOTORS ────────────────────────────────────────────────────────────────────
const motors: DronePart[] = [
  p(
    'motor-1103',
    '1103 Micro',
    'motors',
    0,
    36,
    '#f97316',
    0.9,
    1.4,
    1.5,
    0.7,
    'Tiny motors for whoops. Light and responsive.',
  ),
  p(
    'motor-2205',
    '2205 Racing',
    'motors',
    1,
    112,
    '#dc2626',
    1.4,
    1.2,
    1.3,
    0.9,
    'High-KV racing motors. Max thrust, short bursts.',
  ),
  p(
    'motor-2212',
    '2212 Standard',
    'motors',
    2,
    140,
    '#2563eb',
    1.0,
    1.0,
    1.0,
    1.0,
    'Reliable mid-range motors. Efficient and balanced.',
  ),
  p(
    'motor-2814',
    '2814 Torque',
    'motors',
    3,
    200,
    '#059669',
    0.85,
    0.8,
    0.8,
    1.15,
    'High-torque motors for heavy lift. Smooth power.',
  ),
  p(
    'motor-4114',
    '4114 Industrial',
    'motors',
    4,
    350,
    '#164e63',
    0.65,
    0.55,
    0.5,
    1.35,
    'Massive industrial motors. Enormous thrust, heavy.',
  ),
];

// ── PROPELLERS ────────────────────────────────────────────────────────────────
const propellers: DronePart[] = [
  p(
    'prop-2inch',
    '2" Micro',
    'propellers',
    0,
    4,
    '#fbbf24',
    0.85,
    1.5,
    1.6,
    0.65,
    '2-inch props for micro quads. Insane RPM.',
  ),
  p(
    'prop-3blade',
    '5" Tri-Blade',
    'propellers',
    1,
    20,
    '#f59e0b',
    1.1,
    1.25,
    1.3,
    0.9,
    'Aggressive tri-blade. Fast response, more noise.',
  ),
  p(
    'prop-2blade',
    '5" Dual-Blade',
    'propellers',
    2,
    14,
    '#8b5cf6',
    1.0,
    1.0,
    1.0,
    1.0,
    'Classic dual-blade. Efficient and quiet.',
  ),
  p(
    'prop-4blade',
    '7" Quad-Blade',
    'propellers',
    3,
    28,
    '#06b6d4',
    0.9,
    0.85,
    0.85,
    1.1,
    'Quad-blade for max lift. Smooth hover, less speed.',
  ),
  p(
    'prop-15inch',
    '15" Heavy',
    'propellers',
    4,
    55,
    '#0d9488',
    0.7,
    0.6,
    0.5,
    1.4,
    'Large slow-spinning props. Maximum lift efficiency.',
  ),
];

// ── ESC ───────────────────────────────────────────────────────────────────────
const escs: DronePart[] = [
  p(
    'esc-12a',
    '12A Micro',
    'esc',
    0,
    8,
    '#a3e635',
    0.9,
    1.3,
    1.4,
    0.8,
    'Tiny ESC for micro builds. Fast throttle response.',
  ),
  p(
    'esc-35a',
    '35A BLHeli',
    'esc',
    1,
    28,
    '#84cc16',
    1.15,
    1.15,
    1.2,
    0.95,
    'Racing ESC with 48kHz PWM. Instant response.',
  ),
  p(
    'esc-45a',
    '45A Standard',
    'esc',
    2,
    36,
    '#22c55e',
    1.0,
    1.0,
    1.0,
    1.0,
    'All-rounder ESC. Reliable and smooth.',
  ),
  p(
    'esc-60a',
    '60A Heavy',
    'esc',
    3,
    52,
    '#16a34a',
    0.9,
    0.85,
    0.85,
    1.1,
    'High-amp ESC for heavy motors. Active cooling.',
  ),
  p(
    'esc-80a',
    '80A Industrial',
    'esc',
    4,
    85,
    '#15803d',
    0.75,
    0.7,
    0.7,
    1.25,
    'Industrial-grade. Handles sustained high loads.',
  ),
];

// ── BATTERY ───────────────────────────────────────────────────────────────────
const batteries: DronePart[] = [
  p(
    'bat-450-2s',
    '450mAh 2S',
    'battery',
    0,
    30,
    '#fde047',
    1.2,
    1.3,
    1.2,
    0.7,
    'Tiny LiPo for micro. 2-3 min flights.',
  ),
  p(
    'bat-1300-4s',
    '1300mAh 4S',
    'battery',
    1,
    155,
    '#eab308',
    1.1,
    1.15,
    1.1,
    0.85,
    'Lightweight pack for racing. 4-6 min flights.',
  ),
  p(
    'bat-2200-4s',
    '2200mAh 4S',
    'battery',
    2,
    240,
    '#22c55e',
    1.0,
    1.0,
    1.0,
    1.0,
    'Standard capacity. 8-12 min flights.',
  ),
  p(
    'bat-5000-6s',
    '5000mAh 6S',
    'battery',
    3,
    680,
    '#ef4444',
    0.75,
    0.7,
    0.7,
    1.3,
    'High capacity 6S. 20+ min but very heavy.',
  ),
  p(
    'bat-12000-6s',
    '12000mAh 6S',
    'battery',
    4,
    1350,
    '#991b1b',
    0.5,
    0.4,
    0.4,
    1.6,
    'Massive pack for endurance. 40+ min, extremely heavy.',
  ),
];

// ── FLIGHT CONTROLLER ─────────────────────────────────────────────────────────
const fcs: DronePart[] = [
  p(
    'fc-f4-mini',
    'F4 Mini',
    'flightController',
    0,
    6,
    '#c084fc',
    0.95,
    1.2,
    1.3,
    0.8,
    'Compact F4 chip. Fast PID loop, limited features.',
  ),
  p(
    'fc-f7-racing',
    'F7 Racing',
    'flightController',
    1,
    10,
    '#a855f7',
    1.1,
    1.3,
    1.4,
    0.9,
    'F7 with Betaflight. Ultra-fast gyro processing.',
  ),
  p(
    'fc-h7-standard',
    'H7 Standard',
    'flightController',
    2,
    14,
    '#7c3aed',
    1.0,
    1.0,
    1.0,
    1.0,
    'H7 all-purpose FC. DShot1200, GPS-ready.',
  ),
  p(
    'fc-pixhawk',
    'Pixhawk 6C',
    'flightController',
    3,
    38,
    '#6d28d9',
    0.95,
    0.9,
    0.9,
    1.1,
    'Ardupilot/PX4. Full autonomy, extra weight.',
  ),
  p(
    'fc-cube',
    'CubePilot Orange',
    'flightController',
    4,
    75,
    '#4c1d95',
    0.85,
    0.75,
    0.75,
    1.2,
    'Enterprise FC. Triple-redundant IMU, max stability.',
  ),
];

// ── GPS ───────────────────────────────────────────────────────────────────────
const gpsModules: DronePart[] = [
  p(
    'gps-none',
    'No GPS',
    'gps',
    0,
    0,
    '#64748b',
    1.0,
    1.0,
    1.0,
    1.0,
    'Manual flight only. No position hold.',
  ),
  p(
    'gps-bn180',
    'BN-180 Mini',
    'gps',
    1,
    5,
    '#38bdf8',
    0.98,
    1.0,
    1.0,
    0.95,
    'Tiny GPS. Basic position hold, slow fix.',
  ),
  p(
    'gps-m10',
    'u-blox M10',
    'gps',
    2,
    12,
    '#0ea5e9',
    0.95,
    0.98,
    1.0,
    1.0,
    'Standard GPS + GLONASS. Good accuracy.',
  ),
  p(
    'gps-m9n-rtk',
    'M9N RTK',
    'gps',
    3,
    25,
    '#0284c7',
    0.92,
    0.95,
    1.0,
    1.05,
    'Dual-band RTK. Centimeter-level accuracy.',
  ),
  p(
    'gps-f9p',
    'ZED-F9P PPK',
    'gps',
    4,
    40,
    '#0369a1',
    0.88,
    0.9,
    1.0,
    1.1,
    'Survey-grade GNSS. mm precision, heavy.',
  ),
];

// ── CAMERA / GIMBAL ───────────────────────────────────────────────────────────
const cameras: DronePart[] = [
  p(
    'cam-none',
    'No Camera',
    'camera',
    0,
    0,
    '#94a3b8',
    1.0,
    1.0,
    1.0,
    1.0,
    'No camera. Pure speed build.',
  ),
  p(
    'cam-nano',
    'Nano FPV',
    'camera',
    1,
    8,
    '#e879f9',
    0.98,
    0.98,
    1.0,
    0.95,
    'Tiny analog FPV cam. Minimal weight.',
  ),
  p(
    'cam-dji-o3',
    'DJI O3 Air',
    'camera',
    2,
    36,
    '#d946ef',
    0.95,
    0.95,
    0.95,
    1.0,
    'HD digital FPV. Low latency, great image.',
  ),
  p(
    'cam-gopro',
    'GoPro Hero',
    'camera',
    3,
    120,
    '#a21caf',
    0.85,
    0.85,
    0.85,
    1.1,
    'Action cam + gimbal. Great footage, adds weight.',
  ),
  p(
    'cam-thermal',
    'Thermal + RGB',
    'camera',
    4,
    210,
    '#86198f',
    0.75,
    0.75,
    0.75,
    1.2,
    'Dual thermal/RGB gimbal. Survey & inspection.',
  ),
];

// ── PAYLOAD ───────────────────────────────────────────────────────────────────
const payloads: DronePart[] = [
  p(
    'pay-none',
    'No Payload',
    'payload',
    0,
    0,
    '#64748b',
    1.0,
    1.0,
    1.0,
    1.0,
    'Bare drone. Maximum speed and agility.',
  ),
  p(
    'pay-led',
    'LED Strip Kit',
    'payload',
    1,
    15,
    '#fb923c',
    0.98,
    0.98,
    1.0,
    1.0,
    'Decorative LEDs for night flying.',
  ),
  p(
    'pay-fpv',
    'FPV Goggles Relay',
    'payload',
    2,
    45,
    '#a855f7',
    0.95,
    0.95,
    0.95,
    1.05,
    'Long-range video TX module.',
  ),
  p(
    'pay-lidar',
    'LiDAR Mapper',
    'payload',
    3,
    350,
    '#0ea5e9',
    0.7,
    0.65,
    0.65,
    1.2,
    'Heavy LiDAR mapping payload.',
  ),
  p(
    'pay-delivery',
    'Delivery Box 2kg',
    'payload',
    4,
    2000,
    '#78716c',
    0.35,
    0.3,
    0.3,
    1.5,
    '2 kg delivery payload. Needs heavy-lift build.',
  ),
];

// ── Public Catalog ────────────────────────────────────────────────────────────

export const ALL_CATEGORIES: PartCategory[] = [
  'frame',
  'motors',
  'propellers',
  'esc',
  'battery',
  'flightController',
  'gps',
  'camera',
  'payload',
];

export const PARTS_CATALOG: Record<PartCategory, DronePart[]> = {
  frame: frames,
  motors,
  propellers,
  esc: escs,
  battery: batteries,
  flightController: fcs,
  gps: gpsModules,
  camera: cameras,
  payload: payloads,
};

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  frame: 'Frame',
  motors: 'Motors',
  propellers: 'Props',
  esc: 'ESC',
  battery: 'Battery',
  flightController: 'FC',
  gps: 'GPS',
  camera: 'Camera',
  payload: 'Payload',
};

export const DEFAULT_CONFIG: DroneConfig = {
  frame: frames[2],
  motors: motors[2],
  propellers: propellers[2],
  esc: escs[2],
  battery: batteries[2],
  flightController: fcs[2],
  gps: gpsModules[2],
  camera: cameras[0],
  payload: payloads[0],
};

// ── Modifiers ─────────────────────────────────────────────────────────────────

export type DroneModifiers = {
  speedMultiplier: number;
  attitudeDamping: number;
  rotationMultiplier: number;
  modelScale: number;
  totalWeight_g: number;
  estMaxSpeed_mps: number;
  estFlightTime_min: number;
  thrustToWeight: number;
  primaryColor: string;
};

const BASE_SPEED_MPS = 25;
const BASE_FLIGHT_MIN = 10;
const BASE_WEIGHT = 616;

export function computeModifiers(config: DroneConfig): DroneModifiers {
  const parts: DronePart[] = Object.values(config);

  const totalWeight = parts.reduce((s, pp) => s + pp.weight_g, 0);
  const weightRatio = BASE_WEIGHT / Math.max(totalWeight, 50);

  const rawSpeed = parts.reduce((m, pp) => m * pp.speedFactor, 1.0);
  const speedMultiplier = rawSpeed * Math.sqrt(weightRatio);

  const avgAgility =
    parts.reduce((s, pp) => s + pp.agilityFactor, 0) / parts.length;
  const attitudeDamping = Math.max(0.03, Math.min(1.0, avgAgility * 0.15));

  const avgRotation =
    parts.reduce((s, pp) => s + pp.rotationRate, 0) / parts.length;
  const rotationMultiplier = Math.max(0.1, avgRotation);

  const modelScale = config.frame.scale;

  const batCap = [450, 1300, 2200, 5000, 12000][config.battery.tier] ?? 2200;
  const estFlight =
    BASE_FLIGHT_MIN *
    (batCap / 2200) *
    Math.sqrt(BASE_WEIGHT / Math.max(totalWeight, 50));

  const thrustToWeight =
    (config.motors.speedFactor *
      config.propellers.speedFactor *
      config.esc.speedFactor) /
    Math.max(totalWeight / 1000, 0.05);

  return {
    speedMultiplier: Math.round(speedMultiplier * 100) / 100,
    attitudeDamping,
    rotationMultiplier: Math.round(rotationMultiplier * 100) / 100,
    modelScale,
    totalWeight_g: totalWeight,
    estMaxSpeed_mps: Math.round(BASE_SPEED_MPS * speedMultiplier * 10) / 10,
    estFlightTime_min: Math.round(estFlight * 10) / 10,
    thrustToWeight: Math.round(thrustToWeight * 100) / 100,
    primaryColor: config.frame.color,
  };
}

// ── Free-flight trajectory generator ──────────────────────────────────────────

export const DEFAULT_FREE_FLIGHT: FreeFlightConfig = {
  pattern: 'circle',
  distance_m: 200,
  altitude_m: 30,
  startX: 0,
  startY: 0,
};

export function generateFreeFlightTrajectory(
  ff: FreeFlightConfig,
  mods: DroneModifiers,
): DroneAttitude[] {
  const pts: DroneAttitude[] = [];
  const n = 600;
  const speed = mods.estMaxSpeed_mps;
  const agility = mods.attitudeDamping * 10;
  const rotMul = mods.rotationMultiplier;
  const R = ff.distance_m / 2;
  const alt = ff.altitude_m;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const timeSec = t * Math.max(10, ff.distance_m / Math.max(speed, 1));
    let x = ff.startX;
    let y = ff.startY;
    let z = alt;
    let roll = 0;
    let pitch = 0;
    let yaw = 0;

    switch (ff.pattern) {
      case 'circle': {
        const angle = t * 2 * Math.PI;
        x = ff.startX + Math.cos(angle) * R;
        y = ff.startY + Math.sin(angle) * R;
        z = alt + Math.sin(angle * 2) * (alt * 0.15);
        yaw = ((angle * 180) / Math.PI + 90) % 360;
        roll = -Math.min(30, 15 * agility) * Math.sin(angle);
        pitch = -5 * Math.cos(angle * 2);
        break;
      }
      case 'line': {
        x = ff.startX;
        y = ff.startY + t * ff.distance_m;
        z = alt + Math.sin(t * Math.PI) * (alt * 0.3);
        yaw = 0;
        pitch = (-8 * speed) / BASE_SPEED_MPS;
        roll = Math.sin(t * 6 * Math.PI) * 3 * rotMul;
        break;
      }
      case 'figure8': {
        const angle = t * 2 * Math.PI;
        x = ff.startX + Math.sin(angle) * R;
        y = ff.startY + Math.sin(angle * 2) * (R * 0.5);
        z = alt + Math.sin(angle * 3) * (alt * 0.1);
        const dx = Math.cos(angle) * R;
        const dy = Math.cos(angle * 2) * R;
        yaw = (Math.atan2(dx, dy) * 180) / Math.PI;
        if (yaw < 0) yaw += 360;
        roll = -20 * Math.cos(angle) * rotMul;
        pitch = -5 * Math.sin(angle * 2);
        break;
      }
      case 'square': {
        const side = ff.distance_m / 4;
        const seg = Math.floor(t * 4) % 4;
        const st = (t * 4) % 1;
        const corners = [
          [ff.startX - side / 2, ff.startY - side / 2],
          [ff.startX + side / 2, ff.startY - side / 2],
          [ff.startX + side / 2, ff.startY + side / 2],
          [ff.startX - side / 2, ff.startY + side / 2],
        ];
        const next = (seg + 1) % 4;
        x = corners[seg][0] + (corners[next][0] - corners[seg][0]) * st;
        y = corners[seg][1] + (corners[next][1] - corners[seg][1]) * st;
        z = alt;
        yaw = [0, 90, 180, 270][seg];
        roll = Math.sin(st * Math.PI) * 8 * rotMul;
        pitch = -6;
        break;
      }
      case 'random': {
        const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        const r1 = seed - Math.floor(seed);
        const seed2 = Math.sin(i * 93.9898 + 12.111) * 43758.5453;
        const r2 = seed2 - Math.floor(seed2);
        x = ff.startX + Math.sin(t * 7.3 + r1 * 2) * R * 0.8;
        y = ff.startY + Math.cos(t * 5.1 + r2 * 3) * R * 0.8;
        z = alt + Math.sin(t * 3.7) * (alt * 0.4);
        yaw = (t * 720 * rotMul) % 360;
        roll = Math.sin(t * 11) * 25 * rotMul;
        pitch = Math.cos(t * 8) * 15;
        break;
      }
      case 'helix': {
        const angle = t * 4 * Math.PI;
        x = ff.startX + Math.cos(angle) * R * (1 - t * 0.5);
        y = ff.startY + Math.sin(angle) * R * (1 - t * 0.5);
        z = alt * 0.2 + t * alt * 1.5;
        yaw = ((angle * 180) / Math.PI + 90) % 360;
        roll = -20 * Math.sin(angle) * rotMul;
        pitch = -10 * t;
        break;
      }
    }

    pts.push({ time: timeSec, x, y, z, roll, pitch, yaw });
  }

  return pts;
}
