'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { MTLLoader } from 'three-stdlib';
import { DroneAttitude, DroneConfig, TelemetryPoint, FreeFlightConfig } from '@/types/api';
import {
  DEFAULT_CONFIG, computeModifiers,
  DEFAULT_FREE_FLIGHT, generateFreeFlightTrajectory,
} from '@/lib/droneparts';
import { DroneConstructor } from './DroneConstructor';

interface DroneViewerProps {
  trajectory?: DroneAttitude[];
  telemetry?: TelemetryPoint[];
}

function computeBounds(trajectory: DroneAttitude[]) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const pt of trajectory) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }

  return {
    minX, maxX, minY, maxY, minZ, maxZ,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2,
    extent: Math.max(maxX - minX, maxY - minY, maxZ - minZ, 10),
  };
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return current + diff * t;
}

export function DroneViewer({ trajectory: uploadedTrajectory, telemetry }: DroneViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const droneRef = useRef<THREE.Group | null>(null);
  const droneObjRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const currentRotRef = useRef({ x: 0, y: 0, z: 0 });
  const trailLineRef = useRef<THREE.Line | null>(null);
  const trailDotsRef = useRef<THREE.Points | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [droneConfig, setDroneConfig] = useState<DroneConfig>(DEFAULT_CONFIG);
  const [freeFlightCfg, setFreeFlightCfg] = useState<FreeFlightConfig>(DEFAULT_FREE_FLIGHT);

  const mods = useMemo(() => computeModifiers(droneConfig), [droneConfig]);

  const hasUploaded = !!(uploadedTrajectory && uploadedTrajectory.length > 0);

  const freeTrajectory = useMemo(
    () => (!hasUploaded ? generateFreeFlightTrajectory(freeFlightCfg, mods) : null),
    [hasUploaded, freeFlightCfg, mods],
  );

  const trajectory = hasUploaded ? uploadedTrajectory! : freeTrajectory!;

  const bounds = useMemo(
    () => (trajectory && trajectory.length > 0 ? computeBounds(trajectory) : null),
    [trajectory],
  );

  const currentTelemetry = useMemo(() => {
    if (!trajectory || !telemetry || telemetry.length === 0) return null;
    const frameIdx = Math.floor(currentFrame);
    if (frameIdx < 0 || frameIdx >= trajectory.length) return null;
    const t = trajectory[frameIdx].time;
    let best = telemetry[0];
    let bestDiff = Math.abs(best.timestamp - t);
    for (let i = 1; i < telemetry.length; i++) {
      const diff = Math.abs(telemetry[i].timestamp - t);
      if (diff < bestDiff) { bestDiff = diff; best = telemetry[i]; }
    }
    return best;
  }, [currentFrame, trajectory, telemetry]);

  const currentAttitude = useMemo(() => {
    if (!trajectory) return null;
    const idx = Math.floor(currentFrame);
    if (idx < 0 || idx >= trajectory.length) return null;
    return trajectory[idx];
  }, [currentFrame, trajectory]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    const r = rendererRef.current;
    const c = cameraRef.current;
    const ct = containerRef.current;
    if (!r || !c || !ct) return;
    const tid = setTimeout(() => {
      const w = ct.clientWidth;
      const h = ct.clientHeight;
      c.aspect = w / h;
      c.updateProjectionMatrix();
      r.setSize(w, h);
    }, 100);
    return () => clearTimeout(tid);
  }, [isFullscreen]);

  // ── Apply color tint to drone meshes ──────────────────────────────────────
  useEffect(() => {
    const obj = droneObjRef.current;
    if (!obj) return;
    const tint = new THREE.Color(droneConfig.frame.color);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => { if ('color' in m) (m as THREE.MeshStandardMaterial).color.lerp(tint, 0.4); });
        } else if ('color' in mat) {
          (mat as THREE.MeshStandardMaterial).color.lerp(tint, 0.4);
        }
      }
    });
  }, [droneConfig.frame.color]);

  // ── Apply model scale from config ─────────────────────────────────────────
  useEffect(() => {
    const group = droneRef.current;
    if (!group) return;
    group.scale.setScalar(mods.modelScale);
  }, [mods.modelScale]);

  // ── Load OBJ model ────────────────────────────────────────────────────────
  const loadDroneModel = useCallback(
    (scene: THREE.Scene, scaleFactor: number) => {
      const mtlLoader = new MTLLoader();
      mtlLoader.setPath('/models/drone/');
      mtlLoader.load('Drone.mtl', (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath('/models/drone/');
        objLoader.load('Drone.obj', (obj) => {
          const box = new THREE.Box3().setFromObject(obj);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const desiredSize = scaleFactor * 0.08;
          const s = desiredSize / maxDim;
          obj.scale.set(s, s, s);

          const center = new THREE.Vector3();
          box.getCenter(center);
          obj.position.sub(center.multiplyScalar(s));

          droneObjRef.current = obj;
          const droneGroup = new THREE.Group();
          droneGroup.add(obj);
          droneRef.current = droneGroup;
          scene.add(droneGroup);
          setModelLoaded(true);
        });
      });
    },
    [],
  );

  // ── Build trajectory geometry ─────────────────────────────────────────────
  const buildTrajectoryGeometry = useCallback((
    scene: THREE.Scene,
    traj: DroneAttitude[],
    cX: number, cY: number, cZ: number, ext: number,
  ) => {
    if (trailLineRef.current) scene.remove(trailLineRef.current);
    if (trailDotsRef.current) scene.remove(trailDotsRef.current);

    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();

    for (let i = 0; i < traj.length; i++) {
      const pp = traj[i];
      positions.push(pp.x - cX, pp.z - cZ, pp.y - cY);
      const tt = i / (traj.length - 1);
      color.setHSL(0.55 + tt * 0.15, 0.9, 0.55);
      colors.push(color.r, color.g, color.b);
    }

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    lineGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 2 }));
    scene.add(line);
    trailLineRef.current = line;

    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    dotGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const dotSize = Math.max(1.5, ext * 0.005);
    const dots = new THREE.Points(dotGeom, new THREE.PointsMaterial({ vertexColors: true, size: dotSize, sizeAttenuation: true }));
    scene.add(dots);
    trailDotsRef.current = dots;
  }, []);

  // ── Three.js scene setup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !trajectory || trajectory.length === 0 || !bounds) return;

    const container = containerRef.current;
    const { centerX, centerY, centerZ, extent } = bounds;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.01, 50000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(1, 2, 1).normalize().multiplyScalar(extent * 2);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.5);
    fillLight.position.set(-1, 0.5, -1).normalize().multiplyScalar(extent * 2);
    scene.add(fillLight);
    scene.add(new THREE.HemisphereLight(0xb1e1ff, 0x283050, 0.6));

    const gridSize = Math.max(extent * 2, 200);
    scene.add(new THREE.GridHelper(gridSize, 40, 0x334466, 0x1a2744));

    buildTrajectoryGeometry(scene, trajectory, centerX, centerY, centerZ, extent);

    const startPos = new THREE.Vector3(trajectory[0].x - centerX, trajectory[0].z - centerZ, trajectory[0].y - centerY);
    const endPos = new THREE.Vector3(
      trajectory[trajectory.length - 1].x - centerX,
      trajectory[trajectory.length - 1].z - centerZ,
      trajectory[trajectory.length - 1].y - centerY,
    );

    const markerGeo = new THREE.SphereGeometry(extent * 0.012, 16, 16);
    const startMarker = new THREE.Mesh(markerGeo, new THREE.MeshPhongMaterial({ color: 0x22c55e, emissive: 0x166534 }));
    startMarker.position.copy(startPos);
    scene.add(startMarker);
    const endMarker = new THREE.Mesh(markerGeo, new THREE.MeshPhongMaterial({ color: 0xef4444, emissive: 0x7f1d1d }));
    endMarker.position.copy(endPos);
    scene.add(endMarker);

    loadDroneModel(scene, extent);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = extent * 5;
    controlsRef.current = controls;

    const fov = camera.fov * (Math.PI / 180);
    const camDist = Math.abs(extent / Math.tan(fov / 2)) * 0.35;
    camera.position.set(camDist * 0.3, camDist * 0.5, camDist * 0.3);
    camera.lookAt(startPos);
    controls.target.copy(startPos);
    controls.update();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (frameRef.current !== undefined && trajectory.length > 0) {
        const droneGroup = droneRef.current;
        if (droneGroup) {
          const idx = Math.floor(frameRef.current);
          const safeIdx = Math.max(0, Math.min(idx, trajectory.length - 1));
          const point = trajectory[safeIdx];

          droneGroup.position.set(point.x - centerX, point.z - centerZ, point.y - centerY);

          const rotMul = (droneGroup as any).__rotMul ?? 1;
          const targetY = (point.yaw * Math.PI) / 180 * rotMul;
          const targetX = -(point.pitch * Math.PI) / 180 * rotMul;
          const targetZ = -(point.roll * Math.PI) / 180 * rotMul;

          const damp = (droneGroup as any).__damping ?? 0.15;
          const rot = currentRotRef.current;
          rot.x = lerpAngle(rot.x, targetX, damp);
          rot.y = lerpAngle(rot.y, targetY, damp);
          rot.z = lerpAngle(rot.z, targetZ, damp);

          droneGroup.rotation.order = 'YXZ';
          droneGroup.rotation.y = rot.y;
          droneGroup.rotation.x = rot.x;
          droneGroup.rotation.z = rot.z;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectory, bounds, loadDroneModel, buildTrajectoryGeometry]);

  // ── Playback loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trajectory || trajectory.length === 0) return;
    const interval = setInterval(() => {
      if (!isPlaying) return;
      frameRef.current += speed * 0.5 * mods.speedMultiplier;
      if (frameRef.current >= trajectory.length) frameRef.current = 0;
      setCurrentFrame(frameRef.current);

      const droneGroup = droneRef.current;
      if (droneGroup) {
        (droneGroup as any).__damping = mods.attitudeDamping;
        (droneGroup as any).__rotMul = mods.rotationMultiplier;
      }
    }, 16);
    return () => clearInterval(interval);
  }, [isPlaying, speed, trajectory, mods.speedMultiplier, mods.attitudeDamping, mods.rotationMultiplier]);

  const handleFrameChange = useCallback((val: number) => {
    frameRef.current = val;
    setCurrentFrame(val);
  }, []);

  // If we have no uploaded trajectory and no free flight trajectory yet, this shouldn't happen
  // but just in case:
  if (!trajectory || trajectory.length === 0) {
    return (
      <div className="flex h-[700px] items-center justify-center rounded-2xl border border-white/10 bg-slate-900/70 text-slate-400">
        Initializing flight viewer...
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden shadow-2xl ${
        isFullscreen ? 'rounded-none border-0' : ''
      }`}
    >
      {/* 3D Canvas */}
      <div className="w-full" style={{ height: isFullscreen ? '100vh' : '700px' }} ref={containerRef} />

      {/* Loading overlay */}
      {!modelLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            <p className="text-sm text-blue-300">Loading drone model...</p>
          </div>
        </div>
      )}

      {/* Constructor Panel */}
      <DroneConstructor
        config={droneConfig}
        onChange={setDroneConfig}
        freeFlightConfig={freeFlightCfg}
        onFreeFlightChange={setFreeFlightCfg}
        hasTrajectory={hasUploaded}
      />

      {/* Telemetry Panel */}
      <div className="absolute top-4 right-4 z-20 w-64 rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur-md p-3 shadow-xl">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">
          {hasUploaded ? 'Live Telemetry' : 'Simulation'}
        </h3>

        {currentTelemetry ? (
          <div className="space-y-1.5 font-mono text-[11px]">
            <CoordRow label="LAT" value={currentTelemetry.latitude.toFixed(8)} unit="°" accent="text-emerald-400" />
            <CoordRow label="LON" value={currentTelemetry.longitude.toFixed(8)} unit="°" accent="text-emerald-400" />
            <CoordRow label="ALT" value={currentTelemetry.altitude_m.toFixed(4)} unit="m" accent="text-cyan-400" />
            <div className="my-1.5 h-px bg-white/10" />
            <CoordRow label="SPD" value={(currentTelemetry.speed_mps ?? 0).toFixed(3)} unit="m/s" accent="text-purple-400" />
            {currentAttitude && (
              <>
                <div className="my-1.5 h-px bg-white/10" />
                <CoordRow label="ROLL" value={currentAttitude.roll.toFixed(3)} unit="°" accent="text-cyan-400" />
                <CoordRow label="PITCH" value={currentAttitude.pitch.toFixed(3)} unit="°" accent="text-cyan-400" />
                <CoordRow label="YAW" value={currentAttitude.yaw.toFixed(3)} unit="°" accent="text-cyan-400" />
              </>
            )}
          </div>
        ) : currentAttitude ? (
          <div className="space-y-1.5 font-mono text-[11px]">
            <CoordRow label="X" value={currentAttitude.x.toFixed(2)} unit="m" accent="text-emerald-400" />
            <CoordRow label="Y" value={currentAttitude.y.toFixed(2)} unit="m" accent="text-emerald-400" />
            <CoordRow label="ALT" value={currentAttitude.z.toFixed(2)} unit="m" accent="text-cyan-400" />
            <div className="my-1.5 h-px bg-white/10" />
            <CoordRow label="ROLL" value={currentAttitude.roll.toFixed(3)} unit="°" accent="text-cyan-400" />
            <CoordRow label="PITCH" value={currentAttitude.pitch.toFixed(3)} unit="°" accent="text-cyan-400" />
            <CoordRow label="YAW" value={currentAttitude.yaw.toFixed(3)} unit="°" accent="text-cyan-400" />
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">Waiting for data...</p>
        )}
      </div>

      {/* Frame counter + fullscreen */}
      <div className="absolute top-4 left-88 z-20 flex items-center gap-2">
        <div className="rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur-md px-3 py-2 text-xs text-slate-300">
          {hasUploaded ? 'Frame' : 'Sim'} {Math.floor(currentFrame)} / {trajectory.length - 1}
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
          )}
        </button>
        {!hasUploaded && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/90 backdrop-blur-md px-3 py-2 text-xs text-emerald-300 font-medium">
            Free Flight Mode
          </div>
        )}
      </div>

      {/* Build info bar */}
      <div className="absolute top-4 left-88 mt-11 z-20 flex gap-1.5 flex-wrap">
        <BuildChip label="SPD" value={`${mods.speedMultiplier}x`} />
        <BuildChip label="WT" value={`${mods.totalWeight_g}g`} />
        <BuildChip label="FLT" value={`${mods.estFlightTime_min}m`} />
        <BuildChip label="ROT" value={`${mods.rotationMultiplier}x`} />
        <BuildChip label="T/W" value={`${mods.thrustToWeight}`} />
      </div>

      {/* Playback Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-slate-950/90 backdrop-blur-md px-5 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 transition"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z"/></svg>
            )}
          </button>

          <input
            type="range"
            min={0}
            max={trajectory.length - 1}
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
              max={20}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-20 h-1.5 cursor-pointer appearance-none rounded-full bg-slate-700 accent-blue-500"
            />
            <span className="w-12 text-right tabular-nums text-white">{speed.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CoordRow({ label, value, unit, accent }: { label: string; value: string; unit: string; accent: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500 w-12 shrink-0">{label}</span>
      <span className={`${accent} tabular-nums flex-1 text-right`}>{value}</span>
      <span className="text-slate-600 w-8 text-right">{unit}</span>
    </div>
  );
}

function BuildChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/80 backdrop-blur-md px-2 py-1 text-[10px]">
      <span className="text-slate-500">{label} </span>
      <span className="text-slate-200 font-bold tabular-nums">{value}</span>
    </div>
  );
}
