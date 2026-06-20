import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import ConnectionStatus from '../components/ConnectionStatus';
import { formatWaitTime, formatWaitRange } from '../utils/formatTime';

// Animated flip digit component
function FlipDigit({ digit, delay = 0 }) {
  const [displayDigit, setDisplayDigit] = useState(digit);
  const [flipping, setFlipping] = useState(false);
  const prevDigit = useRef(digit);

  useEffect(() => {
    if (digit !== prevDigit.current) {
      setFlipping(true);
      setTimeout(() => {
        setDisplayDigit(digit);
        setTimeout(() => setFlipping(false), 300);
      }, 300);
      prevDigit.current = digit;
    }
  }, [digit]);

  return (
    <span 
      className={`flip-digit ${flipping ? 'flip-digit--flipping' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {displayDigit}
    </span>
  );
}

// Animated token number that flips each digit
function AnimatedTokenNumber({ number }) {
  if (number == null) return <span className="token-number-empty">—</span>;
  
  const digits = String(number).split('');
  
  return (
    <div className="animated-token-number">
      {digits.map((d, i) => (
        <FlipDigit key={`${i}-${d}`} digit={d} delay={i * 100} />
      ))}
    </div>
  );
}

// Floating particle effect
function ParticleField() {
  return (
    <div className="particle-field">
      {Array.from({ length: 20 }, (_, i) => (
        <div 
          key={i} 
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            opacity: 0.1 + Math.random() * 0.3,
          }}
        />
      ))}
    </div>
  );
}

// Live clock
function LiveClock() {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="live-clock">
      {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
    </span>
  );
}

export default function PatientWaitingRoom() {
  const { isConnected, connectionStatus, queueState, lastEvent } = useSocket();
  const { currentToken, queue, stats } = queueState;
  const [showFlash, setShowFlash] = useState(false);
  const [bellRing, setBellRing] = useState(false);
  const prevTokenRef = useRef(null);

  // Play notification sound using Web Audio API
  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // First tone (higher)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 830;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Second tone (even higher, slight delay)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      gain2.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.7);

      // Third tone (highest, nice ding)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.value = 1320;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0, ctx.currentTime + 0.35);
      gain3.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.4);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc3.start(ctx.currentTime + 0.35);
      osc3.stop(ctx.currentTime + 1.2);
    } catch (e) {
      // Audio not supported
    }
  };

  // Detect token change → trigger dramatic animations
  useEffect(() => {
    if (currentToken && prevTokenRef.current !== currentToken.token) {
      // Flash effect
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 800);
      
      // Bell ring animation
      setBellRing(true);
      setTimeout(() => setBellRing(false), 1500);
      
      // Sound
      playNotificationSound();
      
      prevTokenRef.current = currentToken.token;
    }
  }, [currentToken?.token]);

  return (
    <div className="patient-display">
      <ParticleField />
      
      {/* Flash overlay on token change */}
      {showFlash && <div className="token-flash-overlay" />}
      
      {/* Ambient background */}
      <div className="patient-display__bg" />

      {/* Header bar */}
      <header className="pd-header">
        <div className="pd-header__left">
          <div className="pd-header__logo">
            <span className="pd-header__logo-icon">🏥</span>
            <div>
              <div className="pd-header__title">Queue Cure</div>
              <div className="pd-header__subtitle">Patient Waiting Room</div>
            </div>
          </div>
        </div>
        <div className="pd-header__right">
          <LiveClock />
          <ConnectionStatus status={connectionStatus} />
        </div>
      </header>

      {/* Main content */}
      <main className="pd-main">
        {/* Current token section */}
        <section className="pd-current">
          <div className={`pd-current__bell ${bellRing ? 'pd-current__bell--ring' : ''}`}>
            🔔
          </div>
          <div className="pd-current__label">
            {currentToken ? 'NOW SERVING' : 'WAITING FOR NEXT PATIENT'}
          </div>

          {currentToken ? (
            <div className="pd-current__token-area" key={currentToken.token}>
              <div className="pd-current__token-glow" />
              <AnimatedTokenNumber number={currentToken.token} />
              <div className="pd-current__patient-name">
                {currentToken.name}
              </div>
            </div>
          ) : (
            <div className="pd-current__empty">
              <div className="pd-current__empty-icon">🪑</div>
              <div className="pd-current__empty-text">
                No patient being served
              </div>
            </div>
          )}
        </section>

        {/* Stats cards */}
        <section className="pd-stats">
          <div className="pd-stat-card">
            <div className="pd-stat-card__icon">👥</div>
            <div className="pd-stat-card__value">{stats.totalInQueue}</div>
            <div className="pd-stat-card__label">Waiting</div>
          </div>
          <div className="pd-stat-card pd-stat-card--accent">
            <div className="pd-stat-card__icon">⏱️</div>
            <div className="pd-stat-card__value">
              {stats.emaConsultationTime 
                ? `${Math.round(stats.emaConsultationTime / 60)}m`
                : stats.avgConsultationTime
                  ? `${Math.round(stats.avgConsultationTime / 60)}m`
                  : '--'
              }
            </div>
            <div className="pd-stat-card__label">Avg Consult</div>
          </div>
          <div className="pd-stat-card">
            <div className="pd-stat-card__icon">✅</div>
            <div className="pd-stat-card__value">{stats.completedToday}</div>
            <div className="pd-stat-card__label">Seen Today</div>
          </div>
        </section>

        {/* Queue preview */}
        {queue.length > 0 && (
          <section className="pd-queue-section">
            <div className="pd-queue-section__title">
              <span>📋 Up Next</span>
              <span className="pd-queue-section__count">{queue.length} waiting</span>
            </div>
            <div className="pd-queue-list">
              {queue.slice(0, 12).map((patient, index) => (
                <div
                  key={patient.token}
                  className={`pd-queue-item ${index === 0 ? 'pd-queue-item--next' : ''}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="pd-queue-item__rank">
                    {index === 0 ? '→' : index + 1}
                  </div>
                  <div className="pd-queue-item__token">#{patient.token}</div>
                  <div className="pd-queue-item__name">{patient.name}</div>
                  <div className="pd-queue-item__wait">
                    {patient.estimatedWait && patient.estimatedWait.source === 'real_data'
                      ? formatWaitRange(patient.estimatedWait.confidenceLow, patient.estimatedWait.confidenceHigh)
                      : patient.estimatedWait
                        ? `~${formatWaitTime(patient.estimatedWait.estimatedSeconds)}`
                        : '--'
                    }
                  </div>
                </div>
              ))}
              {queue.length > 12 && (
                <div className="pd-queue-item pd-queue-item--more">
                  +{queue.length - 12} more patients waiting
                </div>
              )}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!currentToken && queue.length === 0 && (
          <section className="pd-empty-full">
            <div className="pd-empty-full__pulse" />
            <div className="pd-empty-full__icon">🏥</div>
            <div className="pd-empty-full__text">No patients in queue</div>
            <div className="pd-empty-full__subtext">
              Patients will appear here as they check in at the reception
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="pd-footer">
        <span>Queue Cure '26 — Real-time Clinic Queue Management</span>
        <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </footer>
    </div>
  );
}
