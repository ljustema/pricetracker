"use client";

import { useEffect } from 'react';
import { databaseWarmupService } from '@/lib/services/database-warmup-service';

/**
 * Database Warmup Provider Component
 * Automatically starts database warmup when the app loads
 * Only runs on client-side for authenticated users
 */
export default function DatabaseWarmupProvider() {
  useEffect(() => {
    // Only start warmup in production or if explicitly enabled
    const shouldStartWarmup = process.env.NODE_ENV === 'production' || 
                             process.env.NEXT_PUBLIC_ENABLE_DB_WARMUP === 'true';
    
    if (shouldStartWarmup) {
      console.log('🔥 Starting database warmup service...');
      
      // Start warmup every 8 minutes (slightly less than 10 to be safe)
      databaseWarmupService.startPeriodicWarmup(8);
      
      // Cleanup on unmount
      return () => {
        console.log('🔥 Stopping database warmup service...');
        databaseWarmupService.stopPeriodicWarmup();
      };
    } else {
      console.log('🔥 Database warmup disabled (development mode)');
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}
