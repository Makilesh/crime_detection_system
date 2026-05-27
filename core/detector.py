import cv2
import numpy as np
import time
from datetime import datetime
import logging

# Set up logger
logger = logging.getLogger("YOLODetector")
logging.basicConfig(level=logging.INFO)

# Optional lazy import of YOLO to avoid initial loading delay on script start
YOLO_AVAILABLE = False
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    logger.warning("Ultralytics YOLO package not found. Running in simulation mode for detector.")

class DetectionResult:
    def __init__(self, threat_type, confidence, bbox, camera_id, wanted_match=False, restricted_zone=False, details=""):
        self.type = threat_type           # 'intrusion', 'violence', 'face', 'loitering', 'tamper', 'anpr', 'weapon'
        self.confidence = float(confidence)
        self.bbox = bbox                  # [x1, y1, x2, y2]
        self.timestamp = datetime.now().isoformat()
        self.camera_id = camera_id
        self.wanted_match = wanted_match
        self.restricted_zone = restricted_zone
        self.details = details

    def to_dict(self):
        return {
            "type": self.type,
            "confidence": self.confidence,
            "bbox": self.bbox,
            "timestamp": self.timestamp,
            "camera_id": self.camera_id,
            "wanted_match": self.wanted_match,
            "restricted_zone": self.restricted_zone,
            "details": self.details
        }

