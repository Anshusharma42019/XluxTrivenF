import { useEffect } from 'react';

/**
 * A custom hook to automatically poll a fetch function silently in the background.
 * 
 * @param {Function} callback - The fetch function to run. It should accept a boolean `silent` parameter (e.g. `(silent) => { ... }`).
 * @param {number} intervalMs - Polling interval in milliseconds (default 15000).
 * @param {Array} dependencies - React dependencies array to trigger re-binding of the interval.
 */
export function useAutoRefresh(callback, intervalMs = 15000, dependencies = []) {
  useEffect(() => {
    if (typeof callback !== 'function') return;

    const interval = setInterval(() => {
      callback(true); // 'true' means it's a silent background fetch
    }, intervalMs);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, intervalMs, ...dependencies]);
}
