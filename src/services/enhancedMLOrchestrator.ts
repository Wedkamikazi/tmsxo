import * as tf from '@tensorflow/tfjs';
import { Transaction, MLCategorizationResult } from '../types';
import { localOllamaIntegration } from './localOllamaIntegration';
import { systemIntegrityService } from './systemIntegrityService';
import { performanceManager } from './performanceManager';
import { localStorageManager } from './localStorageManager';
import { categorizationService } from './categorizationService';

// ENHANCED ML ORCHESTRATOR
// Intelligently combines TensorFlow.js models with Ollama for optimal performance
// Provides unified ML operations with automatic fallback and performance optimization

export interface MLModelStatus {
  tensorflowJS: {
    categorization: boolean;
    sentiment: boolean;
    anomaly: boolean;
    embedding: boolean;
  };
  ollama: {
    available: boolean;
    model: string | null;
    health: 'excellent' | 'good' | 'degraded' | 'failed';
  };
  performance: {
    ollamaResponseTime: number;
    tensorflowResponseTime: number;
    recommendedStrategy: 'ollama-primary' | 'tensorflow-primary' | 'hybrid' | 'tensorflow-only';
  };
}

export interface EnhancedMLResult extends MLCategorizationResult {
  modelUsed: 'ollama' | 'tensorflow' | 'hybrid';
  processingTime: number;
  fallbackUsed: boolean;
  enhancedAnalysis?: {
    semanticSimilarity: number;
    contextualRelevance: number;
    anomalyScore: number;
    patternRecognition: string[];
    businessInsights: string[];
  };
}

export interface MLPerformanceMetrics {
  totalRequests: number;
  ollamaRequests: number;
  tensorflowRequests: number;
  hybridRequests: number;
  averageResponseTime: number;
  accuracyScore: number;
  modelRecommendation: string;
  lastOptimization: string;
}

class EnhancedMLOrchestrator {
  private isInitialized = false;
  
  // TensorFlow.js Models
  private categorizationModel: tf.LayersModel | null = null;
  private sentimentModel: tf.LayersModel | null = null;
  private anomalyModel: tf.LayersModel | null = null;
  private embeddingModel: tf.LayersModel | null = null;
  
  // Vocabulary and mappings
  private vocabulary: Map<string, number> = new Map();
  private categoryMapping: Map<string, number> = new Map();
  private reverseCategoryMapping: Map<number, string> = new Map();
  
  // Performance tracking
  private performanceMetrics: MLPerformanceMetrics = {
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
  private currentStrategy: 'ollama-primary' | 'tensorflow-primary' | 'hybrid' | 'tensorflow-only' = 'hybrid';
  private modelPerformanceHistory: Array<{
    timestamp: string;
    model: string;
    responseTime: number;
    accuracy: number;
    success: boolean;
  }> = [];

  constructor() {
    this.initializeEnhancedML();
  }

  // INITIALIZE ENHANCED ML ORCHESTRATOR
  private async initializeEnhancedML(): Promise<void> {
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
      
    } catch (error) {
      this.logMLError('initializeEnhancedML', error, 'critical');
      this.isInitialized = false;
    }
  }

  // BUILD VOCABULARY AND CATEGORY MAPPINGS
  private buildVocabularyMappings(): void {
    console.log('📚 Building vocabulary and category mappings...');
    
    // Build vocabulary from historical transactions
    const transactions = localStorageManager.getAllTransactions();
    const wordCounts: Map<string, number> = new Map();
    
    transactions.forEach(transaction => {
      const tokens = this.tokenizeDescription(transaction.description);
      tokens.forEach(token => {
        wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
      });
    });
    
    // Build vocabulary from most frequent words
    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5000);
    
    this.vocabulary.clear();
    sortedWords.forEach(([word], index) => {
      this.vocabulary.set(word, index + 1);
    });
    
    // Build category mappings
    const categories = categorizationService.getAllCategories();
    this.categoryMapping.clear();
    this.reverseCategoryMapping.clear();
    
    categories.forEach((category, index) => {
      this.categoryMapping.set(category.id, index);
      this.reverseCategoryMapping.set(index, category.id);
    });
    
