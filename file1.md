# AI Surveillance System — Project Script & GitHub Copilot Prompt

---

## 1. Project Overview

**Project Name:** SmartWatch — AI-Powered CCTV Crime Detection & Alert System  
**Objective:** Build a real-time surveillance pipeline that ingests CCTV feeds, runs multi-threat detection using YOLO, classifies incident severity, and automatically dispatches alerts to the nearest police station.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Object Detection | YOLOv8 (Ultralytics) |
| Face Detection / Recognition | DeepFace + OpenCV |
| Number Plate OCR | EasyOCR / PaddleOCR |
| Violence / Pose Detection | YOLOv8-Pose or MediaPipe |
| Camera Tamper Detection | Frame differencing (OpenCV) |
| Backend API | FastAPI (Python) |
| Database | PostgreSQL + TimescaleDB (time-series incidents) |
| Alert System | Twilio (voice call) + SendGrid (email) |
| Frontend Dashboard | React + TailwindCSS |
| Real-time Feed | WebSocket (FastAPI + OpenCV) |
| Deployment | Docker Compose |

---

## 3. Project Structure

```
smartwatch/
├── core/
│   ├── detector.py          # YOLO multi-threat inference engine
│   ├── face_recognition.py  # DeepFace FR pipeline
│   ├── anpr.py              # Number plate OCR module
│   ├── tamper_detector.py   # Camera tamper via frame diff
│   └── intensity_scorer.py  # Crime intensity classification
├── api/
│   ├── main.py              # FastAPI app entry point
│   ├── routes/
│   │   ├── stream.py        # WebSocket CCTV stream endpoint
│   │   ├── incidents.py     # Incident CRUD endpoints
│   │   └── alerts.py        # Alert dispatch endpoints
│   └── models.py            # Pydantic schemas + DB models
├── alerts/
│   ├── email_alert.py       # SendGrid mail alert
│   └── voice_alert.py       # Twilio auto-call to police
├── dashboard/               # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LiveFeed.jsx
│   │   │   ├── Incidents.jsx
│   │   │   └── Analytics.jsx
│   │   └── components/
│   │       ├── IncidentCard.jsx
│   │       ├── AlertBadge.jsx
│   │       └── LiveMap.jsx
├── db/
│   └── schema.sql
├── docker-compose.yml
└── requirements.txt
```

---

## 4. Module-by-Module Breakdown

### 4.1 CCTV Ingestion
- Accept RTSP streams or local video files
- Use OpenCV `VideoCapture` to pull frames at configurable FPS (default: 5 fps for inference)
- Buffer frames in a thread-safe queue

### 4.2 YOLO Detection Engine (`core/detector.py`)
- Load YOLOv8 model (pretrained + fine-tuned on surveillance dataset)
- Run multi-class detection per frame:
  - `intrusion` — person detected inside restricted polygon zone
  - `object` — weapon / suspicious object class
  - `violent_behavior` — pose-based aggression detection
  - `loitering` — person dwell time > configurable threshold (e.g. 30s)
  - `camera_tamper` — scene change beyond threshold %
  - `face` — face bounding box → pass to FR pipeline
  - `number_plate` — plate bounding box → pass to ANPR
- Return detection payload: `{type, confidence, bbox, timestamp, camera_id}`

### 4.3 Confidence Gate
- Per detection type, apply configurable confidence thresholds
- Below threshold → log raw frame metadata only, discard alert
- Above threshold → proceed to incident record creation

### 4.4 Incident Record (`db/schema.sql`)
```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude FLOAT,
  longitude FLOAT,
  incident_type TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  intensity TEXT CHECK (intensity IN ('low', 'medium', 'high')),
  confidence FLOAT,
  snapshot_path TEXT,
  alert_sent BOOLEAN DEFAULT FALSE
);
```

### 4.5 Intensity Scorer (`core/intensity_scorer.py`)
- **Low**: loitering, intrusion (no weapon), low-confidence face match
- **Medium**: object detection (weapon class), unknown face in restricted zone
- **High**: violent behavior, camera tamper, wanted face match, multiple simultaneous detections
- Score can be a weighted function: `intensity = w1*type_score + w2*confidence + w3*recurrence_count`

### 4.6 Alert Dispatcher (`alerts/`)
- **Low/Medium** → `email_alert.py` via SendGrid: sends incident snapshot, type, location, time, intensity to configured officer email
- **High** → `voice_alert.py` via Twilio: auto-calls nearest police station with TwiML voice message: *"Alert: [incident type] detected at [location] at [time]. Severity: High. Report sent to your dashboard."*
- Both alerts include a link to the incident dashboard record

### 4.7 Police Station Lookup
- Maintain a `police_stations` table with lat/lon
- On high-severity incident, use Haversine formula to find nearest station
- Trigger call to that station's registered number

### 4.8 Dashboard (React)
- **Live Feed page**: WebSocket stream with real-time bounding box overlays
- **Incidents page**: filterable table (type, time, intensity, location)
- **Analytics page**: charts for incident frequency by type, camera, time-of-day
- **Map view**: pin incidents on map with severity color coding

---

## 5. Data Flow Summary

```
CCTV → Frame Queue → YOLO Engine
                         ↓
              [Multi-class detection results]
                         ↓
              Confidence Gate (per-class thresholds)
               ↙ False              ↘ True
           Log only          Incident Record Created
                                     ↓
                            Intensity Scorer
                           ↙          ↓         ↘
                        Low        Medium        High
                         ↓           ↓            ↓
                     Mail alert  Mail alert   Mail + Voice
                                              + Nearest PD
```

---

## 6. Key Configuration (`.env`)