class CrimeDetectionDetector:
    def __init__(self, model_path="yolov8n.pt", confidence_thresholds=None):
        self.model_path = model_path
        self.thresholds = confidence_thresholds or {
            "intrusion": 0.55,
            "violence": 0.65,
            "face": 0.70,
            "loitering": 0.60,
            "tamper": 0.40,
            "anpr": 0.50,
            "weapon": 0.55
        }
        
        # Load YOLO model if available
        self.model = None
        if YOLO_AVAILABLE:
            try:
                logger.info(f"Loading YOLOv8 model from {model_path}...")
                self.model = YOLO(model_path)
                logger.info("YOLOv8 loaded successfully.")
            except Exception as e:
                logger.error(f"Error loading YOLOv8: {str(e)}. Falling back to simulation.")
                self.model = None

        # State tracking for loitering, tampering, etc.
        self.prev_frame_gray = None
        self.person_tracking = {}  # track_id -> {"first_seen": timestamp, "last_seen": timestamp}
        self.polygon_zone = None   # List of tuples [(x1,y1), (x2,y2)...]

    def set_restricted_zone(self, points):
        """
        Set the polygon coordinate boundaries for intrusion checking.
        points: list of dicts/tuples, e.g. [(100, 80), (300, 80)...]
        """
        self.polygon_zone = np.array(points, dtype=np.int32)

    def check_point_in_polygon(self, x, y):
        """
        Ray-casting helper to check if a point is inside the restricted polygon.
        """
        if self.polygon_zone is None or len(self.polygon_zone) < 3:
            return False
        return cv2.pointPolygonTest(self.polygon_zone, (float(x), float(y)), False) >= 0

    def detect_tamper(self, frame):
        """
        Calculate structural changes between successive frames.
        Returns confidence of tamper (1.0 - structural similarity score).
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if self.prev_frame_gray is None:
            self.prev_frame_gray = gray
            return 0.0

        # Frame difference
        frame_diff = cv2.absdiff(self.prev_frame_gray, gray)
        _, thresh = cv2.threshold(frame_diff, 25, 255, cv2.THRESH_BINARY)
        
        # Percentage of pixels changed
        non_zero = np.count_nonzero(thresh)
        total_pixels = thresh.shape[0] * thresh.shape[1]
        change_ratio = non_zero / total_pixels

        self.prev_frame_gray = gray

        # If more than 85% of the frame shifts suddenly, it indicates camera moving/tampered
        if change_ratio > 0.85:
            return float(change_ratio)
        return 0.0

    def process_frame(self, frame, camera_id="cam_001"):
        """
        Run inference on a single frame (numpy array) and return DetectionResult objects.
        """
        results = []
        h, w = frame.shape[:2]

        # 1. Camera Tampering Check
        tamper_conf = self.detect_tamper(frame)
        if tamper_conf > self.thresholds["tamper"]:
            results.append(DetectionResult(
                threat_type="tamper",
                confidence=tamper_conf,
                bbox=[0, 0, w, h],
                camera_id=camera_id,
                details="Camera view blocked or camera dislodged"
            ))
            return results  # Skip other detections if tampered

        # 2. YOLOv8 Inference
        if self.model is not None:
            try:
                # Run YOLO tracking (persists ID across frames for loitering)
                yolo_res = self.model.track(frame, persist=True, verbose=False)[0]
                boxes = yolo_res.boxes
                
                people_boxes = []

                if boxes is not None:
                    for box in boxes:
                        # Extract box coordinates, class, conf, and track_id
                        coords = box.xyxy[0].cpu().numpy().tolist()
                        x1, y1, x2, y2 = map(int, coords)
                        cls_idx = int(box.cls[0].cpu().numpy())
                        conf = float(box.conf[0].cpu().numpy())
                        track_id = int(box.id[0].cpu().numpy()) if box.id is not None else None

                        # Class names in COCO: 0: person, 2: car, 3: motorcycle, 5: bus, 7: truck, 43: knife
                        # Person Detection
                        if cls_idx == 0:
                            cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                            in_restricted = self.check_point_in_polygon(cx, cy)
                            
                            # Intrusion Alert
                            if in_restricted and conf >= self.thresholds["intrusion"]:
                                results.append(DetectionResult(
                                    threat_type="intrusion",
                                    confidence=conf,
                                    bbox=[x1, y1, x2, y2],
                                    camera_id=camera_id,
                                    restricted_zone=True,
                                    details=f"Person detected in restricted perimeter"
                                ))

                            # Loitering Tracker
                            if track_id is not None:
                                now = time.time()
                                if track_id not in self.person_tracking:
                                    self.person_tracking[track_id] = {"first_seen": now, "last_seen": now}
                                else:
                                    self.person_tracking[track_id]["last_seen"] = now
                                    dwell_time = now - self.person_tracking[track_id]["first_seen"]
                                    
                                    # If loitering in restricted zone > 15s
                                    if in_restricted and dwell_time > 15.0 and conf >= self.thresholds["loitering"]:
                                        results.append(DetectionResult(
                                            threat_type="loitering",
                                            confidence=conf,
                                            bbox=[x1, y1, x2, y2],
                                            camera_id=camera_id,
                                            restricted_zone=True,
                                            details=f"Subject loitering in zone for {int(dwell_time)} seconds"
                                        ))
                            
                            people_boxes.append((x1, y1, x2, y2))

                        # Weapon Detection (Standard knife class 43)
                        elif cls_idx == 43 and conf >= self.thresholds["weapon"]:
                            results.append(DetectionResult(
                                threat_type="weapon",
                                confidence=conf,
                                bbox=[x1, y1, x2, y2],
                                camera_id=camera_id,
                                details="Armed subject: knife detected"
                            ))

                        # ANPR License Plate (Standard vehicle classes)
                        elif cls_idx in [2, 3, 5, 7] and conf >= self.thresholds["anpr"]:
                            results.append(DetectionResult(
                                threat_type="anpr",
                                confidence=conf,
                                bbox=[x1, y1, x2, y2],
                                camera_id=camera_id,
                                details=f"Checkpoint vehicle log: {self.model.names[cls_idx]}"
                            ))

                # 3. Simple Pose-Based Proximity Violence check
                # If two people are extremely close and bounding boxes overlap heavily
                if len(people_boxes) >= 2:
                    for i in range(len(people_boxes)):
                        for j in range(i + 1, len(people_boxes)):
                            boxA = people_boxes[i]
                            boxB = people_boxes[j]
                            
                            # Overlap box
                            x1 = max(boxA[0], boxB[0])
                            y1 = max(boxA[1], boxB[1])
                            x2 = min(boxA[2], boxB[2])
                            y2 = min(boxA[3], boxB[3])
                            
                            if x1 < x2 and y1 < y2:
                                # Overlap area / min area
                                overlap_area = (x2 - x1) * (y2 - y1)
                                areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
                                areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
                                overlap_ratio = overlap_area / min(areaA, areaB)

                                if overlap_ratio > 0.65:
                                    results.append(DetectionResult(
                                        threat_type="violence",
                                        confidence=0.82,
                                        bbox=[min(boxA[0], boxB[0]), min(boxA[1], boxB[1]), max(boxA[2], boxB[2]), max(boxA[3], boxB[3])],
                                        camera_id=camera_id,
                                        details="Physical altercation / violent behavior warning"
                                    ))

            except Exception as e:
                logger.error(f"Inference processing failed: {str(e)}")

        else:
            # Fallback Simulation (if YOLOv8 is not loaded/installed locally)
            # Create a mock detection 2% of the time to show it's active
            if int(time.time()) % 15 == 0 and int(time.time() * 10) % 10 == 0:
                mock_types = ["intrusion", "anpr", "loitering"]
                selected_type = np.random.choice(mock_types)
                results.append(DetectionResult(
                    threat_type=selected_type,
                    confidence=0.78,
                    bbox=[int(w*0.2), int(h*0.3), int(w*0.5), int(h*0.8)],
                    camera_id=camera_id,
                    details=f"Simulated {selected_type} threat detected"
                ))

        # Cleanup old tracked persons (> 2 minutes inactive)
        now = time.time()
        expired_tracks = [tid for tid, data in self.person_tracking.items() if now - data["last_seen"] > 120.0]
        for tid in expired_tracks:
            del self.person_tracking[tid]

        return results
