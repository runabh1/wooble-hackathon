import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';
import ConnectionStatus from '../components/ConnectionStatus';
import AddPatientForm from '../components/AddPatientForm';
import QueueList from '../components/QueueList';
import CurrentTokenDisplay from '../components/CurrentTokenDisplay';
import StatsPanel from '../components/StatsPanel';
import { formatWaitTime } from '../utils/formatTime';

export default function ReceptionistDashboard() {
  const {
    isConnected,
    connectionStatus,
    queueState,
    addPatient,
    callNext,
    completeConsultation,
    skipCurrent,
    removePatient,
    undo,
    setAvgTime,
  } = useSocket();

  const [toasts, setToasts] = useState([]);
  const [avgTimeInput, setAvgTimeInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const { currentToken, queue, stats } = queueState;

  // Toast notification system
  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // --- Action Handlers ---
  const handleAddPatient = async (name) => {
    try {
      const entry = await addPatient(name);
      showToast(`Token #${entry.token} — ${entry.name} added`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCallNext = async () => {
    try {
      const patient = await callNext();
      showToast(`Calling Token #${patient.token} — ${patient.name}`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleComplete = async () => {
    try {
      const completed = await completeConsultation();
      const duration = Math.round(completed.durationSeconds);
      showToast(`Token #${completed.token} completed (${formatWaitTime(duration)})`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSkip = async (moveToEnd) => {
    try {
      const skipped = await skipCurrent(moveToEnd);
      showToast(
        moveToEnd 
          ? `Token #${skipped.token} moved to end of queue` 
          : `Token #${skipped.token} skipped`,
        'info'
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemove = (tokenNumber) => {
    setConfirmDialog({
      title: 'Remove Patient',
      message: `Are you sure you want to remove Token #${tokenNumber} from the queue?`,
      onConfirm: async () => {
        try {
          const removed = await removePatient(tokenNumber);
          showToast(`Token #${removed.token} — ${removed.name} removed`, 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleUndo = async () => {
    try {
      const result = await undo();
      showToast(`Undone: ${result.undone} — Token #${result.patient.token}`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSetAvgTime = async () => {
    const minutes = parseFloat(avgTimeInput);
    if (isNaN(minutes) || minutes <= 0) {
      showToast('Please enter a valid time in minutes', 'error');
      return;
    }
    try {
      await setAvgTime(minutes);
      showToast(`Average consultation time set to ${minutes} min`, 'success');
      setAvgTimeInput('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Only Enter in the form
        return;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleCallNext();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueState]); // Re-bind when state changes

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="page-header__logo">
          <div className="page-header__logo-icon">🏥</div>
          <div>
            <div className="page-header__title">Queue Cure</div>
            <div className="page-header__subtitle">Receptionist Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <ConnectionStatus status={connectionStatus} />
          <a 
            href="/display" 
            className="btn btn--ghost"
            style={{ fontSize: '0.8125rem' }}
            target="_blank"
          >
            📺 Open Patient Display →
          </a>
        </div>
      </header>

      {/* Main Content */}
      <div className="receptionist-layout">
        {/* Left - Main Area */}
        <div className="receptionist-main">
          {/* Currently Serving */}
          <CurrentTokenDisplay
            currentToken={currentToken}
            onComplete={handleComplete}
            onSkip={handleSkip}
            avgConsultationTime={stats.emaConsultationTime || stats.avgConsultationTime}
          />

          {/* Call Next Button */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', alignItems: 'center' }}>
            <button
              className={`btn btn--call-next ${queue.length > 0 ? 'pulse' : ''}`}
              onClick={handleCallNext}
              disabled={!isConnected || queue.length === 0}
              id="call-next-btn"
            >
              📢 Call Next Patient
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="kbd">Enter</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'center' }}>shortcut</span>
            </div>
          </div>

          {/* Queue List */}
          <div>
            <div className="section-header">
              <span className="section-header__title">
                📋 Waiting Queue
                <span className="section-header__count">{queue.length}</span>
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                {stats.canUndo && (
                  <button
                    className="btn btn--ghost"
                    onClick={handleUndo}
                    title="Undo last action (Ctrl+Z)"
                    id="undo-btn"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    ↩ Undo <span className="kbd" style={{ marginLeft: '4px' }}>Ctrl+Z</span>
                  </button>
                )}
              </div>
            </div>
            <QueueList queue={queue} onRemove={handleRemove} />
          </div>
        </div>

        {/* Right - Sidebar */}
        <aside className="receptionist-sidebar">
          {/* Add Patient Form */}
          <AddPatientForm 
            onAdd={handleAddPatient} 
            disabled={!isConnected} 
          />

          {/* Stats */}
          <StatsPanel stats={stats} />

          {/* Avg Time Setting */}
          <div>
            <div className="section-header">
              <span className="section-header__title">⏱️ Avg Consultation Time</span>
            </div>
            <div className="avg-time-setting">
              <input
                type="number"
                className="input"
                placeholder="5"
                value={avgTimeInput}
                onChange={(e) => setAvgTimeInput(e.target.value)}
                min="1"
                max="120"
                step="0.5"
                id="avg-time-input"
              />
              <span className="avg-time-setting__label">min</span>
              <button
                className="btn btn--secondary"
                onClick={handleSetAvgTime}
                disabled={!avgTimeInput}
                id="set-avg-time-btn"
              >
                Set
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
              {stats.waitTimeSource === 'real_data' 
                ? '✅ Using real consultation data for estimates' 
                : stats.waitTimeSource === 'manual'
                  ? '✏️ Using manually set time'
                  : 'ℹ️ Set average time or complete consultations for real data'
              }
            </div>
          </div>

          {/* Keyboard Shortcuts Reference */}
          <div style={{ marginTop: 'auto' }}>
            <div className="section-header">
              <span className="section-header__title" style={{ fontSize: '0.8125rem' }}>⌨️ Shortcuts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Call Next</span>
                <span className="kbd">Enter</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Focus Name Input</span>
                <span className="kbd">Ctrl+N</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Undo</span>
                <span className="kbd">Ctrl+Z</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="dialog-overlay" onClick={confirmDialog.onCancel}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog__title">{confirmDialog.title}</div>
            <div className="dialog__message">{confirmDialog.message}</div>
            <div className="dialog__actions">
              <button className="btn btn--ghost" onClick={confirmDialog.onCancel}>Cancel</button>
              <button className="btn btn--danger" onClick={confirmDialog.onConfirm}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
