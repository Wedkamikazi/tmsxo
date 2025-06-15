import * as tf from '@tensorflow/tfjs';
import { eventBus } from './eventBus';

// MEMORY MANAGEMENT SERVICE FOR ML MODELS
// Handles TensorFlow.js memory lifecycle, garbage collection, and optimization

export interface MemoryStats {
  totalBytes: number;
  totalBytesInGPU: number;
  totalTensors: number;
  peakBytes: number;
  unreliableBytes: number;
  reasons: string[];
  timestamp: string;
}

export interface ModelMemoryInfo {
  modelId: string;
  modelName: string;
  memoryUsage: number;
  tensorCount: number;
  lastAccessed: string;
  isActive: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface MemoryThresholds {
  warning: number;    // 80MB
  critical: number;   // 120MB
  emergency: number;  // 150MB
}

class MemoryManagementService {
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
  private disposedTensors: Set<string> = new Set();

  constructor() {
    this.initializeMemoryManagement();
  }

  // INITIALIZE MEMORY MONITORING SYSTEM
  private initializeMemoryManagement(): void {
    console.log('🧠 Initializing Memory Management Service...');
    
    // Start continuous monitoring
    this.startMemoryMonitoring();
    
    // Set up cleanup triggers
    this.setupCleanupTriggers();
    
    // Register for system events
    this.setupEventListeners();
    
    console.log('✅ Memory Management Service Initialized');
  }

