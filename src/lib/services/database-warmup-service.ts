/**
 * Database Warmup Service
 * Helps prevent cold start timeouts by keeping the database connection active
 */

class DatabaseWarmupService {
  private warmupInterval: NodeJS.Timeout | null = null;
  private isWarming = false;
  
  /**
   * Start periodic warmup calls to prevent database cold starts
   * @param intervalMinutes How often to warm up (default: 10 minutes)
   */
  startPeriodicWarmup(intervalMinutes: number = 10) {
    if (this.warmupInterval) {
      this.stopPeriodicWarmup();
    }
    
    console.log(`Starting database warmup every ${intervalMinutes} minutes`);
    
    // Initial warmup
    this.warmupDatabase();
    
    // Set up periodic warmup
    this.warmupInterval = setInterval(() => {
      this.warmupDatabase();
    }, intervalMinutes * 60 * 1000);
  }
  
  /**
   * Stop periodic warmup
   */
  stopPeriodicWarmup() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
      console.log('Database warmup stopped');
    }
  }
  
  /**
   * Perform a single warmup call
   */
  async warmupDatabase(): Promise<boolean> {
    if (this.isWarming) {
      console.log('Warmup already in progress, skipping');
      return false;
    }
    
    this.isWarming = true;
    
    try {
      console.log('Warming up database...');
      
      const response = await fetch('/api/health/warmup', {
        method: 'GET',
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Database warmup successful:', data.timestamp);
        return true;
      } else {
        console.warn('Database warmup failed:', response.status, response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Database warmup error:', error);
      return false;
    } finally {
      this.isWarming = false;
    }
  }
  
  /**
   * Check if warmup is currently running
   */
  isWarmupActive(): boolean {
    return this.warmupInterval !== null;
  }
}

// Export singleton instance
export const databaseWarmupService = new DatabaseWarmupService();

/**
 * Hook for React components to use warmup service
 */
export function useDatabaseWarmup(autoStart: boolean = false, intervalMinutes: number = 10) {
  const startWarmup = () => databaseWarmupService.startPeriodicWarmup(intervalMinutes);
  const stopWarmup = () => databaseWarmupService.stopPeriodicWarmup();
  const warmupOnce = () => databaseWarmupService.warmupDatabase();
  const isActive = databaseWarmupService.isWarmupActive();
  
  // Auto-start if requested
  if (autoStart && !isActive) {
    startWarmup();
  }
  
  return {
    startWarmup,
    stopWarmup,
    warmupOnce,
    isActive
  };
}
