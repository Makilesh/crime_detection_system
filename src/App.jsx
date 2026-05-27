import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Shield, Radio, Activity, AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';
import LiveFeed from './components/LiveFeed';
import IncidentsTable from './components/IncidentsTable';
import InteractiveMap from './components/InteractiveMap';
import Analytics from './components/Analytics';

// Fallback seed data in case database is empty
const defaultCameras = [
  { id: 'cam_gate', name: 'Main Entrance Gate', location: 'Gate A Checkpoint', latitude: 12.95, longitude: 77.52 },
  { id: 'cam_vault', name: 'Server Vault Corridor', location: 'Secure Vault Room', latitude: 12.92, longitude: 77.56 },
  { id: 'cam_parking', name: 'North Parking Lot', location: 'Parking Section B', latitude: 12.98, longitude: 77.60 },
  { id: 'cam_webcam', name: 'Operator Local WebCam', location: 'Webcam Console', latitude: 12.94, longitude: 77.54 }
];

const defaultStations = [
  { id: 'station_central', name: 'City Central Police HQ', phone: '+1 555-0199', latitude: 12.93, longitude: 77.55, jurisdiction: 'Sector 1 & 2' },
  { id: 'station_north', name: 'North Side Precinct', phone: '+1 555-0144', latitude: 12.97, longitude: 77.58, jurisdiction: 'Sector 3' },
  { id: 'station_south', name: 'South Sector Station', phone: '+1 555-0177', latitude: 12.91, longitude: 77.51, jurisdiction: 'Sector 4' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('live'); // live, incidents, analytics
  const [incidents, setIncidents] = useState([]);
  const [cameras, setCameras] = useState(defaultCameras);
  const [stations, setStations] = useState(defaultStations);
  const [activeCamera, setActiveCamera] = useState(defaultCameras[0]);
  const [tickerLogs, setTickerLogs] = useState([]);

  // Synthesizer Web Audio Alarm for high severity alerts
  const playAlarmSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // First beep
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.3);

      // Second beep (slightly delayed & higher pitch)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6
        gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.4);
      }, 150);
    } catch (e) {
      console.warn('Audio Context failed to play:', e);
    }
  };

  // Sync Incidents from Firestore
  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('detected_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // If we received a new critical high incident, trigger local alarm
      if (docs.length > incidents.length && incidents.length > 0) {
        const newDoc = docs[0];
        if (newDoc.intensity === 'high' && !newDoc.reviewed) {
          playAlarmSound();
        }
      }

      setIncidents(docs);

      // Update ticker logs
      const logs = docs.slice(0, 15).map(doc => {
        const time = doc.detected_at?.toDate ? doc.detected_at.toDate() : new Date(doc.detected_at);
        return {
          id: doc.id,
          time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          msg: `${doc.incident_type?.toUpperCase()} detected at ${doc.location}`,
          severity: doc.intensity?.toLowerCase(),
          details: doc.details || ''
        };
      });
      setTickerLogs(logs);
    }, (error) => {
      console.error("Firestore listener failed:", error);
    });

    return () => unsubscribe();
  }, [incidents.length]);

  // Sync Cameras & Stations if they exist in Firestore, otherwise write them
  useEffect(() => {
    const syncDatabase = async () => {
      try {
        const camSnap = await getDocs(collection(db, 'cameras'));
        if (!camSnap.empty) {
          setCameras(camSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // Write defaults
          defaultCameras.forEach(async (c) => {
            await addDoc(collection(db, 'cameras'), c);
          });
        }

        const stationSnap = await getDocs(collection(db, 'stations'));
        if (!stationSnap.empty) {
          setStations(stationSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // Write defaults
          defaultStations.forEach(async (s) => {
            await addDoc(collection(db, 'stations'), s);
          });
        }
      } catch (e) {
        console.warn('Initial seed check failed (could be offline or permissions):', e);
      }
    };
    syncDatabase();
  }, []);

  // Update incident to Resolved
  const handleAcknowledge = async (id) => {
    try {
      const docRef = doc(db, 'incidents', id);
      await updateDoc(docRef, { reviewed: true });
    } catch (e) {
      console.error('Error resolving incident:', e);
    }
  };

  // Trigger manual simulated threat for testing
  const triggerManualThreat = async (type, intensity, location) => {
    try {
      // Pick coordinate offset
      const randCam = defaultCameras[Math.floor(Math.random() * defaultCameras.length)];
      
      const docData = {
        camera_id: randCam.id,
        location: randCam.name,
        latitude: randCam.latitude + (Math.random() - 0.5) * 0.01,
        longitude: randCam.longitude + (Math.random() - 0.5) * 0.01,
        incident_type: type,
        detected_at: new Date(),
        intensity: intensity,
        confidence: 0.85 + Math.random() * 0.12,
        reviewed: false,
        details: `Manual trigger of ${type} security alert`
      };

      await addDoc(collection(db, 'incidents'), docData);
      playAlarmSound();
    } catch (e) {
      console.error('Error triggering manual threat:', e);
    }
  };

  // Safe KPI computations
  const activeIncidents = incidents.filter(i => !i.reviewed);
  const activeCritical = activeIncidents.filter(i => i.intensity === 'high').length;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <Shield size={28} className="logo-icon" />
          <h1 className="app-title">Crime Detection System</h1>
        </div>

        <div className="status-badge-container">
          <div className="system-status">
            <div className="status-dot" />
            <span>Core Detection Online</span>
          </div>

          <div className="nav-tabs">
            <button 
              className={`nav-button ${activeTab === 'live' ? 'active' : ''}`}
              onClick={() => setActiveTab('live')}
            >
              <Radio size={15} />
              <span>Live Monitor</span>
            </button>
            <button 
              className={`nav-button ${activeTab === 'incidents' ? 'active' : ''}`}
              onClick={() => setActiveTab('incidents')}
            >
              <Activity size={15} />
              <span>Incidents Log ({activeIncidents.length})</span>
            </button>
            <button 
              className={`nav-button ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <ShieldCheck size={15} />
              <span>Analytics</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="dashboard-grid">
        {/* Left Side: Live Feed or Incidents list depending on Tab */}
        <section className="panel-left">
          {activeTab === 'live' && (
            <div className="glass-card" style={{ flex: 1 }}>
              <div className="feed-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.6rem' }}>
                <span className="card-title">
                  <Radio size={18} />
                  <span>Real-Time Threat Detection Ingest</span>
                </span>
                
                {/* Camera switcher */}
                <div className="feed-selector">
                  {cameras.map(cam => (
                    <button 
                      key={cam.id} 
                      className={`feed-tab ${activeCamera?.id === cam.id ? 'active' : ''}`}
                      onClick={() => setActiveCamera(cam)}
                    >
                      {cam.id === 'cam_webcam' ? '🔌 Operator WebCam' : cam.name}
                    </button>
                  ))}
                </div>
              </div>

              <LiveFeed 
                activeCamera={activeCamera}
                onNewIncident={(inc) => {
                  // Local callback if needed, Firestore sync takes care of list state
                }}
              />
            </div>
          )}

          {activeTab === 'incidents' && (
            <div className="glass-card" style={{ flex: 1 }}>
              <div className="card-title-section">
                <div className="card-title">
                  <Activity size={18} />
                  <span>Central Incident Management Console</span>
                </div>
              </div>
              <IncidentsTable 
                incidents={incidents}
                onAcknowledge={handleAcknowledge}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <Analytics incidents={incidents} />
          )}

          {/* Quick simulator triggers for manual validation */}
          <div className="glass-card" style={{ padding: '0.8rem 1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <AlertTriangle size={15} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontWeight: '500' }}>Operator Simulation Control Panel</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="control-btn" 
                  onClick={() => triggerManualThreat('intrusion', 'medium')}
                  style={{ borderColor: 'var(--accent-orange)', color: 'var(--accent-orange)' }}
                >
                  Simulate Intrusion (Med)
                </button>
                <button 
                  className="control-btn" 
                  onClick={() => triggerManualThreat('violence', 'high')}
                  style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                >
                  Simulate Violence (High)
                </button>
                <button 
                  className="control-btn" 
                  onClick={() => triggerManualThreat('tamper', 'high')}
                  style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                >
                  Simulate Tampering (High)
                </button>
                <button 
                  className="control-btn" 
                  onClick={() => triggerManualThreat('anpr', 'low')}
                >
                  Simulate ANPR Log (Low)
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Side: Map & Live Threat Ticker (Common for all dashboards) */}
        <section className="panel-right">
          {/* Map */}
          <div className="glass-card" style={{ flex: 1.3 }}>
            <InteractiveMap 
              incidents={incidents}
              cameras={cameras}
              stations={stations}
            />
          </div>

          {/* Live System Ticker */}
          <div className="glass-card" style={{ flex: 0.7 }}>
            <div className="card-title-section">
              <div className="card-title">
                <Activity size={18} />
                <span>Live Surveillance Alert Ticker</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)' }}>
                {activeCritical > 0 && `${activeCritical} Critical Alerts Pending`}
              </div>
            </div>

            <div className="ticker-card-list">
              {tickerLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Awaiting threat signals from camera ingest...
                </div>
              ) : (
                tickerLogs.map((log) => (
                  <div key={log.id} className={`ticker-item ${log.severity}`}>
                    <div className="ticker-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="ticker-msg">{log.msg}</span>
                        <span className="ticker-time">{log.time}</span>
                      </div>
                      <div className="ticker-meta">
                        <span>Details: {log.details}</span>
                        <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: log.severity === 'high' ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                          {log.severity?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