    console.log(`📊 Vocabulary: ${this.vocabulary.size} tokens, Categories: ${categories.length}`);
  }

  // TOKENIZE TRANSACTION DESCRIPTION
  private tokenizeDescription(description: string): string[] {
    return description.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(token => token.length > 2);
  }

  // LOAD OR CREATE TENSORFLOW MODELS
  private async loadOrCreateTensorFlowModels(): Promise<void> {
    try {
      await this.loadTensorFlowModelsFromStorage();
      console.log('📂 TensorFlow models loaded from storage');
    } catch (error) {
      console.log('🔧 Creating new TensorFlow models...');
      await this.createTensorFlowModels();
    }
  }

  // CREATE TENSORFLOW MODELS
  private async createTensorFlowModels(): Promise<void> {
    const vocabSize = Math.max(this.vocabulary.size, 1000);
    const numCategories = Math.max(this.categoryMapping.size, 10);
    
    // CATEGORIZATION MODEL
    this.categorizationModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: vocabSize, outputDim: 128, inputLength: 50 }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({ units: 64, returnSequences: true, dropout: 0.3 })
        }),
        tf.layers.globalAveragePooling1d(),
        tf.layers.dense({ units: 256, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ units: numCategories, activation: 'softmax' })
      ]
    });
    
    this.categorizationModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // SENTIMENT MODEL
    this.sentimentModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: vocabSize, outputDim: 64, inputLength: 50 }),
        tf.layers.lstm({ units: 32, dropout: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' })
      ]
    });
    
    this.sentimentModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // ANOMALY DETECTION MODEL
    this.anomalyModel = tf.sequential({
      layers: [
        tf.layers.dense({ units: 64, activation: 'relu', inputShape: [10] }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 10, activation: 'linear' })
      ]
    });
    
    this.anomalyModel.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    // EMBEDDING MODEL
    this.embeddingModel = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: vocabSize, outputDim: 128, inputLength: 50 }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({ units: 64, dropout: 0.3 })
        }),
        tf.layers.dense({ units: 128, activation: 'tanh' }),
        tf.layers.batchNormalization()
      ]
    });
    
    this.embeddingModel.compile({
      optimizer: 'adam',
      loss: 'cosineProximity'
    });

    // Register models with performance manager
    performanceManager.registerModel('enhanced-categorization', this.categorizationModel);
    performanceManager.registerModel('enhanced-sentiment', this.sentimentModel);
    performanceManager.registerModel('enhanced-anomaly', this.anomalyModel);
    performanceManager.registerModel('enhanced-embedding', this.embeddingModel);
    
    console.log('✅ TensorFlow models created and registered');
  }

  // MAIN CATEGORIZATION METHOD WITH INTELLIGENT ROUTING
  async categorizeTransaction(transaction: Transaction): Promise<EnhancedMLResult> {
    if (!this.isInitialized) {
      throw new Error('Enhanced ML Orchestrator not initialized');
    }

    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    try {
      let result: EnhancedMLResult;
      
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
      
      // Store result for learning
      this.storeResultForLearning(transaction, result);
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceMetrics('tensorflow', processingTime, false);
      this.logMLError('categorizeTransaction', error, 'high');
      
      // Return fallback result
      return this.createFallbackResult(transaction, processingTime);
    }
  }

  // OLLAMA-PRIMARY CATEGORIZATION
  private async categorizeWithOllamaPrimary(transaction: Transaction): Promise<EnhancedMLResult> {
    this.performanceMetrics.ollamaRequests++;
    
    try {
      if (!localOllamaIntegration.isAvailable()) {
        return await this.categorizeWithTensorFlowPrimary(transaction);
      }
      
      const ollamaResult = await localOllamaIntegration.analyzeTransaction(
        transaction.description,
        transaction.debitAmount || transaction.creditAmount,
        transaction.date
      );
      
      // Enhance with TensorFlow.js analysis
      const tfEnhancement = await this.enhanceWithTensorFlow(transaction);
      
      return {
        categoryId: ollamaResult.category,
        confidence: ollamaResult.confidence,
        reasoning: ollamaResult.reasoning,
        alternativeCategories: [],
        modelUsed: 'ollama',
        processingTime: 0, // Will be set by caller
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
      
    } catch (error) {
      this.logMLError('categorizeWithOllamaPrimary', error, 'medium');
      return await this.categorizeWithTensorFlowPrimary(transaction);
    }
  }

  // TENSORFLOW-PRIMARY CATEGORIZATION
  private async categorizeWithTensorFlowPrimary(transaction: Transaction): Promise<EnhancedMLResult> {
    this.performanceMetrics.tensorflowRequests++;
    
    const tensorflowResult = await this.performTensorFlowAnalysis(transaction);
    
    // Try to enhance with Ollama if available
    let ollamaEnhancement = null;
    if (localOllamaIntegration.isAvailable()) {
      try {
        ollamaEnhancement = await localOllamaIntegration.analyzeTransaction(
          transaction.description,
          transaction.debitAmount || transaction.creditAmount,
          transaction.date
        );
      } catch (error) {
        // Ollama enhancement failed, continue with TensorFlow only
      }
    }
    
    return {
      ...tensorflowResult,
      modelUsed: 'tensorflow',
      enhancedAnalysis: {
        semanticSimilarity: tensorflowResult.enhancedAnalysis?.semanticSimilarity || 0.7,
        contextualRelevance: 0.8,
        anomalyScore: tensorflowResult.enhancedAnalysis?.anomalyScore || 0,
        patternRecognition: tensorflowResult.enhancedAnalysis?.patternRecognition || [],
        businessInsights: ollamaEnhancement?.suggestions || []
      }
    };
  }

  // HYBRID APPROACH CATEGORIZATION
  private async categorizeWithHybridApproach(transaction: Transaction): Promise<EnhancedMLResult> {
    this.performanceMetrics.hybridRequests++;
    
    // Run both models in parallel
    const [tensorflowResult, ollamaResult] = await Promise.allSettled([
      this.performTensorFlowAnalysis(transaction),
      localOllamaIntegration.isAvailable() 
        ? localOllamaIntegration.analyzeTransaction(
            transaction.description,
            transaction.debitAmount || transaction.creditAmount,
            transaction.date
          )
        : Promise.reject(new Error('Ollama not available'))
    ]);
    
    // Combine results intelligently
    if (tensorflowResult.status === 'fulfilled' && ollamaResult.status === 'fulfilled') {
      // Both models succeeded - combine their insights
      const tfResult = tensorflowResult.value;
      const ollamaAnalysis = ollamaResult.value;
      
      // Use higher confidence result as primary, other as enhancement
      const primaryResult = tfResult.confidence > ollamaAnalysis.confidence ? tfResult : {
        categoryId: ollamaAnalysis.category,
        confidence: ollamaAnalysis.confidence,
        reasoning: ollamaAnalysis.reasoning,
        alternativeCategories: [],
        modelUsed: 'hybrid' as const,
        processingTime: 0,
        fallbackUsed: false,
        metadata: {
          sentiment: ollamaAnalysis.sentiment,
          sentimentConfidence: 0.8,
          modelVersion: 'enhanced-orchestrator-v1.0',
          predictionTimestamp: new Date().toISOString()
        }
      };
      
      return {
        ...primaryResult,
        modelUsed: 'hybrid',
        enhancedAnalysis: {
          semanticSimilarity: tfResult.enhancedAnalysis?.semanticSimilarity || 0.8,
          contextualRelevance: 0.9,
          anomalyScore: tfResult.enhancedAnalysis?.anomalyScore || 0,
          patternRecognition: tfResult.enhancedAnalysis?.patternRecognition || [],
          businessInsights: ollamaAnalysis.suggestions
        }
      };
    } else if (tensorflowResult.status === 'fulfilled') {
      // Only TensorFlow succeeded
      return { ...tensorflowResult.value, modelUsed: 'tensorflow', fallbackUsed: true };
    } else {
      // Fallback to basic categorization
      throw new Error('Both models failed');
    }
  }

  // TENSORFLOW-ONLY CATEGORIZATION
  private async categorizeWithTensorFlowOnly(transaction: Transaction): Promise<EnhancedMLResult> {
    this.performanceMetrics.tensorflowRequests++;
    return await this.performTensorFlowAnalysis(transaction);
  }

  // PERFORM TENSORFLOW ANALYSIS
  private async performTensorFlowAnalysis(transaction: Transaction): Promise<EnhancedMLResult> {
    const textFeatures = this.prepareTextFeatures(transaction.description);
    const numericalFeatures = this.prepareNumericalFeatures(transaction);
    
    // Get predictions from all models
    const [categoryPrediction, sentimentPrediction, anomalyScore, semanticEmbedding] = await Promise.all([
      this.predictCategory(textFeatures),
      this.predictSentiment(textFeatures),
      this.detectAnomaly(numericalFeatures),
      this.getSemanticEmbedding(textFeatures)
    ]);
    
    // Analyze patterns
    const patterns = this.recognizePatterns(numericalFeatures, semanticEmbedding);
    
    // Clean up tensors
    textFeatures.dispose();
    numericalFeatures.dispose();
    
    return {
      categoryId: categoryPrediction.categoryId,
      confidence: categoryPrediction.confidence,
      reasoning: this.generateReasoning(categoryPrediction, sentimentPrediction, anomalyScore),
      alternativeCategories: categoryPrediction.alternatives,
      modelUsed: 'tensorflow',
      processingTime: 0,
      fallbackUsed: false,
      metadata: {
        sentiment: sentimentPrediction.label,
        sentimentConfidence: sentimentPrediction.confidence,
        isAnomaly: anomalyScore > 0.7,
        anomalyScore,
        modelVersion: 'enhanced-orchestrator-v1.0',
        predictionTimestamp: new Date().toISOString(),
        tensorflowMemory: tf.memory()
      },
      enhancedAnalysis: {
        semanticSimilarity: 0.8,
        contextualRelevance: 0.8,
        anomalyScore,
        patternRecognition: patterns,
        businessInsights: []
      }
    };
  }

  // HELPER METHODS FOR TENSORFLOW ANALYSIS
  private prepareTextFeatures(description: string): tf.Tensor {
    const tokens = this.tokenizeDescription(description);
    const indices = tokens.map(token => this.vocabulary.get(token) || 0).slice(0, 50);
    
    // Pad or truncate to fixed length
    while (indices.length < 50) indices.push(0);
    
    return tf.tensor2d([indices], [1, 50]);
  }

  private prepareNumericalFeatures(transaction: Transaction): tf.Tensor {
    const amount = transaction.debitAmount || transaction.creditAmount;
    const date = new Date(transaction.date);
    
    const features = [
      Math.log(amount + 1), // Log amount
      date.getMonth(), // Month
      date.getDay(), // Day of week
      date.getDate(), // Day of month
      amount > 1000 ? 1 : 0, // Large amount flag
      transaction.description.length, // Description length
      transaction.debitAmount > 0 ? 1 : 0, // Is debit
      transaction.creditAmount > 0 ? 1 : 0, // Is credit
      transaction.reference ? 1 : 0, // Has reference
      0 // Reserved
    ];
    
    return tf.tensor2d([features], [1, 10]);
  }

  private async predictCategory(textFeatures: tf.Tensor): Promise<{
    categoryId: string;
    confidence: number;
    alternatives: Array<{ categoryId: string; confidence: number }>;
  }> {
    if (!this.categorizationModel) {
      throw new Error('Categorization model not available');
    }
    
    const prediction = this.categorizationModel.predict(textFeatures) as tf.Tensor;
    const probabilities = await prediction.data();
    
    // Find top predictions
    const results = Array.from(probabilities)
      .map((prob, index) => ({ index, probability: prob }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);
    
    prediction.dispose();
    
    return {
      categoryId: this.reverseCategoryMapping.get(results[0].index) || 'Other',
      confidence: results[0].probability,
      alternatives: results.slice(1).map(r => ({
        categoryId: this.reverseCategoryMapping.get(r.index) || 'Other',
        confidence: r.probability
      }))
    };
  }

  private async predictSentiment(textFeatures: tf.Tensor): Promise<{
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }> {
    if (!this.sentimentModel) {
      return { label: 'neutral', confidence: 0.5 };
    }
    
    const prediction = this.sentimentModel.predict(textFeatures) as tf.Tensor;
    const probabilities = await prediction.data();
    
    const labels = ['negative', 'neutral', 'positive'] as const;
    const maxIndex = probabilities.indexOf(Math.max(...probabilities));
    
    prediction.dispose();
    
    return {
      label: labels[maxIndex],
      confidence: probabilities[maxIndex]
    };
  }

  private async detectAnomaly(numericalFeatures: tf.Tensor): Promise<number> {
    if (!this.anomalyModel) {
      return 0;
    }
    
    const prediction = this.anomalyModel.predict(numericalFeatures) as tf.Tensor;
    const reconstructed = await prediction.data();
    const original = await numericalFeatures.data();
    
    // Calculate reconstruction error
    let error = 0;
    for (let i = 0; i < original.length; i++) {
      error += Math.pow(original[i] - reconstructed[i], 2);
    }
    
    prediction.dispose();
    
    return Math.min(error / original.length, 1);
  }

  private async getSemanticEmbedding(textFeatures: tf.Tensor): Promise<number[]> {
    if (!this.embeddingModel) {
      return new Array(128).fill(0);
    }
    
    const embedding = this.embeddingModel.predict(textFeatures) as tf.Tensor;
    const data = await embedding.data();
    
    embedding.dispose();
    
    return Array.from(data);
  }

  private recognizePatterns(numericalFeatures: tf.Tensor, embedding: number[]): string[] {
    const patterns: string[] = [];
    
    // Simple pattern recognition based on features
    const features = numericalFeatures.dataSync();
    
    if (features[0] > 5) patterns.push('Large Amount');
    if (features[1] === 11 || features[1] === 0) patterns.push('End of Year');
    if (features[2] === 0 || features[2] === 6) patterns.push('Weekend');
    if (features[5] > 20) patterns.push('Detailed Description');
    
    return patterns;
  }

  private generateReasoning(
    categoryPrediction: any,
    sentimentPrediction: any,
    anomalyScore: number
  ): string {
    let reasoning = `Categorized as ${categoryPrediction.categoryId} with ${(categoryPrediction.confidence * 100).toFixed(1)}% confidence.`;
    
    if (sentimentPrediction.confidence > 0.7) {
      reasoning += ` Transaction has ${sentimentPrediction.label} sentiment.`;
    }
    
    if (anomalyScore > 0.5) {
      reasoning += ` Unusual pattern detected (anomaly score: ${(anomalyScore * 100).toFixed(1)}%).`;
    }
    
    return reasoning;
  }

  // ENHANCED TENSORFLOW ANALYSIS FOR OLLAMA RESULTS
  private async enhanceWithTensorFlow(transaction: Transaction): Promise<{
    semanticSimilarity: number;
    anomalyScore: number;
    patterns: string[];
  }> {
    const textFeatures = this.prepareTextFeatures(transaction.description);
    const numericalFeatures = this.prepareNumericalFeatures(transaction);
    
    const [anomalyScore, semanticEmbedding] = await Promise.all([
      this.detectAnomaly(numericalFeatures),
      this.getSemanticEmbedding(textFeatures)
    ]);
    
    const patterns = this.recognizePatterns(numericalFeatures, semanticEmbedding);
    
    textFeatures.dispose();
    numericalFeatures.dispose();
    
    return {
      semanticSimilarity: 0.8, // Placeholder - would need historical comparison
      anomalyScore,
      patterns
    };
  }

  // PERFORMANCE AND STRATEGY MANAGEMENT
  private determineOptimalStrategy(): void {
    const ollamaAvailable = localOllamaIntegration.isAvailable();
    const recentPerformance = this.modelPerformanceHistory.slice(-20);
    
    if (!ollamaAvailable) {
      this.currentStrategy = 'tensorflow-only';
      return;
    }
    
    if (recentPerformance.length < 10) {
      this.currentStrategy = 'hybrid';
      return;
    }
    
    const ollamaPerf = recentPerformance.filter(p => p.model === 'ollama');
    const tfPerf = recentPerformance.filter(p => p.model === 'tensorflow');
    
    const ollamaAvgTime = ollamaPerf.reduce((sum, p) => sum + p.responseTime, 0) / ollamaPerf.length;
    const tfAvgTime = tfPerf.reduce((sum, p) => sum + p.responseTime, 0) / tfPerf.length;
    
    if (ollamaAvgTime < tfAvgTime * 1.5) {
      this.currentStrategy = 'ollama-primary';
    } else if (tfAvgTime < ollamaAvgTime * 1.5) {
      this.currentStrategy = 'tensorflow-primary';
    } else {
      this.currentStrategy = 'hybrid';
    }
    
    console.log(`🎯 Strategy determined: ${this.currentStrategy}`);
  }

  private updatePerformanceMetrics(model: string, responseTime: number, success: boolean): void {
    this.performanceMetrics.averageResponseTime = (
      (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1) + responseTime) /
      this.performanceMetrics.totalRequests
    );
    
    this.modelPerformanceHistory.push({
      timestamp: new Date().toISOString(),
      model,
      responseTime,
      accuracy: success ? 0.9 : 0.1, // Simplified accuracy tracking
      success
    });
    
    // Keep only recent history
    if (this.modelPerformanceHistory.length > 100) {
      this.modelPerformanceHistory = this.modelPerformanceHistory.slice(-50);
    }
    
    // Periodically re-evaluate strategy
    if (this.performanceMetrics.totalRequests % 20 === 0) {
      this.determineOptimalStrategy();
    }
    
    this.savePerformanceHistory();
  }

  private storeResultForLearning(transaction: Transaction, result: EnhancedMLResult): void {
    // Store for future model training and improvement
    try {
      const learningData = {
        transactionId: transaction.id,
        description: transaction.description,
        predictedCategory: result.categoryId,
        confidence: result.confidence,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString()
      };
      
      localStorageManager.setItem(`ml-learning-${transaction.id}`, learningData);
    } catch (error) {
      // Ignore storage errors for learning data
    }
  }

  private createFallbackResult(transaction: Transaction, processingTime: number): EnhancedMLResult {
    return {
      categoryId: 'Other',
      confidence: 0.3,
      reasoning: 'Fallback categorization due to model failure',
      alternativeCategories: [],
      modelUsed: 'tensorflow',
      processingTime,
      fallbackUsed: true,
      metadata: {
        modelVersion: 'enhanced-orchestrator-v1.0',
        predictionTimestamp: new Date().toISOString()
      }
    };
  }

  // STORAGE METHODS
  private async loadTensorFlowModelsFromStorage(): Promise<void> {
    this.categorizationModel = await tf.loadLayersModel('localstorage://enhanced-categorization-model');
    this.sentimentModel = await tf.loadLayersModel('localstorage://enhanced-sentiment-model');
    this.anomalyModel = await tf.loadLayersModel('localstorage://enhanced-anomaly-model');
    this.embeddingModel = await tf.loadLayersModel('localstorage://enhanced-embedding-model');
  }

  private async saveTensorFlowModelsToStorage(): Promise<void> {
    if (this.categorizationModel) {
      await this.categorizationModel.save('localstorage://enhanced-categorization-model');
    }
    if (this.sentimentModel) {
      await this.sentimentModel.save('localstorage://enhanced-sentiment-model');
    }
    if (this.anomalyModel) {
      await this.anomalyModel.save('localstorage://enhanced-anomaly-model');
    }
    if (this.embeddingModel) {
      await this.embeddingModel.save('localstorage://enhanced-embedding-model');
    }
  }

  private loadPerformanceHistory(): void {
    try {
      const saved = localStorageManager.getItem('enhanced-ml-performance');
      if (saved) {
        this.performanceMetrics = { ...this.performanceMetrics, ...saved.metrics };
        this.modelPerformanceHistory = saved.history || [];
      }
    } catch (error) {
      // Ignore storage errors
    }
  }

  private savePerformanceHistory(): void {
    try {
      localStorageManager.setItem('enhanced-ml-performance', {
        metrics: this.performanceMetrics,
        history: this.modelPerformanceHistory
      });
    } catch (error) {
      // Ignore storage errors
    }
  }

  private logMLError(operation: string, error: unknown, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    systemIntegrityService.logServiceError(
      'EnhancedMLOrchestrator',
      operation,
      error instanceof Error ? error : new Error(String(error)),
      severity,
      { component: 'mlOrchestrator', timestamp: new Date().toISOString() }
    );
  }

  // PUBLIC API METHODS
  getModelStatus(): MLModelStatus {
    const ollamaStatus = localOllamaIntegration.getHealthStatus();
    
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

  getPerformanceMetrics(): MLPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  async batchCategorizeTransactions(transactions: Transaction[]): Promise<EnhancedMLResult[]> {
    const results: EnhancedMLResult[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      const batchPromises = batch.map(transaction => this.categorizeTransaction(transaction));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  async switchStrategy(strategy: MLModelStatus['performance']['recommendedStrategy']): Promise<boolean> {
    if (strategy === 'ollama-primary' && !localOllamaIntegration.isAvailable()) {
      return false;
    }
    
    this.currentStrategy = strategy;
    console.log(`🔄 Strategy switched to: ${strategy}`);
    return true;
  }

  dispose(): void {
    this.categorizationModel?.dispose();
    this.sentimentModel?.dispose();
    this.anomalyModel?.dispose();
    this.embeddingModel?.dispose();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const enhancedMLOrchestrator = new EnhancedMLOrchestrator(); 