import os
import cv2
import threading
import time
import logging
from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime

# Local modules
from core.detector import CrimeDetectionDetector, YOLO_AVAILABLE
from core.intensity_scorer import score_incident
from core.police_station_locator import find_nearest_station
from alerts.email_alert import send_email_alert
from alerts.voice_alert import make_voice_call

# Load environment variables
load_dotenv()

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CrimeDetectionAPI")

app = FastAPI(title="Crime Detection Surveillance Core API", version="1.0.0")

# CORS middleware for local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase Admin SDK
firebase_initialized = False
db = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Path to service account key (can be set in .env)
    cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
    
    if os.path.exists(cred_path):
        logger.info(f"Initializing Firebase Admin with service account: {cred_path}")
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
    else:
        # Try default credentials
        logger.info("Service account JSON not found. Attempting Application Default Credentials...")
        firebase_admin.initialize_app()
        firebase_initialized = True
        
    if firebase_initialized:
        db = firestore.client()
        logger.info("Firebase Firestore connected successfully.")
except Exception as e:
    logger.warning(f"Could not initialize Firebase Admin SDK: {str(e)}.")
    logger.warning("Incidents will be printed to stdout and saved in mock local list instead of Cloud Firestore.")

# Global state for actively running camera streams
running_streams = {}  # camera_id -> thread active state
latest_frames = {}    # camera_id -> raw jpeg bytes
detector = CrimeDetectionDetector()

class CameraConfig(BaseModel):
    id: str
    rtsp_url: str
    location: str
    latitude: float
    longitude: float

def process_camera_stream_loop(camera_id: str, source: str, location: str, lat: float, lng: float):
    """
    Background worker thread to ingest stream frames, run YOLO, score threat intensity, 
    write incident to Firestore, and trigger alerts.
    """
    logger.info(f"Starting ingestion worker thread for camera {camera_id} (Source: {source})")
    # Optimize FFMPEG capture options for RTSP streams
    # TCP transport ensures packet integrity and reduces packet drop issues
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"
    # If the source is a camera index (e.g. "0" for webcam), convert it to integer
    source_val = int(source) if source.isdigit() else source
    cap = cv2.VideoCapture(source_val)
    
    if not cap.isOpened():
        logger.error(f"Cannot open video/RTSP source: {source}")
        running_streams[camera_id] = False
        return

    fps = int(os.getenv("STREAM_FPS", "5"))
    frame_interval = 1.0 / fps
    
    # Configure a default guard polygon for intrusion checks (represented as fractions of 640x360 frame)
    detector.set_restricted_zone([
        (100, 80), (300, 80), (350, 250), (80, 250)
    ])

    current_detections = []
    last_processed_time = time.time()

    while running_streams.get(camera_id, False):
        current_time = time.time()
        elapsed = current_time - last_processed_time
        
        # Pull frames continuously to prevent buffer delay, but process at configured FPS
        ret, frame = cap.read()
        if not ret:
            logger.warning(f"Stream disconnect or end-of-file on {camera_id}. Reconnecting...")
            cap.release()
            time.sleep(2)
            cap = cv2.VideoCapture(source_val)
            continue
            
        # Resize for consistent model input dimensions
        frame_resized = cv2.resize(frame, (640, 360))

        if elapsed >= frame_interval:
            last_processed_time = current_time
            
            # Run YOLO detector
            current_detections = detector.process_frame(frame_resized, camera_id)
            
            if current_detections:
                # Score threat intensity
                detection_dicts = [d.to_dict() for d in current_detections]
                intensity, reason = score_incident(detection_dicts)
                
                # Check confidence threshold gate
                max_conf = max(d.confidence for d in current_detections)
                
                # Find nearest police station
                nearest_station = find_nearest_station(lat, lng)
                
                # Create Incident payload
                incident_payload = {
                    "camera_id": camera_id,
                    "location": location,
                    "latitude": lat,
                    "longitude": lng,
                    "incident_type": current_detections[0].type,
                    "detected_at": firestore.SERVER_TIMESTAMP if db else datetime.now().isoformat(),
                    "intensity": intensity,
                    "confidence": max_conf,
                    "reviewed": False,
                    "details": reason,
                    "police_station": nearest_station["name"] if nearest_station else "City Core dispatch"
                }
                
                # Save to Firebase Firestore
                if db:
                    try:
                        db.collection("incidents").add(incident_payload)
                        logger.info(f"Incident {current_detections[0].type} written to Cloud Firestore!")
                    except Exception as e:
                        logger.error(f"Failed to write to Firestore: {str(e)}")
                else:
                    logger.info(f"MOCK LOG (No DB): {incident_payload}")
                    
                # Dispatch Alerts
                # Low/Medium -> Send email
                if intensity in ["low", "medium"]:
                    send_email_alert(
                        incident_type=current_detections[0].type,
                        location=location,
                        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        intensity=intensity,
                        details=reason
                    )
                # High -> Send email + Twilio call
                elif intensity == "high":
                    # Send email
                    send_email_alert(
                        incident_type=current_detections[0].type,
                        location=location,
                        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        intensity=intensity,
                        details=reason
                    )
                    # Twilio phone call to nearest police station
                    station_phone = nearest_station["phone"] if nearest_station else "+15550199"
                    make_voice_call(
                        police_phone=station_phone,
                        incident_type=current_detections[0].type,
                        location=location,
                        timestamp=datetime.now().strftime("%I:%M %p")
                    )

        # Annotate and save frame for live streaming
        annotated_frame = frame_resized.copy()
        for det in current_detections:
            x1, y1, x2, y2 = det.bbox
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"{det.type} ({det.confidence:.2f})", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
        
        _, jpeg_bytes = cv2.imencode('.jpg', annotated_frame)
        latest_frames[camera_id] = jpeg_bytes.tobytes()

        # Sleep briefly to reduce CPU utilization
        time.sleep(0.01)


    cap.release()
    logger.info(f"Stream thread {camera_id} stopped.")

