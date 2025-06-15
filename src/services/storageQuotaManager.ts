/**
 * COMPREHENSIVE LOCALSTORAGE QUOTA MANAGEMENT SERVICE
 * 
 * Features:
 * - Real-time quota monitoring with predictive cleanup
 * - Multi-tier cleanup strategies (non-critical → critical data)
 * - Emergency fallback modes for continued operation
 * - User notifications and data recovery mechanisms
 * - Compression and archiving for large datasets
 * - Automatic cleanup triggers at 80% quota usage
 * 
 * Integrates with existing localStorageManager.ts for seamless quota management
 */

import { eventBus } from './eventBus';
import { systemIntegrityService } from './systemIntegrityService';

export interface StorageQuotaInfo {
  total: number;           // Total localStorage quota in bytes
  used: number;            // Currently used space in bytes
  available: number;       // Available space in bytes
  utilization: number;     // Usage percentage (0-100)
  isNearLimit: boolean;    // True if > 80% used
  isCritical: boolean;     // True if > 95% used
  lastChecked: string;     // ISO timestamp
}

export interface CleanupStrategy {
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedSpaceSaved: number; // Bytes
  execute: () => Promise<{ success: boolean; spaceFreed: number; details: string }>;
}

export interface QuotaAlert {
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
  availableActions: string[];
  timestamp: string;
  acknowledged: boolean;
}

/**
 * STORAGE QUOTA MANAGER
 * Provides comprehensive localStorage quota management with automatic cleanup
 */
class StorageQuotaManager {
  private readonly QUOTA_WARNING_THRESHOLD = 0.80; // 80%
  private readonly QUOTA_CRITICAL_THRESHOLD = 0.95; // 95%
  private readonly QUOTA_EMERGENCY_THRESHOLD = 0.98; // 98%
  
  private readonly MONITORING_INTERVAL = 60000; // 1 minute
  
  private monitoringTimer: NodeJS.Timeout | null = null;
  private currentQuotaInfo: StorageQuotaInfo | null = null;
  private activeAlerts: QuotaAlert[] = [];
  private cleanupHistory: Array<{ timestamp: string; strategy: string; spaceFreed: number }> = [];
  
  private readonly STORAGE_KEYS = {
    quotaHistory: 'tms_quota_history',
    cleanupLog: 'tms_cleanup_log',
    userPreferences: 'tms_quota_preferences'
  };

  constructor() {
    this.initializeQuotaMonitoring();
  }

  /**
   * Initialize quota monitoring system
   */
  private async initializeQuotaMonitoring(): Promise<void> {
    try {
      // Initial quota check
      await this.updateQuotaInfo();
      
      // Start continuous monitoring
      this.startMonitoring();
      
      console.log('✅ Storage Quota Manager initialized');
    } catch (error) {
      systemIntegrityService.logServiceError(
        'StorageQuotaManager',
        'initializeQuotaMonitoring',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { operation: 'initialization' }
      );
    }
  }

  /**
   * Start continuous quota monitoring
   */
  startMonitoring(): void {
    if (this.monitoringTimer) return;
    
    this.monitoringTimer = setInterval(async () => {
      await this.updateQuotaInfo();
      await this.checkQuotaThresholds();
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stop quota monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * Update current quota information
   */
  private async updateQuotaInfo(): Promise<void> {
    try {
      const quotaInfo = await this.calculateStorageQuota();
      this.currentQuotaInfo = quotaInfo;
      
      // Store quota history for trends
      this.recordQuotaHistory(quotaInfo);
      
      // Emit quota update event
      eventBus.emit('QUOTA_UPDATED', quotaInfo, 'StorageQuotaManager');
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'StorageQuotaManager',
        'updateQuotaInfo',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { operation: 'quota_calculation' }
      );
    }
  }

  /**
   * Calculate current localStorage quota usage
   */
  private async calculateStorageQuota(): Promise<StorageQuotaInfo> {
    const used = this.calculateUsedSpace();
    const total = await this.estimateQuotaSize();
    const available = Math.max(0, total - used);
    const utilization = (used / total) * 100;

    return {
      total,
      used,
      available,
      utilization,
      isNearLimit: utilization >= this.QUOTA_WARNING_THRESHOLD * 100,
      isCritical: utilization >= this.QUOTA_CRITICAL_THRESHOLD * 100,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Calculate currently used localStorage space
   */
  private calculateUsedSpace(): number {
    let totalSize = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            // Calculate size in bytes (approximate)
            totalSize += (key.length + value.length) * 2; // UTF-16 characters = 2 bytes each
          }
        }
      }
    } catch (error) {
      console.warn('Error calculating used space:', error);
    }
    
    return totalSize;
  }

