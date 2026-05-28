# File: scripts/probe_all_paths.py
import os
import subprocess
import json
from dotenv import load_dotenv

load_dotenv()

def probe_path(url, timeout=4):
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-rtsp_transport", "tcp",
        "-timeout", str(timeout * 1000000),
        url
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout + 2)
        if res.returncode != 0:
            return False, "Handshake/Authentication failed"
            
        data = json.loads(res.stdout)
        video_stream = None
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                video_stream = stream
                break
                
        if not video_stream:
            return False, "No video stream in profile"
            
        width = video_stream.get("width", 0)
        height = video_stream.get("height", 0)
        codec = video_stream.get("codec_name", "unknown")
        
        if width > 0 and height > 0:
            return True, f"VALID ({width}x{height}, Codec: {codec})"
        else:
            return True, f"CONNECTED BUT NO FRAMES (0x0, Codec: {codec})"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    ip = "192.168.1.8"
    user = os.getenv("CAMERA_USER", "admin")
    password = os.getenv("CAMERA_PASS", "admin@123")
    credentials = f"{user}:{password}@"
    
    paths = [
        # Dahua OEM formats
        "/cam/realmonitor?channel=1&subtype=0",
        "/cam/realmonitor?channel=1&subtype=1",
        
        # Generic ONVIF / IPC formats
        "/stream0",
        "/stream1",
        "/stream_main",
        "/stream_sub",
        
        # Hikvision OEM formats
        "/Streaming/Channels/101",
        "/Streaming/Channels/102",
        
        # Xiongmai (XM) OEM formats
        f"/user={user}&password={password}&channel=1&stream=0.sdp",
        f"/user={user}&password={password}&channel=1&stream=1.sdp",
        "/h264Preview_01_main",
        
        # Tuya / Generic OEM formats
        "/live/ch0",
        "/live/ch1",
        "/onvif1",
        "/onvif2",
        "/1",
        "/2",
        "/11",
        "/12",
        "/live"
    ]
    
    print(f"Scanning RTSP paths for: {ip}...")
    print("=" * 60)
    
    for path in paths:
        # Construct url
        if path.startswith("/user="):
            url = f"rtsp://{ip}:554{path}"
        else:
            url = f"rtsp://{credentials}{ip}:554{path}"
            
        # Mask credentials in output
        masked_url = url.replace(password, "******")
        print(f"Path: {path}")
        print("Probing... ", end="", flush=True)
        
        success, msg = probe_path(url)
        if success:
            print(f"\033[92m{msg}\033[0m")
            if "VALID" in msg:
                print(f"\n[FOUND] Working Path: {masked_url}")
                print("=" * 60)
                break
        else:
            print(f"\033[91mFAILED\033[0m ({msg})")
        print("-" * 60)
