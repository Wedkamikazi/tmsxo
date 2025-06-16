/**
 * CENTRALIZED CLEANUP MANAGER SERVICE
 * Manages all disposable resources, timers, event listeners, and TensorFlow models
 * Prevents memory leaks and ensures proper resource cleanup
 */

import { performanceManager } from '@/core/performance/PerformanceManager';
import { systemSafetyManager } from '@/core/safety/SystemSafetyManager';

interface DisposableResource {
  id: string;
  type: 'tensorflow-model' | 'timer' | 'interval' | 'event-listener' | 'web-worker' | 'custom';
  resource: any;
  disposer: () => void;
  component?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  lastAccessed?: Date;
}

interface CleanupStats {
  totalRegistered: number;
  disposed: number;
  memoryFreed: number;
  errors: number;
  lastCleanup: Date;
}

class CleanupManager {
  private resources: Map<string, DisposableResource> = new Map();
  private cleanupStats: CleanupStats = {
    totalRegistered: 0,
    disposed: 0,
    memoryFreed: 0,
    errors: 0,
    lastCleanup: new Date()
  };
  private isCleanupInProgress = false;
  private emergencyCleanupThreshold = 50; // Maximum resources before emergency cleanup

  constructor() {
    this.initializeCleanupManager();
  }

  private initializeCleanupManager(): void {
    console.log('🧹 Initializing Cleanup Manager...');
    
    // Register with system safety manager
    systemSafetyManager.addCleanupHandler(() => {
      this.performEmergencyCleanup();
    });

    // Set up periodic cleanup
    this.startPeriodicCleanup();
    
    // Set up emergency cleanup triggers
    this.setupEmergencyTriggers();
    
    console.log('✅ Cleanup Manager initialized');
  }

  /**
   * Register a disposable resource for automatic cleanup
   */
  public registerResource(
    id: string,
    type: DisposableResource['type'],
    resource: any,
    disposer: () => void,
    component?: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): void {
    const resourceInfo: DisposableResource = {
      id,
      type,
      resource,
      disposer,
      component,
      priority,
      createdAt: new Date(),
      lastAccessed: new Date()
    };

    this.resources.set(id, resourceInfo);
    this.cleanupStats.totalRegistered++;

    console.log(`📝 Registered ${type} resource: ${id}${component ? ` (${component})` : ''}`);

    // Check if emergency cleanup is needed
    if (this.resources.size >= this.emergencyCleanupThreshold) {
      console.warn(`⚠️ Resource count (${this.resources.size}) exceeds threshold. Triggering cleanup...`);
      this.performCleanup('auto-threshold');
    }
  }

