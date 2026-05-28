# File: scripts/test_upload.py
import os
import firebase_admin
from firebase_admin import credentials, firestore

cred_path = "serviceAccountKey.json"
if not os.path.exists(cred_path):
    print("Error: serviceAccountKey.json not found in root folder.")
    exit(1)

# Initialize Firebase
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

# Create test incident payload
test_payload = {
    "camera_id": "cam_backend_test",
    "location": "Backend Diagnostic Desk",
    "latitude": 12.95,
    "longitude": 77.52,
    "incident_type": "weapon",
    "detected_at": firestore.SERVER_TIMESTAMP,
    "intensity": "medium",
    "confidence": 0.98,
    "reviewed": False,
    "details": "SUCCESS: Real-time database bridge verified from Python Backend!",
    "police_station": "City Central Police HQ"
}

print("Uploading diagnostic test incident to Firestore...")
db.collection("incidents").add(test_payload)
print("[SUCCESS] Upload complete! Please check your React dashboard ticker at http://localhost:3000.")
