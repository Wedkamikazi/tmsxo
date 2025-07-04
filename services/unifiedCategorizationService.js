"use strict";
// UNIFIED CATEGORIZATION SERVICE
// Central orchestrator for all categorization strategies
// Implements fallback chain, performance monitoring, and unified API
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedCategorizationService = exports.UnifiedCategorizationService = void 0;
const categorization_1 = require("./categorization");
const ruleBasedMethod_1 = require("./categorization/ruleBasedMethod");
const mlEnhancedMethod_1 = require("./categorization/mlEnhancedMethod");
const tensorFlowMethod_1 = require("./categorization/tensorFlowMethod");
const debugMode_1 = require("../utils/debugMode");
const eventBus_1 = require("./eventBus");
class UnifiedCategorizationService {
    constructor() {
        this.initialized = false;
        this.initializationPromise = null;
        this.registry = new categorization_1.StrategyRegistry();
        this.performance = {
            totalCategorizations: 0,
            averageConfidence: 0,
            averageProcessingTime: 0,
            successRate: 0,
            methodBreakdown: {},
            lastUpdated: new Date().toISOString()
        };
        this.config = {
            primary: 'ml-enhanced',
            fallback: ['tensorflow', 'rule-based'],
            confidenceThreshold: 0.7,
            enableLearning: true,
            batchSize: 10,
            autoApplyHighConfidence: true,
            maxRetries: 3,
            retryDelay: 1000,
            debugMode: (0, debugMode_1.isDebugMode)(),
            performance: {
                trackMetrics: true,
                logSlowOperations: true,
                slowOperationThreshold: 2000
            }
        };
    }
    // INITIALIZATION
    async initialize() {
        if (this.initialized)
            return;
        if (this.initializationPromise)
            return this.initializationPromise;
        this.initializationPromise = this._performInitialization();
        await this.initializationPromise;
    }
    async _performInitialization() {
        try {
            console.log('🔄 Initializing Unified Categorization Service...');
            // Register strategies in order of priority
            await this._registerStrategies();
            // Load configuration
            await this._loadConfiguration();
            // Initialize performance tracking
            this._initializePerformanceTracking();
            this.initialized = true;
            console.log('✅ Unified Categorization Service initialized successfully');
            eventBus_1.eventBus.emit('CATEGORIZATION_SERVICE_READY', {
                strategies: this.registry.getAllStrategies().map(s => s.name),
                config: this.config
            });
        }
        catch (error) {
            console.error('❌ Failed to initialize Unified Categorization Service:', error);
            throw error;
        }
    }
    async _registerStrategies() {
        // Rule-based method (always available, highest priority for fallback)
        const ruleBasedMethod = new ruleBasedMethod_1.RuleBasedMethod();
        this.registry.register(ruleBasedMethod);
        // ML Enhanced method (primary strategy)
        const mlEnhancedMethod = new mlEnhancedMethod_1.MLEnhancedMethod();
        this.registry.register(mlEnhancedMethod);
        // TensorFlow method (advanced ML when available)
        if (!this.config.debugMode) {
            const tensorFlowMethod = new tensorFlowMethod_1.TensorFlowMethod();
            this.registry.register(tensorFlowMethod);
        }
        console.log(`📋 Registered ${this.registry.getAllStrategies().length} categorization strategies`);
    }
    async _loadConfiguration() {
        try {
            const savedConfig = localStorage.getItem('unifiedCategorizationConfig');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
                this.registry.updateConfig(this.config);
            }
        }
        catch (error) {
            console.warn('Failed to load categorization configuration:', error);
        }
    }
    _initializePerformanceTracking() {
        const savedPerformance = localStorage.getItem('categorizationPerformance');
        if (savedPerformance) {
            try {
                this.performance = JSON.parse(savedPerformance);
            }
            catch (error) {
                console.warn('Failed to load performance data:', error);
            }
        }
    }
    // CORE CATEGORIZATION API
    async categorizeTransaction(transaction) {
        await this.initialize();
        const startTime = performance.now();
        let result;
        try {
            result = await this._executeCategorization(transaction);
            this._updatePerformanceMetrics(result, performance.now() - startTime);
            // Log slow operations
            if (this.config.performance.logSlowOperations &&
                result.processingTime > this.config.performance.slowOperationThreshold) {
                console.warn(`🐌 Slow categorization: ${result.processingTime}ms for ${transaction.description}`);
            }
            return result;
        }
        catch (error) {
            console.error('❌ Categorization failed:', error);
            // Return fallback result
            result = this._createFallbackResult(transaction, error);
            this._updatePerformanceMetrics(result, performance.now() - startTime);
            return result;
        }
    }
    async _executeCategorization(transaction) {
        const availableStrategies = await this.registry.getAvailableStrategies();
        if (availableStrategies.length === 0) {
            throw new Error('No categorization strategies available');
        }
        // Try primary strategy first
        const primaryStrategy = availableStrategies.find(s => s.name === this.config.primary);
        if (primaryStrategy) {
            try {
                const result = await primaryStrategy.categorize(transaction);
                if (result.confidence >= this.config.confidenceThreshold) {
                    return result;
                }
            }
            catch (error) {
                console.warn(`Primary strategy ${this.config.primary} failed:`, error);
            }
        }
        // Try fallback strategies
        for (const fallbackName of this.config.fallback) {
            const strategy = availableStrategies.find(s => s.name === fallbackName);
            if (strategy) {
                try {
                    const result = await strategy.categorize(transaction);
                    if (result.confidence >= this.config.confidenceThreshold * 0.8) { // Lower threshold for fallback
                        result.metadata.fallbackReason = `Primary strategy ${this.config.primary} insufficient confidence`;
                        return result;
                    }
                }
                catch (error) {
                    console.warn(`Fallback strategy ${fallbackName} failed:`, error);
                }
            }
        }
        // If all else fails, use first available strategy with any confidence
        const lastResort = availableStrategies[0];
        const result = await lastResort.categorize(transaction);
        result.metadata.fallbackReason = 'All primary strategies failed or had low confidence';
        return result;
    }
    // BATCH CATEGORIZATION
    async batchCategorize(transactions, options = {}) {
        await this.initialize();
        const { batchSize = this.config.batchSize, progressCallback, abortSignal } = options;
        const results = [];
        const batches = this._createBatches(transactions, batchSize);
        console.log(`🔄 Starting batch categorization: ${transactions.length} transactions in ${batches.length} batches`);
        for (let i = 0; i < batches.length; i++) {
            if (abortSignal === null || abortSignal === void 0 ? void 0 : abortSignal.aborted) {
                throw new Error('Batch categorization aborted');
            }
            const batch = batches[i];
            const batchResults = await this._processBatch(batch);
            results.push(...batchResults);
            if (progressCallback) {
                progressCallback(results.length, transactions.length);
            }
            // Small delay between batches to prevent UI blocking
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        console.log(`✅ Batch categorization complete: ${results.length} transactions processed`);
        eventBus_1.eventBus.emit('BATCH_CATEGORIZATION_COMPLETE', {
            total: transactions.length,
            successful: results.filter(r => r.method !== 'fallback').length,
            averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
        });
        return results;
    }
    async _processBatch(transactions) {
        // Try to use batch processing if available
        const availableStrategies = await this.registry.getAvailableStrategies();
        const primaryStrategy = availableStrategies.find(s => s.name === this.config.primary);
        if (primaryStrategy === null || primaryStrategy === void 0 ? void 0 : primaryStrategy.batchCategorize) {
            try {
                return await primaryStrategy.batchCategorize(transactions);
            }
            catch (error) {
                console.warn('Batch processing failed, falling back to individual processing:', error);
            }
        }
        // Fallback to individual processing
        const results = [];
        for (const transaction of transactions) {
            try {
                const result = await this.categorizeTransaction(transaction);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to categorize transaction ${transaction.id}:`, error);
                results.push(this._createFallbackResult(transaction, error));
            }
        }
        return results;
    }
    _createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    // CONFIGURATION MANAGEMENT
    getConfiguration() {
        return { ...this.config };
    }
    updateConfiguration(updates) {
        this.config = { ...this.config, ...updates };
        this.registry.updateConfig(this.config);
        // Save to localStorage
        try {
            localStorage.setItem('unifiedCategorizationConfig', JSON.stringify(this.config));
        }
        catch (error) {
            console.warn('Failed to save categorization configuration:', error);
        }
        eventBus_1.eventBus.emit('CATEGORIZATION_CONFIG_UPDATED', this.config);
    }
    // PERFORMANCE MONITORING
    getPerformanceMetrics() {
        return { ...this.performance };
    }
    _updatePerformanceMetrics(result, processingTime) {
        if (!this.config.performance.trackMetrics)
            return;
        this.performance.totalCategorizations++;
        this.performance.averageProcessingTime =
            (this.performance.averageProcessingTime * (this.performance.totalCategorizations - 1) + processingTime) /
                this.performance.totalCategorizations;
        this.performance.averageConfidence =
            (this.performance.averageConfidence * (this.performance.totalCategorizations - 1) + result.confidence) /
                this.performance.totalCategorizations;
        // Update method breakdown
        this.performance.methodBreakdown[result.method] =
            (this.performance.methodBreakdown[result.method] || 0) + 1;
        // Update success rate
        const successful = result.method !== 'fallback' && result.confidence >= this.config.confidenceThreshold;
        const currentSuccessful = this.performance.successRate * (this.performance.totalCategorizations - 1);
        this.performance.successRate = (currentSuccessful + (successful ? 1 : 0)) / this.performance.totalCategorizations;
        this.performance.lastUpdated = new Date().toISOString();
        // Save performance data periodically
        if (this.performance.totalCategorizations % 10 === 0) {
            try {
                localStorage.setItem('categorizationPerformance', JSON.stringify(this.performance));
            }
            catch (error) {
                console.warn('Failed to save performance data:', error);
            }
        }
    }
    // STRATEGY MANAGEMENT
    async getAvailableStrategies() {
        await this.initialize();
        const strategies = await this.registry.getAvailableStrategies();
        return strategies.map(s => s.name);
    }
    async switchPrimaryStrategy(strategyName) {
        await this.initialize();
        const strategy = this.registry.getStrategy(strategyName);
        if (!strategy) {
            throw new Error(`Strategy ${strategyName} not found`);
        }
        const isAvailable = await strategy.isAvailable();
        if (!isAvailable) {
            throw new Error(`Strategy ${strategyName} is not available`);
        }
        this.config.primary = strategyName;
        this.updateConfiguration({ primary: strategyName });
        console.log(`🔄 Switched primary categorization strategy to: ${strategyName}`);
    }
    // UTILITY METHODS
    _createFallbackResult(_transaction, error) {
        return {
            categoryId: 'uncategorized',
            categoryName: 'Uncategorized',
            confidence: 0.1,
            method: 'fallback',
            reasoning: 'Automatic categorization failed, manual review required',
            suggestions: ['Review transaction manually', 'Check categorization rules'],
            alternatives: [],
            processingTime: 0,
            metadata: {
                anomalyDetected: true,
                fallbackReason: error instanceof Error ? error.message : 'Unknown error',
                strategyUsed: 'error-fallback'
            }
        };
    }
    // UTILITY METHODS
    async ensureInitialized() {
        await this.initialize();
    }
    // CLEANUP
    dispose() {
        this.registry.dispose();
        this.initialized = false;
        this.initializationPromise = null;
        console.log('🧹 Unified Categorization Service disposed');
    }
}
exports.UnifiedCategorizationService = UnifiedCategorizationService;
// Singleton instance
exports.unifiedCategorizationService = new UnifiedCategorizationService();
exports.default = exports.unifiedCategorizationService;
