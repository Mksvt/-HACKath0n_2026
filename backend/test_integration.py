#!/usr/bin/env python3
"""
Integration test: upload a BIN file and fetch the trajectory with attitude
"""
import os
import requests
import json
from pathlib import Path

API_BASE = os.getenv("API_BASE", "http://localhost:8000/api/v1")


def find_bin_file() -> Path | None:
    candidates = [
        Path(__file__).resolve().parent / "data" / "uploads",
        Path("./data/uploads"),
        Path("./backend/data/uploads"),
    ]
    for directory in candidates:
        if not directory.exists():
            continue
        files = sorted(directory.glob("*.BIN"))
        if files:
            return files[0]
    return None


BIN_FILE = find_bin_file()

if BIN_FILE is None:
    print("No .BIN file found in known upload directories")
    exit(1)

print("📤 Uploading file...")
with open(BIN_FILE, "rb") as f:
    files = {"file": f}
    response = requests.post(f"{API_BASE}/flights/upload", files=files)
    if response.status_code != 200:
        print(f"Upload failed: {response.text}")
        exit(1)
    upload_data = response.json()
    flight_id = upload_data["flight_id"]
    print(f"✓ Uploaded as flight_id: {flight_id}")

print("📊 Fetching trajectory with attitude...")
response = requests.get(f"{API_BASE}/flights/{flight_id}/trajectory/with-attitude")
if response.status_code != 200:
    print(f"Failed: {response.text}")
    exit(1)

trajectory = response.json()
print(f"✓ Got {len(trajectory)} points")
print("\n📍 First 3 points:")
for i, point in enumerate(trajectory[:3]):
    print(f"  {i}: time={point['time']:.2f}s, pos=({point['x']:.2f}, {point['y']:.2f}, {point['z']:.2f}), rot=(r={point['roll']:.1f}°, p={point['pitch']:.1f}°, y={point['yaw']:.1f}°)")

print("\n✨ Success! The trajectory with attitude is ready for Three.js 3D visualization.")
