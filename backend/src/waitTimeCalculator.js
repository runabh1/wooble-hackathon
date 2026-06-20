const db = require('./db');

/**
 * Wait Time Calculator using Exponential Moving Average (EMA)
 * 
 * Why EMA over simple average?
 * - Gives more weight to recent consultations
 * - Adapts quickly if doctor speeds up or slows down
 * - More accurate prediction than simple mean
 * 
 * EMA formula: EMA_new = α × current_value + (1 - α) × EMA_previous
 * where α (alpha) = 2 / (N + 1), N = number of periods to consider
 */

const DEFAULT_CONSULTATION_TIME = 300; // 5 minutes default fallback (in seconds)
const EMA_PERIODS = 5; // Consider last 5 consultations most heavily
const ALPHA = 2 / (EMA_PERIODS + 1); // ~0.333 smoothing factor

class WaitTimeCalculator {
  constructor() {
    this.emaValue = null;
    this.durations = [];
    this.manualAvgTime = null; // Receptionist can set this as override
    this._bootstrapFromHistory();
  }

  /**
   * Bootstrap EMA from historical data on startup
   */
  _bootstrapFromHistory() {
    try {
      const recentDurations = db.getRecentDurations(7);
      if (recentDurations.length > 0) {
        // Process in chronological order (oldest first)
        const sorted = recentDurations.reverse();
        this.emaValue = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          this.emaValue = ALPHA * sorted[i] + (1 - ALPHA) * this.emaValue;
        }
        this.durations = recentDurations.reverse(); // Back to newest-first
      }
    } catch (e) {
      // DB might not be ready yet, that's ok
      console.log('WaitTimeCalculator: No historical data found, using defaults');
    }
  }

  /**
   * Set manual average consultation time (receptionist override)
   * @param {number} seconds - Average consultation time in seconds
   */
  setManualAvgTime(seconds) {
    if (seconds > 0) {
      this.manualAvgTime = seconds;
    } else {
      this.manualAvgTime = null;
    }
  }

  /**
   * Record a completed consultation duration and update EMA
   * @param {number} durationSeconds - How long the consultation took
   */
  recordConsultation(durationSeconds) {
    if (durationSeconds <= 0) return;

    this.durations.unshift(durationSeconds); // Add to front (newest first)
    
    // Keep last 50 durations for stats
    if (this.durations.length > 50) {
      this.durations = this.durations.slice(0, 50);
    }

    // Update EMA
    if (this.emaValue === null) {
      this.emaValue = durationSeconds;
    } else {
      this.emaValue = ALPHA * durationSeconds + (1 - ALPHA) * this.emaValue;
    }
  }

  /**
   * Get the current best estimate for consultation duration
   * Priority: EMA from real data > manual override > default
   */
  getEstimatedConsultationTime() {
    if (this.emaValue !== null && this.durations.length >= 2) {
      return this.emaValue;
    }
    if (this.manualAvgTime !== null) {
      return this.manualAvgTime;
    }
    if (this.emaValue !== null) {
      return this.emaValue;
    }
    return DEFAULT_CONSULTATION_TIME;
  }

  /**
   * Calculate estimated wait time for a patient at a given position
   * @param {number} position - Number of patients ahead (0 = you're next)
   * @returns {object} - { estimatedSeconds, confidenceLow, confidenceHigh, source }
   */
  calculateWaitTime(position) {
    const avgTime = this.getEstimatedConsultationTime();
    const estimatedSeconds = Math.round(position * avgTime);

    // Calculate confidence interval using standard deviation
    let confidenceLow = estimatedSeconds;
    let confidenceHigh = estimatedSeconds;
    let source = 'default';

    if (this.durations.length >= 3) {
      const stdDev = this._calculateStdDev(this.durations.slice(0, 10));
      const margin = stdDev * position * 0.8; // 80% confidence
      confidenceLow = Math.max(0, Math.round(estimatedSeconds - margin));
      confidenceHigh = Math.round(estimatedSeconds + margin);
      source = 'real_data';
    } else if (this.durations.length >= 1) {
      // Limited data, wider confidence
      confidenceLow = Math.round(estimatedSeconds * 0.6);
      confidenceHigh = Math.round(estimatedSeconds * 1.5);
      source = 'limited_data';
    } else if (this.manualAvgTime !== null) {
      confidenceLow = Math.round(estimatedSeconds * 0.7);
      confidenceHigh = Math.round(estimatedSeconds * 1.3);
      source = 'manual';
    }

    return {
      estimatedSeconds,
      confidenceLow,
      confidenceHigh,
      source,
      basedOnConsultations: this.durations.length,
      currentEMA: this.emaValue ? Math.round(this.emaValue) : null
    };
  }

  /**
   * Calculate standard deviation
   */
  _calculateStdDev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Get statistics about consultation times
   */
  getStats() {
    const todayDurations = this.durations;
    
    if (todayDurations.length === 0) {
      return {
        averageTime: this.manualAvgTime || DEFAULT_CONSULTATION_TIME,
        emaTime: null,
        minTime: null,
        maxTime: null,
        totalConsultations: 0,
        source: this.manualAvgTime ? 'manual' : 'default'
      };
    }

    const sum = todayDurations.reduce((a, b) => a + b, 0);
    
    return {
      averageTime: Math.round(sum / todayDurations.length),
      emaTime: this.emaValue ? Math.round(this.emaValue) : null,
      minTime: Math.round(Math.min(...todayDurations)),
      maxTime: Math.round(Math.max(...todayDurations)),
      totalConsultations: todayDurations.length,
      source: 'real_data'
    };
  }

  /**
   * Reset calculator (e.g., for a new day)
   */
  reset() {
    this.emaValue = null;
    this.durations = [];
    this._bootstrapFromHistory();
  }
}

module.exports = WaitTimeCalculator;
