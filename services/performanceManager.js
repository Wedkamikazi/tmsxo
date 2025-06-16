"use strict";
/**
 * UNIFIED PERFORMANCE & MEMORY MANAGER
 * Consolidates general performance monitoring with TensorFlow.js memory management
 * Handles memory management, caching, and performance monitoring for all services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceManager = void 0;
const tf = require("@tensorflow/tfjs");
const eventBus_1 = require("./eventBus");
const systemIntegrityService_1 = require("./systemIntegrityService");
const debugMode_1 = require("../utils/debugMode");
class PerformanceManager {
    constructor() {
        this.cache = new Map();
        this.operationTimes = [];
        this.CACHE_MAX_SIZE = 100;
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.MEMORY_CLEANUP_THRESHOLD = 0.8; // 80% memory usage
        this.MAX_OPERATION_TIMES = 100;
        // TENSORFLOW.JS MEMORY MANAGEMENT
        this.thresholds = {
            warning: 80 * 1024 * 1024,
            critical: 120 * 1024 * 1024,
            emergency: 150 * 1024 * 1024 // 150MB
        };
        this.monitoringInterval = null;
        this.modelRegistry = new Map();
        this.memoryHistory = [];
        this.maxHistorySize = 100;
        this.cleanupInProgress = false;
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
    setCache(key, data) {
        // Check if cache is at max size
        if (this.cache.size >= this.CACHE_MAX_SIZE) {
            this.evictLeastRecentlyUsed();
        }
        const entry = {
            data,
            timestamp: Date.now(),
            accessCount: 0,
            lastAccessed: Date.now()
        };
        this.cache.set(key, entry);
        this.updateMetrics();
    }
    getCache(key) {
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
        return entry.data;
    }
    clearCache() {
        this.cache.clear();
        this.updateMetrics();
    }
    evictLeastRecentlyUsed() {
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
    initializeTensorFlowMonitoring() {
        console.log('🧠 Initializing TensorFlow.js Memory Management...');
        // Set up cleanup triggers for TensorFlow.js
        this.setupTensorFlowCleanupTriggers();
        // Register for system events
        this.setupTensorFlowEventListeners();
        console.log('✅ TensorFlow.js Memory Management Initialized');
    }
    // Register ML model for memory tracking
    registerModel(modelId, modelName, model, priority = 'medium') {
        const memoryInfo = {
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
    unregisterModel(modelId) {
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
    touchModel(modelId) {
        const modelInfo = this.modelRegistry.get(modelId);
        if (modelInfo) {
            modelInfo.lastAccessed = new Date().toISOString();
        }
    }
    /**
     * UNIFIED MEMORY MANAGEMENT
     */
    getMemoryStats() {
        const stats = {
            used: 0,
            total: 0,
            percentage: 0
        };
        // Check if performance.memory is available (Chrome/Edge)
        if ('memory' in performance) {
            const memory = performance.memory;
            stats.jsHeapSizeLimit = memory.jsHeapSizeLimit;
            stats.usedJSHeapSize = memory.usedJSHeapSize;
            stats.totalJSHeapSize = memory.totalJSHeapSize;
            stats.used = memory.usedJSHeapSize;
            stats.total = memory.jsHeapSizeLimit;
            stats.percentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        }
        else {
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
                peakBytes: Math.max(...this.memoryHistory.map(h => { var _a; return ((_a = h.tensorflow) === null || _a === void 0 ? void 0 : _a.numBytes) || 0; }), tfMemory.numBytes)
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
    getMemoryHealthStatus() {
        var _a;
        const memoryStats = this.getMemoryStats();
        const tfMemory = ((_a = memoryStats.tensorflow) === null || _a === void 0 ? void 0 : _a.numBytes) || 0;
        let status = 'healthy';
        let threshold = 'Normal';
        if (tfMemory > this.thresholds.emergency) {
            status = 'emergency';
            threshold = 'Emergency (>150MB)';
        }
        else if (tfMemory > this.thresholds.critical) {
            status = 'critical';
            threshold = 'Critical (>120MB)';
        }
        else if (tfMemory > this.thresholds.warning) {
            status = 'warning';
            threshold = 'Warning (>80MB)';
        }
        const recommendations = [];
        if (status === 'emergency') {
            recommendations.push('Immediate cleanup required - dispose unused models');
            recommendations.push('Consider reducing model complexity');
        }
        else if (status === 'critical') {
            recommendations.push('Cleanup recommended - review model usage');
            recommendations.push('Monitor memory usage closely');
        }
        else if (status === 'warning') {
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
    startOperation() {
        const startTime = performance.now();
        return () => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            this.recordOperationTime(duration);
            this.metrics.operationCount++;
        };
    }
    recordOperationTime(duration) {
        this.operationTimes.push(duration);
        // Keep only recent operation times
        if (this.operationTimes.length > this.MAX_OPERATION_TIMES) {
            this.operationTimes.shift();
        }
        // Update average response time
        this.metrics.averageResponseTime =
            this.operationTimes.reduce((sum, time) => sum + time, 0) / this.operationTimes.length;
    }
    recordError() {
        this.metrics.errorCount++;
    }
    /**
     * UNIFIED MEMORY MONITORING & CLEANUP
     */
    startMemoryMonitoring() {
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
    checkMemoryThresholds() {
        var _a;
        const memoryStats = this.getMemoryStats();
        const tfMemory = ((_a = memoryStats.tensorflow) === null || _a === void 0 ? void 0 : _a.numBytes) || 0;
        if (tfMemory > this.thresholds.emergency) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'memoryThresholdCheck', 'TensorFlow.js memory usage critical - emergency cleanup required', 'critical', { usage: tfMemory, threshold: this.thresholds.emergency, usagePercent: (tfMemory / this.thresholds.emergency * 100).toFixed(1) });
            this.performTensorFlowCleanup(true);
            eventBus_1.eventBus.emit('MEMORY_EMERGENCY', {
                usage: tfMemory,
                threshold: this.thresholds.emergency
            }, 'PerformanceManager');
        }
        else if (tfMemory > this.thresholds.critical) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'memoryThresholdCheck', 'TensorFlow.js memory usage high - cleanup recommended', 'high', { usage: tfMemory, threshold: this.thresholds.critical, usagePercent: (tfMemory / this.thresholds.critical * 100).toFixed(1) });
            this.performTensorFlowCleanup(false);
            eventBus_1.eventBus.emit('MEMORY_CRITICAL', {
                usage: tfMemory,
                threshold: this.thresholds.critical
            }, 'PerformanceManager');
        }
        else if (tfMemory > this.thresholds.warning) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'memoryThresholdCheck', 'TensorFlow.js memory usage elevated - monitoring recommended', 'medium', { usage: tfMemory, threshold: this.thresholds.warning, usagePercent: (tfMemory / this.thresholds.warning * 100).toFixed(1) });
            eventBus_1.eventBus.emit('MEMORY_WARNING', {
                usage: tfMemory,
                threshold: this.thresholds.warning
            }, 'PerformanceManager');
        }
    }
    performMemoryCleanup() {
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
    async performTensorFlowCleanup(aggressive = false) {
        if (this.cleanupInProgress) {
            return;
        }
        this.cleanupInProgress = true;
        try {
            console.log('🧹 Starting TensorFlow.js Memory Cleanup...');
            // 1. Dispose inactive models first
            const modelsDisposed = [];
            for (const [modelId, modelInfo] of this.modelRegistry) {
                if (!modelInfo.isActive) {
                    modelsDisposed.push(modelInfo.modelName);
                    this.modelRegistry.delete(modelId);
                }
            }
            // 2. Run TensorFlow.js garbage collection
            tf.disposeVariables();
            // 3. Force browser garbage collection if available
            if ('gc' in window && typeof window.gc === 'function') {
                window.gc();
            }
            // 4. Aggressive cleanup for emergency situations
            if (aggressive) {
                const sortedModels = Array.from(this.modelRegistry.entries())
                    .sort(([, a], [, b]) => {
                    // Sort by priority (low first) then by last accessed (oldest first)
                    const priorityOrder = { low: 0, medium: 1, high: 2 };
                    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                    if (priorityDiff !== 0)
                        return priorityDiff;
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
        }
        finally {
            this.cleanupInProgress = false;
        }
    }
    cleanupExpiredCache() {
        const now = Date.now();
        const expiredKeys = [];
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
    cleanupOldStorageEntries() {
        try {
            // Clean up old performance data if it exists
            const oldKeys = Object.keys(localStorage).filter(key => key.startsWith('tms_perf_') || key.startsWith('tms_cache_'));
            oldKeys.forEach(key => {
                try {
                    const data = localStorage.getItem(key);
                    if (data) {
                        const parsed = JSON.parse(data);
                        if (parsed.timestamp && Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                            localStorage.removeItem(key);
                        }
                    }
                }
                catch (error) {
                    // If parsing fails, remove the key
                    localStorage.removeItem(key);
                }
            });
        }
        catch (error) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'cleanupOldStorageEntries', error instanceof Error ? error : new Error(String(error)), 'low', { operation: 'localStorage cleanup' });
        }
    }
    startPeriodicCleanup() {
        // Clean up every 10 minutes
        setInterval(() => {
            this.performMemoryCleanup();
        }, 10 * 60 * 1000);
    }
    setupTensorFlowCleanupTriggers() {
        // Clean up on visibility change (tab becomes hidden)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.performTensorFlowCleanup();
            }
        });
    }
    setupTensorFlowEventListeners() {
        eventBus_1.eventBus.on('DATA_CLEARED', () => {
            // Cleanup models when data is cleared
            this.performTensorFlowCleanup();
        });
    }
    getMetrics() {
        this.updateMetrics();
        return { ...this.metrics };
    }
    updateMetrics() {
        this.metrics.cacheSize = this.cache.size;
        this.metrics.memoryUsage = this.getMemoryStats().percentage;
    }
    calculateCacheHitRate() {
        const entries = Array.from(this.cache.values());
        const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
        return entries.length > 0 ? totalAccesses / entries.length : 0;
    }
    // TensorFlow.js helper methods
    estimateModelMemory(model) {
        try {
            // Rough estimation based on model parameters
            const params = model.countParams();
            return params * 4; // Assuming 32-bit floats
        }
        catch (error) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'estimateModelMemory', error instanceof Error ? error : new Error(String(error)), 'low', { operation: 'TensorFlow model memory estimation' });
            return 0;
        }
    }
    countModelTensors(model) {
        try {
            return model.layers.reduce((count, layer) => {
                return count + (layer.getWeights ? layer.getWeights().length : 0);
            }, 0);
        }
        catch (error) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'countModelTensors', error instanceof Error ? error : new Error(String(error)), 'low', { operation: 'TensorFlow model tensor counting' });
            return 0;
        }
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    getRegisteredModels() {
        return Array.from(this.modelRegistry.values());
    }
    getMemoryHistory() {
        return [...this.memoryHistory];
    }
    getPerformanceReport() {
        const memoryStats = this.getMemoryStats();
        const cacheHitRate = this.calculateCacheHitRate();
        const recommendations = [];
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
    batchProcess(items, processor, batchSize = 50) {
        return new Promise((resolve, reject) => {
            const results = [];
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
                    }
                    else {
                        resolve(results);
                    }
                }
                catch (error) {
                    systemIntegrityService_1.systemIntegrityService.logServiceError('PerformanceManager', 'batchProcess', error instanceof Error ? error : new Error(String(error)), 'medium', { batchSize, totalItems: items.length, currentIndex });
                    reject(error);
                }
            };
            processBatch();
        });
    }
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }
    destroy() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.cache.clear();
        this.modelRegistry.clear();
        this.memoryHistory = [];
    }
}
// Check for debug mode
const isDebugMode = (0, debugMode_1.isDebugMode)();
// Export singleton instance (skip TensorFlow initialization in debug mode)
let performanceManager;
exports.performanceManager = performanceManager;
if (isDebugMode) {
    console.log('🚨 PerformanceManager: Debug mode detected - creating mock instance (no TensorFlow)');
    exports.performanceManager = performanceManager = {
        getMemoryHealthStatus: () => ({
            status: 'healthy',
            currentUsage: 25,
            threshold: 'normal',
            recommendations: [],
            modelStats: { total: 0, active: 0, inactive: 0, highPriority: 0 },
            cacheStats: { size: 0, hitRate: 1.0, memoryUsage: 0 }
        }),
        getPerformanceReport: () => ({
            metrics: {
                memoryUsage: 25,
                cacheSize: 0,
                operationCount: 0,
                averageResponseTime: 0,
                errorCount: 0,
                lastCleanup: new Date()
            },
            memoryStats: {
                used: 25,
                total: 100,
                percentage: 25
            },
            cacheHitRate: 1.0,
            recommendations: ['Debug mode - all services mocked']
        }),
        registerModel: () => { },
        setCache: () => { },
        getCache: () => null,
        startOperation: () => () => { },
        recordError: () => { },
        dispose: () => Promise.resolve(),
        // Add other commonly used methods
        getMemoryStats: () => ({
            used: 25,
            total: 100,
            percentage: 25
        }),
        getMetrics: () => ({
            memoryUsage: 25,
            cacheSize: 0,
            operationCount: 0,
            averageResponseTime: 0,
            errorCount: 0,
            lastCleanup: new Date()
        }),
        touchModel: () => { },
        unregisterModel: () => { },
        clearCache: () => { },
        batchProcess: (items, processor) => Promise.resolve(items.map(processor))
    };
}
else {
    exports.performanceManager = performanceManager = new PerformanceManager();
}
