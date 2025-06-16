"use strict";
// ML-ENHANCED CATEGORIZATION METHOD - BASIC STRUCTURE
// Extracted from enhancedCategorizationService.ts - implements ML-enhanced transaction categorization
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLEnhancedMethod = void 0;
const enhancedMLOrchestrator_1 = require("../enhancedMLOrchestrator");
const localStorageManager_1 = require("../localStorageManager");
const eventBus_1 = require("../eventBus");
const systemIntegrityService_1 = require("../systemIntegrityService");
class MLEnhancedMethod {
    constructor() {
        this.name = 'ml-enhanced';
        this.priority = 1; // Highest priority method
        this.isInitialized = false;
        this.strategy = {
            primary: 'ml-enhanced',
            fallback: 'rule-based',
            confidenceThreshold: 0.7,
            useOllamaWhenAvailable: true,
            enableLearning: true
        };
        this.performance = {
            totalCategorizations: 0,
            accuracyRate: 0.85,
            averageConfidence: 0.75,
            methodBreakdown: {
                mlEnhanced: 0,
                ruleBased: 0,
                manual: 0,
                default: 0
            },
            averageProcessingTime: 0,
            ollamaUsageRate: 0,
            learningDataPoints: 0,
            enhancedMetrics: {
                fallbackRate: 0,
                improvementRate: 0,
                userCorrectionRate: 0,
                averageAlternativesProvided: 2.5
            }
        };
        this.categoryMappings = new Map();
        this.learningHistory = [];
        this.PERFORMANCE_KEY = 'tms_ml_enhanced_performance';
        this.LEARNING_KEY = 'tms_ml_enhanced_learning';
        this.initializeMLEnhanced();
    }
    async isAvailable() {
        try {
            // Check if ML orchestrator is available
            const mlStatus = enhancedMLOrchestrator_1.enhancedMLOrchestrator.getModelStatus();
            return mlStatus.tensorflowJS.categorization || mlStatus.ollama.available;
        }
        catch (error) {
            console.error('Error checking ML-Enhanced availability:', error);
            return false;
        }
    }
    async categorize(transaction) {
        var _a, _b, _c, _d, _e;
        if (!this.isInitialized) {
            throw new Error('ML-Enhanced method not initialized');
        }
        const startTime = Date.now();
        this.performance.totalCategorizations++;
        try {
            // Call ML orchestrator for enhanced categorization
            const mlResult = await enhancedMLOrchestrator_1.enhancedMLOrchestrator.categorizeTransaction(transaction);
            const category = this.categoryMappings.get(mlResult.categoryId);
            // Update performance metrics
            this.performance.methodBreakdown.mlEnhanced++;
            if (mlResult.modelUsed === 'ollama') {
                this.performance.ollamaUsageRate =
                    (this.performance.ollamaUsageRate * (this.performance.totalCategorizations - 1) + 1) /
                        this.performance.totalCategorizations;
            }
            const processingTime = Date.now() - startTime;
            // Convert to unified result format
            let result = {
                categoryId: mlResult.categoryId,
                categoryName: (category === null || category === void 0 ? void 0 : category.name) || mlResult.categoryId,
                confidence: mlResult.confidence,
                method: 'ml-enhanced',
                reasoning: mlResult.reasoning,
                suggestions: ((_a = mlResult.enhancedAnalysis) === null || _a === void 0 ? void 0 : _a.businessInsights) || [],
                alternatives: mlResult.alternativeCategories.map(alt => {
                    var _a;
                    return ({
                        categoryId: alt.categoryId,
                        categoryName: ((_a = this.categoryMappings.get(alt.categoryId)) === null || _a === void 0 ? void 0 : _a.name) || alt.categoryId,
                        confidence: alt.confidence
                    });
                }),
                processingTime,
                metadata: {
                    modelUsed: mlResult.modelUsed,
                    anomalyDetected: ((_b = mlResult.metadata) === null || _b === void 0 ? void 0 : _b.isAnomaly) || false,
                    sentiment: (_c = mlResult.metadata) === null || _c === void 0 ? void 0 : _c.sentiment,
                    entities: (_d = mlResult.enhancedAnalysis) === null || _d === void 0 ? void 0 : _d.businessInsights,
                    patterns: (_e = mlResult.enhancedAnalysis) === null || _e === void 0 ? void 0 : _e.patternRecognition,
                    strategyUsed: 'ml-enhanced'
                }
            };
            // Update performance metrics and store learning data
            this.updatePerformanceMetrics(result);
            if (this.strategy.enableLearning) {
                this.storeLearningData(transaction, result);
            }
            // Check if confidence is above threshold, otherwise try fallback
            if (result.confidence < this.strategy.confidenceThreshold) {
                console.log(`🔄 Low confidence (${result.confidence}), trying fallback strategy`);
                const fallbackResult = await this.tryFallbackStrategy(transaction);
                if (fallbackResult.confidence > result.confidence) {
                    result = fallbackResult;
                }
            }
            // Emit categorization event
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
                transactionId: transaction.id,
                categoryId: result.categoryId,
                method: result.method,
                confidence: result.confidence
            }, 'MLEnhancedMethod');
            return result;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.logError('categorize', error, 'high');
            return this.createDefaultResult(transaction, processingTime, String(error));
        }
    }
    async batchCategorize(transactions) {
        return Promise.all(transactions.map(t => this.categorize(t)));
    }
    // INITIALIZATION AND SETUP
    async initializeMLEnhanced() {
        try {
            console.log('🎯 Initializing ML-Enhanced Categorization Method...');
            // Load categories and build mappings
            this.loadCategoryMappings();
            // Load performance history
            this.loadPerformanceHistory();
            // Load learning data
            this.loadLearningHistory();
            // Ensure ML orchestrator is ready
            await enhancedMLOrchestrator_1.enhancedMLOrchestrator.ensureInitialized();
            // Setup event listeners
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('✅ ML-Enhanced Categorization Method Ready');
        }
        catch (error) {
            this.logError('initializeMLEnhanced', error, 'critical');
            this.isInitialized = false;
        }
    }
    loadCategoryMappings() {
        const categories = localStorageManager_1.localStorageManager.getAllCategories();
        this.categoryMappings.clear();
        categories.forEach(cat => this.categoryMappings.set(cat.id, cat));
    }
    loadPerformanceHistory() {
        try {
            const data = localStorage.getItem(this.PERFORMANCE_KEY);
            if (data) {
                const saved = JSON.parse(data);
                this.performance = { ...this.performance, ...saved };
            }
        }
        catch (error) {
            console.warn('Failed to load ML-Enhanced performance history:', error);
        }
    }
    loadLearningHistory() {
        try {
            const data = localStorage.getItem(this.LEARNING_KEY);
            if (data) {
                this.learningHistory = JSON.parse(data);
            }
        }
        catch (error) {
            console.warn('Failed to load ML-Enhanced learning history:', error);
        }
    }
    setupEventListeners() {
        // Listen for category updates to refresh mappings
        eventBus_1.eventBus.on('CATEGORIES_UPDATED', () => {
            this.loadCategoryMappings();
        });
    }
    // UTILITY METHODS (using createDefaultResult instead)
    logError(operation, error, severity) {
        systemIntegrityService_1.systemIntegrityService.logServiceError('MLEnhancedMethod', operation, error instanceof Error ? error : new Error(String(error)), severity, { method: 'ml-enhanced' });
    }
    // PUBLIC API METHODS (for external access)
    getStrategy() {
        return { ...this.strategy };
    }
    getPerformanceMetrics() {
        return { ...this.performance };
    }
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initializeMLEnhanced();
        }
    }
    // PERFORMANCE AND LEARNING METHODS
    updatePerformanceMetrics(result) {
        // Update averages
        const total = this.performance.totalCategorizations;
        this.performance.averageConfidence =
            (this.performance.averageConfidence * (total - 1) + result.confidence) / total;
        this.performance.averageProcessingTime =
            (this.performance.averageProcessingTime * (total - 1) + result.processingTime) / total;
        // Calculate enhanced metrics
        if (result.method === 'fallback') {
            this.performance.enhancedMetrics.fallbackRate =
                (this.performance.enhancedMetrics.fallbackRate * (total - 1) + 1) / total;
        }
        this.performance.enhancedMetrics.averageAlternativesProvided =
            (this.performance.enhancedMetrics.averageAlternativesProvided * (total - 1) + result.alternatives.length) / total;
        // Save performance data
        this.savePerformanceHistory();
    }
    storeLearningData(transaction, result) {
        const learningPoint = {
            transactionId: transaction.id,
            originalPrediction: result.categoryId,
            correctedCategory: result.categoryId,
            confidence: result.confidence,
            method: result.method,
            timestamp: new Date().toISOString(),
            contextualFactors: result.metadata.patterns
        };
        this.learningHistory.push(learningPoint);
        // Keep only recent learning data (last 1000 points)
        if (this.learningHistory.length > 1000) {
            this.learningHistory = this.learningHistory.slice(-1000);
        }
        this.performance.learningDataPoints = this.learningHistory.length;
        this.saveLearningHistory();
    }
    savePerformanceHistory() {
        try {
            localStorage.setItem(this.PERFORMANCE_KEY, JSON.stringify(this.performance));
        }
        catch (error) {
            console.warn('Failed to save ML-Enhanced performance history:', error);
        }
    }
    saveLearningHistory() {
        try {
            localStorage.setItem(this.LEARNING_KEY, JSON.stringify(this.learningHistory));
        }
        catch (error) {
            console.warn('Failed to save ML-Enhanced learning history:', error);
        }
    }
    // FALLBACK STRATEGY METHODS
    async tryFallbackStrategy(transaction) {
        try {
            switch (this.strategy.fallback) {
                case 'rule-based':
                    return await this.categorizeWithRules(transaction);
                case 'manual':
                    return await this.categorizeWithManual(transaction);
                default:
                    return this.createDefaultResult(transaction, 0, 'fallback_to_default');
            }
        }
        catch (error) {
            this.logError('tryFallbackStrategy', error, 'medium');
            return this.createDefaultResult(transaction, 0, String(error));
        }
    }
    async categorizeWithRules(transaction) {
        // Import rule-based method to avoid circular dependencies
        const { RuleBasedMethod } = await Promise.resolve().then(() => require('./ruleBasedMethod'));
        const ruleBasedMethod = new RuleBasedMethod();
        try {
            const result = await ruleBasedMethod.categorize(transaction);
            // Update performance metrics
            this.performance.methodBreakdown.ruleBased++;
            this.performance.enhancedMetrics.fallbackRate =
                (this.performance.enhancedMetrics.fallbackRate * this.performance.totalCategorizations + 1) /
                    (this.performance.totalCategorizations + 1);
            // Mark as fallback method
            result.metadata.fallbackReason = 'low_ml_confidence';
            result.metadata.strategyUsed = 'rule-based-fallback';
            return result;
        }
        finally {
            ruleBasedMethod.dispose();
        }
    }
    async categorizeWithManual(transaction) {
        // Check if manual categorization exists - use localStorage directly to avoid circular dependency
        try {
            const categorizations = JSON.parse(localStorage.getItem('transaction-categorizations') || '[]');
            const existingCategorization = categorizations.find((cat) => cat.transactionId === transaction.id);
            if (existingCategorization) {
                const category = this.categoryMappings.get(existingCategorization.categoryId);
                this.performance.methodBreakdown.manual++;
                return {
                    categoryId: existingCategorization.categoryId,
                    categoryName: (category === null || category === void 0 ? void 0 : category.name) || existingCategorization.categoryId,
                    confidence: 1.0,
                    method: 'manual',
                    reasoning: existingCategorization.reasoning || 'Manual categorization',
                    suggestions: [],
                    alternatives: [],
                    processingTime: 0,
                    metadata: {
                        anomalyDetected: false,
                        fallbackReason: 'low_ml_confidence',
                        strategyUsed: 'manual-fallback'
                    }
                };
            }
        }
        catch (error) {
            console.warn('Failed to load manual categorizations:', error);
        }
        throw new Error('No manual categorization available');
    }
    createDefaultResult(_transaction, processingTime, fallbackReason) {
        this.performance.methodBreakdown.default++;
        return {
            categoryId: 'cat_expense',
            categoryName: 'Expense',
            confidence: 0.3,
            method: 'fallback',
            reasoning: 'Default categorization due to processing failure or low confidence',
            suggestions: ['Manual review recommended', 'Consider adding categorization rules'],
            alternatives: [],
            processingTime,
            metadata: {
                anomalyDetected: false,
                fallbackReason: fallbackReason || 'default_categorization',
                strategyUsed: 'default-fallback'
            }
        };
    }
    // STRATEGY CONFIGURATION
    updateStrategy(newStrategy) {
        this.strategy = { ...this.strategy, ...newStrategy };
        console.log('🔧 ML-Enhanced strategy updated:', this.strategy);
    }
    // FEEDBACK AND IMPROVEMENT
    async improveFromFeedback(transactionId, correctCategoryId) {
        const learningPoint = this.learningHistory.find(l => l.transactionId === transactionId);
        if (learningPoint) {
            learningPoint.correctedCategory = correctCategoryId;
            learningPoint.improvementFactor = learningPoint.originalPrediction !== correctCategoryId ? 1 : 0;
            this.performance.enhancedMetrics.userCorrectionRate =
                (this.performance.enhancedMetrics.userCorrectionRate * this.performance.totalCategorizations + 1) /
                    (this.performance.totalCategorizations + 1);
            this.saveLearningHistory();
            this.savePerformanceHistory();
        }
    }
    dispose() {
        this.categoryMappings.clear();
        this.learningHistory = [];
        this.isInitialized = false;
        console.log(`ML-Enhanced method disposed with ${this.learningHistory.length} learning data points`);
    }
}
exports.MLEnhancedMethod = MLEnhancedMethod;
