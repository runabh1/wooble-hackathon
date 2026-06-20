/**
 * Format seconds into human-readable time string
 * @param {number} seconds
 * @returns {string} e.g., "5 min", "1 hr 20 min", "< 1 min"
 */
export function formatWaitTime(seconds) {
  if (seconds == null || seconds < 0) return '--';
  if (seconds < 60) return '< 1 min';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  return `${minutes} min`;
}

/**
 * Format seconds into short time string
 * @param {number} seconds
 * @returns {string} e.g., "5m", "1h 20m", "<1m"
 */
export function formatWaitTimeShort(seconds) {
  if (seconds == null || seconds < 0) return '--';
  if (seconds < 60) return '<1m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Format a wait time range
 * @param {number} low - Lower bound in seconds
 * @param {number} high - Upper bound in seconds
 * @returns {string} e.g., "5-10 min"
 */
export function formatWaitRange(low, high) {
  if (low == null || high == null) return '--';
  
  const lowMin = Math.max(1, Math.round(low / 60));
  const highMin = Math.max(1, Math.round(high / 60));
  
  if (lowMin === highMin) return `~${lowMin} min`;
  return `${lowMin}–${highMin} min`;
}

/**
 * Format elapsed time since a given timestamp
 * @param {string} isoTimestamp
 * @returns {string} e.g., "2:35"
 */
export function formatElapsed(isoTimestamp) {
  if (!isoTimestamp) return '0:00';
  
  const start = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format time of day from ISO timestamp
 * @param {string} isoTimestamp 
 * @returns {string} e.g., "2:30 PM"
 */
export function formatTimeOfDay(isoTimestamp) {
  if (!isoTimestamp) return '';
  
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get a relative time description
 * @param {string} isoTimestamp 
 * @returns {string} e.g., "2 min ago", "just now"
 */
export function getRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);
  
  if (diffSeconds < 30) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}
