import { useState, useEffect, useRef } from 'react';
import { formatElapsed } from '../utils/formatTime';

// Circular progress timer component
function CircularTimer({ calledAt, avgTime }) {
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState('0:00');
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (!calledAt) return;

    const update = () => {
      const start = new Date(calledAt).getTime();
      const now = Date.now();
      const elapsedSec = (now - start) / 1000;
      const target = avgTime || 300; // default 5 min
      const pct = Math.min(elapsedSec / target, 1.5); // cap at 150%
      setProgress(pct);
      setElapsed(formatElapsed(calledAt));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [calledAt, avgTime]);

  const offset = circumference - Math.min(progress, 1) * circumference;
  const isOvertime = progress > 1;
  const strokeColor = isOvertime ? '#f59e0b' : '#14b8a6';

  return (
    <div className="circular-timer">
      <svg width="110" height="110" viewBox="0 0 110 110">
        {/* Background circle */}
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.1)"
          strokeWidth="6"
        />
        {/* Progress circle */}
        <circle
          cx="55"
          cy="55"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          style={{ 
            transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease',
            filter: `drop-shadow(0 0 6px ${strokeColor}40)`
          }}
        />
        {/* Overtime glow ring */}
        {isOvertime && (
          <circle
            cx="55"
            cy="55"
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            opacity="0.3"
            style={{ animation: 'pulse-ring 2s infinite' }}
          />
        )}
      </svg>
      <div className="circular-timer__time">
        <span className="circular-timer__value">{elapsed}</span>
        <span className="circular-timer__label">
          {isOvertime ? 'overtime' : 'elapsed'}
        </span>
      </div>
    </div>
  );
}

export default function CurrentTokenDisplay({ currentToken, onComplete, onSkip, avgConsultationTime }) {
  if (!currentToken) {
    return (
      <div className="serving-card">
        <div className="serving-card__content">
          <div className="serving-card__label">Currently Serving</div>
          <div style={{ padding: 'var(--space-xl) 0' }}>
            <div className="empty-state__icon">🏥</div>
            <div className="empty-state__title" style={{ color: 'var(--text-muted)' }}>
              No patient being served
            </div>
            <div className="empty-state__description">
              Click "Call Next" to serve the next patient
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="serving-card serving-card--active">
      <div className="serving-card__content">
        <div className="serving-card__label">🔔 Currently Serving</div>
        <div className="serving-card__main">
          <div className="serving-card__left">
            <div className="serving-card__token token-reveal" key={currentToken.token}>
              #{currentToken.token}
            </div>
            <div className="serving-card__name">{currentToken.name}</div>
          </div>
          <CircularTimer 
            calledAt={currentToken.calledAt} 
            avgTime={avgConsultationTime}
          />
        </div>
        <div className="serving-card__actions">
          <button
            className="btn btn--primary btn--lg"
            onClick={onComplete}
            id="complete-consultation-btn"
          >
            ✓ Complete Consultation
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => onSkip(true)}
            title="Move to end of queue"
            id="skip-to-end-btn"
          >
            ↻ Re-queue
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => onSkip(false)}
            title="Skip entirely"
            id="skip-btn"
          >
            ⏭ Skip
          </button>
        </div>
      </div>
    </div>
  );
}
