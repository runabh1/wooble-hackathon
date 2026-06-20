import { formatWaitTime } from '../utils/formatTime';

export default function StatsPanel({ stats }) {
  const avgTimeMinutes = stats.emaConsultationTime 
    ? (stats.emaConsultationTime / 60).toFixed(1) 
    : stats.avgConsultationTime 
      ? (stats.avgConsultationTime / 60).toFixed(1) 
      : '--';

  const source = stats.waitTimeSource === 'real_data' 
    ? '📊 From real data' 
    : stats.waitTimeSource === 'manual' 
      ? '✏️ Manual' 
      : '⚙️ Default';

  return (
    <div>
      <div className="section-header">
        <span className="section-header__title">📈 Today's Stats</span>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__value">{stats.totalInQueue}</div>
          <div className="stat-card__label">In Queue</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.completedToday}</div>
          <div className="stat-card__label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{avgTimeMinutes}m</div>
          <div className="stat-card__label">Avg Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.totalConsultationsRecorded}</div>
          <div className="stat-card__label">Recorded</div>
        </div>
      </div>
      <div style={{ 
        marginTop: 'var(--space-sm)', 
        fontSize: '0.75rem', 
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)'
      }}>
        {source}
        {stats.totalConsultationsRecorded > 0 && stats.minConsultationTime && (
          <span style={{ marginLeft: 'auto' }}>
            Range: {formatWaitTime(stats.minConsultationTime)} – {formatWaitTime(stats.maxConsultationTime)}
          </span>
        )}
      </div>
    </div>
  );
}
