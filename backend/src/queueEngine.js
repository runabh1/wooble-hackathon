const db = require('./db');
const WaitTimeCalculator = require('./waitTimeCalculator');

/**
 * Queue Engine — Single source of truth for queue state
 * 
 * All queue mutations go through this engine.
 * The server never allows direct client-side state changes.
 * This prevents race conditions and ensures consistency.
 */
class QueueEngine {
  constructor() {
    this.queue = [];           // Patients waiting: [{token, name, addedAt}]
    this.currentToken = null;  // Currently being served: {token, name, calledAt}
    this.nextTokenNumber = 1;  // Next token to assign
    this.completedToday = 0;   // Count of completed consultations today
    this.skippedToday = 0;     // Count of skipped patients today
    this.history = [];         // Recent actions for undo: [{action, data, timestamp}]
    this.waitCalculator = new WaitTimeCalculator();
    this.date = this._getToday();
    
    // Initialize DB
    db.getDb();
  }

  _getToday() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Check if we've crossed midnight and need to reset
   */
  _checkDayRollover() {
    const today = this._getToday();
    if (today !== this.date) {
      this.date = today;
      this.queue = [];
      this.currentToken = null;
      this.nextTokenNumber = 1;
      this.completedToday = 0;
      this.skippedToday = 0;
      this.history = [];
      this.waitCalculator.reset();
    }
  }

  /**
   * Add a patient to the queue
   * @param {string} name - Patient name
   * @returns {object} - The new queue entry
   */
  addPatient(name) {
    this._checkDayRollover();
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Patient name is required');
    }

    const trimmedName = name.trim();
    const token = this.nextTokenNumber++;
    const addedAt = new Date().toISOString();

    const entry = {
      token,
      name: trimmedName,
      addedAt
    };

    this.queue.push(entry);

    // Record in database
    try {
      db.addConsultationRecord(token, trimmedName);
    } catch (e) {
      console.error('Failed to record consultation:', e.message);
    }

    // Save to history for undo
    this._pushHistory('add', { entry, index: this.queue.length - 1 });

