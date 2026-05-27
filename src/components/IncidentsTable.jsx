import React, { useState } from 'react';
import { Shield, Eye, CheckCircle2, ChevronRight, Filter } from 'lucide-react';

export default function IncidentsTable({ incidents, onAcknowledge, onReview }) {
  const [filterType, setFilterType] = useState('all');
  const [filterIntensity, setFilterIntensity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Filter logic
  const filteredIncidents = incidents.filter(inc => {
    if (filterType !== 'all' && inc.incident_type !== filterType) return false;
    if (filterIntensity !== 'all' && inc.intensity !== filterIntensity) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'reviewed' && !inc.reviewed) return false;
      if (filterStatus === 'pending' && inc.reviewed) return false;
    }
    return true;
  });

  const getIntensityClass = (intensity) => {
    switch (intensity?.toLowerCase()) {
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'low';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    // Handle Firestore timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="incidents-container">
      <div className="filters-row">
        <Filter size={16} className="text-secondary" style={{ alignSelf: 'center' }} />
        <select 
          className="filter-select"
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="intrusion">Intrusion</option>
          <option value="violence">Violence</option>
          <option value="loitering">Loitering</option>
          <option value="tamper">Camera Tamper</option>
          <option value="face">Wanted Face</option>
          <option value="anpr">ANPR (Vehicle)</option>
          <option value="weapon">Weapon Detected</option>
        </select>

        <select 
          className="filter-select"
          value={filterIntensity} 
          onChange={(e) => setFilterIntensity(e.target.value)}
        >
          <option value="all">All Intensities</option>
          <option value="high">High Severity</option>
          <option value="medium">Medium Severity</option>
          <option value="low">Low Severity</option>
        </select>

        <select 
          className="filter-select"
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Active/Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      <div className="incidents-list-wrapper">
        {filteredIncidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            No incident reports found matching current filters.
          </div>
        ) : (
          <table className="incidents-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((inc) => (
                <tr key={inc.id} className={!inc.reviewed && inc.intensity === 'high' ? 'active-incident' : ''}>
                  <td>
                    <div style={{ fontWeight: '500' }}>{formatTime(inc.detected_at)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatDate(inc.detected_at)}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'capitalize' }}>
                      <Shield size={14} className={inc.intensity === 'high' ? 'text-accent-red' : 'text-accent-cyan'} style={{ color: inc.intensity === 'high' ? 'var(--accent-red)' : 'var(--accent-cyan)' }} />
                      {inc.incident_type?.replace('_', ' ')}
                    </div>
                  </td>
                  <td>{inc.location || 'Unknown'}</td>
                  <td>
                    <span className={`badge ${getIntensityClass(inc.intensity)}`}>
                      {inc.intensity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${inc.reviewed ? 'status-reviewed' : 'status-pending'}`}>
                      {inc.reviewed ? 'Reviewed' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {!inc.reviewed ? (
                        <button 
                          className="action-btn"
                          onClick={() => onAcknowledge(inc.id)}
                          title="Acknowledge Alert"
                        >
                          <CheckCircle2 size={12} />
                          <span>Resolve</span>
                        </button>
                      ) : (
                        <button 
                          className="action-btn secondary"
                          disabled
                          style={{ cursor: 'default', opacity: 0.5 }}
                        >
                          Resolved
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