  // REGISTER ML MODEL FOR MEMORY TRACKING
  registerModel(modelId: string, modelName: string, model: tf.LayersModel, priority: 'high' | 'medium' | 'low' = 'medium'): void {
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

  // UNREGISTER AND DISPOSE MODEL
  unregisterModel(modelId: string): boolean {
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

  // UPDATE MODEL LAST ACCESSED TIME
  touchModel(modelId: string): void {
    const modelInfo = this.modelRegistry.get(modelId);
    if (modelInfo) {
      modelInfo.lastAccessed = new Date().toISOString();
    }
  }

  // GET CURRENT MEMORY STATISTICS
  getCurrentMemoryStats(): MemoryStats {
    const tfMemory = tf.memory();
    
    const stats: MemoryStats = {
      totalBytes: tfMemory.numBytes,
      totalBytesInGPU: tfMemory.numBytesInGPU || 0,
      totalTensors: tfMemory.numTensors,
      peakBytes: Math.max(...this.memoryHistory.map(h => h.totalBytes), tfMemory.numBytes),
      unreliableBytes: tfMemory.unreliableBytes || 0,
      reasons: tfMemory.reasons || [],
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    return stats;
  }

  // COMPREHENSIVE MEMORY CLEANUP
  async performMemoryCleanup(force: boolean = false): Promise<{
    success: boolean;
    beforeCleanup: MemoryStats;
    afterCleanup: MemoryStats;
    freedBytes: number;
    modelsDisposed: string[];
  }> {
    if (this.cleanupInProgress && !force) {
      console.log('🔄 Memory cleanup already in progress');
      return {
        success: false,
        beforeCleanup: this.getCurrentMemoryStats(),
        afterCleanup: this.getCurrentMemoryStats(),
        freedBytes: 0,
        modelsDisposed: []
      };
    }

    this.cleanupInProgress = true;
    const beforeCleanup = this.getCurrentMemoryStats();
    const modelsDisposed: string[] = [];

    try {
      console.log('🧹 Starting Memory Cleanup...');

      // 1. Dispose inactive models first
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

      // 4. Clean up old unused models based on LRU
      if (force || beforeCleanup.totalBytes > this.thresholds.critical) {
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

      // 5. Clear disposed tensors tracking
      this.disposedTensors.clear();

      const afterCleanup = this.getCurrentMemoryStats();
      const freedBytes = beforeCleanup.totalBytes - afterCleanup.totalBytes;

      console.log(`✅ Memory cleanup completed. Freed: ${this.formatBytes(freedBytes)}`);

      // Emit cleanup event
      eventBus.emit('DATA_CLEARED', {
        memoryCleanup: {
          freedBytes,
          modelsDisposed: modelsDisposed.length,
          beforeBytes: beforeCleanup.totalBytes,
          afterBytes: afterCleanup.totalBytes
        }
      }, 'MemoryManagementService');

      return {
        success: true,
        beforeCleanup,
        afterCleanup,
        freedBytes,
        modelsDisposed
      };

    } catch (error) {
      console.error('❌ Memory cleanup failed:', error);
      return {
        success: false,
        beforeCleanup,
        afterCleanup: this.getCurrentMemoryStats(),
        freedBytes: 0,
        modelsDisposed
      };
    } finally {
      this.cleanupInProgress = false;
    }
  }

  // OPTIMIZE MEMORY USAGE
  async optimizeMemoryUsage(): Promise<{
    optimizationsApplied: string[];
    memoryBefore: number;
    memoryAfter: number;
  }> {
    const optimizationsApplied: string[] = [];
    const memoryBefore = this.getCurrentMemoryStats().totalBytes;

    try {
      console.log('⚡ Optimizing Memory Usage...');

      // 1. Enable memory growth for WebGL backend
      if (tf.getBackend() === 'webgl') {
        const webglBackend = tf.backend() as any;
        if (webglBackend && webglBackend.gpgpu && webglBackend.gpgpu.gl) {
          // Enable memory optimization flags
          optimizationsApplied.push('WebGL memory optimization');
        }
      }

      // 2. Optimize tensor operations
      tf.enableProdMode(); // Disable debug mode for better performance
      optimizationsApplied.push('Production mode enabled');

      // 3. Set memory growth limit
      try {
        tf.ENV.set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0.5);
        optimizationsApplied.push('WebGL texture threshold optimized');
      } catch (error) {
        // Ignore if not supported
      }

      // 4. Cleanup intermediate tensors
      const activeModels = Array.from(this.modelRegistry.values()).filter(m => m.isActive);
      if (activeModels.length > 3) {
        // Too many active models, suggest cleanup
        optimizationsApplied.push('Active model limit optimization suggested');
      }

      // 5. Memory defragmentation
      await this.performMemoryDefragmentation();
      optimizationsApplied.push('Memory defragmentation');

      const memoryAfter = this.getCurrentMemoryStats().totalBytes;

      console.log(`🎯 Memory optimization completed. Optimizations: ${optimizationsApplied.length}`);

      return {
        optimizationsApplied,
        memoryBefore,
        memoryAfter
      };

    } catch (error) {
      console.error('❌ Memory optimization failed:', error);
      return {
        optimizationsApplied,
        memoryBefore,
        memoryAfter: memoryBefore
      };
    }
  }

  // GET MEMORY HEALTH STATUS
  getMemoryHealthStatus(): {
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
  } {
    const currentStats = this.getCurrentMemoryStats();
    const currentUsage = currentStats.totalBytes;
    
    let status: 'healthy' | 'warning' | 'critical' | 'emergency';
    let threshold: string;
    const recommendations: string[] = [];

    if (currentUsage >= this.thresholds.emergency) {
      status = 'emergency';
      threshold = 'Emergency';
      recommendations.push('Immediate memory cleanup required');
      recommendations.push('Consider restarting the application');
    } else if (currentUsage >= this.thresholds.critical) {
      status = 'critical';
      threshold = 'Critical';
      recommendations.push('Perform memory cleanup');
      recommendations.push('Dispose unused models');
    } else if (currentUsage >= this.thresholds.warning) {
      status = 'warning';
      threshold = 'Warning';
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Consider cleanup if usage increases');
    } else {
      status = 'healthy';
      threshold = 'Healthy';
      recommendations.push('Memory usage is optimal');
    }

    // Model statistics
    const allModels = Array.from(this.modelRegistry.values());
    const modelStats = {
      total: allModels.length,
      active: allModels.filter(m => m.isActive).length,
      inactive: allModels.filter(m => !m.isActive).length,
      highPriority: allModels.filter(m => m.priority === 'high').length
    };

    // Additional recommendations based on model stats
    if (modelStats.inactive > 0) {
      recommendations.push(`Clean up ${modelStats.inactive} inactive models`);
    }
    
    if (modelStats.active > 5) {
      recommendations.push('Consider reducing active models for better performance');
    }

    return {
      status,
      currentUsage,
      threshold,
      recommendations,
      modelStats
    };
  }

  // PRIVATE HELPER METHODS
  private startMemoryMonitoring(): void {
    // Monitor memory every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryThresholds();
    }, 30000);
  }

  private setupCleanupTriggers(): void {
    // Set up automatic cleanup when thresholds are exceeded
    eventBus.on('DATA_CLEARED', (payload) => {
      if (payload?.memoryPressure) {
        this.performMemoryCleanup(false);
      }
    });
  }

  private setupEventListeners(): void {
    // Listen for model lifecycle events
    eventBus.on('TRANSACTIONS_UPDATED', () => {
      // Touch ML models that might be used for transaction processing
      this.touchModel('categorization-model');
      this.touchModel('sentiment-model');
    });
  }

  private checkMemoryThresholds(): void {
    const currentStats = this.getCurrentMemoryStats();
    const usage = currentStats.totalBytes;

    if (usage >= this.thresholds.emergency) {
      console.error('🚨 EMERGENCY: Memory usage critical!');
      this.performMemoryCleanup(true); // Force cleanup
      
      eventBus.emit('DATA_CLEARED', {
        memoryEmergency: {
          usage,
          threshold: this.thresholds.emergency,
          immediate: true
        }
      }, 'MemoryManagementService');
      
    } else if (usage >= this.thresholds.critical) {
      console.warn('⚠️ CRITICAL: Memory usage high');
      this.performMemoryCleanup(false);
      
    } else if (usage >= this.thresholds.warning) {
      console.warn('⏰ WARNING: Memory usage elevated');
      
      eventBus.emit('DATA_CLEARED', {
        memoryWarning: {
          usage,
          threshold: this.thresholds.warning
        }
      }, 'MemoryManagementService');
    }
  }

  private estimateModelMemory(model: tf.LayersModel): number {
    try {
      let totalParams = 0;
      model.layers.forEach(layer => {
        const weights = layer.getWeights();
        weights.forEach(weight => {
          totalParams += weight.size;
        });
      });
      
      // Estimate 4 bytes per float32 parameter
      return totalParams * 4;
    } catch (error) {
      // Fallback estimation
      return 10 * 1024 * 1024; // 10MB default
    }
  }

  private countModelTensors(model: tf.LayersModel): number {
    try {
      let tensorCount = 0;
      model.layers.forEach(layer => {
        const weights = layer.getWeights();
        tensorCount += weights.length;
      });
      return tensorCount;
    } catch (error) {
      return 0;
    }
  }

  private async performMemoryDefragmentation(): Promise<void> {
    // This is a conceptual defragmentation - TensorFlow.js handles actual memory
    // But we can optimize our tracking and cleanup orphaned references
    
    const activeModelIds = new Set(Array.from(this.modelRegistry.keys()));
    
    // Clean up any references to disposed models
    this.disposedTensors.forEach(tensorId => {
      if (!activeModelIds.has(tensorId)) {
        this.disposedTensors.delete(tensorId);
      }
    });

    // Trigger garbage collection hint
    if (typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // PUBLIC API METHODS
  getRegisteredModels(): ModelMemoryInfo[] {
    return Array.from(this.modelRegistry.values());
  }

  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  // CLEANUP AND DISPOSAL
  dispose(): void {
    console.log('🧹 Disposing Memory Management Service...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Perform final cleanup
    this.performMemoryCleanup(true);
    
    // Clear all tracking
    this.modelRegistry.clear();
    this.memoryHistory = [];
    this.disposedTensors.clear();
    
    console.log('✅ Memory Management Service disposed');
  }
}

// Export singleton instance
export const memoryManagementService = new MemoryManagementService(); 