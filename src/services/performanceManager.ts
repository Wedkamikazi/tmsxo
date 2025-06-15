/**
 * UNIFIED PERFORMANCE & MEMORY MANAGER
 * Consolidates general performance monitoring with TensorFlow.js memory management
 * Handles memory management, caching, and performance monitoring for all services
 */

import * as tf from '@tensorflow/tfjs';
import { eventBus } from './eventBus';
import { systemIntegrityService } from './systemIntegrityService';
import { DEBUG_MODE_ACTIVE } from '../utils/debugMode';

export interface PerformanceMetrics {
  memoryUsage: number;
  cacheSize: number;
  operationCount: number;
  averageResponseTime: number;
  errorCount: number;
  lastCleanup: Date;
  tensorflowMemory?: {
    totalBytes: number;
    totalTensors: number;
    peakBytes: number;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface MemoryStats {
  used: number;
  total: number;
  percentage: number;
  jsHeapSizeLimit?: number;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  tensorflow?: {
    numBytes: number;
    numTensors: number;
    peakBytes: number;
  };
}

// TENSORFLOW.JS MODEL MANAGEMENT
interface ModelMemoryInfo {
  modelId: string;
  modelName: string;
  memoryUsage: number;
  tensorCount: number;
  lastAccessed: string;
  isActive: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface MemoryThresholds {
  warning: number;    // 80MB
  critical: number;   // 120MB
  emergency: number;  // 150MB
}

class PerformanceManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private metrics: PerformanceMetrics;
  private operationTimes: number[] = [];
  private readonly CACHE_MAX_SIZE = 100;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MEMORY_CLEANUP_THRESHOLD = 0.8; // 80% memory usage
  private readonly MAX_OPERATION_TIMES = 100;

  // TENSORFLOW.JS MEMORY MANAGEMENT
  private readonly thresholds: MemoryThresholds = {
    warning: 80 * 1024 * 1024,    // 80MB
    critical: 120 * 1024 * 1024,  // 120MB
    emergency: 150 * 1024 * 1024  // 150MB
  };

  private monitoringInterval: NodeJS.Timeout | null = null;
  private modelRegistry: Map<string, ModelMemoryInfo> = new Map();
  private memoryHistory: MemoryStats[] = [];
  private maxHistorySize = 100;
  private cleanupInProgress = false;

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

    // Initialize TensorFlow.js monitoring
    this.initializeTensorFlowMonitoring();
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
   * TENSORFLOW.JS MODEL MANAGEMENT
   */
  
  // Initialize TensorFlow.js memory monitoring
  private initializeTensorFlowMonitoring(): void {
    console.log('🧠 Initializing TensorFlow.js Memory Management...');
    
    // Set up cleanup triggers for TensorFlow.js
    this.setupTensorFlowCleanupTriggers();
    
    // Register for system events
    this.setupTensorFlowEventListeners();
    
    console.log('✅ TensorFlow.js Memory Management Initialized');
  }

  // Register ML model for memory tracking
  public registerModel(modelId: string, modelName: string, model: tf.LayersModel, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    const memoryInfo: ModelMemoryInfo = {
      modelId,
      modelName,
      memoryUsage: this.estimateModelMemory(model),
      tensorCount: this.countModelTensors(model),
      lastAccessed: new Date().toISOString(),
      isActive: true,
      priority
    };

    this.modelRegistry.set(modelId, memoryInfo);
    
    console.log(`📊 Registered model ${modelName} (${this.formatBytes(memoryInfo.memoryUsage)})`);
    
    // Check if we need cleanup after registration
    this.checkMemoryThresholds();
  }

  // Unregister and dispose model
  public unregisterModel(modelId: string): boolean {
    const modelInfo = this.modelRegistry.get(modelId);
    if (!modelInfo) {
      return false;
    }

    // Mark as inactive
    modelInfo.isActive = false;
    
    console.log(`🗑️ Unregistered model ${modelInfo.modelName}`);
    
    // Remove from registry
    this.modelRegistry.delete(modelId);
    
    return true;
  }

  // Update model last accessed time
  public touchModel(modelId: string): void {
    const modelInfo = this.modelRegistry.get(modelId);
    if (modelInfo) {
      modelInfo.lastAccessed = new Date().toISOString();
    }
  }

  /**
   * UNIFIED MEMORY MANAGEMENT
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

    // Add TensorFlow.js memory stats
    if (typeof tf !== 'undefined') {
      const tfMemory = tf.memory();
      stats.tensorflow = {
        numBytes: tfMemory.numBytes,
        numTensors: tfMemory.numTensors,
        peakBytes: Math.max(...this.memoryHistory.map(h => h.tensorflow?.numBytes || 0), tfMemory.numBytes)
      };
      
      // Update performance metrics with TensorFlow info
      this.metrics.tensorflowMemory = {
        totalBytes: tfMemory.numBytes,
        totalTensors: tfMemory.numTensors,
        peakBytes: stats.tensorflow.peakBytes
      };
    }

    this.metrics.memoryUsage = stats.percentage;
    
    // Add to history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    return stats;
  }

  // Get comprehensive memory health status
  public getMemoryHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical' | 'emergency';
    currentUsage: number;
    threshold: string;
    recommendations: string[];
    modelStats: {
      total: number;
      active: number;
      inactive: number;
      highPriority: number;
    };
    cacheStats: {
      size: number;
      hitRate: number;
      memoryUsage: number;
    };
  } {
    const memoryStats = this.getMemoryStats();
    const tfMemory = memoryStats.tensorflow?.numBytes || 0;
    
    let status: 'healthy' | 'warning' | 'critical' | 'emergency' = 'healthy';
    let threshold = 'Normal';
    
    if (tfMemory > this.thresholds.emergency) {
      status = 'emergency';
      threshold = 'Emergency (>150MB)';
    } else if (tfMemory > this.thresholds.critical) {
      status = 'critical';
      threshold = 'Critical (>120MB)';
    } else if (tfMemory > this.thresholds.warning) {
      status = 'warning';
      threshold = 'Warning (>80MB)';
    }

    const recommendations: string[] = [];
    
    if (status === 'emergency') {
      recommendations.push('Immediate cleanup required - dispose unused models');
      recommendations.push('Consider reducing model complexity');
    } else if (status === 'critical') {
      recommendations.push('Cleanup recommended - review model usage');
      recommendations.push('Monitor memory usage closely');
    } else if (status === 'warning') {
      recommendations.push('Consider cleanup of low-priority models');
    }

    const modelStats = {
      total: this.modelRegistry.size,
      active: Array.from(this.modelRegistry.values()).filter(m => m.isActive).length,
      inactive: Array.from(this.modelRegistry.values()).filter(m => !m.isActive).length,
      highPriority: Array.from(this.modelRegistry.values()).filter(m => m.priority === 'high').length
    };

    const cacheStats = {
      size: this.cache.size,
      hitRate: this.calculateCacheHitRate(),
      memoryUsage: this.cache.size * 1000 // Rough estimate
    };

    return {
      status,
      currentUsage: tfMemory,
      threshold,
      recommendations,
      modelStats,
      cacheStats
    };
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
   * UNIFIED MEMORY MONITORING & CLEANUP
   */
  private startMemoryMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const memoryStats = this.getMemoryStats();
      
      // Check general memory usage
      if (memoryStats.percentage > this.MEMORY_CLEANUP_THRESHOLD * 100) {
        this.performMemoryCleanup();
      }

      // Check TensorFlow.js memory usage
      if (memoryStats.tensorflow) {
        this.checkMemoryThresholds();
      }
    }, 30000); // Check every 30 seconds
  }

  private checkMemoryThresholds(): void {
    const memoryStats = this.getMemoryStats();
    const tfMemory = memoryStats.tensorflow?.numBytes || 0;

    if (tfMemory > this.thresholds.emergency) {
      systemIntegrityService.logServiceError(
        'PerformanceManager',
        'memoryThresholdCheck',
        'TensorFlow.js memory usage critical - emergency cleanup required',
        'critical',
        { usage: tfMemory, threshold: this.thresholds.emergency, usagePercent: (tfMemory / this.thresholds.emergency * 100).toFixed(1) }
      );
      this.performTensorFlowCleanup(true);
      eventBus.emit('MEMORY_EMERGENCY', { 
        usage: tfMemory, 
        threshold: this.thresholds.emergency 
      }, 'PerformanceManager');
    } else if (tfMemory > this.thresholds.critical) {
      systemIntegrityService.logServiceError(
        'PerformanceManager',
        'memoryThresholdCheck',
        'TensorFlow.js memory usage high - cleanup recommended',
        'high',
        { usage: tfMemory, threshold: this.thresholds.critical, usagePercent: (tfMemory / this.thresholds.critical * 100).toFixed(1) }
      );
      this.performTensorFlowCleanup(false);
      eventBus.emit('MEMORY_CRITICAL', { 
        usage: tfMemory, 
        threshold: this.thresholds.critical 
      }, 'PerformanceManager');
    } else if (tfMemory > this.thresholds.warning) {
      systemIntegrityService.logServiceError(
        'PerformanceManager',
        'memoryThresholdCheck',
        'TensorFlow.js memory usage elevated - monitoring recommended',
        'medium',
        { usage: tfMemory, threshold: this.thresholds.warning, usagePercent: (tfMemory / this.thresholds.warning * 100).toFixed(1) }
      );
      eventBus.emit('MEMORY_WARNING', { 
        usage: tfMemory, 
        threshold: this.thresholds.warning 
      }, 'PerformanceManager');
    }
  }

  private performMemoryCleanup(): void {
    console.log('🧹 Performing unified memory cleanup...');
    
    // Clear expired cache entries
    this.cleanupExpiredCache();
    
    // Limit operation times array
    if (this.operationTimes.length > this.MAX_OPERATION_TIMES / 2) {
      this.operationTimes = this.operationTimes.slice(-this.MAX_OPERATION_TIMES / 2);
    }
    
    // Cleanup localStorage if possible
    this.cleanupOldStorageEntries();
    
    // Update cleanup timestamp
    this.metrics.lastCleanup = new Date();
  }

  // TensorFlow.js specific cleanup
  private async performTensorFlowCleanup(aggressive: boolean = false): Promise<void> {
    if (this.cleanupInProgress) {
      return;
    }

    this.cleanupInProgress = true;

    try {
      console.log('🧹 Starting TensorFlow.js Memory Cleanup...');

      // 1. Dispose inactive models first
      const modelsDisposed: string[] = [];
      for (const [modelId, modelInfo] of this.modelRegistry) {
        if (!modelInfo.isActive) {
          modelsDisposed.push(modelInfo.modelName);
          this.modelRegistry.delete(modelId);
        }
      }

      // 2. Run TensorFlow.js garbage collection
      tf.disposeVariables();
      
      // 3. Force browser garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc();
      }

      // 4. Aggressive cleanup for emergency situations
      if (aggressive) {
        const sortedModels = Array.from(this.modelRegistry.entries())
          .sort(([, a], [, b]) => {
            // Sort by priority (low first) then by last accessed (oldest first)
            const priorityOrder = { low: 0, medium: 1, high: 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            return new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime();
          });

        // Dispose lowest priority and oldest models
        const modelsToDispose = sortedModels.slice(0, Math.ceil(sortedModels.length * 0.3));
        
        for (const [modelId, modelInfo] of modelsToDispose) {
          if (modelInfo.priority !== 'high') { // Never dispose high priority models
            modelsDisposed.push(modelInfo.modelName);
            this.modelRegistry.delete(modelId);
          }
        }
      }

      console.log(`✅ TensorFlow.js cleanup complete. Disposed ${modelsDisposed.length} models.`);
    } finally {
      this.cleanupInProgress = false;
    }
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
      console.log(`🗑️ Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  private cleanupOldStorageEntries(): void {
    try {
      // Clean up old performance data if it exists
      const oldKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('tms_perf_') || key.startsWith('tms_cache_')
      );
      
      oldKeys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.timestamp && Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
              localStorage.removeItem(key);
            }
          }
        } catch (error) {
          // If parsing fails, remove the key
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      systemIntegrityService.logServiceError(
        'PerformanceManager',
        'cleanupOldStorageEntries',
        error instanceof Error ? error : new Error(String(error)),
        'low',
        { operation: 'localStorage cleanup' }
      );
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up every 10 minutes
    setInterval(() => {
      this.performMemoryCleanup();
    }, 10 * 60 * 1000);
  }

  private setupTensorFlowCleanupTriggers(): void {
    // Clean up on visibility change (tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performTensorFlowCleanup();
      }
    });
  }

  private setupTensorFlowEventListeners(): void {
    eventBus.on('DATA_CLEARED', () => {
      // Cleanup models when data is cleared
      this.performTensorFlowCleanup();
    });
  }

  public getMetrics(): PerformanceMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  private updateMetrics(): void {
    this.metrics.cacheSize = this.cache.size;
    this.metrics.memoryUsage = this.getMemoryStats().percentage;
  }

  private calculateCacheHitRate(): number {
    const entries = Array.from(this.cache.values());
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    return entries.length > 0 ? totalAccesses / entries.length : 0;
  }

  // TensorFlow.js helper methods
  private estimateModelMemory(model: tf.LayersModel): number {
    try {
      // Rough estimation based on model parameters
      const params = model.countParams();
      return params * 4; // Assuming 32-bit floats
    } catch (error) {
      systemIntegrityService.logServiceError(
        'PerformanceManager',
        'estimateModelMemory',
        error instanceof Error ? error : new Error(String(error)),
        'low',
        { operation: 'TensorFlow model memory estimation' }
      );
      return 0;
    }
  }

  private countModelTensors(model: tf.LayersModel): number {
    try {
      return model.layers.reduce((count, layer) => {
        return count + (layer.getWeights ? layer.getWeights().length : 0);
      }, 0);
    } catch (error) {
      systemIntegrityService.logServiceError(
        'PerformanceManager',
        'countModelTensors',
        error instanceof Error ? error : new Error(String(error)),
        'low',
        { operation: 'TensorFlow model tensor counting' }
      );
      return 0;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public getRegisteredModels(): ModelMemoryInfo[] {
    return Array.from(this.modelRegistry.values());
  }

  public getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  public getPerformanceReport(): {
    metrics: PerformanceMetrics;
    memoryStats: MemoryStats;
    cacheHitRate: number;
    recommendations: string[];
  } {
    const memoryStats = this.getMemoryStats();
    const cacheHitRate = this.calculateCacheHitRate();
    const recommendations: string[] = [];

    if (memoryStats.percentage > 80) {
      recommendations.push('High memory usage detected - consider cleanup');
    }

    if (cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate - review caching strategy');
    }

    if (this.metrics.errorCount > 10) {
      recommendations.push('High error count - investigate error patterns');
    }

    if (this.metrics.tensorflowMemory && this.metrics.tensorflowMemory.totalBytes > this.thresholds.warning) {
      recommendations.push('TensorFlow.js memory usage elevated - consider model cleanup');
    }

    return {
      metrics: this.getMetrics(),
      memoryStats,
      cacheHitRate,
      recommendations
    };
  }

  public batchProcess<T, R>(
    items: T[], 
    processor: (item: T) => R, 
    batchSize: number = 50
  ): Promise<R[]> {
    return new Promise((resolve, reject) => {
      const results: R[] = [];
      let currentIndex = 0;
      
      const processBatch = () => {
        try {
          const batch = items.slice(currentIndex, currentIndex + batchSize);
          const batchResults = batch.map(processor);
          results.push(...batchResults);
          
          currentIndex += batchSize;
          
          if (currentIndex < items.length) {
            // Process next batch in next tick to avoid blocking
            setTimeout(processBatch, 0);
          } else {
            resolve(results);
          }
        } catch (error) {
          systemIntegrityService.logServiceError(
            'PerformanceManager',
            'batchProcess',
            error instanceof Error ? error : new Error(String(error)),
            'medium',
            { batchSize, totalItems: items.length, currentIndex }
          );
          reject(error);
        }
      };
      
      processBatch();
    });
  }

  public debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.cache.clear();
    this.modelRegistry.clear();
    this.memoryHistory = [];
  }
}

// Check for debug mode
const isDebugMode = DEBUG_MODE_ACTIVE;

// Export singleton instance (skip TensorFlow initialization in debug mode)
let performanceManager: PerformanceManager;

if (isDebugMode) {
  console.log('🚨 PerformanceManager: Debug mode detected - creating mock instance (no TensorFlow)');
  performanceManager = {
    getMemoryHealthStatus: () => ({ isHealthy: true, overall: 'excellent', details: {} }),
    registerModel: () => {},
    dispose: () => Promise.resolve()
  } as any;
} else {
  performanceManager = new PerformanceManager();
}

export { performanceManager }; 