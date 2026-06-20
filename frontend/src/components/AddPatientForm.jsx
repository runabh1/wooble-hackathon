import { useState, useRef, useEffect } from 'react';

export default function AddPatientForm({ onAdd, disabled }) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onAdd(trimmed);
      setName('');
      // Re-focus input after adding
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    } catch (err) {
      console.error('Failed to add patient:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Global keyboard shortcut: Ctrl+N to focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="add-patient-form">
      <div className="section-header">
        <span className="section-header__title">
          ➕ Add Patient
        </span>
        <span className="kbd" title="Focus: Ctrl+N">Ctrl+N</span>
      </div>
      <div className="input-group">
        <input
          ref={inputRef}
          type="text"
          className="input input--lg"
          placeholder="Enter patient name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled || isSubmitting}
          autoComplete="off"
          id="patient-name-input"
        />
        <button
          type="submit"
          className="btn btn--primary btn--lg"
          disabled={!name.trim() || disabled || isSubmitting}
          id="add-patient-btn"
        >
          {isSubmitting ? '...' : 'Add'}
        </button>
      </div>
    </form>
  );
}
