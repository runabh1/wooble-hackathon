const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'queue_cure.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      added_at TEXT NOT NULL,
      called_at TEXT,
      completed_at TEXT,
      duration_seconds REAL,
      status TEXT NOT NULL DEFAULT 'waiting'
    );

    CREATE INDEX IF NOT EXISTS idx_consultations_date 
    ON consultations(date);

    CREATE INDEX IF NOT EXISTS idx_consultations_status 
    ON consultations(status);
  `);
}

/**
 * Record a new patient being added to the queue
 */
function addConsultationRecord(tokenNumber, patientName) {
  const stmt = db.prepare(`
    INSERT INTO consultations (token_number, patient_name, added_at)
    VALUES (?, ?, datetime('now', 'localtime'))
  `);
  return stmt.run(tokenNumber, patientName);
}

/**
 * Mark a consultation as started (patient called)
 */
function markConsultationStarted(tokenNumber, date) {
  const stmt = db.prepare(`
    UPDATE consultations 
    SET called_at = datetime('now', 'localtime'), status = 'in_progress'
    WHERE token_number = ? AND date = ? AND status = 'waiting'
  `);
  return stmt.run(tokenNumber, date || new Date().toISOString().split('T')[0]);
}

/**
 * Mark a consultation as completed and record duration
 */
function markConsultationCompleted(tokenNumber, date) {
  const today = date || new Date().toISOString().split('T')[0];
  
  // First get the called_at time
  const row = db.prepare(`
    SELECT called_at FROM consultations 
    WHERE token_number = ? AND date = ? AND status = 'in_progress'
  `).get(tokenNumber, today);

  if (!row || !row.called_at) return null;

  const stmt = db.prepare(`
    UPDATE consultations 
    SET completed_at = datetime('now', 'localtime'), 
        status = 'completed',
        duration_seconds = (julianday(datetime('now', 'localtime')) - julianday(called_at)) * 86400
    WHERE token_number = ? AND date = ? AND status = 'in_progress'
  `);
  return stmt.run(tokenNumber, today);
}

/**
 * Mark a consultation as skipped
 */
function markConsultationSkipped(tokenNumber, date) {
  const today = date || new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
    UPDATE consultations 
    SET status = 'skipped'
    WHERE token_number = ? AND date = ? AND (status = 'waiting' OR status = 'in_progress')
  `);
  return stmt.run(tokenNumber, today);
}

/**
 * Get completed consultation durations for today (for wait time calculation)
 */
function getTodayCompletedDurations() {
  const today = new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
    SELECT duration_seconds FROM consultations 
    WHERE date = ? AND status = 'completed' AND duration_seconds IS NOT NULL
    ORDER BY completed_at ASC
  `);
  return stmt.all(today).map(r => r.duration_seconds);
}

/**
 * Get recent consultation durations (last N days) for bootstrapping EMA
 */
function getRecentDurations(days = 7) {
  const stmt = db.prepare(`
    SELECT duration_seconds FROM consultations 
    WHERE date >= date('now', 'localtime', ?) 
      AND status = 'completed' 
      AND duration_seconds IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT 100
  `);
  return stmt.all(`-${days} days`).map(r => r.duration_seconds);
}

/**
 * Get today's stats
 */
function getTodayStats() {
  const today = new Date().toISOString().split('T')[0];
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_patients,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      AVG(CASE WHEN status = 'completed' THEN duration_seconds END) as avg_duration,
      MIN(CASE WHEN status = 'completed' THEN duration_seconds END) as min_duration,
      MAX(CASE WHEN status = 'completed' THEN duration_seconds END) as max_duration
    FROM consultations WHERE date = ?
  `).get(today);
  
  return stats;
}

/**
 * Close the database connection
 */
function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  addConsultationRecord,
  markConsultationStarted,
  markConsultationCompleted,
  markConsultationSkipped,
  getTodayCompletedDurations,
  getRecentDurations,
  getTodayStats,
  closeDb
};
