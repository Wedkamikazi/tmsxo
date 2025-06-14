/**
 * PERFORMANCE MANAGER - PRODUCTION OPTIMIZATION
 * Handles memory management, caching, and performance monitoring
 * Critical for preventing memory leaks and ensuring smooth operation
 */

interface PerformanceMetrics {
  memoryUsage: number;
  cacheSize: number;
  operationCount: number;
  averageResponseTime: number;
  errorCount: number;
  lastCleanup: Date;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

interface MemoryStats {
  used: number;
  total: number;
  percentage: number;
  jsHeapSizeLimit?: number;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
}

class PerformanceManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private metrics: PerformanceMetrics;
  private operationTimes: number[] = [];
  private readonly CACHE_MAX_SIZE = 100;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MEMORY_CLEANUP_THRESHOLD = 0.8; // 80% memory usage
  private readonly MAX_OPERATION_TIMES = 100;

  constructor() {
    this.metrics = {
      memoryUsage: 0,
      cacheSize: 0,
      operationCount: 0,
      averageResponseTime: 0,
      errorCount: 0,
      lastCleanup: new Date()
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    // Monitor memory usage
    this.startMemoryMonitoring();
  }

  /**
   * CACHE MANAGEMENT
   */
  public setCache<T>(key: string, data: T): void {
    // Check if cache is at max size
    if (this.cache.size >= this.CACHE_MAX_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.updateMetrics();
  }

  public getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data as T;
  }

  public clearCache(): void {
    this.cache.clear();
    this.updateMetrics();
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * PERFORMANCE TRACKING
   */
  public startOperation(): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordOperationTime(duration);
      this.metrics.operationCount++;
    };
  }

  private recordOperationTime(duration: number): void {
    this.operationTimes.push(duration);
    
    // Keep only recent operation times
    if (this.operationTimes.length > this.MAX_OPERATION_TIMES) {
      this.operationTimes.shift();
    }
    
    // Update average response time
    this.metrics.averageResponseTime = 
      this.operationTimes.reduce((sum, time) => sum + time, 0) / this.operationTimes.length;
  }

  public recordError(): void {
    this.metrics.errorCount++;
  }

  /**
   * MEMORY MANAGEMENT
   */
  public getMemoryStats(): MemoryStats {
    const stats: MemoryStats = {
      used: 0,
      total: 0,
      percentage: 0
    };

    // Check if performance.memory is available (Chrome/Edge)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      stats.jsHeapSizeLimit = memory.jsHeapSizeLimit;
      stats.usedJSHeapSize = memory.usedJSHeapSize;
      stats.totalJSHeapSize = memory.totalJSHeapSize;
      
      stats.used = memory.usedJSHeapSize;
      stats.total = memory.jsHeapSizeLimit;
      stats.percentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    } else {
      // Fallback for other browsers - estimate based on cache size
      const cacheMemoryEstimate = this.cache.size * 1000; // Rough estimate
      stats.used = cacheMemoryEstimate;
      stats.total = 50 * 1024 * 1024; // 50MB estimate
      stats.percentage = (cacheMemoryEstimate / stats.total) * 100;
    }

    this.metrics.memoryUsage = stats.percentage;
    return stats;
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const memoryStats = this.getMemoryStats();
      
      // If memory usage is high, perform cleanup
      if (memoryStats.percentage > this.MEMORY_CLEANUP_THRESHOLD * 100) {
        this.performMemoryCleanup();
      }
    }, 30000); // Check every 30 seconds
  }

  private performMemoryCleanup(): void {
    console.log('Performing memory cleanup...');
    
    // Clear expired cache entries
    this.cleanupExpiredCache();
    
    // Limit operation times array
    if (this.operationTimes.length > this.MAX_OPERATION_TIMES / 2) {
      this.operationTimes = this.operationTimes.slice(-this.MAX_OPERATION_TIMES / 2);
    }
    
    // Clear old localStorage entries if possible
    this.cleanupOldStorageEntries();
    
    // Force garbage collection if available
    if ('gc' in window) {
      try {
        (window as any).gc();
      } catch (error) {
        console.warn('Manual garbage collection not available');
      }
    }
    
    this.metrics.lastCleanup = new Date();
    console.log('Memory cleanup completed');
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private cleanupOldStorageEntries(): void {
    try {
      const keys = Object.keys(localStorage);
      const tmsKeys = keys.filter(key => key.startsWith('tms_'));
      
      // Sort by key (which includes timestamps in some cases)
      tmsKeys.sort();
      
      // If we have too many keys, remove the oldest ones
      if (tmsKeys.length > 1000) {
        const keysToRemove = tmsKeys.slice(0, tmsKeys.length - 800);
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.warn(`Failed to remove old storage key: ${key}`);
          }
        });
        console.log(`Cleaned up ${keysToRemove.length} old storage entries`);
      }
    } catch (error) {
      console.warn('Failed to cleanup old storage entries:', error);
    }
  }

  private startPeriodicCleanup(): void {
    // Cleanup every 5 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000);
    
    // Full cleanup every hour
    setInterval(() => {
      this.performMemoryCleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * METRICS AND REPORTING
   */
  public getMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    this.metrics.cacheSize = this.cache.size;
    this.getMemoryStats(); // Updates memory usage
  }

  public getPerformanceReport(): {
    metrics: PerformanceMetrics;
    memoryStats: MemoryStats;
    cacheHitRate: number;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const memoryStats = this.getMemoryStats();
    
    // Calculate cache hit rate (simplified)
    const cacheHitRate = this.cache.size > 0 ? 
      Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0) / this.cache.size : 0;
    
    const recommendations: string[] = [];
    
    if (memoryStats.percentage > 70) {
      recommendations.push('High memory usage detected - consider clearing cache or reducing data volume');
    }
    
    if (metrics.averageResponseTime > 1000) {
      recommendations.push('Slow response times detected - consider optimizing operations');
    }
    
    if (metrics.errorCount > 10) {
      recommendations.push('High error count - check for recurring issues');
    }
    
    if (this.cache.size > this.CACHE_MAX_SIZE * 0.8) {
      recommendations.push('Cache is nearly full - consider increasing cache size or TTL');
    }
    
    return {
      metrics,
      memoryStats,
      cacheHitRate,
      recommendations
    };
  }

  /**
   * BATCH PROCESSING OPTIMIZATION
   */
  public batchProcess<T, R>(
    items: T[], 
    processor: (item: T) => R, 
    batchSize: number = 50
  ): Promise<R[]> {
    return new Promise((resolve) => {
      const results: R[] = [];
      let currentIndex = 0;
      
      const processBatch = () => {
        const endIndex = Math.min(currentIndex + batchSize, items.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
          results.push(processor(items[i]));
        }
        
        currentIndex = endIndex;
        
        if (currentIndex < items.length) {
          // Use setTimeout to prevent blocking the UI
          setTimeout(processBatch, 0);
        } else {
          resolve(results);
        }
      };
      
      processBatch();
    });
  }

  /**
   * DEBOUNCE UTILITY
   */
  public debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
      }, wait);
    };
  }

  /**
   * CLEANUP
   */
  public destroy(): void {
    this.cache.clear();
    this.operationTimes = [];
  }
}

// Singleton instance
export const performanceManager = new PerformanceManager();

// Export types for use in other files
export type { PerformanceMetrics, MemoryStats }; 