# Crime Detection System — Developer Guide & Setup

Welcome to the Crime Detection System integration guide. This README is tailored for your local testing and integration of the **Trueview camera (Device ID: 7660019715, Software: 4.9.76.4)** on IP `192.168.1.8`.

---

## 📂 Project Structure

```
crime_detection_system/
├── .env                     # Local credentials (ignored by Git)
├── mediamtx.yml             # MediaMTX relay configuration
├── requirements.txt         # Project package dependencies
├── api/
│   └── main.py              # FastAPI server (FastAPI + YOLO + Alerts)
├── core/
│   ├── detector.py          # YOLOv8 target threat classification engine
│   ├── intensity_scorer.py  # Severity scorer (low, medium, high)
│   └── ...
├── scripts/                 # Camera verification & integration scripts
│   ├── discover_onvif.py    # Probe ONVIF profiles and RTSP URLs
│   ├── test_rtsp.py         # Subprocess ffprobe validation script
│   └── probe_ports.sh       # Netcat and Nmap port probing script
└── ...
```

---

## 🔒 Environment Setup (`.env`)

A local `.env` file has been created at the root directory of the project. It stores your credentials securely and is excluded from GitHub commits by `.gitignore`.

```env
# TrueCloud App Cloud Login (For reference/cloud integrations)
CLOUD_USER=+919443045602
CLOUD_PASS=admin@123

# Local Camera RTSP/ONVIF Login (Required for local stream capture)
CAMERA_USER=admin
CAMERA_PASS=admin@123
```

---

## 🛠️ Verification & Camera Discovery Scripts

You can execute all python scripts using your project's local virtual environment (`.venv`).

### 1. Probe Active Ports (`scripts/probe_ports.sh`)
Checks connection to essential camera ports (RTSP `554`, Web `80`, ONVIF `8899`).
- **PowerShell / WSL / Git Bash:**
  ```bash
  ./scripts/probe_ports.sh
  ```
  *(Results are logged to `ports_probe.log`)*

### 2. Validate Candidate RTSP URLs (`scripts/test_rtsp.py`)
Sequentially probes 5 candidate RTSP URLs using `ffprobe` to determine which stream format is active.
- **Run with defaults (loads from `.env`):**
  ```powershell
  .venv\Scripts\python scripts\test_rtsp.py
  ```
- **Run with custom parameters:**
  ```powershell
  .venv\Scripts\python scripts\test_rtsp.py --ip 192.168.1.8 --user admin --password admin@123
  ```

### 3. Auto-Discover ONVIF profiles (`scripts/discover_onvif.py`)
Connects to ONVIF web services on ports 80, 8080, and 8899 to discover all active media profiles and stream paths.
- **Run with defaults (loads from `.env`):**
  ```powershell
  .venv\Scripts\python scripts\discover_onvif.py
  ```

---

## 📡 MediaMTX Stream Relay (`mediamtx.yml`)

If your FastAPI backend runs on a remote server (e.g. in the cloud) and doesn't have direct LAN access to the camera's local IP (`192.168.1.8`), you can run **MediaMTX** on a computer on the same LAN as the camera.

1. Download and run [MediaMTX](https://github.com/bluenviron/mediamtx).
2. Use the configuration defined in [mediamtx.yml](file:///d:/GEN%20AI/crime_detection_system/mediamtx.yml).
3. MediaMTX will relay the local stream to a publicly exposed endpoint, which your backend can then consume:
   `rtsp://YOUR_RELAY_SERVER:8554/trueview_cam`

---

## 🚀 Running the FastAPI Backend Server

To start the crime detection backend:

```powershell
.venv\Scripts\python -m api.main
```
*Note: Using the `-m` flag is required so python can correctly resolve imports between package subdirectories like `core` and `alerts`.*

### Ingesting Stream to API

Once the server is running on `http://localhost:8000`, start running YOLO inference and threat scoring by sending a POST request:

- **Endpoint:** `POST http://localhost:8000/streams/start`
- **Body (JSON):**
  ```json
  {
    "id": "entrance_camera",
    "rtsp_url": "rtsp://admin:admin@123@192.168.1.8:554/cam/realmonitor?channel=1&subtype=0",
    "location": "Main Entrance Gate",
    "latitude": 13.0827,
    "longitude": 80.2707
  }
  ```

To stop processing the stream:
- **Endpoint:** `POST http://localhost:8000/streams/stop/entrance_camera`
