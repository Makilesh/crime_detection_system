# File: scripts/test_substream.py
import os
import cv2
import time
from dotenv import load_dotenv

load_dotenv()

ip = "192.168.1.8"
user = os.getenv("CAMERA_USER", "admin")
password = os.getenv("CAMERA_PASS", "admin@123")

# Target the lower-resolution H.264 Substream (subtype=1)
url = f"rtsp://{user}:{password}@{ip}:554/cam/realmonitor?channel=1&subtype=1"

print(f"Testing Substream connection to: {url.replace(password, '******')}", flush=True)

# 1. Test using TCP transport (standard)
print("\n--- [Test 1] Attempting Substream over TCP ---", flush=True)
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

start = time.time()
cap = cv2.VideoCapture(url)
if cap.isOpened():
    print("[+] VideoCapture opened successfully.", flush=True)
    ret, frame = cap.read()
    if ret and frame is not None:
        print(f"[SUCCESS] Read frame over TCP! Size: {frame.shape[1]}x{frame.shape[0]}", flush=True)
        cv2.imwrite("test_substream_tcp.jpg", frame)
    else:
        print("[-] Connected, but failed to read frame (timeout).", flush=True)
    cap.release()
else:
    print("[-] VideoCapture failed to open.", flush=True)
print(f"TCP Test Duration: {time.time() - start:.2f} seconds", flush=True)

# 2. Test using UDP transport
print("\n--- [Test 2] Attempting Substream over UDP ---", flush=True)
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;udp"

start = time.time()
cap = cv2.VideoCapture(url)
if cap.isOpened():
    print("[+] VideoCapture opened successfully.", flush=True)
    ret, frame = cap.read()
    if ret and frame is not None:
        print(f"[SUCCESS] Read frame over UDP! Size: {frame.shape[1]}x{frame.shape[0]}", flush=True)
        cv2.imwrite("test_substream_udp.jpg", frame)
    else:
        print("[-] Connected, but failed to read frame (timeout).", flush=True)
    cap.release()
else:
    print("[-] VideoCapture failed to open.", flush=True)
print(f"UDP Test Duration: {time.time() - start:.2f} seconds", flush=True)
