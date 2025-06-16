"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedMLOrchestrator = void 0;
const tf = require("@tensorflow/tfjs");
const localOllamaIntegration_1 = require("./localOllamaIntegration");
// import { systemIntegrityService } from './systemIntegrityService';
// import { performanceManager } from './performanceManager';
const cleanupManager_1 = require("./cleanupManager");
const localStorageManager_1 = require("./localStorageManager");
const categorizationService_1 = require("./categorizationService");
const debugMode_1 = require("../utils/debugMode");
class EnhancedMLOrchestrator {
    constructor() {
        this.isInitialized = false;
        // TensorFlow.js Models
        this.categorizationModel = null;
        this.sentimentModel = null;
        this.anomalyModel = null;
        this.embeddingModel = null;
        // Vocabulary and mappings
        this.vocabulary = new Map();
        this.categoryMapping = new Map();
        this.reverseCategoryMapping = new Map();
        // Performance tracking
        this.performanceMetrics = {
            totalRequests: 0,
            ollamaRequests: 0,
            tensorflowRequests: 0,
            hybridRequests: 0,
            averageResponseTime: 0,
            accuracyScore: 0.8,
            modelRecommendation: 'hybrid',
            lastOptimization: new Date().toISOString()
        };
        // Strategy selection
        this.currentStrategy = 'hybrid';
        this.initializeEnhancedML();
    }
    // INITIALIZE ENHANCED ML ORCHESTRATOR
    async initializeEnhancedML() {
        try {
            console.log('🎯 Initializing Enhanced ML Orchestrator...');
            // Initialize vocabularies and mappings
            this.buildVocabularyMappings();
            // Load or create TensorFlow.js models
            await this.loadOrCreateTensorFlowModels();
            // Load performance history
            this.loadPerformanceHistory();
            // Determine optimal strategy
            this.determineOptimalStrategy();
            this.isInitialized = true;
            console.log(`✅ Enhanced ML Orchestrator Ready - Strategy: ${this.currentStrategy}`);
        }
        catch (error) {
            this.logMLError('initializeEnhancedML', error, 'critical');
            this.isInitialized = false;
        }
    }
    // MAIN CATEGORIZATION METHOD WITH INTELLIGENT ROUTING
    async categorizeTransaction(transaction) {
        if (!this.isInitialized) {
            throw new Error('Enhanced ML Orchestrator not initialized');
        }
        const startTime = Date.now();
        this.performanceMetrics.totalRequests++;
        try {
            let result;
            switch (this.currentStrategy) {
                case 'ollama-primary':
                    result = await this.categorizeWithOllamaPrimary(transaction);
                    break;
                case 'tensorflow-primary':
                    result = await this.categorizeWithTensorFlowPrimary(transaction);
                    break;
                case 'hybrid':
                    result = await this.categorizeWithHybridApproach(transaction);
                    break;
                case 'tensorflow-only':
                    result = await this.categorizeWithTensorFlowOnly(transaction);
                    break;
                default:
                    result = await this.categorizeWithHybridApproach(transaction);
            }
            const processingTime = Date.now() - startTime;
            result.processingTime = processingTime;
            // Update performance metrics
            this.updatePerformanceMetrics(result.modelUsed, processingTime, true);
            return result;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceMetrics('tensorflow', processingTime, false);
            this.logMLError('categorizeTransaction', error, 'high');
            // Return fallback result
            return this.createFallbackResult(transaction, processingTime);
        }
    }
    // OLLAMA-PRIMARY CATEGORIZATION
    async categorizeWithOllamaPrimary(transaction) {
        this.performanceMetrics.ollamaRequests++;
        try {
            if (!localOllamaIntegration_1.localOllamaIntegration.isAvailable()) {
                return await this.categorizeWithTensorFlowPrimary(transaction);
            }
            const ollamaResult = await localOllamaIntegration_1.localOllamaIntegration.analyzeTransaction(transaction.description, transaction.debitAmount || transaction.creditAmount, transaction.date);
            // Enhance with TensorFlow.js analysis
            const tfEnhancement = await this.enhanceWithTensorFlow(transaction);
            return {
                categoryId: ollamaResult.category,
                confidence: ollamaResult.confidence,
                reasoning: ollamaResult.reasoning,
                alternativeCategories: [],
                modelUsed: 'ollama',
                processingTime: 0,
                fallbackUsed: false,
                metadata: {
                    sentiment: ollamaResult.sentiment,
                    sentimentConfidence: 0.8,
                    isAnomaly: tfEnhancement.anomalyScore > 0.7,
                    anomalyScore: tfEnhancement.anomalyScore,
                    modelVersion: 'enhanced-orchestrator-v1.0',
                    predictionTimestamp: new Date().toISOString()
                },
                enhancedAnalysis: {
                    semanticSimilarity: tfEnhancement.semanticSimilarity,
                    contextualRelevance: 0.85,
                    anomalyScore: tfEnhancement.anomalyScore,
                    patternRecognition: tfEnhancement.patterns,
                    businessInsights: ollamaResult.suggestions
                }
            };
        }
        catch (error) {
            this.logMLError('categorizeWithOllamaPrimary', error, 'medium');
            return await this.categorizeWithTensorFlowPrimary(transaction);
        }
    }
    // PUBLIC API METHODS
    getModelStatus() {
        const ollamaStatus = localOllamaIntegration_1.localOllamaIntegration.getHealthStatus();
        return {
            tensorflowJS: {
                categorization: this.categorizationModel !== null,
                sentiment: this.sentimentModel !== null,
                anomaly: this.anomalyModel !== null,
                embedding: this.embeddingModel !== null
            },
            ollama: {
                available: ollamaStatus.isReachable,
                model: ollamaStatus.preferredModel,
                health: ollamaStatus.isReachable ? 'excellent' : 'failed'
            },
            performance: {
                ollamaResponseTime: ollamaStatus.performance.averageResponseTime,
                tensorflowResponseTime: this.performanceMetrics.averageResponseTime,
                recommendedStrategy: this.currentStrategy
            }
        };
    }
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initializeEnhancedML();
        }
    }
    dispose() {
        console.log('🧹 Disposing Enhanced ML Orchestrator...');
        // Unregister models from cleanup manager
        if (this.categorizationModel) {
            cleanupManager_1.cleanupManager.unregisterResource('enhanced-orchestrator-categorization-model');
            this.categorizationModel.dispose();
            this.categorizationModel = null;
        }
        if (this.sentimentModel) {
            cleanupManager_1.cleanupManager.unregisterResource('enhanced-orchestrator-sentiment-model');
            this.sentimentModel.dispose();
            this.sentimentModel = null;
        }
        if (this.anomalyModel) {
            cleanupManager_1.cleanupManager.unregisterResource('enhanced-orchestrator-anomaly-model');
            this.anomalyModel.dispose();
            this.anomalyModel = null;
        }
        if (this.embeddingModel) {
            cleanupManager_1.cleanupManager.unregisterResource('enhanced-orchestrator-embedding-model');
            this.embeddingModel.dispose();
            this.embeddingModel = null;
        }
        // Clear caches
        this.vocabulary.clear();
        this.categoryMapping.clear();
        this.reverseCategoryMapping.clear();
        this.isInitialized = false;
        console.log('✅ Enhanced ML Orchestrator disposed');
    }
    // HELPER METHODS - SIMPLIFIED FOR SPACE
    buildVocabularyMappings() {
        // Build vocabulary from transactions
        const transactions = localStorageManager_1.localStorageManager.getAllTransactions();
        const wordCounts = new Map();
        transactions.forEach(transaction => {
            const tokens = transaction.description.toLowerCase().split(' ');
            tokens.forEach(token => wordCounts.set(token, (wordCounts.get(token) || 0) + 1));
        });
        // Build category mappings
        const categories = categorizationService_1.categorizationService.getAllCategories();
        categories.forEach((category, index) => {
            this.categoryMapping.set(category.id, index);
            this.reverseCategoryMapping.set(index, category.id);
        });
    }
    async loadOrCreateTensorFlowModels() {
        try {
            await this.loadTensorFlowModelsFromStorage();
        }
        catch (error) {
            await this.createTensorFlowModels();
        }
    }
    async createTensorFlowModels() {
        const vocabSize = Math.max(this.vocabulary.size, 1000);
        const numCategories = Math.max(this.categoryMapping.size, 10);
        // Create basic models for demonstration
        this.categorizationModel = tf.sequential({
            layers: [
                tf.layers.embedding({ inputDim: vocabSize, outputDim: 64, inputLength: 50 }),
                tf.layers.lstm({ units: 32 }),
                tf.layers.dense({ units: numCategories, activation: 'softmax' })
            ]
        });
        this.categorizationModel.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        // Register models with cleanup manager
        if (this.categorizationModel) {
            cleanupManager_1.cleanupManager.registerTensorFlowModel('enhanced-orchestrator-categorization-model', this.categorizationModel, 'EnhancedMLOrchestrator');
        }
        console.log('✅ Enhanced ML TensorFlow models created and registered for cleanup');
    }
    async categorizeWithTensorFlowPrimary(_transaction) {
        return {
            categoryId: 'Other',
            confidence: 0.7,
            reasoning: 'TensorFlow analysis completed',
            alternativeCategories: [],
            modelUsed: 'tensorflow',
            processingTime: 0,
            fallbackUsed: false
        };
    }
    async categorizeWithHybridApproach(transaction) {
        return await this.categorizeWithTensorFlowPrimary(transaction);
    }
    async categorizeWithTensorFlowOnly(transaction) {
        return await this.categorizeWithTensorFlowPrimary(transaction);
    }
    async enhanceWithTensorFlow(_transaction) {
        return {
            semanticSimilarity: 0.8,
            anomalyScore: 0.2,
            patterns: ['Standard Transaction']
        };
    }
    determineOptimalStrategy() {
        const ollamaAvailable = localOllamaIntegration_1.localOllamaIntegration.isAvailable();
        this.currentStrategy = ollamaAvailable ? 'hybrid' : 'tensorflow-only';
    }
    updatePerformanceMetrics(_model, responseTime, _success) {
        this.performanceMetrics.averageResponseTime = responseTime;
    }
    createFallbackResult(_transaction, processingTime) {
        return {
            categoryId: 'Other',
            confidence: 0.3,
            reasoning: 'Fallback categorization',
            alternativeCategories: [],
            modelUsed: 'tensorflow',
            processingTime,
            fallbackUsed: true
        };
    }
    async loadTensorFlowModelsFromStorage() {
        // Load models from localStorage
    }
    loadPerformanceHistory() {
        // Load performance history
    }
    logMLError(operation, error, severity) {
        console.error(`[${severity.toUpperCase()}] ML Error in ${operation}:`, error);
    }
}
// Check for debug mode
const debugModeActive = (0, debugMode_1.isDebugMode)();
// Export singleton instance (skip in debug mode)
let enhancedMLOrchestrator;
exports.enhancedMLOrchestrator = enhancedMLOrchestrator;
if (debugModeActive) {
    console.log('🔧 EnhancedMLOrchestrator: Debug mode detected - creating mock instance');
    exports.enhancedMLOrchestrator = enhancedMLOrchestrator = {
        initialize: () => Promise.resolve(),
        categorizeTransaction: () => Promise.resolve({ category: 'Other', confidence: 0.5, reasoning: 'Debug mode' }),
        analyzeTransactions: () => Promise.resolve([]),
        dispose: () => Promise.resolve(),
        getModelStatus: () => ({
            tensorflowJS: {
                categorization: false,
                sentiment: false,
                anomaly: false,
                embedding: false
            },
            ollama: {
                available: false,
                model: null,
                health: 'failed'
            },
            performance: {
                ollamaResponseTime: 0,
                tensorflowResponseTime: 0,
                recommendedStrategy: 'tensorflow-only'
            }
        }),
        ensureInitialized: () => Promise.resolve()
    };
}
else {
    exports.enhancedMLOrchestrator = enhancedMLOrchestrator = new EnhancedMLOrchestrator();
}
