'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { TrajectoryPoint, DroneAttitude, TelemetryPoint } from '@/types/api';

const CESIUM_BASE_URL =
  process.env.NEXT_PUBLIC_CESIUM_BASE_URL ||
  'https://cdn.jsdelivr.net/npm/cesium@1.120.0/Build/Cesium/';

interface Props {
  trajectory?: TrajectoryPoint[];
  trajectoryWithAttitude?: DroneAttitude[];
  telemetry?: TelemetryPoint[];
  origin?: { lat: number; lon: number; alt: number };
  colorMode?: 'speed' | 'time';
}

export function CesiumViewer({
  trajectory,
  trajectoryWithAttitude,
  telemetry,
  origin,
  colorMode = 'speed',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [altScale, setAltScale] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const frameRef = useRef(0);
  const droneEntityRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const enuFrameRef = useRef<any>(null);
  const headingRef = useRef(0);
  const positionsRef = useRef<any[]>([]);
  const hasTrajectoryData = Boolean(trajectory?.length && origin);

  const currentTelemetry = useMemo(() => {
    if (!trajectoryWithAttitude || !telemetry || telemetry.length === 0)
      return null;
    const frameIdx = Math.floor(currentFrame);
    if (frameIdx < 0 || frameIdx >= trajectoryWithAttitude.length) return null;
    const t = trajectoryWithAttitude[frameIdx].time;
    let best = telemetry[0];
    let bestDiff = Math.abs(best.timestamp - t);
    for (let i = 1; i < telemetry.length; i++) {
      const diff = Math.abs(telemetry[i].timestamp - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = telemetry[i];
      }
    }
    return best;
  }, [currentFrame, trajectoryWithAttitude, telemetry]);

  const currentAttitude = useMemo(() => {
    if (!trajectoryWithAttitude) return null;
    const idx = Math.floor(currentFrame);
    if (idx < 0 || idx >= trajectoryWithAttitude.length) return null;
    return trajectoryWithAttitude[idx];
  }, [currentFrame, trajectoryWithAttitude]);

  useEffect(() => {
    if (!hasTrajectoryData) {
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!containerRef.current || !trajectory?.length || !origin) return;

    setIsLoading(true);
    setError(null);

    let viewer: any;
    let ro: ResizeObserver;
    let destroyed = false;

    const silentCredit = document.createElement('div');
    silentCredit.style.display = 'none';
    document.body.appendChild(silentCredit);

    (async () => {
      try {
        await waitForSize(containerRef.current!);
        if (destroyed) return;

        const Cesium = await import('cesium');
        cesiumRef.current = Cesium;
        const buildModuleUrl = Cesium.buildModuleUrl as unknown as {
          setBaseUrl?: (url: string) => void;
        };
        buildModuleUrl.setBaseUrl?.(CESIUM_BASE_URL);

        const token =
          process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ??
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MmU3ZTFkYy00ODk1LTQwOGMtYjc4MS05MGIxYjQ0YTlhNGYiLCJpZCI6NDEyMzUyLCJpYXQiOjE3NzUwNDY4ODl9.TNm4F4wo2bhp4O4YZ9NX_wfiet3lUlsdX5GQ0tLx5Aw';
        if (!token) {
          console.warn(
            '[CesiumViewer] NEXT_PUBLIC_CESIUM_ION_TOKEN is not set.',
          );
        }
        Cesium.Ion.defaultAccessToken = token;

        if (destroyed) return;

        viewer = new Cesium.Viewer(containerRef.current as HTMLElement, {
          animation: false,
          timeline: false,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          creditContainer: silentCredit,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          skyBox: false as any,
          skyAtmosphere: false as any,
          useBrowserRecommendedResolution: true,
        });

        viewerRef.current = viewer;
        forceCanvasFill(viewer);

        viewer.scene.backgroundColor =
          Cesium.Color.fromCssColorString('#0b1021');
        viewer.scene.globe.baseColor =
          Cesium.Color.fromCssColorString('#1a1f2e');
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;

        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '',
          }),
        );

        ro = new ResizeObserver(() => {
          if (!viewer || viewer.isDestroyed()) return;
          forceCanvasFill(viewer);
        });
        ro.observe(containerRef.current as HTMLElement);

        const { positions, enuFrame } = renderTrajectory(
          Cesium,
          viewer,
          trajectory,
          origin,
          altScale,
        );
        positionsRef.current = positions;
        enuFrameRef.current = enuFrame;

        // Add drone model entity
        if (
          trajectoryWithAttitude &&
          trajectoryWithAttitude.length > 0 &&
          positions.length > 0
        ) {
          const initialOrientation = computeOrientationFromTrajectoryDirection(
            Cesium,
            enuFrame,
            trajectoryWithAttitude,
            0,
            altScale,
            headingRef.current,
          );
          headingRef.current = initialOrientation.headingRad;

          const droneEntity = viewer.entities.add({
            position: positions[0],
            orientation: initialOrientation.quaternion,
            model: {
              uri: '/models/drone/Drone.glb',
              minimumPixelSize: 64,
              maximumScale: 50,
              scale: 0.3,
              color: Cesium.Color.WHITE,
              colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
              colorBlendAmount: 0.3,
            },
            label: {
              text: 'UAV',
              font: '12px sans-serif',
              fillColor: Cesium.Color.fromCssColorString('#60a5fa'),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -30),
              showBackground: true,
              backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
            },
          });
          droneEntityRef.current = droneEntity;
        }

        viewer.scene.requestRender();
        setIsLoading(false);
      } catch (err: any) {
        console.error('[CesiumViewer] Initialization failed:', err);
        setError(err?.message ?? 'Cesium failed to initialize');
        setIsLoading(false);
      }
    })();

    return () => {
      destroyed = true;
      ro?.disconnect();
      silentCredit.remove();
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
        viewerRef.current = null;
        droneEntityRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTrajectoryData, trajectory, origin, altScale]);

  // Animation loop for the drone
  useEffect(() => {
    if (!trajectoryWithAttitude || trajectoryWithAttitude.length === 0) return;
    const interval = setInterval(() => {
      if (!isPlaying) return;
      frameRef.current += speed * 0.5;
      if (frameRef.current >= trajectoryWithAttitude.length)
        frameRef.current = 0;
      setCurrentFrame(frameRef.current);
    }, 16);
    return () => clearInterval(interval);
  }, [isPlaying, speed, trajectoryWithAttitude]);

  // Update drone position on the Cesium globe
  useEffect(() => {
    const entity = droneEntityRef.current;
    const Cesium = cesiumRef.current;
    const enuFrame = enuFrameRef.current;
    const viewer = viewerRef.current;
    if (!entity || !Cesium || !enuFrame || !viewer || !trajectoryWithAttitude)
      return;

    const idx = Math.floor(currentFrame);
    const safeIdx = Math.max(
      0,
      Math.min(idx, trajectoryWithAttitude.length - 1),
    );
    const point = trajectoryWithAttitude[safeIdx];

    const local = new Cesium.Cartesian3(point.x, point.y, point.z * altScale);
    const ecef = Cesium.Matrix4.multiplyByPoint(
      enuFrame,
      local,
      new Cesium.Cartesian3(),
    );

    const orientation = computeOrientationFromTrajectoryDirection(
      Cesium,
      enuFrame,
      trajectoryWithAttitude,
      safeIdx,
      altScale,
      headingRef.current,
    );
    headingRef.current = orientation.headingRad;

    entity.position = ecef;
    entity.orientation = orientation.quaternion;

    viewer.scene.requestRender();
  }, [currentFrame, trajectoryWithAttitude, altScale]);

  const handleFrameChange = useCallback((val: number) => {
    frameRef.current = val;
    setCurrentFrame(val);
  }, []);

  const totalFrames = trajectoryWithAttitude?.length ?? trajectory?.length ?? 0;

  return (
    <div className="relative flex flex-col gap-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border border-white/10 rounded-t-2xl">
        <span className="text-xs text-slate-400 font-medium">
          {hasTrajectoryData
            ? `3D ENU trajectory — ${trajectory?.length ?? 0} points`
            : 'Карта польоту очікує BIN-лог'}
        </span>
        <div className="flex items-center gap-3">
          {hasTrajectoryData && (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Altitude ×
                <select
                  value={altScale}
                  onChange={(e) => setAltScale(Number(e.target.value))}
                  className="bg-slate-800 border border-white/10 text-white text-xs rounded px-2 py-1"
                >
                  <option value={1}>1× (real)</option>
                  <option value={3}>3×</option>
                  <option value={5}>5×</option>
                  <option value={10}>10×</option>
                  <option value={20}>20×</option>
                </select>
              </label>
              <span className="text-xs text-slate-500">
                Color by {colorMode}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Cesium wrapper */}
      <div
        style={{
          width: '100%',
          height: '60vh',
          minHeight: 480,
          position: 'relative',
        }}
        className="border-x border-b border-white/10 rounded-b-2xl overflow-hidden bg-[#0b1021]"
      >
        <div
          key={altScale}
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {!hasTrajectoryData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b1021]/85">
            <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/80 px-6 py-5 text-center backdrop-blur">
              <p className="text-sm font-semibold text-cyan-300">
                Немає траєкторії для відтворення
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Завантаж BIN-файл у верхній панелі, і карта автоматично
                відкриється з маршрутом польоту.
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {hasTrajectoryData && isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1021]/80 z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Loading 3D viewer…</span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b1021]/90 z-10">
            <div className="flex flex-col items-center gap-2 max-w-sm text-center px-6">
              <span className="text-red-400 text-sm font-medium">
                Viewer failed to load
              </span>
              <span className="text-slate-500 text-xs">{error}</span>
            </div>
          </div>
        )}

        {/* Telemetry overlay */}
        {trajectoryWithAttitude && trajectoryWithAttitude.length > 0 && (
          <div className="absolute top-4 right-4 z-20 w-72 rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-md p-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
              Live Telemetry
            </h3>
            {currentTelemetry ? (
              <div className="space-y-2 font-mono text-xs">
                <CoordRow
                  label="LAT"
                  value={currentTelemetry.latitude.toFixed(8)}
                  unit="°"
                  accent="text-emerald-400"
                />
                <CoordRow
                  label="LON"
                  value={currentTelemetry.longitude.toFixed(8)}
                  unit="°"
                  accent="text-emerald-400"
                />
                <CoordRow
                  label="ALT"
                  value={currentTelemetry.altitude_m.toFixed(4)}
                  unit="m"
                  accent="text-cyan-400"
                />
                <div className="my-2 h-px bg-white/10" />
                <CoordRow
                  label="SPD"
                  value={(currentTelemetry.speed_mps ?? 0).toFixed(3)}
                  unit="m/s"
                  accent="text-purple-400"
                />
                {currentAttitude && (
                  <>
                    <div className="my-2 h-px bg-white/10" />
                    <CoordRow
                      label="ROLL"
                      value={currentAttitude.roll.toFixed(3)}
                      unit="°"
                      accent="text-cyan-400"
                    />
                    <CoordRow
                      label="PITCH"
                      value={currentAttitude.pitch.toFixed(3)}
                      unit="°"
                      accent="text-cyan-400"
                    />
                    <CoordRow
                      label="YAW"
                      value={currentAttitude.yaw.toFixed(3)}
                      unit="°"
                      accent="text-cyan-400"
                    />
                    <CoordRow
                      label="TIME"
                      value={currentAttitude.time.toFixed(2)}
                      unit="s"
                      accent="text-slate-400"
                    />
                  </>
                )}
              </div>
            ) : currentAttitude ? (
              <div className="space-y-2 font-mono text-xs">
                <CoordRow
                  label="X (E)"
                  value={currentAttitude.x.toFixed(4)}
                  unit="m"
                  accent="text-amber-400"
                />
                <CoordRow
                  label="Y (N)"
                  value={currentAttitude.y.toFixed(4)}
                  unit="m"
                  accent="text-amber-400"
                />
                <CoordRow
                  label="Z (U)"
                  value={currentAttitude.z.toFixed(4)}
                  unit="m"
                  accent="text-amber-400"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Frame counter */}
        {totalFrames > 0 && (
          <div className="absolute top-4 left-4 z-20 rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur-md px-3 py-2 text-xs text-slate-300">
            Frame {Math.floor(currentFrame)} / {totalFrames - 1}
          </div>
        )}
      </div>

      {/* Playback controls */}
      {hasTrajectoryData && totalFrames > 0 && (
        <div className="border-x border-b border-white/10 bg-slate-950/90 backdrop-blur-md px-5 py-3 rounded-b-2xl -mt-px">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 transition"
            >
              {isPlaying ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="currentColor"
                >
                  <rect x="2" y="1" width="3.5" height="12" rx="1" />
                  <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="currentColor"
                >
                  <path d="M3 1.5v11l9-5.5z" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              step={1}
              value={Math.floor(currentFrame)}
              onChange={(e) => handleFrameChange(Number(e.target.value))}
              className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500"
            />

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Speed</span>
              <input
                type="range"
                min={0.1}
                max={10}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-20 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500"
              />
              <span className="w-10 text-right tabular-nums text-white">
                {speed.toFixed(1)}x
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CoordRow({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500 w-12 shrink-0">{label}</span>
      <span className={`${accent} tabular-nums flex-1 text-right`}>
        {value}
      </span>
      <span className="text-slate-600 w-8 text-right">{unit}</span>
    </div>
  );
}

function computeOrientationFromTrajectoryDirection(
  Cesium: any,
  enuFrame: any,
  points: DroneAttitude[],
  index: number,
  altScale: number,
  fallbackHeadingRad: number,
): { quaternion: any; headingRad: number } {
  const safeIndex = Math.max(0, Math.min(index, points.length - 1));
  const current = points[safeIndex];
  const next = points[Math.min(safeIndex + 1, points.length - 1)];
  const prev = points[Math.max(safeIndex - 1, 0)];

  const dirX =
    safeIndex < points.length - 1 ? next.x - current.x : current.x - prev.x;
  const dirY =
    safeIndex < points.length - 1 ? next.y - current.y : current.y - prev.y;

  // Cesium HPR heading is referenced to local East axis. Convert ENU direction
  // vector to this convention so the drone nose follows the trajectory.
  const headingRad =
    Math.hypot(dirX, dirY) > 1e-4
      ? -Math.atan2(dirY, dirX)
      : fallbackHeadingRad;

  // Keep drone level to avoid unnatural roll/pitch from noisy attitude logs.
  const hpr = new Cesium.HeadingPitchRoll(headingRad, 0, 0);

  const local = new Cesium.Cartesian3(
    current.x,
    current.y,
    current.z * altScale,
  );
  const position = Cesium.Matrix4.multiplyByPoint(
    enuFrame,
    local,
    new Cesium.Cartesian3(),
  );

  return {
    quaternion: Cesium.Transforms.headingPitchRollQuaternion(position, hpr),
    headingRad,
  };
}

function waitForSize(
  el: HTMLElement,
  maxWaitMs = 5000,
  intervalMs = 50,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) resolve();
      else if (Date.now() - start > maxWaitMs)
        reject(new Error('Container never gained size'));
      else setTimeout(check, intervalMs);
    };
    check();
  });
}

function forceCanvasFill(viewer: any) {
  const canvas: HTMLCanvasElement | undefined = viewer?.canvas;
  if (!canvas) return;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  viewer.resize();
}

function renderTrajectory(
  Cesium: any,
  viewer: any,
  trajectory: TrajectoryPoint[],
  origin: { lat: number; lon: number; alt: number },
  altScale: number,
): { positions: any[]; enuFrame: any } {
  viewer.entities.removeAll();
  viewer.scene.primitives.removeAll();

  if (!trajectory.length) return { positions: [], enuFrame: null };

  const originCartesian = Cesium.Cartesian3.fromDegrees(
    origin.lon,
    origin.lat,
    origin.alt,
  );
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);

  const toEcef = (p: TrajectoryPoint): any => {
    const local = new Cesium.Cartesian3(p.x, p.y, p.z * altScale);
    return Cesium.Matrix4.multiplyByPoint(
      enuFrame,
      local,
      new Cesium.Cartesian3(),
    );
  };

  const positions = trajectory.map(toEcef);
  const groundPositions = trajectory.map((p) => {
    const local = new Cesium.Cartesian3(p.x, p.y, 0);
    return Cesium.Matrix4.multiplyByPoint(
      enuFrame,
      local,
      new Cesium.Cartesian3(),
    );
  });

  const colors = trajectory.map((p) =>
    Cesium.Color.fromCssColorString(p.color ?? '#3b82f6'),
  );

  // Flight path
  viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.PolylineGeometry({
          positions,
          width: 5,
          vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
          colors,
          colorsPerVertex: true,
        }),
      }),
      appearance: new Cesium.PolylineColorAppearance({ translucent: false }),
    }),
  );

  // Ground shadow
  viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.PolylineGeometry({
          positions: groundPositions,
          width: 2,
          vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
          colors: groundPositions.map(() => new Cesium.Color(1, 1, 1, 0.2)),
          colorsPerVertex: false,
        }),
      }),
      appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
    }),
  );

  // Vertical curtain lines
  const step = Math.max(1, Math.floor(trajectory.length / 20));
  for (let i = 0; i < trajectory.length; i += step) {
    viewer.scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.PolylineGeometry({
            positions: [positions[i], groundPositions[i]],
            width: 1,
            vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
            colors: [
              new Cesium.Color(1, 1, 1, 0.15),
              new Cesium.Color(1, 1, 1, 0.05),
            ],
            colorsPerVertex: true,
          }),
        }),
        appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
      }),
    );
  }

  // Start marker
  viewer.entities.add({
    position: positions[0],
    point: {
      pixelSize: 14,
      color: Cesium.Color.fromCssColorString('#22c55e'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: 'Start',
      font: '13px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#22c55e'),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -18),
    },
  });

  // End marker
  viewer.entities.add({
    position: positions[positions.length - 1],
    point: {
      pixelSize: 14,
      color: Cesium.Color.fromCssColorString('#ef4444'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: 'End',
      font: '13px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#ef4444'),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -18),
    },
  });

  // Fit camera
  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  const radius = Math.max(sphere.radius, 50);
  viewer.camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(30),
      Cesium.Math.toRadians(-35),
      radius * 4,
    ),
    duration: 1.5,
  });

  return { positions, enuFrame };
}