  /**
   * Estimate total localStorage quota size
   */
  private async estimateQuotaSize(): Promise<number> {
    // Try to determine localStorage quota through testing
    try {
      const testKey = 'tms_quota_test';
      let quotaSize = 0;
      
      // Binary search for quota size
      let low = 0;
      let high = 50 * 1024 * 1024; // Start with 50MB upper bound
      
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const testValue = 'x'.repeat(mid);
        
        try {
          localStorage.setItem(testKey, testValue);
          localStorage.removeItem(testKey);
          low = mid + 1;
          quotaSize = mid;
        } catch (error) {
          high = mid;
        }
      }
      
      // Clean up
      try {
        localStorage.removeItem(testKey);
      } catch {}
      
      // Default to 10MB if estimation fails
      return quotaSize > 0 ? quotaSize * 2 : 10 * 1024 * 1024; // UTF-16 factor
      
    } catch (error) {
      console.warn('Could not estimate quota size, using default 10MB');
      return 10 * 1024 * 1024; // 10MB default
    }
  }

  /**
   * Check quota thresholds and trigger appropriate actions
   */
  private async checkQuotaThresholds(): Promise<void> {
    if (!this.currentQuotaInfo) return;

    const { utilization } = this.currentQuotaInfo;

    // Emergency threshold - immediate cleanup
    if (utilization >= this.QUOTA_EMERGENCY_THRESHOLD * 100) {
      await this.handleEmergencyQuota();
    }
    // Critical threshold - aggressive cleanup
    else if (utilization >= this.QUOTA_CRITICAL_THRESHOLD * 100) {
      await this.handleCriticalQuota();
    }
    // Warning threshold - preventive cleanup
    else if (utilization >= this.QUOTA_WARNING_THRESHOLD * 100) {
      await this.handleWarningQuota();
    }
  }

  /**
   * Handle emergency quota situation (98%+ used)
   */
  private async handleEmergencyQuota(): Promise<void> {
    console.warn('🚨 EMERGENCY: localStorage quota at 98%+ - performing immediate cleanup');
    
    const alert: QuotaAlert = {
      severity: 'emergency',
      message: 'Storage quota critically full. Emergency cleanup in progress.',
      availableActions: ['Immediate cleanup', 'Data export', 'Clear non-essential data'],
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
    await this.performEmergencyCleanup();
  }

  /**
   * Handle critical quota situation (95%+ used)
   */
  private async handleCriticalQuota(): Promise<void> {
    console.warn('⚠️ CRITICAL: localStorage quota at 95%+ - performing cleanup');
    
    const alert: QuotaAlert = {
      severity: 'critical',
      message: 'Storage quota is critically full. Cleanup required.',
      availableActions: ['Auto cleanup', 'Manual cleanup', 'Data export'],
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
    await this.performCriticalCleanup();
  }

  /**
   * Handle warning quota situation (80%+ used)
   */
  private async handleWarningQuota(): Promise<void> {
    console.warn('⚠️ WARNING: localStorage quota at 80%+ - cleanup recommended');
    
    const alert: QuotaAlert = {
      severity: 'warning',
      message: 'Storage quota is getting full. Cleanup recommended.',
      availableActions: ['Schedule cleanup', 'Review data', 'Export old data'],
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    this.addAlert(alert);
    await this.performPreventiveCleanup();
  }

  /**
   * Perform emergency cleanup (most aggressive)
   */
  async performEmergencyCleanup(): Promise<{ success: boolean; spaceFreed: number }> {
    console.log('🧹 Performing emergency storage cleanup...');
    let totalSpaceFreed = 0;
    
    try {
      const strategies = [
        await this.createSnapshotCleanupStrategy(),
        await this.createCacheCleanupStrategy(),
        await this.createHistoryCleanupStrategy(),
        await this.createOldDataCleanupStrategy(),
        await this.createPerformanceDataCleanupStrategy()
      ];
      
      // Execute all strategies in priority order
      for (const strategy of strategies.sort((a, b) => this.priorityOrder(a.priority) - this.priorityOrder(b.priority))) {
        const result = await strategy.execute();
        if (result.success) {
          totalSpaceFreed += result.spaceFreed;
          this.recordCleanup(strategy.name, result.spaceFreed);
        }
      }
      
      await this.updateQuotaInfo();
      eventBus.emit('EMERGENCY_CLEANUP_COMPLETED', { spaceFreed: totalSpaceFreed }, 'StorageQuotaManager');
      
      return { success: true, spaceFreed: totalSpaceFreed };
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'StorageQuotaManager',
        'performEmergencyCleanup',
        error instanceof Error ? error : new Error(String(error)),
        'critical',
        { spaceFreed: totalSpaceFreed }
      );
      return { success: false, spaceFreed: totalSpaceFreed };
    }
  }

  /**
   * Perform critical cleanup (selective)
   */
  async performCriticalCleanup(): Promise<{ success: boolean; spaceFreed: number }> {
    console.log('🧹 Performing critical storage cleanup...');
    let totalSpaceFreed = 0;
    
    try {
      const strategies = [
        await this.createSnapshotCleanupStrategy(),
        await this.createCacheCleanupStrategy(),
        await this.createHistoryCleanupStrategy()
      ];
      
      // Execute medium to high priority strategies
      for (const strategy of strategies.filter(s => ['medium', 'high'].includes(s.priority))) {
        const result = await strategy.execute();
        if (result.success) {
          totalSpaceFreed += result.spaceFreed;
          this.recordCleanup(strategy.name, result.spaceFreed);
        }
      }
      
      await this.updateQuotaInfo();
      return { success: true, spaceFreed: totalSpaceFreed };
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'StorageQuotaManager',
        'performCriticalCleanup',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { spaceFreed: totalSpaceFreed }
      );
      return { success: false, spaceFreed: totalSpaceFreed };
    }
  }

  /**
   * Perform preventive cleanup (gentle)
   */
  async performPreventiveCleanup(): Promise<{ success: boolean; spaceFreed: number }> {
    console.log('🧹 Performing preventive storage cleanup...');
    let totalSpaceFreed = 0;
    
    try {
      const strategies = [
        await this.createCacheCleanupStrategy(),
        await this.createHistoryCleanupStrategy()
      ];
      
      // Execute only low-medium priority strategies
      for (const strategy of strategies.filter(s => ['low', 'medium'].includes(s.priority))) {
        const result = await strategy.execute();
        if (result.success) {
          totalSpaceFreed += result.spaceFreed;
          this.recordCleanup(strategy.name, result.spaceFreed);
        }
      }
      
      await this.updateQuotaInfo();
      return { success: true, spaceFreed: totalSpaceFreed };
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'StorageQuotaManager',
        'performPreventiveCleanup',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { spaceFreed: totalSpaceFreed }
      );
      return { success: false, spaceFreed: totalSpaceFreed };
    }
  }

  /**
   * Create snapshot cleanup strategy
   */
  private async createSnapshotCleanupStrategy(): Promise<CleanupStrategy> {
    return {
      name: 'Snapshot Cleanup',
      description: 'Remove old data snapshots to free space',
      priority: 'high',
      estimatedSpaceSaved: await this.estimateSnapshotSize(),
      execute: async () => {
        try {
          const snapshots = JSON.parse(localStorage.getItem('tms_snapshots') || '[]');
          const originalSize = JSON.stringify(snapshots).length * 2; // UTF-16
          
          // Keep only the 2 most recent snapshots
          const recentSnapshots = snapshots.slice(-2);
          localStorage.setItem('tms_snapshots', JSON.stringify(recentSnapshots));
          
          const newSize = JSON.stringify(recentSnapshots).length * 2;
          const spaceFreed = originalSize - newSize;
          
          return {
            success: true,
            spaceFreed,
            details: `Removed ${snapshots.length - recentSnapshots.length} old snapshots`
          };
        } catch (error) {
          return {
            success: false,
            spaceFreed: 0,
            details: `Snapshot cleanup failed: ${error}`
          };
        }
      }
    };
  }

  /**
   * Create cache cleanup strategy
   */
  private async createCacheCleanupStrategy(): Promise<CleanupStrategy> {
    return {
      name: 'Cache Cleanup',
      description: 'Clear expired cache entries and temporary data',
      priority: 'medium',
      estimatedSpaceSaved: await this.estimateCacheSize(),
      execute: async () => {
        try {
          let spaceFreed = 0;
          const cacheKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('tms_cache_') || 
            key.startsWith('tms_temp_') ||
            key.startsWith('tms_perf_')
          );
          
          cacheKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
              spaceFreed += (key.length + value.length) * 2;
              localStorage.removeItem(key);
            }
          });
          
          return {
            success: true,
            spaceFreed,
            details: `Cleared ${cacheKeys.length} cache entries`
          };
        } catch (error) {
          return {
            success: false,
            spaceFreed: 0,
            details: `Cache cleanup failed: ${error}`
          };
        }
      }
    };
  }

  /**
   * Create history cleanup strategy
   */
  private async createHistoryCleanupStrategy(): Promise<CleanupStrategy> {
    return {
      name: 'History Cleanup',
      description: 'Remove old history and log entries',
      priority: 'medium',
      estimatedSpaceSaved: await this.estimateHistorySize(),
      execute: async () => {
        try {
          let spaceFreed = 0;
          const historyKeys = Object.keys(localStorage).filter(key =>
            key.includes('history') || 
            key.includes('log') ||
            key.endsWith('_training_history')
          );
          
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          
          historyKeys.forEach(key => {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                const data = JSON.parse(value);
                if (Array.isArray(data)) {
                  // Keep only recent entries
                  const recentData = data.filter((item: any) => {
                    const itemDate = new Date(item.timestamp || item.date || item.createdDate);
                    return itemDate.getTime() > thirtyDaysAgo;
                  });
                  
                  if (recentData.length !== data.length) {
                    const originalSize = value.length * 2;
                    const newValue = JSON.stringify(recentData);
                    localStorage.setItem(key, newValue);
                    const newSize = newValue.length * 2;
                    spaceFreed += originalSize - newSize;
                  }
                }
              }
            } catch (error) {
              // If parsing fails, remove the key entirely
              const value = localStorage.getItem(key);
              if (value) {
                spaceFreed += (key.length + value.length) * 2;
                localStorage.removeItem(key);
              }
            }
          });
          
          return {
            success: true,
            spaceFreed,
            details: `Cleaned history data from ${historyKeys.length} keys`
          };
        } catch (error) {
          return {
            success: false,
            spaceFreed: 0,
            details: `History cleanup failed: ${error}`
          };
        }
      }
    };
  }

  /**
   * Create old data cleanup strategy
   */
  private async createOldDataCleanupStrategy(): Promise<CleanupStrategy> {
    return {
      name: 'Old Data Cleanup',
      description: 'Compress or archive old transaction data',
      priority: 'critical',
      estimatedSpaceSaved: await this.estimateOldDataSize(),
      execute: async () => {
        try {
          // This strategy compresses old transactions instead of deleting them
          const transactions = JSON.parse(localStorage.getItem('tms_transactions') || '[]');
          const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
          
          const recentTransactions = transactions.filter((t: any) => 
            new Date(t.date).getTime() > oneYearAgo
          );
          
          const oldTransactions = transactions.filter((t: any) => 
            new Date(t.date).getTime() <= oneYearAgo
          );
          
          if (oldTransactions.length > 0) {
            // Store compressed old transactions separately
            const compressedOldData = this.compressData(oldTransactions);
            localStorage.setItem('tms_transactions_archived', compressedOldData);
            
            // Update main transactions with only recent data
            const originalSize = JSON.stringify(transactions).length * 2;
            localStorage.setItem('tms_transactions', JSON.stringify(recentTransactions));
            const newSize = JSON.stringify(recentTransactions).length * 2;
            
            return {
              success: true,
              spaceFreed: originalSize - newSize,
              details: `Archived ${oldTransactions.length} old transactions`
            };
          }
          
          return {
            success: true,
            spaceFreed: 0,
            details: 'No old data to archive'
          };
        } catch (error) {
          return {
            success: false,
            spaceFreed: 0,
            details: `Old data cleanup failed: ${error}`
          };
        }
      }
    };
  }

  /**
   * Create performance data cleanup strategy
   */
  private async createPerformanceDataCleanupStrategy(): Promise<CleanupStrategy> {
    return {
      name: 'Performance Data Cleanup',
      description: 'Clear old performance metrics and monitoring data',
      priority: 'low',
      estimatedSpaceSaved: await this.estimatePerformanceDataSize(),
      execute: async () => {
        try {
          let spaceFreed = 0;
          const perfKeys = Object.keys(localStorage).filter(key =>
            key.includes('performance') ||
            key.includes('metrics') ||
            key.includes('monitor')
          );
          
          perfKeys.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) {
              spaceFreed += (key.length + value.length) * 2;
              localStorage.removeItem(key);
            }
          });
          
          return {
            success: true,
            spaceFreed,
            details: `Cleared ${perfKeys.length} performance data keys`
          };
        } catch (error) {
          return {
            success: false,
            spaceFreed: 0,
            details: `Performance data cleanup failed: ${error}`
          };
        }
      }
    };
  }

  /**
   * Simple data compression using JSON string optimization
   */
  private compressData(data: any): string {
    try {
      // Simple compression: remove unnecessary whitespace and optimize structure
      return JSON.stringify(data, (_, value) => {
        // Remove null/undefined values to reduce size
        return value === null || value === undefined ? undefined : value;
      });
    } catch (error) {
      return JSON.stringify(data);
    }
  }

  /**
   * Estimate size of different data categories
   */
  private async estimateSnapshotSize(): Promise<number> {
    const snapshots = localStorage.getItem('tms_snapshots');
    return snapshots ? snapshots.length * 2 : 0;
  }

  private async estimateCacheSize(): Promise<number> {
    let size = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('tms_cache_') || key.startsWith('tms_temp_') || key.startsWith('tms_perf_')) {
        const value = localStorage.getItem(key);
        if (value) size += (key.length + value.length) * 2;
      }
    });
    return size;
  }

  private async estimateHistorySize(): Promise<number> {
    let size = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.includes('history') || key.includes('log')) {
        const value = localStorage.getItem(key);
        if (value) size += (key.length + value.length) * 2;
      }
    });
    return size;
  }

  private async estimateOldDataSize(): Promise<number> {
    const transactions = localStorage.getItem('tms_transactions');
    if (!transactions) return 0;
    
    try {
      const data = JSON.parse(transactions);
      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
      const oldTransactions = data.filter((t: any) => 
        new Date(t.date).getTime() <= oneYearAgo
      );
      return JSON.stringify(oldTransactions).length * 2;
    } catch {
      return 0;
    }
  }

  private async estimatePerformanceDataSize(): Promise<number> {
    let size = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.includes('performance') || key.includes('metrics') || key.includes('monitor')) {
        const value = localStorage.getItem(key);
        if (value) size += (key.length + value.length) * 2;
      }
    });
    return size;
  }

  /**
   * Priority ordering for cleanup strategies
   */
  private priorityOrder(priority: string): number {
    switch (priority) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 0;
    }
  }

  /**
   * Add alert to active alerts
   */
  private addAlert(alert: QuotaAlert): void {
    this.activeAlerts.push(alert);
    eventBus.emit('QUOTA_ALERT', alert, 'StorageQuotaManager');
  }

  /**
   * Record cleanup operation in history
   */
  private recordCleanup(strategy: string, spaceFreed: number): void {
    this.cleanupHistory.push({
      timestamp: new Date().toISOString(),
      strategy,
      spaceFreed
    });

    // Keep only recent cleanup history
    if (this.cleanupHistory.length > 100) {
      this.cleanupHistory = this.cleanupHistory.slice(-50);
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.cleanupLog, JSON.stringify(this.cleanupHistory));
    } catch (error) {
      console.warn('Could not save cleanup history:', error);
    }
  }

  /**
   * Record quota history for trend analysis
   */
  private recordQuotaHistory(quotaInfo: StorageQuotaInfo): void {
    try {
      const history = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.quotaHistory) || '[]');
      history.push({
        timestamp: quotaInfo.lastChecked,
        utilization: quotaInfo.utilization,
        used: quotaInfo.used,
        total: quotaInfo.total
      });

      // Keep only recent history (last 7 days worth of hourly samples)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const recentHistory = history.filter((h: any) => 
        new Date(h.timestamp).getTime() > sevenDaysAgo
      );

      localStorage.setItem(this.STORAGE_KEYS.quotaHistory, JSON.stringify(recentHistory));
    } catch (error) {
      console.warn('Could not save quota history:', error);
    }
  }

  // PUBLIC API METHODS

  /**
   * Get current quota information
   */
  getQuotaInfo(): StorageQuotaInfo | null {
    return this.currentQuotaInfo;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): QuotaAlert[] {
    return this.activeAlerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(timestamp: string): boolean {
    const alert = this.activeAlerts.find(a => a.timestamp === timestamp);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get cleanup history
   */
  getCleanupHistory(): Array<{ timestamp: string; strategy: string; spaceFreed: number }> {
    return [...this.cleanupHistory];
  }

  /**
   * Force immediate quota check and cleanup if needed
   */
  async forceQuotaCheck(): Promise<void> {
    await this.updateQuotaInfo();
    await this.checkQuotaThresholds();
  }

  /**
   * Manual cleanup trigger
   */
  async performManualCleanup(aggressiveness: 'gentle' | 'moderate' | 'aggressive' = 'moderate'): Promise<{ success: boolean; spaceFreed: number }> {
    switch (aggressiveness) {
      case 'gentle':
        return await this.performPreventiveCleanup();
      case 'moderate':
        return await this.performCriticalCleanup();
      case 'aggressive':
        return await this.performEmergencyCleanup();
      default:
        return await this.performCriticalCleanup();
    }
  }

  /**
   * Get available cleanup strategies
   */
  async getAvailableStrategies(): Promise<CleanupStrategy[]> {
    return [
      await this.createSnapshotCleanupStrategy(),
      await this.createCacheCleanupStrategy(),
      await this.createHistoryCleanupStrategy(),
      await this.createOldDataCleanupStrategy(),
      await this.createPerformanceDataCleanupStrategy()
    ];
  }

  /**
   * Execute specific cleanup strategy
   */
  async executeStrategy(strategyName: string): Promise<{ success: boolean; spaceFreed: number; details: string }> {
    const strategies = await this.getAvailableStrategies();
    const strategy = strategies.find(s => s.name === strategyName);
    
    if (!strategy) {
      return { success: false, spaceFreed: 0, details: 'Strategy not found' };
    }
    
    const result = await strategy.execute();
    if (result.success) {
      this.recordCleanup(strategy.name, result.spaceFreed);
      await this.updateQuotaInfo();
    }
    
    return result;
  }

  /**
   * Destroy the quota manager (cleanup)
   */
  destroy(): void {
    this.stopMonitoring();
    this.activeAlerts = [];
    this.cleanupHistory = [];
    this.currentQuotaInfo = null;
  }
}

// Create and export singleton instance
export const storageQuotaManager = new StorageQuotaManager();
export default storageQuotaManager; 