  /**
   * Unregister and dispose a specific resource
   */
  public unregisterResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) {
      return false;
    }

    try {
      resource.disposer();
      this.resources.delete(id);
      this.cleanupStats.disposed++;
      
      console.log(`🗑️ Disposed ${resource.type} resource: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to dispose resource ${id}:`, error);
      this.cleanupStats.errors++;
      return false;
    }
  }

  /**
   * Register TensorFlow.js model for cleanup
   */
  public registerTensorFlowModel(modelId: string, model: any, component?: string): void {
    this.registerResource(
      modelId,
      'tensorflow-model',
      model,
      () => {
        if (model && typeof model.dispose === 'function') {
          model.dispose();
          performanceManager.unregisterModel(modelId);
        }
      },
      component,
      'high'
    );
  }

  /**
   * Register timer for cleanup
   */
  public registerTimer(timerId: string, timerHandle: NodeJS.Timeout, component?: string): void {
    this.registerResource(
      timerId,
      'timer',
      timerHandle,
      () => clearTimeout(timerHandle as any),
      component,
      'medium'
    );
  }

  /**
   * Register interval for cleanup
   */
  public registerInterval(intervalId: string, intervalHandle: NodeJS.Timeout, component?: string): void {
    this.registerResource(
      intervalId,
      'interval',
      intervalHandle,
      () => clearInterval(intervalHandle as any),
      component,
      'medium'
    );
  }

  /**
   * Register event listener for cleanup
   */
  public registerEventListener(
    listenerId: string,
    element: EventTarget,
    event: string,
    listener: EventListener,
    component?: string
  ): void {
    this.registerResource(
      listenerId,
      'event-listener',
      { element, event, listener },
      () => element.removeEventListener(event, listener),
      component,
      'low'
    );
  }

  /**
   * Register Web Worker for cleanup
   */
  public registerWebWorker(workerId: string, worker: Worker, component?: string): void {
    this.registerResource(
      workerId,
      'web-worker',
      worker,
      () => worker.terminate(),
      component,
      'medium'
    );
  }

  /**
   * Clean up all resources for a specific component
   */
  public cleanupComponent(componentName: string): void {
    console.log(`🧹 Cleaning up resources for component: ${componentName}`);
    
    const componentResources = Array.from(this.resources.entries())
      .filter(([, resource]) => resource.component === componentName);

    let disposed = 0;
    for (const [id] of componentResources) {
      if (this.unregisterResource(id)) {
        disposed++;
      }
    }

    console.log(`✅ Cleaned up ${disposed} resources for ${componentName}`);
  }

  /**
   * Perform cleanup based on various criteria
   */
  public performCleanup(reason: 'manual' | 'periodic' | 'emergency' | 'auto-threshold' = 'manual'): void {
    if (this.isCleanupInProgress) {
      console.log('⏳ Cleanup already in progress, skipping...');
      return;
    }

    this.isCleanupInProgress = true;
    console.log(`🧹 Starting cleanup (reason: ${reason})...`);

    try {
      const startTime = Date.now();
      let disposed = 0;

      // Sort resources by priority and age
      const sortedResources = Array.from(this.resources.entries())
        .sort(([, a], [, b]) => {
          // Priority order: low -> medium -> high (dispose low priority first)
          const priorityOrder = { low: 0, medium: 1, high: 2 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          
          // Then by age (oldest first)
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

      // Clean up based on reason
      let resourcesToClean: Array<[string, DisposableResource]> = [];
      
      if (reason === 'emergency' || reason === 'auto-threshold') {
        // Aggressive cleanup - remove 40% of resources, prioritizing low priority and old
        resourcesToClean = sortedResources.slice(0, Math.ceil(sortedResources.length * 0.4));
      } else if (reason === 'periodic') {
        // Periodic cleanup - remove old low-priority resources
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        resourcesToClean = sortedResources.filter(([, resource]) => 
          resource.priority === 'low' && resource.createdAt.getTime() < oneHourAgo
        );
      }
      // Manual cleanup cleans everything

      if (reason === 'manual') {
        // Clean all resources
        for (const [id] of sortedResources) {
          if (this.unregisterResource(id)) {
            disposed++;
          }
        }
      } else {
        // Clean selected resources
        for (const [id] of resourcesToClean) {
          if (this.unregisterResource(id)) {
            disposed++;
          }
        }
      }

      const duration = Date.now() - startTime;
      this.cleanupStats.lastCleanup = new Date();

      console.log(`✅ Cleanup complete: ${disposed} resources disposed in ${duration}ms`);
      
      // Trigger garbage collection if available
      if (reason === 'emergency' && typeof window !== 'undefined' && window.gc) {
        window.gc();
      }

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      this.cleanupStats.errors++;
    } finally {
      this.isCleanupInProgress = false;
    }
  }

  /**
   * Emergency cleanup for critical situations
   */
  public performEmergencyCleanup(): void {
    console.log('🚨 EMERGENCY CLEANUP TRIGGERED');
    this.performCleanup('emergency');
  }

  /**
   * Set up periodic cleanup
   */
  private startPeriodicCleanup(): void {
    const cleanupInterval = setInterval(() => {
      this.performCleanup('periodic');
    }, 10 * 60 * 1000); // Every 10 minutes

    // Register the cleanup interval itself
    this.registerInterval('cleanup-manager-periodic', cleanupInterval, 'CleanupManager');
  }

  /**
   * Set up emergency cleanup triggers
   */
  private setupEmergencyTriggers(): void {
    // Memory pressure detection
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const checkMemoryPressure = () => {
        const memory = (performance as any).memory;
        if (memory && memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
          console.warn('🚨 High memory usage detected - triggering emergency cleanup');
          this.performEmergencyCleanup();
        }
      };

      const memoryCheckInterval = setInterval(checkMemoryPressure, 30000); // Every 30 seconds
      this.registerInterval('memory-pressure-check', memoryCheckInterval, 'CleanupManager');
    }
  }

  /**
   * Get current cleanup statistics
   */
  public getCleanupStats(): CleanupStats & { activeResources: number } {
    return {
      ...this.cleanupStats,
      activeResources: this.resources.size
    };
  }

  /**
   * Get resources by component
   */
  public getResourcesByComponent(): Record<string, number> {
    const componentCounts: Record<string, number> = {};
    
    for (const resource of this.resources.values()) {
      const component = resource.component || 'global';
      componentCounts[component] = (componentCounts[component] || 0) + 1;
    }
    
    return componentCounts;
  }

  /**
   * Get resources by type
   */
  public getResourcesByType(): Record<DisposableResource['type'], number> {
    const typeCounts: Record<DisposableResource['type'], number> = {
      'tensorflow-model': 0,
      'timer': 0,
      'interval': 0,
      'event-listener': 0,
      'web-worker': 0,
      'custom': 0
    };
    
    for (const resource of this.resources.values()) {
      typeCounts[resource.type]++;
    }
    
    return typeCounts;
  }

  /**
   * Update resource access time (for LRU cleanup)
   */
  public markResourceAccessed(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      resource.lastAccessed = new Date();
    }
  }

  /**
   * Dispose of the cleanup manager itself
   */
  public dispose(): void {
    console.log('🧹 Disposing Cleanup Manager...');
    this.performCleanup('manual');
    console.log('✅ Cleanup Manager disposed');
  }
}

// Create and export singleton instance
export const cleanupManager = new CleanupManager(); 