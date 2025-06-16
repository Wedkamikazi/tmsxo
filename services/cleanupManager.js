"use strict";
/**
 * CENTRALIZED CLEANUP MANAGER SERVICE
 * Manages all disposable resources, timers, event listeners, and TensorFlow models
 * Prevents memory leaks and ensures proper resource cleanup
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupManager = void 0;
const performanceManager_1 = require("./performanceManager");
const systemSafetyManager_1 = require("../utils/systemSafetyManager");
class CleanupManager {
    constructor() {
        this.resources = new Map();
        this.cleanupStats = {
            totalRegistered: 0,
            disposed: 0,
            memoryFreed: 0,
            errors: 0,
            lastCleanup: new Date()
        };
        this.isCleanupInProgress = false;
        this.emergencyCleanupThreshold = 50; // Maximum resources before emergency cleanup
        this.initializeCleanupManager();
    }
    initializeCleanupManager() {
        console.log('🧹 Initializing Cleanup Manager...');
        // Register with system safety manager
        systemSafetyManager_1.systemSafetyManager.addCleanupHandler(() => {
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
    registerResource(id, type, resource, disposer, component, priority = 'medium') {
        const resourceInfo = {
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
    unregisterResource(id) {
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
        }
        catch (error) {
            console.error(`❌ Failed to dispose resource ${id}:`, error);
            this.cleanupStats.errors++;
            return false;
        }
    }
    /**
     * Register TensorFlow.js model for cleanup
     */
    registerTensorFlowModel(modelId, model, component) {
        this.registerResource(modelId, 'tensorflow-model', model, () => {
            if (model && typeof model.dispose === 'function') {
                model.dispose();
                performanceManager_1.performanceManager.unregisterModel(modelId);
            }
        }, component, 'high');
    }
    /**
     * Register timer for cleanup
     */
    registerTimer(timerId, timerHandle, component) {
        this.registerResource(timerId, 'timer', timerHandle, () => clearTimeout(timerHandle), component, 'medium');
    }
    /**
     * Register interval for cleanup
     */
    registerInterval(intervalId, intervalHandle, component) {
        this.registerResource(intervalId, 'interval', intervalHandle, () => clearInterval(intervalHandle), component, 'medium');
    }
    /**
     * Register event listener for cleanup
     */
    registerEventListener(listenerId, element, event, listener, component) {
        this.registerResource(listenerId, 'event-listener', { element, event, listener }, () => element.removeEventListener(event, listener), component, 'low');
    }
    /**
     * Register Web Worker for cleanup
     */
    registerWebWorker(workerId, worker, component) {
        this.registerResource(workerId, 'web-worker', worker, () => worker.terminate(), component, 'medium');
    }
    /**
     * Clean up all resources for a specific component
     */
    cleanupComponent(componentName) {
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
    performCleanup(reason = 'manual') {
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
                if (priorityDiff !== 0)
                    return priorityDiff;
                // Then by age (oldest first)
                return a.createdAt.getTime() - b.createdAt.getTime();
            });
            // Clean up based on reason
            let resourcesToClean = [];
            if (reason === 'emergency' || reason === 'auto-threshold') {
                // Aggressive cleanup - remove 40% of resources, prioritizing low priority and old
                resourcesToClean = sortedResources.slice(0, Math.ceil(sortedResources.length * 0.4));
            }
            else if (reason === 'periodic') {
                // Periodic cleanup - remove old low-priority resources
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                resourcesToClean = sortedResources.filter(([, resource]) => resource.priority === 'low' && resource.createdAt.getTime() < oneHourAgo);
            }
            // Manual cleanup cleans everything
            if (reason === 'manual') {
                // Clean all resources
                for (const [id] of sortedResources) {
                    if (this.unregisterResource(id)) {
                        disposed++;
                    }
                }
            }
            else {
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
        }
        catch (error) {
            console.error('❌ Error during cleanup:', error);
            this.cleanupStats.errors++;
        }
        finally {
            this.isCleanupInProgress = false;
        }
    }
    /**
     * Emergency cleanup for critical situations
     */
    performEmergencyCleanup() {
        console.log('🚨 EMERGENCY CLEANUP TRIGGERED');
        this.performCleanup('emergency');
    }
    /**
     * Set up periodic cleanup
     */
    startPeriodicCleanup() {
        const cleanupInterval = setInterval(() => {
            this.performCleanup('periodic');
        }, 10 * 60 * 1000); // Every 10 minutes
        // Register the cleanup interval itself
        this.registerInterval('cleanup-manager-periodic', cleanupInterval, 'CleanupManager');
    }
    /**
     * Set up emergency cleanup triggers
     */
    setupEmergencyTriggers() {
        // Memory pressure detection
        if (typeof window !== 'undefined' && 'memory' in performance) {
            const checkMemoryPressure = () => {
                const memory = performance.memory;
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
    getCleanupStats() {
        return {
            ...this.cleanupStats,
            activeResources: this.resources.size
        };
    }
    /**
     * Get resources by component
     */
    getResourcesByComponent() {
        const componentCounts = {};
        for (const resource of this.resources.values()) {
            const component = resource.component || 'global';
            componentCounts[component] = (componentCounts[component] || 0) + 1;
        }
        return componentCounts;
    }
    /**
     * Get resources by type
     */
    getResourcesByType() {
        const typeCounts = {
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
    markResourceAccessed(id) {
        const resource = this.resources.get(id);
        if (resource) {
            resource.lastAccessed = new Date();
        }
    }
    /**
     * Dispose of the cleanup manager itself
     */
    dispose() {
        console.log('🧹 Disposing Cleanup Manager...');
        this.performCleanup('manual');
        console.log('✅ Cleanup Manager disposed');
    }
}
// Create and export singleton instance
exports.cleanupManager = new CleanupManager();
