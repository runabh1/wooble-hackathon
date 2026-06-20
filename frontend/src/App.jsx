import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import PatientWaitingRoom from './pages/PatientWaitingRoom';
import './index.css';

function HomePage() {
  return (
    <div className="page-container" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '700px' }}>
        <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)' }}>🏥</div>
        <h1 style={{ 
          fontSize: '3rem', 
          fontWeight: 900,
          marginBottom: 'var(--space-sm)',
          lineHeight: 1.1
        }}>
          <span className="text-gradient">Queue Cure</span>
        </h1>
        <p style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '1.125rem',
          marginBottom: 'var(--space-3xl)',
          maxWidth: '500px',
          margin: '0 auto var(--space-3xl)'
        }}>
          Real-time clinic queue management. No more paper tokens, 
          no more shouting. Just seamless, live queue tracking.
        </p>

        <div className="nav-bar">
          <Link to="/receptionist" className="nav-card" id="nav-receptionist">
            <div className="nav-card__icon">👩‍⚕️</div>
            <div className="nav-card__title">Receptionist</div>
            <div className="nav-card__description">
              Manage patients, call tokens, track consultations
            </div>
          </Link>

          <Link to="/display" className="nav-card" id="nav-display">
            <div className="nav-card__icon">📺</div>
            <div className="nav-card__title">Patient Display</div>
            <div className="nav-card__description">
              Waiting room screen showing current token & queue
            </div>
          </Link>
        </div>

        <div style={{ 
          marginTop: 'var(--space-2xl)', 
          fontSize: '0.8125rem',
          color: 'var(--text-muted)'
        }}>
          💡 Tip: Open both screens in separate windows for the full experience
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/receptionist" element={<ReceptionistDashboard />} />
        <Route path="/display" element={<PatientWaitingRoom />} />
      </Routes>
    </BrowserRouter>
  );
}