    return entry;
  }

  /**
   * Call the next patient in line
   * @returns {object|null} - The called patient or null if queue is empty
   */
  callNext() {
    this._checkDayRollover();

    if (this.queue.length === 0) {
      return null;
    }

    // If someone was being served, auto-complete them
    if (this.currentToken) {
      this._completeCurrentSilently();
    }

    const nextPatient = this.queue.shift();
    const calledAt = new Date().toISOString();

    this.currentToken = {
      ...nextPatient,
      calledAt
    };

    // Update database
    try {
      db.markConsultationStarted(nextPatient.token, this.date);
    } catch (e) {
      console.error('Failed to mark consultation started:', e.message);
    }

    // Save to history for undo
    this._pushHistory('call', { 
      patient: this.currentToken,
      previousCurrent: null // We already completed the previous one
    });

    return this.currentToken;
  }

  /**
   * Complete the current consultation
   */
  completeCurrentConsultation() {
    this._checkDayRollover();

    if (!this.currentToken) {
      return null;
    }

    const completed = { ...this.currentToken };
    const completedAt = new Date().toISOString();
    
    // Calculate duration
    const startTime = new Date(this.currentToken.calledAt).getTime();
    const endTime = new Date(completedAt).getTime();
    const durationSeconds = (endTime - startTime) / 1000;

    // Record in wait time calculator
    if (durationSeconds > 0) {
      this.waitCalculator.recordConsultation(durationSeconds);
    }

    // Update database
    try {
      db.markConsultationCompleted(this.currentToken.token, this.date);
    } catch (e) {
      console.error('Failed to mark consultation completed:', e.message);
    }

    this.completedToday++;
    
    this._pushHistory('complete', { patient: completed, durationSeconds });
    
    this.currentToken = null;

    return { ...completed, durationSeconds, completedAt };
  }

  /**
   * Silently complete current patient (used when calling next while someone is being served)
   */
  _completeCurrentSilently() {
    if (!this.currentToken) return;

    const completedAt = new Date().toISOString();
    const startTime = new Date(this.currentToken.calledAt).getTime();
    const endTime = new Date(completedAt).getTime();
    const durationSeconds = (endTime - startTime) / 1000;

    if (durationSeconds > 0) {
      this.waitCalculator.recordConsultation(durationSeconds);
    }

    try {
      db.markConsultationCompleted(this.currentToken.token, this.date);
    } catch (e) {
      console.error('Failed to mark consultation completed:', e.message);
    }

    this.completedToday++;
    this.currentToken = null;
  }

  /**
   * Skip the current patient (move to end of queue or remove)
   * @param {boolean} moveToEnd - If true, move to end of queue; if false, remove entirely
   */
  skipCurrent(moveToEnd = false) {
    this._checkDayRollover();

    if (!this.currentToken) {
      return null;
    }

    const skipped = { ...this.currentToken };

    if (moveToEnd) {
      // Move back to end of queue
      this.queue.push({
        token: skipped.token,
        name: skipped.name,
        addedAt: skipped.addedAt
      });
    } else {
      // Mark as skipped in DB
      try {
        db.markConsultationSkipped(skipped.token, this.date);
      } catch (e) {
        console.error('Failed to mark consultation skipped:', e.message);
      }
      this.skippedToday++;
    }

    this._pushHistory('skip', { patient: skipped, movedToEnd: moveToEnd });
    
    this.currentToken = null;

    return skipped;
  }

  /**
   * Remove a specific patient from the queue (by token number)
   */
  removeFromQueue(tokenNumber) {
    this._checkDayRollover();

    const index = this.queue.findIndex(p => p.token === tokenNumber);
    if (index === -1) return null;

    const removed = this.queue.splice(index, 1)[0];

    try {
      db.markConsultationSkipped(tokenNumber, this.date);
    } catch (e) {
      console.error('Failed to mark consultation skipped:', e.message);
    }

    this._pushHistory('remove', { patient: removed, index });

    return removed;
  }

  /**
   * Undo the last action
   * @returns {object|null} - Description of what was undone
   */
  undo() {
    if (this.history.length === 0) return null;

    const lastAction = this.history.pop();

    switch (lastAction.action) {
      case 'add': {
        // Undo add = remove from queue
        const idx = this.queue.findIndex(p => p.token === lastAction.data.entry.token);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.nextTokenNumber--;
        }
        return { undone: 'add', patient: lastAction.data.entry };
      }
      case 'call': {
        // Undo call = put patient back at front of queue
        if (this.currentToken) {
          this.queue.unshift({
            token: this.currentToken.token,
            name: this.currentToken.name,
            addedAt: this.currentToken.addedAt
          });
          this.currentToken = null;
        }
        return { undone: 'call', patient: lastAction.data.patient };
      }
      case 'remove': {
        // Undo remove = put back in queue at original position
        const pos = Math.min(lastAction.data.index, this.queue.length);
        this.queue.splice(pos, 0, lastAction.data.patient);
        return { undone: 'remove', patient: lastAction.data.patient };
      }
      default:
        return null;
    }
  }

  /**
   * Set manual average consultation time
   */
  setAvgConsultationTime(minutes) {
    const seconds = minutes * 60;
    this.waitCalculator.setManualAvgTime(seconds);
  }

  /**
   * Get full state (for initial sync or reconnection)
   */
  getFullState() {
    this._checkDayRollover();

    const waitTimeStats = this.waitCalculator.getStats();

    // Calculate wait times for each patient in queue
    const queueWithWaitTimes = this.queue.map((patient, index) => {
      const position = index + 1; // +1 because current patient is being served
      const waitInfo = this.waitCalculator.calculateWaitTime(position);
      return {
        ...patient,
        position: index + 1,
        tokensAhead: index,
        estimatedWait: waitInfo
      };
    });

    return {
      currentToken: this.currentToken,
      queue: queueWithWaitTimes,
      stats: {
        totalInQueue: this.queue.length,
        completedToday: this.completedToday,
        skippedToday: this.skippedToday,
        nextTokenNumber: this.nextTokenNumber,
        avgConsultationTime: waitTimeStats.averageTime,
        emaConsultationTime: waitTimeStats.emaTime,
        minConsultationTime: waitTimeStats.minTime,
        maxConsultationTime: waitTimeStats.maxTime,
        totalConsultationsRecorded: waitTimeStats.totalConsultations,
        waitTimeSource: waitTimeStats.source,
        canUndo: this.history.length > 0,
        date: this.date
      }
    };
  }

  /**
   * Push action to history (max 20 items)
   */
  _pushHistory(action, data) {
    this.history.push({
      action,
      data,
      timestamp: new Date().toISOString()
    });
    if (this.history.length > 20) {
      this.history.shift();
    }
  }
}

module.exports = QueueEngine;
