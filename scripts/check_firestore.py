# File: scripts/check_firestore.py
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

print("Querying last 5 incidents from Firestore...")
print("=" * 70)

# Fetch incidents ordered by detected_at descending
docs = db.collection("incidents").order_by("detected_at", direction=firestore.Query.DESCENDING).limit(5).get()

for doc in docs:
    data = doc.to_dict()
    print(f"Doc ID: {doc.id}")
    print(f"  Type      : {data.get('incident_type')}")
    print(f"  Location  : {data.get('location')}")
    print(f"  Intensity : {data.get('intensity')}")
    print(f"  Detected At: {data.get('detected_at')} (Type: {type(data.get('detected_at'))})")
    print(f"  Details   : {data.get('details')}")
    print("-" * 70)
