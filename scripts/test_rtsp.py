# File: scripts/test_rtsp.py
import json
import subprocess
import sys
import argparse

def get_candidates(ip, user, password):
    """
    Generate 5 high-probability candidate RTSP URLs for Trueview/Dahua OEM camera.
    """
    # URL encode password if it contains special characters
    from urllib.parse import quote
    safe_pass = quote(password) if password else ""
    credentials = f"{user}:{safe_pass}@" if user else ""
    
    return [
        # Candidate 1: Dahua OEM Standard Main Stream (Most likely)
        f"rtsp://{credentials}{ip}:554/cam/realmonitor?channel=1&subtype=0",
        
        # Candidate 2: Dahua OEM Standard Sub-Stream
        f"rtsp://{credentials}{ip}:554/cam/realmonitor?channel=1&subtype=1",
        
        # Candidate 3: Generic IPC/ONVIF Profile 1
        f"rtsp://{credentials}{ip}:554/stream0",
        
        # Candidate 4: Generic IPC/ONVIF Profile 2
        f"rtsp://{credentials}{ip}:554/stream1",
        
        # Candidate 5: Xiongmai (XM) OEM common SDP path
        f"rtsp://{ip}:554/user={user}&password={password}&channel=1&stream=0.sdp"
    ]

def probe_rtsp_url(url, timeout=5):
    """
    Executes ffprobe on an RTSP URL to retrieve stream metadata in JSON format.
    """
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-rtsp_transport", "tcp",  # Force TCP for stability
        "-stimeout", str(timeout * 1000000),  # microseconds timeout for connection
        url
    ]
    
    try:
        # Run ffprobe
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout + 2)
        
        if result.returncode != 0:
            return False, f"ffprobe failed with exit code {result.returncode}."
            
        data = json.loads(result.stdout)
        
        # Look for video stream
        video_stream = None
        for stream in data.get("streams", []):
            if stream.get("codec_type") == "video":
                video_stream = stream
                break
                
        if not video_stream:
            return False, "No video stream found in stream metadata."
            
        # Parse stream features
        codec = video_stream.get("codec_name", "unknown")
        width = video_stream.get("width", "unknown")
        height = video_stream.get("height", "unknown")
        
        # Parse FPS
        fps_raw = video_stream.get("avg_frame_rate", "0/0")
        if "/" in fps_raw:
            num, den = map(int, fps_raw.split("/"))
            fps = round(num / den, 2) if den > 0 else "unknown"
        else:
            fps = fps_raw
            
        return True, {
            "codec": codec,
            "resolution": f"{width}x{height}",
            "fps": fps
        }
        
    except subprocess.TimeoutExpired:
        return False, "Connection timed out."
    except json.JSONDecodeError:
        return False, "Failed to parse ffprobe output JSON."
    except FileNotFoundError:
        return False, "ffprobe executable not found. Please install ffmpeg and make sure it is in your PATH."
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test candidate RTSP URLs using ffprobe")
    parser.add_argument("--ip", default="192.168.1.8", help="Camera IP address")
    parser.add_argument("--user", default="admin", help="Camera username")
    parser.add_argument("--password", default="", help="Camera password")
    parser.add_argument("--timeout", type=int, default=5, help="Connection timeout in seconds")
    
    args = parser.parse_args()
    
    candidates = get_candidates(args.ip, args.user, args.password)
    
    print(f"Testing {len(candidates)} Candidate RTSP URLs for {args.ip}...")
    print("=" * 70)
    
    working_found = False
    for idx, url in enumerate(candidates, 1):
        # Mask password in console printout for security
        masked_url = url
        if args.password:
            masked_url = url.replace(f":{args.password}@", ":******@").replace(f"password={args.password}", "password=******")
            
        print(f"Candidate {idx}: {masked_url}")
        print("Probing... ", end="", flush=True)
        
        success, info = probe_rtsp_url(url, args.timeout)
        if success:
            print("\033[92mSUCCESS\033[0m")
            print(f"  Codec     : {info['codec']}")
            print(f"  Resolution: {info['resolution']}")
            print(f"  FPS       : {info['fps']}")
            print("=" * 70)
            working_found = True
            # Keep testing others to list all options, or break if only one is needed. 
            # We will list all working ones.
        else:
            print(f"\033[91mFAILED\033[0m (Reason: {info})")
            print("-" * 70)
            
    if not working_found:
        print("\nNo working RTSP URLs found. Please double-check:")
        print("1. Camera is powered on and connected to the network.")
        print("2. The IP address '192.168.1.8' is correct.")
        print("3. Credentials (user/password) are correct.")
        print("4. Port 554 is open (probe it using port scanner).")
