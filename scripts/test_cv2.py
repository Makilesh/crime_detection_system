# File: scripts/test_cv2.py
import os
import cv2
import time
from dotenv import load_dotenv

# Load credentials
load_dotenv()

def test_capture(name, rtsp_url, transport=None):
    print(f"\n--- Testing: {name} ---")
    print(f"URL: {rtsp_url.replace(os.getenv('CAMERA_PASS', 'pwd'), '******')}")
    
    # Configure transport protocol
    if transport:
        print(f"Transport: {transport}")
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"rtsp_transport;{transport}|fflags;nobuffer|analyzeduration;5000000|probesize;5000000"
    else:
        print("Transport: Default (Automatic)")
        if "OPENCV_FFMPEG_CAPTURE_OPTIONS" in os.environ:
            del os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"]
            
    start_time = time.time()
    cap = cv2.VideoCapture(rtsp_url)
    
    if not cap.isOpened():
        print("[!] Failed to open video source.")
        return False
        
    print("[+] VideoCapture opened. Attempting to read a frame...")
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    
    # Try reading a frame with 10s timeout
    ret, frame = False, None
    for i in range(5):
        ret, frame = cap.read()
        if ret:
            break
        time.sleep(0.5)
        
    duration = time.time() - start_time
    
    if ret and frame is not None:
        h, w, c = frame.shape
        print(f"[SUCCESS] Read frame in {duration:.2f} seconds.")
        print(f"   Resolution: {w}x{h} ({c} channels)")
        
        # Save a test snapshot to verify it's actual image data
        snapshot_filename = f"test_snapshot_{name.lower().replace(' ', '_')}.jpg"
        cv2.imwrite(snapshot_filename, frame)
        print(f"   Saved diagnostic frame to: {snapshot_filename}")
        cap.release()
        return True
    else:
        print(f"[FAILED] to read frame. Timed out after {duration:.2f} seconds.")
        cap.release()
        return False

if __name__ == "__main__":
    ip = "192.168.1.8"
    user = os.getenv("CAMERA_USER", "admin")
    password = os.getenv("CAMERA_PASS", "admin@123")
    
    # URLs
    main_url = f"rtsp://{user}:{password}@{ip}:554/cam/realmonitor?channel=1&subtype=0"
    sub_url = f"rtsp://{user}:{password}@{ip}:554/cam/realmonitor?channel=1&subtype=1"
    generic_url = f"rtsp://{user}:{password}@{ip}:554/stream0"
    
    # Test matrix
    tests = [
        # Test 1: Main Stream + UDP (Many cameras only output raw RTP over UDP)
        ("Main Stream UDP", main_url, "udp"),
        
        # Test 2: Substream + UDP (H.264 or lower res HEVC, easier on network/decoders)
        ("Substream UDP", sub_url, "udp"),
        
        # Test 3: Main Stream + TCP
        ("Main Stream TCP", main_url, "tcp"),
        
        # Test 4: Substream + TCP
        ("Substream TCP", sub_url, "tcp"),
        
        # Test 5: Generic Stream 0 + UDP
        ("Generic Stream UDP", generic_url, "udp")
    ]
    
    success_count = 0
    for name, url, transport in tests:
        if test_capture(name, url, transport):
            success_count += 1
            print("Stopping diagnostics as we found a working stream option!")
            break
            
    if success_count == 0:
        print("\nAll tests failed. The camera is not sending stream data to local processes.")
        print("Please check the camera configuration web UI (http://192.168.1.8) to make sure RTSP streaming is fully enabled.")
