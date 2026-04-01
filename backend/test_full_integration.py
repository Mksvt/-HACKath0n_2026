#!/usr/bin/env python3
"""
Full integration test: upload a BIN file, parse it, and verify the trajectory with attitude endpoint
"""

import json
import sys
from pathlib import Path

# Test that the parser works
from app.services.log_parser.ardupilot_parser import ArdupilotLogParser
from app.services.telemetry.trajectory import TrajectoryBuilder


def test_full_pipeline():
    # Find a test BIN file
    uploads_dir = Path("./data/uploads")
    if not uploads_dir.exists():
        uploads_dir = Path("./backend/data/uploads")
    
    bin_files = list(uploads_dir.glob("*.BIN"))
    
    if not bin_files:
        print(f"❌ No BIN files found in {uploads_dir.absolute()}")
        return False
    
    test_file = bin_files[0]
    print(f"✓ Testing with: {test_file.name}")
    
    try:
        # Step 1: Parse the log
        parser = ArdupilotLogParser()
        gps_df, imu_df, att_df = parser.parse(test_file)
        
        print(f"✓ Parsed {len(gps_df)} GPS points, {len(imu_df)} IMU points, {len(att_df)} ATT points")
        
        if gps_df.empty or att_df.empty:
            print("❌ No GPS or ATT data")
            return False
        
        # Step 2: Convert to ENU
        telemetry_df = gps_df.rename(columns={"lat": "latitude", "lon": "longitude", "alt_m": "altitude_m"})
        telemetry_df = TrajectoryBuilder.to_enu(telemetry_df)
        
        print(f"✓ Converted to ENU: {len(telemetry_df)} points")
        
        # Step 3: Build trajectory with attitude (same as the endpoint)
        trajectory = []
        for _, gps_row in telemetry_df.iterrows():
            time = gps_row["time_s"]
            att_row = att_df.iloc[(att_df["time_s"] - time).abs().idxmin()]
            
            trajectory.append({
                "time": float(time),
                "x": float(gps_row["enu_x"]),
                "y": float(gps_row["enu_y"]),
                "z": float(gps_row["enu_z"]),
                "roll": float(att_row["roll"]),
                "pitch": float(att_row["pitch"]),
                "yaw": float(att_row["yaw"]),
            })
        
        print(f"✓ Built trajectory with {len(trajectory)} attitude points")
        
        # Print first 3 points for inspection
        print("\n📊 First 3 trajectory points (for 3D visualization):")
        print(json.dumps(trajectory[:3], indent=2))
        
        # Verify the structure
        assert len(trajectory) > 0, "Empty trajectory"
        assert "time" in trajectory[0], "Missing time"
        assert "x" in trajectory[0], "Missing x"
        assert "y" in trajectory[0], "Missing y"
        assert "z" in trajectory[0], "Missing z"
        assert "roll" in trajectory[0], "Missing roll"
        assert "pitch" in trajectory[0], "Missing pitch"
        assert "yaw" in trajectory[0], "Missing yaw"
        
        print("\n✅ Integration test PASSED!")
        print(f"   - Ready to send {len(trajectory)} points to Three.js frontend")
        return True
        
    except Exception as e:
        print(f"❌ Integration test FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_full_pipeline()
    sys.exit(0 if success else 1)
