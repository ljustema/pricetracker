import { debugLog } from './debug-logger';

// Memory thresholds in MB
const MEMORY_WARNING_THRESHOLD = 800;
const MEMORY_CRITICAL_THRESHOLD = 1200;
const MEMORY_RESTART_THRESHOLD = 1400;

// Track memory usage over time
let memoryHistory: number[] = [];
const MEMORY_HISTORY_SIZE = 10;

// Track restart attempts
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;

export interface MemoryStats {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

/**
 * Get current memory usage in MB
 */
export function getMemoryStats(): MemoryStats {
  const memUsage = process.memoryUsage();
  return {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };
}

/**
 * Log memory usage with context
 */
export function logMemoryUsage(context: string): MemoryStats {
  const stats = getMemoryStats();
  console.log(`[MEMORY] ${context}: RSS=${stats.rss}MB, Heap=${stats.heapUsed}/${stats.heapTotal}MB, External=${stats.external}MB`);

  // Add to history
  memoryHistory.push(stats.rss);
  if (memoryHistory.length > MEMORY_HISTORY_SIZE) {
    memoryHistory.shift();
  }

  // Check thresholds
  if (stats.rss > MEMORY_RESTART_THRESHOLD) {
    console.error(`[MEMORY CRITICAL] Memory usage ${stats.rss}MB exceeds restart threshold ${MEMORY_RESTART_THRESHOLD}MB`);
    handleCriticalMemory();
  } else if (stats.rss > MEMORY_CRITICAL_THRESHOLD) {
    console.warn(`[MEMORY CRITICAL] High memory usage detected: ${stats.rss}MB RSS (threshold: ${MEMORY_CRITICAL_THRESHOLD}MB)`);
  } else if (stats.rss > MEMORY_WARNING_THRESHOLD) {
    console.warn(`[MEMORY WARNING] High memory usage detected: ${stats.rss}MB RSS (threshold: ${MEMORY_WARNING_THRESHOLD}MB)`);
  }

  return stats;
}

/**
 * Force garbage collection and memory cleanup
 */
export function forceMemoryCleanup(context: string): MemoryStats {
  debugLog(`Forcing memory cleanup: ${context}`);

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    debugLog('Garbage collection triggered');
  }

  // Log memory usage after cleanup
  const stats = logMemoryUsage(`After cleanup - ${context}`);
  
  return stats;
}

/**
 * Check if memory usage is trending upward
 */
export function isMemoryTrendingUp(): boolean {
  if (memoryHistory.length < 3) return false;
  
  const recent = memoryHistory.slice(-3);
  return recent[2] > recent[1] && recent[1] > recent[0];
}

/**
 * Get average memory usage from history
 */
export function getAverageMemoryUsage(): number {
  if (memoryHistory.length === 0) return 0;
  return memoryHistory.reduce((sum, mem) => sum + mem, 0) / memoryHistory.length;
}

/**
 * Handle critical memory situations
 */
function handleCriticalMemory(): void {
  debugLog(`Critical memory situation detected. Restart attempts: ${restartAttempts}/${MAX_RESTART_ATTEMPTS}`);
  
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error('[MEMORY CRITICAL] Maximum restart attempts reached. Worker will continue but may be unstable.');
    return;
  }

  restartAttempts++;
  
  // Force aggressive cleanup
  forceMemoryCleanup('Critical memory cleanup');
  
  // If memory is still critical after cleanup, consider process restart
  const statsAfterCleanup = getMemoryStats();
  if (statsAfterCleanup.rss > MEMORY_RESTART_THRESHOLD) {
    console.error('[MEMORY CRITICAL] Memory still critical after cleanup. Process restart recommended.');
    
    // In a production environment, you might want to:
    // 1. Gracefully finish current job
    // 2. Exit process to let process manager restart it
    // 3. Or implement a more sophisticated restart mechanism
    
    // For now, we'll just log the recommendation
    debugLog('Consider implementing process restart mechanism for critical memory situations');
  }
}

/**
 * Reset restart attempts counter (call after successful memory cleanup)
 */
export function resetRestartAttempts(): void {
  restartAttempts = 0;
}

/**
 * Check if worker should restart due to memory issues
 */
export function shouldRestart(): boolean {
  const stats = getMemoryStats();
  const avgMemory = getAverageMemoryUsage();
  
  // Restart if:
  // 1. Current memory exceeds restart threshold
  // 2. Average memory is consistently high and trending up
  return stats.rss > MEMORY_RESTART_THRESHOLD || 
         (avgMemory > MEMORY_CRITICAL_THRESHOLD && isMemoryTrendingUp());
}

/**
 * Get memory status summary
 */
export function getMemoryStatus(): {
  current: MemoryStats;
  average: number;
  trending: 'up' | 'down' | 'stable';
  status: 'normal' | 'warning' | 'critical' | 'restart';
} {
  const current = getMemoryStats();
  const average = getAverageMemoryUsage();
  
  let trending: 'up' | 'down' | 'stable' = 'stable';
  if (memoryHistory.length >= 3) {
    const recent = memoryHistory.slice(-3);
    if (recent[2] > recent[1] && recent[1] > recent[0]) {
      trending = 'up';
    } else if (recent[2] < recent[1] && recent[1] < recent[0]) {
      trending = 'down';
    }
  }
  
  let status: 'normal' | 'warning' | 'critical' | 'restart' = 'normal';
  if (current.rss > MEMORY_RESTART_THRESHOLD) {
    status = 'restart';
  } else if (current.rss > MEMORY_CRITICAL_THRESHOLD) {
    status = 'critical';
  } else if (current.rss > MEMORY_WARNING_THRESHOLD) {
    status = 'warning';
  }
  
  return {
    current,
    average,
    trending,
    status
  };
}
