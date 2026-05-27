# Crime Detection System — AI-Powered CCTV Surveillance

The Crime Detection System is a modern, real-time surveillance threat detection system that monitors camera streams, runs automated YOLOv8-based threat classification, alerts dispatch centers, and displays events in an interactive glassmorphic dashboard.

## 🚀 Deployed Web Dashboard
- Live URL: **[https://crime-detection-system-80b2c.web.app](https://crime-detection-system-80b2c.web.app)**
- Firebase Console: **[https://console.firebase.google.com/project/crime-detection-system-80b2c/overview](https://console.firebase.google.com/project/crime-detection-system-80b2c/overview)**

---

## 💻 Tech Stack & Features

1. **Frontend Dashboard (React + Vite + Firebase SDK)**
   - Deployed on **Firebase Hosting** and synced with **Cloud Firestore**.
   - Premium responsive UI with dark glassmorphism styling, alert ticker, real-time incidents log, and SVG maps.
   - Built-in **Camera Feed Simulator** and **Webcam support** allowing live custom polygon zone drawing and coordinate-based dispatch simulation.
   - Synthesis Audio Alarm for high-severity threat logs.

2. **Core Python YOLO Backend**
   - Stream processing via OpenCV, frame-to-frame tampering checks, and Ultralytics YOLOv8 object/person classification.
   - Automatic coordinate dispatch calculation using Haversine lookup for closest police station.
   - Outbound alert dispatch integration with SendGrid (Email) and Twilio (Voice Call).

---

## 🛠️ Local Installation & Development

### 1. Frontend Web Dashboard
To run the dashboard source code locally:

```bash
# Install dependencies
npm install

# Run the local Vite dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. YOLO Core Ingest Backend
To set up the Python CCTV ingestion backend:

1. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

2. Download your Firebase service account JSON from Firebase Console settings, save it as `serviceAccountKey.json` in this folder.

3. (Optional) Set environment credentials in a `.env` file:
   ```env
   SENDGRID_API_KEY=your_sendgrid_key
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_FROM_NUMBER=your_twilio_phone
   OFFICER_EMAIL_LIST=officer@police.gov
   STREAM_FPS=5
   ```

4. Run the FastAPI server:
   ```bash
   python api/main.py
   ```

5. Trigger camera processing streams by making a POST request to `http://localhost:8000/streams/start`:
   ```json
   {
     "id": "cam_gate",
     "rtsp_url": "path/to/local/cctv_video.mp4",
     "location": "Entrance Gate A",
     "latitude": 12.95,
     "longitude": 77.52
   }
   ```
