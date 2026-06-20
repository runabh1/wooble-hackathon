import { formatWaitTime, formatTimeOfDay } from '../utils/formatTime';

export default function QueueList({ queue, onRemove }) {
  if (queue.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">📋</div>
        <div className="empty-state__title">Queue is empty</div>
        <div className="empty-state__description">
          Add patients using the form above to get started
        </div>
      </div>
    );
  }

  return (
    <div className="queue-list">
      {queue.map((patient, index) => (
        <div
          key={patient.token}
          className="queue-item queue-item-enter"
          style={{ animationDelay: `${index * 50}ms` }}
          id={`queue-item-${patient.token}`}
        >
          <div className="queue-item__token">
            #{patient.token}
          </div>
          <div className="queue-item__info">
            <div className="queue-item__name">{patient.name}</div>
            <div className="queue-item__meta">
              Added {formatTimeOfDay(patient.addedAt)} · Position {patient.position}
            </div>
          </div>
          <div className="queue-item__wait">
            <div className="queue-item__wait-time">
              {patient.estimatedWait 
                ? formatWaitTime(patient.estimatedWait.estimatedSeconds)
                : '--'
              }
            </div>
            <div className="queue-item__wait-label">est. wait</div>
          </div>
          <div className="queue-item__actions">
            <button
              className="btn btn--ghost btn--icon"
              onClick={() => onRemove(patient.token)}
              title="Remove from queue"
              id={`remove-patient-${patient.token}`}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