```env
YOLO_MODEL_PATH=models/smartwatch_v8.pt
CONFIDENCE_THRESHOLDS={"intrusion":0.6,"violence":0.7,"face":0.75,"loitering":0.65,"tamper":0.8,"anpr":0.7}
LOITERING_DWELL_SECONDS=30
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
DATABASE_URL=postgresql://...
STREAM_FPS=5
```

---

    ## 7. GitHub Copilot Prompt

    > Copy the entire block below and paste it as a chat message in GitHub Copilot (Claude Sonnet / GPT-5.2 mode).

    ---

    ```
    You are a senior AI/ML engineer and full-stack architect.

    Build a production-ready Python + React codebase for an AI surveillance system called "SmartWatch".

    ## System Description
    SmartWatch ingests live CCTV feeds, runs YOLOv8-based multi-threat detection in real-time, classifies incident severity, stores structured incident records, and automatically dispatches email or voice alerts to the nearest police station.

## What to build

### 1. core/detector.py
- Use Ultralytics YOLOv8 (`from ultralytics import YOLO`)
- Accept a video frame (numpy array) as input
- Detect the following threat classes simultaneously:
  - intrusion (person in a defined restricted polygon zone)
  - violent_behavior (pose-based: arms raised + proximity to another person)
  - face (pass bounding box to face recognition pipeline)
  - loitering (person dwell time > 30s in same zone)
  - camera_tamper (frame-to-frame structural similarity drop below 0.4)
  - number_plate (bounding box for ANPR OCR)
  - object (weapon/suspicious item class)
- Return a list of DetectionResult objects:
  `{type: str, confidence: float, bbox: [x1,y1,x2,y2], timestamp: datetime, camera_id: str}`
- Apply per-class confidence thresholds from config

### 2. core/intensity_scorer.py
- Input: list of DetectionResult objects for a single frame
- Output: intensity string — "low", "medium", or "high"
- Scoring logic:
  - High: violent_behavior OR camera_tamper OR (face + wanted_match=True) OR 3+ simultaneous detections
  - Medium: object detection OR unknown face in restricted zone
  - Low: intrusion (no weapon) OR loitering
- Return intensity and a human-readable reason string

### 3. api/routes/stream.py (FastAPI WebSocket)
- Accept RTSP URL or video file path as query param
- Open OpenCV VideoCapture, pull frames at 5 FPS
- Run detector on each frame
- Apply intensity scorer
- If detection above threshold: write incident to PostgreSQL and trigger alert dispatcher
- Stream annotated frame (JPEG bytes) and latest detection JSON over WebSocket

### 4. api/routes/incidents.py (FastAPI REST)
- GET /incidents — paginated, filterable by type/intensity/camera_id/date_range
- GET /incidents/{id} — single incident with snapshot URL
- PATCH /incidents/{id} — mark as reviewed
- Use SQLAlchemy async with PostgreSQL

### 5. alerts/email_alert.py
- Use SendGrid Python SDK
- Build HTML email with: incident type, location, timestamp, intensity badge, snapshot image (base64 inline), link to dashboard
- Send to configured officer email list

### 6. alerts/voice_alert.py
- Use Twilio Python SDK
- Given a police station phone number, make an outbound call
- TwiML: "Alert: [incident_type] detected at [location] at [time]. Severity: High. A full report has been sent to your dashboard."
- Include a callback URL for acknowledgment

### 7. core/police_station_locator.py
- Accept incident lat/lon
- Query police_stations table
- Use Haversine formula to find nearest station
- Return {name, phone, distance_km}

### 8. dashboard/src/pages/LiveFeed.jsx (React)
- Connect to WebSocket stream endpoint
- Display video frames using canvas
- Overlay bounding boxes from detection JSON (different colors per threat type)
- Show live incident ticker in sidebar
- Use TailwindCSS for layout

### 9. docker-compose.yml
- Services: api (FastAPI), db (PostgreSQL 15 + TimescaleDB), dashboard (React/Nginx), redis (for frame queue)
- Volume mounts for model files and snapshots
- Health checks for all services

### 10. db/schema.sql
- incidents table (id, camera_id, location, lat, lon, incident_type, detected_at, intensity, confidence, snapshot_path, alert_sent, reviewed)
- police_stations table (id, name, phone, lat, lon, jurisdiction)
- cameras table (id, name, rtsp_url, zone_polygon JSONB, location, active)

## Coding standards
- Python: type hints everywhere, async/await for I/O, Pydantic v2 for schemas
- Error handling: never swallow exceptions silently; log with structlog
- All config via environment variables (use python-dotenv)
- React: functional components, custom hooks for WebSocket and data fetching
- Write docstrings for all public functions
- Include a README.md with setup instructions

## Output format
Generate each file completely. Start each file with a comment block: `# File: path/to/file.py`. Do not truncate any file. After all files, list all pip dependencies for requirements.txt and npm dependencies for package.json.
```

---

## 8. Recommended Fine-Tuning Datasets

- **Violence detection**: RWF-2000, Hockey Fight dataset
- **Weapon detection**: Open Images V7 (weapon subset), COCO weapon annotations
- **Loitering / pose**: PoseTrack21, MOT17
- **Number plates (India)**: IDD-Detection, ANPR India dataset

---

## 9. Milestones

| Week | Deliverable |
|---|---|
| 1 | YOLO model setup, frame ingestion, basic detection pipeline |
| 2 | Face recognition + ANPR integration |
| 3 | Incident DB schema, intensity scorer, confidence gate |
| 4 | Alert system (email + voice), police station locator |
| 5 | FastAPI backend + WebSocket stream |
| 6 | React dashboard (live feed + incidents table) |
| 7 | Docker Compose, end-to-end integration testing |
| 8 | Model fine-tuning on surveillance datasets + hardening |