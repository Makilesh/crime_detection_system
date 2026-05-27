import React, { useState, useEffect } from 'react';
import { Landmark, Camera, AlertTriangle } from 'lucide-react';

export default function InteractiveMap({ incidents, cameras, stations }) {
  const [selectedElement, setSelectedElement] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);

  // SVG grid coordinate conversions
  // Map dimensions: width=800, height=500
  // Latitude ranges roughly [12.9, 13.0] and Longitude ranges [77.5, 77.6] (Bangalore-like coordinates)
  const mapWidth = 800;
  const mapHeight = 500;
  
  // Coordinate bounding boxes for the simulated area
  const minLat = 12.90;
  const maxLat = 12.99;
  const minLng = 77.50;
  const maxLng = 77.62;

  const toSvgCoords = (lat, lng) => {
    if (!lat || !lng) return { x: 400, y: 250 };
    // Interpolate
    const x = ((lng - minLng) / (maxLng - minLng)) * mapWidth;
    // Y is inverted in SVG
    const y = mapHeight - (((lat - minLat) / (maxLat - minLat)) * mapHeight);
    return { x, y };
  };

  // Find the closest station route for the latest active high severity incident
  useEffect(() => {
    const activeHighIncidents = incidents.filter(i => !i.reviewed && i.intensity === 'high');
    if (activeHighIncidents.length > 0) {
      const latestInc = activeHighIncidents[0];
      if (latestInc.latitude && latestInc.longitude && stations.length > 0) {
        // Find nearest station
        let nearestStation = stations[0];
        let minDistance = Infinity;

        stations.forEach(st => {
          const dx = st.latitude - latestInc.latitude;
          const dy = st.longitude - latestInc.longitude;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            nearestStation = st;
          }
        });

        const start = toSvgCoords(nearestStation.latitude, nearestStation.longitude);
        const end = toSvgCoords(latestInc.latitude, latestInc.longitude);
        setActiveRoute({
          start,
          end,
          stationName: nearestStation.name,
          incidentType: latestInc.incident_type
        });
        return;
      }
    }
    setActiveRoute(null);
  }, [incidents, stations]);

  return (
    <div className="map-container">
      <div className="card-title-section">
        <div className="card-title">
          <Landmark size={18} />
          <span>City Surveillance Map & Dispatch Routing</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {activeRoute ? (
            <span style={{ color: 'var(--accent-red)', fontWeight: 'bold', animation: 'pulse-glow 1s infinite' }}>
              ⚠️ Officer Dispatched from {activeRoute.stationName}
            </span>
          ) : (
            'All Areas Secure'
          )}
        </div>
      </div>

      <div className="city-map-wrapper">
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="svg-map">
          {/* Background Grid */}
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={`grid-x-${i}`}
              x1={(mapWidth / 16) * i}
              y1={0}
              x2={(mapWidth / 16) * i}
              y2={mapHeight}
              className="map-grid-line"
            />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line
              key={`grid-y-${i}`}
              x1={0}
              y1={(mapHeight / 10) * i}
              x2={mapWidth}
              y2={(mapHeight / 10) * i}
              className="map-grid-line"
            />
          ))}

          {/* Simulated Roads/Highways for visual premium feel */}
          <path d="M 50 100 Q 400 150 750 80" className="map-road-highway" />
          <path d="M 100 450 Q 380 320 700 420" className="map-road-highway" />
          <path d="M 200 50 L 250 450" className="map-road" />
          <path d="M 600 50 L 550 450" className="map-road" />
          <path d="M 50 250 L 750 250" className="map-road" />
          <path d="M 400 50 C 350 200, 450 300, 400 450" className="map-road" style={{ stroke: 'rgba(0, 240, 255, 0.08)', strokeWidth: 5 }} />

          {/* Active Dispatch Route */}
          {activeRoute && (
            <>
              {/* Glow line under active route */}
              <line
                x1={activeRoute.start.x}
                y1={activeRoute.start.y}
                x2={activeRoute.end.x}
                y2={activeRoute.end.y}
                stroke="var(--accent-red)"
                strokeWidth="4"
                opacity="0.3"
                strokeLinecap="round"
              />
              <line
                x1={activeRoute.start.x}
                y1={activeRoute.start.y}
                x2={activeRoute.end.x}
                y2={activeRoute.end.y}
                stroke="var(--accent-red)"
                strokeWidth="2"
                strokeLinecap="round"
                className="dispatch-route"
              />
            </>
          )}

          {/* Render Police Stations */}
          {stations.map((st) => {
            const coords = toSvgCoords(st.latitude, st.longitude);
            return (
              <g 
                key={st.id} 
                className="station-marker"
                onClick={() => setSelectedElement({ type: 'Station', ...st })}
              >
                <circle cx={coords.x} cy={coords.y} r="16" fill="rgba(0, 112, 243, 0.15)" stroke="var(--accent-blue)" strokeWidth="1.5" />
                <circle cx={coords.x} cy={coords.y} r="4" fill="var(--accent-blue)" />
                <foreignObject x={coords.x - 7} y={coords.y - 7} width="14" height="14" style={{ pointerEvents: 'none' }}>
                  <Landmark size={14} className="text-accent-blue" style={{ color: 'var(--accent-blue)' }} />
                </foreignObject>
              </g>
            );
          })}

          {/* Render Cameras */}
          {cameras.map((cam) => {
            const coords = toSvgCoords(cam.latitude, cam.longitude);
            return (
              <g 
                key={cam.id} 
                className="camera-marker"
                onClick={() => setSelectedElement({ type: 'Camera', ...cam })}
              >
                <circle cx={coords.x} cy={coords.y} r="14" fill="rgba(0, 240, 255, 0.1)" stroke="var(--accent-cyan)" strokeWidth="1.2" />
                <circle cx={coords.x} cy={coords.y} r="3" fill="var(--accent-cyan)" />
                <foreignObject x={coords.x - 6} y={coords.y - 6} width="12" height="12" style={{ pointerEvents: 'none' }}>
                  <Camera size={12} style={{ color: 'var(--accent-cyan)' }} />
                </foreignObject>
              </g>
            );
          })}

          {/* Render Active/Pending High Severity Incidents */}
          {incidents
            .filter((inc) => !inc.reviewed && inc.intensity === 'high')
            .map((inc) => {
              const coords = toSvgCoords(inc.latitude, inc.longitude);
              return (
                <g 
                  key={inc.id} 
                  className="incident-marker"
                  onClick={() => setSelectedElement({ type: 'Threat', ...inc })}
                >
                  <circle cx={coords.x} cy={coords.y} r="18" fill="rgba(255, 0, 85, 0.1)" stroke="var(--accent-red)" strokeWidth="1.5" />
                  <circle cx={coords.x} cy={coords.y} r="25" fill="none" stroke="var(--accent-red)" strokeWidth="1" className="incident-ping" />
                  <foreignObject x={coords.x - 9} y={coords.y - 9} width="18" height="18" style={{ pointerEvents: 'none' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--accent-red)' }} />
                  </foreignObject>
                </g>
              );
            })}
        </svg>

        {/* Legend */}
        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-dot pd"></div>
            <span>Police Station</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot cam"></div>
            <span>Surveillance Cam</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot inc"></div>
            <span>High Severity Threat</span>
          </div>
        </div>

        {/* Detail Tooltip Popup */}
        {selectedElement && (
          <div 
            style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              background: 'rgba(10, 10, 18, 0.95)',
              border: '1px solid var(--accent-cyan)',
              boxShadow: 'var(--glow-cyan)',
              borderRadius: '8px',
              padding: '0.8rem',
              fontSize: '0.8rem',
              width: '240px',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.2rem' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{selectedElement.type} Info</span>
              <button 
                onClick={() => setSelectedElement(null)} 
                style={{ background: 'none', border: 'none', color: '#ff0055', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
            {selectedElement.type === 'Camera' && (
              <div>
                <p><strong>ID:</strong> {selectedElement.id}</p>
                <p><strong>Name:</strong> {selectedElement.name}</p>
                <p><strong>Location:</strong> {selectedElement.location}</p>
                <p><strong>Status:</strong> <span style={{ color: 'var(--accent-green)' }}>Online</span></p>
              </div>
            )}
            {selectedElement.type === 'Station' && (
              <div>
                <p><strong>Name:</strong> {selectedElement.name}</p>
                <p><strong>Contact:</strong> {selectedElement.phone}</p>
                <p><strong>Jurisdiction:</strong> {selectedElement.jurisdiction || 'City Core'}</p>
              </div>
            )}
            {selectedElement.type === 'Threat' && (
              <div>
                <p><strong>Type:</strong> <span style={{ textTransform: 'capitalize', color: 'var(--accent-red)' }}>{selectedElement.incident_type}</span></p>
                <p><strong>Location:</strong> {selectedElement.location}</p>
                <p><strong>Confidence:</strong> {(selectedElement.confidence * 100).toFixed(0)}%</p>
                <p><strong>Threat Status:</strong> Active Dispatch</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
