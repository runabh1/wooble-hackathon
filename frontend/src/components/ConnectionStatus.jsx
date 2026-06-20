import { useState, useRef, useEffect } from 'react';

export default function ConnectionStatus({ status }) {
  const dotClass = status === 'connected' 
    ? 'connection-dot--connected' 
    : status === 'reconnecting' 
      ? 'connection-dot--connecting' 
      : 'connection-dot--disconnected';

  const label = status === 'connected' 
    ? 'Live' 
    : status === 'reconnecting' 
      ? 'Reconnecting...' 
      : 'Offline';

  return (
    <div className="connection-indicator">
      <span className={`connection-dot ${dotClass}`}></span>
      <span style={{ color: status === 'connected' ? 'var(--color-success)' : status === 'reconnecting' ? 'var(--color-warning)' : 'var(--color-danger)' }}>
        {label}
      </span>
    </div>
  );
}
