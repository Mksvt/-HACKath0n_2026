'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { DroneAttitude } from '@/types/api';

interface DroneViewerProps {
  trajectory?: DroneAttitude[];
}

export function DroneViewer({ trajectory }: DroneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<any>(null);
  const droneRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !trajectory || trajectory.length === 0) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    // Calculate trajectory bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    trajectory.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Draw trajectory line
    const trajectoryGeometry = new THREE.BufferGeometry();
    const positions = trajectory.map((p) => [p.x - centerX, p.z - centerZ, p.y - centerY]).flat();
    trajectoryGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

    const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
    const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
    scene.add(trajectoryLine);

    // Draw waypoints
    const waypointGeometry = new THREE.BufferGeometry();
    const waypointPositions: number[] = [];
    trajectory.forEach((point, i) => {
      if (i % Math.max(1, Math.floor(trajectory.length / 20)) === 0) {
        waypointPositions.push(point.x - centerX, point.z - centerZ, point.y - centerY);
      }
    });
    waypointGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(waypointPositions), 3));

    const waypointMaterial = new THREE.PointsMaterial({ color: 0x10b981, size: 2 });
    const waypoints = new THREE.Points(waypointGeometry, waypointMaterial);
    scene.add(waypoints);

    // Create drone mesh
    const drone = new THREE.Group();

    // Drone body
    const bodyGeometry = new THREE.BoxGeometry(2, 1, 2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    drone.add(body);

    // Drone arms and rotors
    const armPositions = [
      [3, 0, 3],
      [-3, 0, 3],
      [-3, 0, -3],
      [3, 0, -3],
    ];

    armPositions.forEach((pos) => {
      // Arm line
      const armGeometry = new THREE.BufferGeometry();
      armGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array([0, 0, 0, pos[0], pos[1], pos[2]]), 3)
      );
      const armMaterial = new THREE.LineBasicMaterial({ color: 0x0099ff });
      const arm = new THREE.Line(armGeometry, armMaterial);
      drone.add(arm);

      // Rotor (sphere)
      const rotorGeometry = new THREE.SphereGeometry(1.5, 16, 16);
      const rotorMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x00aa00 });
      const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
      rotor.position.set(pos[0], pos[1], pos[2]);
      drone.add(rotor);
    });

    // Direction arrow
    const arrowGeometry = new THREE.ConeGeometry(1, 3, 8);
    const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xfbbf24 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(4, 0, 0);
    arrow.rotation.z = Math.PI / 2;
    drone.add(arrow);

    droneRef.current = drone;
    scene.add(drone);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.autoRotate = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Position camera to see entire trajectory
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 2;

    camera.position.set(centerX + cameraZ * 0.5, centerZ + cameraZ, centerY + cameraZ * 0.5);
    controls.target.set(centerX, centerZ, centerY);
    controls.update();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (isPlaying && trajectory.length > 0) {
        setCurrentFrame((prev) => {
          const next = prev + speed * 0.3;
          return next >= trajectory.length ? 0 : next;
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [trajectory]);

  // Update drone position
  useEffect(() => {
    if (!trajectory || trajectory.length === 0 || !droneRef.current) return;

    const frameIndex = Math.floor(currentFrame);
    if (frameIndex >= 0 && frameIndex < trajectory.length) {
      const point = trajectory[frameIndex];

      // Calculate center for offset
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      trajectory.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;

      // Position drone
      droneRef.current.position.set(point.x - centerX, point.z - centerZ, point.y - centerY);

      // Rotation (convert degrees to radians, YXZ order)
      droneRef.current.rotation.order = 'YXZ';
      droneRef.current.rotation.y = (point.yaw * Math.PI) / 180;
      droneRef.current.rotation.x = (point.pitch * Math.PI) / 180;
      droneRef.current.rotation.z = (point.roll * Math.PI) / 180;
    }
  }, [currentFrame, trajectory]);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full bg-gray-900 rounded-lg overflow-hidden" style={{ height: '600px' }} ref={containerRef} />

      <div className="flex gap-4 items-center bg-gray-800 p-4 rounded-lg">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition disabled:opacity-50"
          disabled={!trajectory}
        >
          {isPlaying ? '⏸ Пауза' : '▶ Прямо'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-white text-sm">Швидкість:</span>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-32 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            disabled={!trajectory}
          />
          <span className="text-white text-sm w-8">{speed.toFixed(1)}x</span>
        </div>

        <div className="text-white text-sm ml-auto">
          {trajectory && `Frame: ${Math.floor(currentFrame)} / ${trajectory.length}`}
        </div>
      </div>

      <div className="text-xs text-gray-400 bg-gray-800 p-3 rounded">
        💡 Використовуй <strong>мишку</strong> для обертання, <strong>скрол</strong> для зуму
      </div>
    </div>
  );
}
