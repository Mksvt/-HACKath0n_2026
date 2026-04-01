# 🚁 Ardupilot 3D Flight Visualization - Complete Architecture

## Overview

This is a full-stack solution for uploading Ardupilot `.BIN` logs, parsing GPS/IMU/ATT data, and visualizing drone flights in 3D using Three.js.

### Data Flow

```
User selects .BIN file
    ↓
Upload to backend (POST /api/v1/flights/upload)
    ↓
Parser: Extract GPS (coordinates), IMU (acceleration), ATT (orientation)
    ↓
Convert GPS from WGS-84 to local ENU (meters from start point)
    ↓
Synchronize ATT data with GPS timestamps
    ↓
Generate JSON: [{ time, x, y, z, roll, pitch, yaw }, ...]
    ↓
Frontend fetches trajectory via GET /api/v1/flights/{id}/trajectory/with-attitude
    ↓
Three.js renders drone model + animates along path with correct orientation
```

## Backend (Python/FastAPI)

### Key Files

- **[app/services/log_parser/ardupilot_parser.py](backend/app/services/log_parser/ardupilot_parser.py)** - Parses `.BIN` files using `pymavlink`
  - Extracts GPS messages (lat, lon, alt, speed)
  - Extracts IMU messages (acceleration)
  - Extracts ATT messages (roll, pitch, yaw) **[NEW]**
  - Returns 3 DataFrames

- **[app/utils/geo.py](backend/app/utils/geo.py)** - Geographic conversions
  - `wgs84_to_enu()` - Converts WGS-84 (GPS) to local ENU coordinates

- **[app/services/telemetry/trajectory.py](backend/app/services/telemetry/trajectory.py)** - Trajectory building
  - `TrajectoryBuilder.to_enu()` - Converts telemetry to ENU

- **[app/api/v1/routes.py](backend/app/api/v1/routes.py)** - API endpoints
  - `POST /flights/upload` - Accept `.BIN` file
  - `GET /flights/{id}/trajectory/with-attitude` **[NEW]** - Returns drone trajectory with attitude

### New Endpoint

```
GET /api/v1/flights/{flight_id}/trajectory/with-attitude

Response:
[
  {
    "time": 16.463383,     // seconds since start
    "x": 0.0,              // meters East
    "y": 0.0,              // meters North
    "z": 0.0,              // meters Up
    "roll": 4.06,          // degrees
    "pitch": 64.00,        // degrees
    "yaw": 359.22          // degrees
  },
  ...
]
```

## Frontend (Next.js/Three.js/React)

### Key Files

- **[src/components/DroneViewer.tsx](frontend/src/components/DroneViewer.tsx)** - Main 3D viewer wrapper
  - Canvas setup with React Three Fiber

- **[src/components/DroneVisualizer.tsx](frontend/src/components/DroneVisualizer.tsx)** - Core 3D logic
  - `SimpleQuadcopter()` - 3D model (X-shaped frame + 4 rotors)
  - `DroneAnimator()` - Uses `useFrame()` hook for animation
  - `TrajectoryLine()` - Renders flight path

- **[src/lib/api.ts](frontend/src/lib/api.ts)** - API client
  - `fetchTrajectoryWithAttitude()` - Fetches drone trajectory

- **[src/store/useFlightStore.ts](frontend/src/store/useFlightStore.ts)** - State management
  - Stores `trajectoryWithAttitude` array

- **[src/components/UploadPanel.tsx](frontend/src/components/UploadPanel.tsx)** - File upload
  - Calls new endpoint after upload

- **[src/app/page.tsx](frontend/src/app/page.tsx)** - Main page
  - Toggle between Three.js (🚁) and Cesium (🌍) viewers

### Animation Logic

```typescript
useFrame((state, delta) => {
  // Update animation time
  timeRef.current += delta * speed;
  
  // Find trajectory point at current time
  // Linear interpolation between GPS samples
  
  // Apply position: position={[x, y, z]}
  droneRef.current.position.set(x, z, y);
  
  // Apply rotation (YXZ order):
  droneRef.current.rotation.order = 'YXZ';
  droneRef.current.rotation.y = yaw;
  droneRef.current.rotation.x = pitch;
  droneRef.current.rotation.z = roll;
});
```

## Usage

### Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm install --legacy-peer-deps
npm run dev
```

### Upload & Visualize

1. Open http://localhost:3000
2. Click "Choose log" and select a `.BIN` file
3. Click "Upload & analyze"
4. Click the 🚁 button to view in Three.js
5. Use mouse to rotate camera, scroll to zoom
6. Click Play/Pause to control animation
7. Adjust speed slider

## Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Log Parsing | `pymavlink` | Decode Ardupilot binary format |
| Coordinate Conversion | `pymap3d`, `pyproj` | WGS-84 → ENU |
| 3D Rendering | `Three.js` | WebGL graphics |
| React Integration | `@react-three/fiber` | Three.js + React hooks |
| Camera Control | `@react-three/drei` | OrbitControls |
| Networking | `Next.js` API Client | Fetch trajectory JSON |

## Data Structures

### Parsed Data (Internal)

```
GPS DataFrame:
  time_s, lat, lon, alt_m, spd_mps, vz_mps

ATT DataFrame:
  time_s, roll, pitch, yaw

IMU DataFrame:
  time_s, acc_x, acc_y, acc_z
```

### ENU Conversion

```
WGS-84 (lat, lon, alt) → ENU (x, y, z)
  x = East (meters)
  y = North (meters)
  z = Up (meters)
  
Origin = First valid GPS point
```

### 3D Visualization

```
Position: (enu_x, enu_z, enu_y)  ← Z-up coordinate system for Three.js
Rotation: (pitch, roll, yaw) in degrees → radians
```

## Testing

```bash
# Run full pipeline test
cd backend
PYTHONPATH=. python test_full_integration.py
```

Expected output:
```
✓ Testing with: 19cd22a4-6c29-45ff-9929-73e392f3a07a.BIN
✓ Parsed 118 GPS points, 3088 IMU points, 1543 ATT points
✓ Converted to ENU: 118 points
✓ Built trajectory with 118 attitude points
✅ Integration test PASSED!
```

## Future Enhancements

- [ ] Load `.glb` drone model from file instead of procedural geometry
- [ ] Render altitude reference grid
- [ ] Show speed/acceleration as color gradient along path
- [ ] Multi-log comparison (fly multiple drones simultaneously)
- [ ] Export animation as video
- [ ] Real-time telemetry websocket stream

---

**Stack**: Python + FastAPI + Next.js + Three.js + React  
**Data Format**: Ardupilot `.BIN` binary logs  
**Visualization**: 3D drone model with attitude interpolation  
**Deployment**: Docker Compose ready
