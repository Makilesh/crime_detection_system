# File: scripts/discover_onvif.py
import os
import sys
import argparse

try:
    import onvif
    from onvif import ONVIFCamera
except ImportError:
    print("Error: 'onvif-zeep' is not installed. Please run: pip install onvif-zeep")
    sys.exit(1)

def discover_camera(ip, port, user, password):
    print(f"Connecting to ONVIF camera at {ip}:{port}...")
    
    # Locate the WSDL directory bundled with onvif-zeep to ensure soap calls succeed
    onvif_path = os.path.dirname(onvif.__file__)
    wsdl_dir = os.path.join(onvif_path, 'wsdl')
    
    if not os.path.exists(wsdl_dir):
        # Fallback to default search paths in package
        wsdl_dir = None
        print("Warning: Bundled WSDL directory not found. Attempting connection with default lookup...")

    try:
        if wsdl_dir:
            cam = ONVIFCamera(ip, port, user, password, wsdl_dir=wsdl_dir)
        else:
            cam = ONVIFCamera(ip, port, user, password)
            
        print(f"Successfully connected to ONVIF service on port {port}!")
        
        # Fetch device information
        dev_info = cam.devicemgr.GetDeviceInformation()
        print(f"Manufacturer: {dev_info.Manufacturer}")
        print(f"Model: {dev_info.Model}")
        print(f"Firmware Version: {dev_info.FirmwareVersion}")
        print(f"Serial Number: {dev_info.SerialNumber}")
        
        # Create media service
        media = cam.create_media_service()
        
        # Get profiles
        profiles = media.GetProfiles()
        print(f"\nFound {len(profiles)} media profile(s):")
        
        for idx, profile in enumerate(profiles):
            token = profile.token
            name = profile.Name
            print(f"\nProfile {idx+1}: {name} (Token: {token})")
            
            # Fetch Stream URI
            try:
                stream_setup = {
                    'StreamSetup': {
                        'Stream': 'RTP-Unicast',
                        'Transport': {
                            'Protocol': 'RTSP'
                        }
                    },
                    'ProfileToken': token
                }
                stream_uri = media.GetStreamUri(stream_setup)
                print(f"  RTSP Stream URI: {stream_uri.Uri}")
            except Exception as e:
                print(f"  Failed to retrieve RTSP Stream URI: {str(e)}")
                
    except Exception as e:
        print(f"Failed to connect to ONVIF at {ip}:{port} - Error: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ONVIF Auto-Discovery Script for Trueview/Dahua Camera")
    parser.add_argument("--ip", default="192.168.1.8", help="IP address of the camera (default: 192.168.1.8)")
    parser.add_argument("--user", default="admin", help="ONVIF username (default: admin)")
    parser.add_argument("--password", default="", help="ONVIF password (default: empty)")
    parser.add_argument("--ports", default="80,8899,8080", help="Comma-separated ONVIF ports to probe (default: 80,8899,8080)")
    
    args = parser.parse_args()
    
    port_list = [int(p.strip()) for p in args.ports.split(",") if p.strip().isdigit()]
    
    print(f"Target Camera: {args.ip}")
    print(f"Probing Ports: {port_list}")
    print("=" * 60)
    
    for port in port_list:
        discover_camera(args.ip, port, args.user, args.password)
        print("=" * 60)
