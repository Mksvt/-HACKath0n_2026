'use client';

import { useEffect, useRef, useState } from 'react';
import { TrajectoryPoint } from '@/types/api';

const CESIUM_BASE_URL =
  process.env.NEXT_PUBLIC_CESIUM_BASE_URL ||
  'https://cdn.jsdelivr.net/npm/cesium@1.120.0/Build/Cesium/';

interface Props {
  trajectory?: TrajectoryPoint[];
  origin?: { lat: number; lon: number; alt: number };
  colorMode?: 'speed' | 'time';
}

export function CesiumViewer({ trajectory, origin, colorMode = 'speed' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [altScale, setAltScale] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !trajectory?.length || !origin) return;

    let viewer: any;
    let ro: ResizeObserver;
    let destroyed = false;

    const silentCredit = document.createElement('div');
    silentCredit.style.display = 'none';
    document.body.appendChild(silentCredit);

    (async () => {
      try {
        // ── 1. Wait for the container to have real pixel dimensions ──────────
        await waitForSize(containerRef.current!);
        if (destroyed) return;

        // ── 2. Dynamic import + base-URL patch ───────────────────────────────
        const Cesium = await import('cesium');
        const buildModuleUrl = Cesium.buildModuleUrl as unknown as {
          setBaseUrl?: (url: string) => void;
        };
        buildModuleUrl.setBaseUrl?.(CESIUM_BASE_URL);

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MmU3ZTFkYy00ODk1LTQwOGMtYjc4MS05MGIxYjQ0YTlhNGYiLCJpZCI6NDEyMzUyLCJpYXQiOjE3NzUwNDY4ODl9.TNm4F4wo2bhp4O4YZ9NX_wfiet3lUlsdX5GQ0tLx5Aw';
        if (!token) {
          console.warn(
            '[CesiumViewer] NEXT_PUBLIC_CESIUM_ION_TOKEN is not set. ' +
            'Get a free token at https://ion.cesium.com/tokens',
          );
        }
        Cesium.Ion.defaultAccessToken = token;

        if (destroyed) return;

        // ── 3. Create the Viewer ─────────────────────────────────────────────
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

        // ── 4. Force canvas to fill its parent ───────────────────────────────
        //    Cesium creates a <canvas> and sets its inline style to pixel values
        //    measured at construction time. If layout wasn't settled yet the
        //    canvas stays at the wrong size. We override it to 100%×100% and
        //    call resize() so Cesium rebuilds its projection + framebuffer.
        forceCanvasFill(viewer);

        // ── 5. Scene styling ─────────────────────────────────────────────────
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0b1021');
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a1f2e');
        if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
        if (viewer.scene.globe.terrainExaggeration !== undefined) {
          viewer.scene.globe.terrainExaggeration = 1.0;
        }

        // ── 6. OSM imagery ───────────────────────────────────────────────────
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '',
          }),
        );

        // ── 7. ResizeObserver ────────────────────────────────────────────────
        ro = new ResizeObserver(() => {
          if (!viewer || viewer.isDestroyed()) return;
          forceCanvasFill(viewer);
        });
        ro.observe(containerRef.current as HTMLElement);

        // ── 8. Render trajectory ─────────────────────────────────────────────
        renderTrajectory(Cesium, viewer, trajectory, origin, altScale);
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
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectory, origin]);

  return (
    <div className="flex flex-col gap-0">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border border-white/10 rounded-t-2xl">
        <span className="text-xs text-slate-400 font-medium">
          3D ENU trajectory — {trajectory?.length ?? 0} points
        </span>
        <div className="flex items-center gap-3">
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
          <span className="text-xs text-slate-500">Color by {colorMode}</span>
        </div>
      </div>

      {/* ── Cesium wrapper (fixed height, relative) ─────────────────────────── */}
      <div
        style={{ width: '100%', height: '60vh', minHeight: 480, position: 'relative' }}
        className="border-x border-b border-white/10 rounded-b-2xl overflow-hidden bg-[#0b1021]"
      >
        {/*
          key={altScale} unmounts + remounts this div → triggers useEffect with
          the new altScale. Must sit INSIDE the sized wrapper so clientWidth /
          clientHeight are already correct when Cesium reads them.
        */}
        <div
          key={altScale}
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: 0,          // top/right/bottom/left = 0
            width: '100%',
            height: '100%',
          }}
        />

        {/* Loading overlay */}
        {isLoading && !error && (
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
              <span className="text-red-400 text-sm font-medium">Viewer failed to load</span>
              <span className="text-slate-500 text-xs">{error}</span>
              <span className="text-slate-600 text-xs mt-1">
                Make sure{' '}
                <code className="text-slate-400">NEXT_PUBLIC_CESIUM_ION_TOKEN</code> is set in{' '}
                <code className="text-slate-400">.env.local</code>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Polls until the element has non-zero clientWidth × clientHeight.
 * Cesium reads these synchronously during construction; if the element is
 * still in a CSS transition or hidden the canvas ends up 0×0.
 */
function waitForSize(el: HTMLElement, maxWaitMs = 5000, intervalMs = 50): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        resolve();
      } else if (Date.now() - start > maxWaitMs) {
        reject(new Error('CesiumViewer container never gained a non-zero size'));
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

/**
 * Forces the Cesium-internal <canvas> to always fill its parent div.
 *
 * Problem: Cesium sets canvas.style.width / canvas.style.height to the pixel
 * values it measured at construction time. If the container is later resized
 * (window resize, tab switch, panel open/close) the canvas stays stale and
 * the rest of the container shows through as solid background colour.
 *
 * Fix: override those inline styles to 100%×100% and call viewer.resize() so
 * Cesium recomputes its internal projection matrix and redraws at full size.
 */
function forceCanvasFill(viewer: any) {
  const canvas: HTMLCanvasElement | undefined = viewer?.canvas;
  if (!canvas) return;

  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';

  viewer.resize();
}

// ── Trajectory renderer ───────────────────────────────────────────────────────

/**
 * Renders the flight path into an already-initialised Cesium Viewer.
 *
 * Coordinate mapping:
 *   origin              → WGS-84 reference (first valid GPS fix)
 *   TrajectoryPoint.x/y/z → ENU offsets in metres relative to origin
 *
 * We build a local ENU→ECEF 4×4 matrix from the origin, then multiply every
 * point through it so Cesium can place them in world space.
 */
function renderTrajectory(
  Cesium: any,
  viewer: any,
  trajectory: TrajectoryPoint[],
  origin: { lat: number; lon: number; alt: number },
  altScale: number,
) {
  viewer.entities.removeAll();
  viewer.scene.primitives.removeAll();

  if (!trajectory.length) return;

  const originCartesian = Cesium.Cartesian3.fromDegrees(
    origin.lon,
    origin.lat,
    origin.alt,
  );
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian);

  const toEcef = (p: TrajectoryPoint): any => {
    // Scale Z (Up) to keep low-altitude flights visible
    const local = new Cesium.Cartesian3(p.x, p.y, p.z * altScale);
    return Cesium.Matrix4.multiplyByPoint(enuFrame, local, new Cesium.Cartesian3());
  };

  const positions = trajectory.map(toEcef);
  const groundPositions = trajectory.map((p) => {
    const local = new Cesium.Cartesian3(p.x, p.y, 0); // z=0 → ground shadow
    return Cesium.Matrix4.multiplyByPoint(enuFrame, local, new Cesium.Cartesian3());
  });

  const colors = trajectory.map((p) =>
    Cesium.Color.fromCssColorString(p.color ?? '#3b82f6'),
  );

  // ── Main flight path ──────────────────────────────────────────────────────
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

  // ── Ground shadow ─────────────────────────────────────────────────────────
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

  // ── Vertical curtain lines every N points ─────────────────────────────────
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

  // ── Start marker ──────────────────────────────────────────────────────────
  viewer.entities.add({
    position: positions[0],
    point: {
      pixelSize: 14,
      color: Cesium.Color.fromCssColorString('#22c55e'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.NONE,
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

  // ── End marker ────────────────────────────────────────────────────────────
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

  // ── Fit camera to trajectory ──────────────────────────────────────────────
  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  const radius = Math.max(sphere.radius, 50);

  viewer.camera.flyToBoundingSphere(sphere, {
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(30),   // heading — slightly to the side
      Cesium.Math.toRadians(-35),  // pitch   — ~35° down
      radius * 4,                  // range
    ),
    duration: 1.5,
  });
}