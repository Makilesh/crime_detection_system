import React from 'react';
import { BarChart3, TrendingUp, AlertOctagon, Clock } from 'lucide-react';

export default function Analytics({ incidents }) {
  // Aggregate data by type
  const typeCounts = {};
  const severityCounts = { high: 0, medium: 0, low: 0 };
  const hourlyCounts = Array(24).fill(0);

  incidents.forEach(inc => {
    // Type aggregation
    const type = inc.incident_type || 'other';
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    // Severity aggregation
    const severity = inc.intensity?.toLowerCase() || 'low';
    if (severityCounts[severity] !== undefined) {
      severityCounts[severity]++;
    }

    // Hourly aggregation
    if (inc.detected_at) {
      const date = inc.detected_at.toDate ? inc.detected_at.toDate() : new Date(inc.detected_at);
      const hour = date.getHours();
      if (hour >= 0 && hour < 24) {
        hourlyCounts[hour]++;
      }
    }
  });

  const totalIncidents = incidents.length;
  const highSeverityCount = severityCounts.high;
  const resolvedCount = incidents.filter(i => i.reviewed).length;
  const resolutionRate = totalIncidents > 0 ? ((resolvedCount / totalIncidents) * 100).toFixed(0) : 100;

  // Render a custom CSS bar chart
  const maxTypeCount = Math.max(...Object.values(typeCounts), 1);
  const typesData = Object.entries(typeCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // top 5 types

  // Group hours into 4 categories: Night (0-6), Morning (6-12), Afternoon (12-18), Evening (18-24)
  const timeBlockCounts = {
    'Night (12am-6am)': 0,
    'Morning (6am-12pm)': 0,
    'Afternoon (12pm-6pm)': 0,
    'Evening (6pm-12am)': 0
  };

  hourlyCounts.forEach((count, hour) => {
    if (hour >= 0 && hour < 6) timeBlockCounts['Night (12am-6am)'] += count;
    else if (hour >= 6 && hour < 12) timeBlockCounts['Morning (6am-12pm)'] += count;
    else if (hour >= 12 && hour < 18) timeBlockCounts['Afternoon (12pm-6pm)'] += count;
    else timeBlockCounts['Evening (6pm-12am)'] += count;
  });

  const maxTimeBlockCount = Math.max(...Object.values(timeBlockCounts), 1);

  return (
    <div className="analytics-grid">
      {/* Incident Categories Panel */}
      <div className="glass-card">
        <div className="card-title-section">
          <div className="card-title">
            <BarChart3 size={18} />
            <span>Incident Frequency by Type</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', flex: 1, justifyContent: 'center' }}>
          {typesData.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No incidents logged yet.</div>
          ) : (
            typesData.map(({ name, count }) => {
              const percentage = (count / maxTypeCount) * 100;
              return (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{name.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>{count} ({((count / totalIncidents) * 100).toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${percentage}%`, 
                        background: 'linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-cyan) 100%)',
                        boxShadow: 'var(--glow-cyan)',
                        borderRadius: '4px',
                        transition: 'width 1s ease-in-out'
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Temporal Analysis Panel */}
      <div className="glass-card">
        <div className="card-title-section">
          <div className="card-title">
            <Clock size={18} />
            <span>Temporal Incident Distribution</span>
          </div>
        </div>

        <div className="chart-canvas-wrapper">
          {Object.entries(timeBlockCounts).map(([label, count]) => {
            const heightPct = (count / maxTimeBlockCount) * 75; // max height 75% for labels/tooltips
            const shortLabel = label.split(' ')[0]; // Night, Morning, etc.
            return (
              <div key={label} className="chart-bar-container">
                <div 
                  className="chart-bar-fill" 
                  style={{ height: `${Math.max(heightPct, 5)}%` }}
                >
                  <div className="chart-bar-tooltip">{count}</div>
                </div>
                <span className="chart-label">{shortLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="glass-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-title-section">
          <div className="card-title">
            <TrendingUp size={18} />
            <span>Key Performance Metrics & Security Health</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resolution Rate</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--accent-green)', marginTop: '0.2rem' }}>{resolutionRate}%</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Resolved incidents vs total logs</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Threat Ratio</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--accent-red)', marginTop: '0.2rem' }}>
              {totalIncidents > 0 ? ((highSeverityCount / totalIncidents) * 100).toFixed(0) : 0}%
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Percentage of high severity cases</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Dispatch Time</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>2.4 min</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Mean dispatch notification lag</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Nodes</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>4 / 4</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Connected camera nodes online</div>
          </div>
        </div>
      </div>
    </div>
  );
}