@app.post("/streams/start")
def start_camera_stream(config: CameraConfig, background_tasks: BackgroundTasks):
    """
    Start processing a live RTSP stream or local video file in a background worker thread.
    """
    if config.id in running_streams and running_streams[config.id]:
        return {"status": "already_running", "camera_id": config.id}

    running_streams[config.id] = True
    
    # Run the worker thread
    thread = threading.Thread(
        target=process_camera_stream_loop,
        args=(config.id, config.rtsp_url, config.location, config.latitude, config.longitude),
        daemon=True
    )
    thread.start()
    
    return {"status": "started", "camera_id": config.id}

@app.post("/streams/stop/{camera_id}")
def stop_camera_stream(camera_id: str):
    """
    Stop processing stream for a camera ID.
    """
    if camera_id in running_streams:
        running_streams[camera_id] = False
        return {"status": "stopping", "camera_id": camera_id}
    return {"status": "not_found", "camera_id": camera_id}

@app.get("/streams/status")
def get_streams_status():
    """
    Get active stream processing status.
    """
    return {"active_streams": {cid: active for cid, active in running_streams.items()}}

def gen_frames(camera_id: str):
    while True:
        frame_bytes = latest_frames.get(camera_id)
        if frame_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.08)  # Limit output frame rate (~12 FPS) to optimize network bandwidth

@app.get("/streams/video/{camera_id}")
def get_video_stream(camera_id: str):
    """
    Get the live annotated MJPEG stream from the processed video capture.
    """
    return StreamingResponse(gen_frames(camera_id), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "firebase_connected": firebase_initialized,
        "yolo_loaded": YOLO_AVAILABLE and detector.model is not None
    }

if __name__ == "__main__":
    import uvicorn
    # Bind to standard port for FastAPI
    uvicorn.run(app, host="0.0.0.0", port=8000)
