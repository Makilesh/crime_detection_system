import React, { useState, useEffect, useRef } from 'react';
import { Camera, Settings, RefreshCw, StopCircle, Play, ShieldAlert, Sparkles } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function LiveFeed({ activeCamera, activeIncidents, onNewIncident }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([
    { x: 100, y: 80 },
    { x: 300, y: 80 },
    { x: 350, y: 250 },
    { x: 80, y: 250 }
  ]);
  const [activeThreats, setActiveThreats] = useState([]);
  const [isBackendActive, setIsBackendActive] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1);
  
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const getRtspUrl = (camera) => {
    if (!camera) return '';
    if (camera.rtsp_url) return camera.rtsp_url;
    if (camera.id === 'cam_webcam') return '0';
    if (camera.id === 'cam_gate') return 'rtsp://admin:admin@123@192.168.1.8:554/cam/realmonitor?channel=1&subtype=1';
    return '';
  };
  
  // Simulated entities (people, objects) moving in the frame
  const entitiesRef = useRef([
    { id: 1, x: 50, y: 150, vx: 1.2, vy: 0.5, name: 'Subject A', size: 10, loiterTime: 0, threatTriggered: {} },
    { id: 2, x: 450, y: 100, vx: -0.8, vy: 0.8, name: 'Subject B', size: 10, loiterTime: 0, threatTriggered: {} },
    { id: 3, x: 250, y: 300, vx: 0.5, vy: -0.6, name: 'Subject C', size: 10, loiterTime: 0, threatTriggered: {} }
  ]);

  // Point in polygon ray-casting algorithm
  const isPointInPolygon = (x, y, poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Handle adding custom points during drawing
  const handleCanvasClick = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (polygonPoints.length >= 6) {
      setPolygonPoints([{ x, y }]); // Reset if too many points
    } else {
      setPolygonPoints([...polygonPoints, { x, y }]);
    }
  };

  // Toggle drawing mode
  const startDrawing = () => {
    setIsDrawing(true);
    setPolygonPoints([]);
  };

  const saveZone = () => {
    setIsDrawing(false);
  };

  const resetZone = () => {
    setIsDrawing(false);
    // Set default polygon
    setPolygonPoints([
      { x: 100, y: 80 },
      { x: 300, y: 80 },
      { x: 350, y: 250 },
      { x: 80, y: 250 }
    ]);
  };

  // Push simulated incident to Firestore
  const triggerIncident = async (type, intensity, details) => {
    try {
      const docData = {
        camera_id: activeCamera?.id || 'cam_sim',
        location: activeCamera?.location || 'Simulated Area',
        latitude: activeCamera?.latitude || 12.94,
        longitude: activeCamera?.longitude || 77.54,
        incident_type: type,
        detected_at: new Date(),
        intensity: intensity,
        confidence: 0.82 + Math.random() * 0.15,
        reviewed: false,
        details: details
      };

      const docRef = await addDoc(collection(db, 'incidents'), docData);
      const newInc = { id: docRef.id, ...docData };
      if (onNewIncident) {
        onNewIncident(newInc);
      }
    } catch (e) {
      console.error('Error logging incident to Firestore:', e);
    }
  };

  // Poll backend stream status periodically
  useEffect(() => {
    if (!activeCamera) return;
    let active = true;

    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/streams/status');
        if (!res.ok) throw new Error('Backend offline');
        const data = await res.json();
        if (active) {
          const activeStreams = data.active_streams || {};
          setIsBackendActive(!!activeStreams[activeCamera.id]);
        }
      } catch (err) {
        if (active) {
          setIsBackendActive(false);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeCamera]);

  const toggleBackendStream = async () => {
    if (!activeCamera) return;
    try {
      if (isBackendActive) {
        // Stop stream
        const res = await fetch(`http://localhost:8000/streams/stop/${activeCamera.id}`, {
          method: 'POST'
        });
        if (res.ok) {
          setIsBackendActive(false);
        } else {
          alert('Failed to stop backend stream process.');
        }
      } else {
        // Start stream
        const rtspUrl = getRtspUrl(activeCamera);
        if (!rtspUrl) {
          alert(`No streaming source configured for camera "${activeCamera.name}"`);
          return;
        }
        const res = await fetch('http://localhost:8000/streams/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: activeCamera.id,
            rtsp_url: rtspUrl,
            location: activeCamera.location || 'Unknown',
            latitude: activeCamera.latitude || 0,
            longitude: activeCamera.longitude || 0
          })
        });
        if (res.ok) {
          setIsBackendActive(true);
          setStreamKey(prev => prev + 1); // Refresh image feed
        } else {
          alert('Failed to start backend stream process.');
        }
      }
    } catch (err) {
      console.error('Error toggling backend stream:', err);
      alert('Could not connect to FastAPI backend server on port 8000.');
    }
  };

  // Main rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set logical dimensions
    canvas.width = 640;
    canvas.height = 360;

    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isBackendActive) {
        // Draw simulated background
        ctx.fillStyle = '#06060c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw structural wireframe background for a high-tech grid look
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 30) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, canvas.height);
          ctx.stroke();
        }
        for (let i = 0; i < canvas.height; i += 30) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(canvas.width, i);
          ctx.stroke();
        }

        // Draw some mock room elements
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 40, 540, 280); // Warehouse wall outline
        ctx.beginPath();
        ctx.moveTo(150, 40); ctx.lineTo(150, 320);
        ctx.moveTo(490, 40); ctx.lineTo(490, 320);
        ctx.stroke();

        // Draw labels inside rooms
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '8px Orbitron';
        ctx.fillText('BAY 01', 80, 55);
        ctx.fillText('CENTRAL LOADING ZONE', 250, 55);
        ctx.fillText('BAY 02', 510, 55);
      }

      // Draw custom polygon zone (restricted area)
      if (polygonPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for (let i = 1; i < polygonPoints.length; i++) {
          ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        if (!isDrawing) {
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
          ctx.fill();
        }
        ctx.strokeStyle = isDrawing ? 'rgba(0, 240, 255, 0.8)' : 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = isDrawing ? 2 : 1.5;
        ctx.setLineDash(isDrawing ? [5, 5] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label the Restricted Zone
        if (polygonPoints.length >= 3 && !isDrawing) {
          const cX = polygonPoints.reduce((acc, p) => acc + p.x, 0) / polygonPoints.length;
          const cY = polygonPoints.reduce((acc, p) => acc + p.y, 0) / polygonPoints.length;
          ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
          ctx.font = '8px Orbitron';
          ctx.fillText('RESTRICTED POLYGON', cX - 45, cY);
        }
      }

      // Update and Draw Simulated Targets/Entities (Only in simulation mode)
      if (!isBackendActive) {
        const entities = entitiesRef.current;
        const currentThreats = [];

        entities.forEach((entity) => {
          // Move entity
          entity.x += entity.vx * simSpeed;
          entity.y += entity.vy * simSpeed;

          // Wall collisions (bounce back)
          if (entity.x < 10 || entity.x > canvas.width - 10) {
            entity.vx *= -1;
            entity.x = Math.max(10, Math.min(canvas.width - 10, entity.x));
          }
          if (entity.y < 10 || entity.y > canvas.height - 10) {
            entity.vy *= -1;
            entity.y = Math.max(10, Math.min(canvas.height - 10, entity.y));
          }

          // Check if inside polygon
          const inZone = polygonPoints.length >= 3 && isPointInPolygon(entity.x, entity.y, polygonPoints);

          // Bounding box colors
          let boxColor = 'rgba(0, 240, 255, 0.7)'; // Cyan default
          let boxGlow = 'rgba(0, 240, 255, 0.2)';

          if (inZone) {
            boxColor = 'var(--accent-red)';
            boxGlow = 'rgba(255, 0, 85, 0.3)';
            entity.loiterTime += 1;

            // Trigger Intrusion alert (throttle to once per entrance)
            if (!entity.threatTriggered.intrusion) {
              entity.threatTriggered.intrusion = true;
              triggerIncident('intrusion', 'medium', `${entity.name} entered restricted zone`);
            }

            // Trigger Loitering alert after 180 frames (approx 6 seconds at 30fps)
            if (entity.loiterTime > 180 && !entity.threatTriggered.loitering) {
              entity.threatTriggered.loitering = true;
              triggerIncident('loitering', 'low', `${entity.name} dwelling in restricted zone for >6s`);
            }
          } else {
            entity.loiterTime = Math.max(0, entity.loiterTime - 2);
            if (entity.loiterTime === 0) {
              // Reset triggers when they exit
              entity.threatTriggered.intrusion = false;
              entity.threatTriggered.loitering = false;
            }
          }

          // Periodic Random Event: Violence simulation (Subject A and B approach each other)
          if (entity.id === 1) {
            const other = entities.find(e => e.id === 2);
            if (other) {
              const dist = Math.sqrt((entity.x - other.x) ** 2 + (entity.y - other.y) ** 2);
              // If they are very close, simulate conflict (5% chance if close)
              if (dist < 40 && frameCount % 300 === 0 && !entity.threatTriggered.violence) {
                entity.threatTriggered.violence = true;
                other.threatTriggered.violence = true;
                triggerIncident('violence', 'high', `Physical conflict detected between ${entity.name} and ${other.name}`);
              }

              // Conflict duration
              if (entity.threatTriggered.violence) {
                boxColor = 'var(--accent-red)';
                boxGlow = 'rgba(255, 0, 85, 0.4)';
                
                // Jitter/Aggressive movement
                entity.vx = (Math.random() - 0.5) * 5;
                entity.vy = (Math.random() - 0.5) * 5;
                
                // Draw visual violence trigger indicator
                ctx.strokeStyle = 'var(--accent-red)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc((entity.x + other.x) / 2, (entity.y + other.y) / 2, 35, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255, 0, 85, 0.8)';
                ctx.font = '8px Orbitron';
                ctx.fillText('POSE THREAT: AGGRESSION', (entity.x + other.x) / 2 - 60, (entity.y + other.y) / 2 - 40);

                // Clear conflict after 120 frames
                if (frameCount % 120 === 0) {
                  entity.threatTriggered.violence = false;
                  other.threatTriggered.violence = false;
                  entity.vx = (Math.random() - 0.5) * 3;
                  entity.vy = (Math.random() - 0.5) * 3;
                }
              }
            }
          }

          // Periodic Random Event: Wanted Face Detection (Subject C wanted match)
          if (entity.id === 3 && frameCount % 600 === 100 && !entity.threatTriggered.face) {
            entity.threatTriggered.face = true;
            triggerIncident('face', 'high', `Wanted person MATCH: John Doe ID #4092`);
            
            // Clear notification
            setTimeout(() => {
              entity.threatTriggered.face = false;
            }, 4000);
          }

          if (entity.threatTriggered.face) {
            boxColor = 'var(--accent-red)';
            boxGlow = 'rgba(255, 0, 85, 0.3)';
            ctx.fillStyle = 'var(--accent-red)';
            ctx.font = '7px Orbitron';
            ctx.fillText('MATCH: WANTED PERSON', entity.x - 40, entity.y - entity.size - 22);
          }

          // Draw Target bounding box
          ctx.shadowColor = boxGlow;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 1.5;
          const boxWidth = entity.size * 2.5;
          const boxHeight = entity.size * 4.5;
          ctx.strokeRect(entity.x - boxWidth / 2, entity.y - boxHeight / 2, boxWidth, boxHeight);
          ctx.shadowBlur = 0; // Reset shadow

          // Corner ticks for high-tech HUD look
          ctx.beginPath();
          // Top left
          ctx.moveTo(entity.x - boxWidth / 2, entity.y - boxHeight / 2 + 5);
          ctx.lineTo(entity.x - boxWidth / 2, entity.y - boxHeight / 2);
          ctx.lineTo(entity.x - boxWidth / 2 + 5, entity.y - boxHeight / 2);
          // Top right
          ctx.moveTo(entity.x + boxWidth / 2 - 5, entity.y - boxHeight / 2);
          ctx.lineTo(entity.x + boxWidth / 2, entity.y - boxHeight / 2);
          ctx.lineTo(entity.x + boxWidth / 2, entity.y - boxHeight / 2 + 5);
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          // Label Target Info
          ctx.fillStyle = '#ffffff';
          ctx.font = '7px Inter';
          ctx.fillText(`${entity.name} [${inZone ? 'RESTRICTED' : 'SECURE'}]`, entity.x - boxWidth / 2, entity.y - boxHeight / 2 - 10);
          ctx.fillStyle = boxColor;
          ctx.fillText(`CONF: ${(80 + Math.random() * 19).toFixed(0)}%`, entity.x - boxWidth / 2, entity.y - boxHeight / 2 - 3);

          if (inZone || entity.threatTriggered.violence || entity.threatTriggered.face) {
            currentThreats.push({ name: entity.name, threat: inZone ? 'Intrusion' : (entity.threatTriggered.violence ? 'Violence' : 'Wanted Match') });
          }
        });

        setActiveThreats(currentThreats);
      } else {
        // Clear simulated threats when backend is active
        setActiveThreats([]);
      }

      requestRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [polygonPoints, isDrawing, simSpeed, activeCamera, isBackendActive]);

  // Filter active incidents for this camera (limit to top 3 most recent to prevent UI clutter)
  const backendThreats = activeIncidents
    ? activeIncidents
        .filter(i => i.camera_id === activeCamera?.id && !i.reviewed)
        .slice(0, 3)
    : [];

  return (
    <div className="feed-container">
      <div className="feed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={16} className="text-accent-cyan" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Active Camera Feed: <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)' }}>{activeCamera?.name || 'Local Simulator'}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button 
            className="control-btn"
            onClick={toggleBackendStream}
            style={{ 
              borderColor: isBackendActive ? 'var(--accent-red)' : 'var(--accent-cyan)',
              color: isBackendActive ? 'var(--accent-red)' : 'var(--accent-cyan)'
            }}
          >
            {isBackendActive ? <StopCircle size={12} /> : <Play size={12} />}
            <span>{isBackendActive ? 'Stop Stream Feed' : 'Start Stream Feed'}</span>
          </button>

          {!isBackendActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>SIM SPEED:</span>
              <select 
                className="filter-select"
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                value={simSpeed}
                onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1.0x</option>
                <option value={2}>2.0x</option>
              </select>
            </div>
          )}

          <button className="control-btn" onClick={isDrawing ? saveZone : startDrawing}>
            <Settings size={12} />
            <span>{isDrawing ? 'Save Zone (Ctrl+S)' : 'Edit Guard Zone'}</span>
          </button>
          {isDrawing && (
            <button className="control-btn" onClick={resetZone} style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      <div className="video-screen-wrapper" style={{ position: 'relative' }}>
        {isBackendActive && (
          <img 
            src={`http://localhost:8000/streams/video/${activeCamera?.id}?key=${streamKey}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1
            }}
            alt="Live feed stream"
            onError={() => {
              console.warn('Stream image failed to load, falling back...');
              setIsBackendActive(false);
            }}
          />
        )}
        <canvas 
          ref={canvasRef} 
          className="video-canvas"
          onClick={handleCanvasClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            cursor: isDrawing ? 'crosshair' : 'default',
            background: 'transparent'
          }}
        />

        {/* Video overlay HUD */}
        <div className="feed-hud" style={{ zIndex: 3 }}>
          <div className="hud-left">
            <div className="hud-rec-indicator">
              <div className="hud-rec-dot" style={{ backgroundColor: isBackendActive ? 'var(--accent-red)' : 'var(--text-secondary)' }} />
              <span style={{ color: isBackendActive ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                {isBackendActive ? 'LIVE STREAM' : 'SIMULATION'}
              </span>
            </div>
            <div>RES: 1080P</div>
            <div>FPS: {isBackendActive ? '12.0' : '29.97'}</div>
          </div>
          <div className="hud-right">
            <div>CAM_ID: {activeCamera?.id?.toUpperCase() || 'SIM_001'}</div>
            <div>ZONE: {activeCamera?.location?.toUpperCase() || 'SURVEILLANCE'}</div>
            <div>{new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Custom drawer overlay indicator */}
        {isDrawing && (
          <div 
            style={{
              position: 'absolute',
              bottom: '1rem',
              right: '1rem',
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid var(--accent-cyan)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.7rem',
              color: 'var(--accent-cyan)',
              pointerEvents: 'none',
              zIndex: 3
            }}
          >
            Click up to 6 points on feed to draw intrusion zone.
          </div>
        )}

        {/* Active alert overlays */}
        {((isBackendActive && backendThreats.length > 0) || (!isBackendActive && activeThreats.length > 0)) && (
          <div 
            style={{
              position: 'absolute',
              top: '3.5rem',
              left: '1rem',
              background: 'rgba(255, 0, 85, 0.85)',
              color: '#ffffff',
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.4rem',
              fontFamily: 'var(--font-display)',
              boxShadow: 'var(--glow-red)',
              pointerEvents: 'none',
              animation: 'pulse-glow 2s infinite alternate',
              zIndex: 3,
              maxWidth: '350px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)', width: '100%', paddingBottom: '3px', fontSize: '0.75rem' }}>
              <ShieldAlert size={14} />
              <span>ACTIVE THREATS</span>
            </div>
            {isBackendActive ? (
              backendThreats.map(t => (
                <div key={t.id} style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                  ⚠️ <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{t.incident_type}</span>: {t.details}
                </div>
              ))
            ) : (
              activeThreats.map((t, idx) => (
                <div key={idx} style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>
                  ⚠️ <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{t.threat}</span>: {t.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
