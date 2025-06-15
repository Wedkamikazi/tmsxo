// TENSORFLOW CATEGORIZATION METHOD - BASIC STRUCTURE
// Extracted from mlCategorizationService.ts - implements TensorFlow-based transaction categorization

import * as tf from '@tensorflow/tfjs';
import { Transaction } from '../../types';
import { CategorizationStrategy, UnifiedCategorizationResult } from './index';
import { 
  TensorFlowModelConfig, 
  TensorFlowModelStats, 
  TrainingDataPoint,
  TensorFlowModelStatus,
  FeatureConfig
} from './tensorFlowTypes';
import { localStorageManager } from '../localStorageManager';
import { cleanupManager } from '../cleanupManager';
import { systemIntegrityService } from '../systemIntegrityService';
import { isDebugMode as checkDebugMode } from '../../utils/debugMode';

export class TensorFlowMethod implements CategorizationStrategy {
  name = 'tensorflow';
  priority = 2; // Second priority after ML-enhanced
  
  private vocabulary: Map<string, number> = new Map();
  private categoryMapping: Map<string, number> = new Map();
  private reverseCategoryMapping: Map<number, string> = new Map();
  private isInitialized = false;
  
  // TensorFlow.js Models
  private categorizationModel: tf.LayersModel | null = null;
  private sentimentModel: tf.LayersModel | null = null;
  private anomalyModel: tf.LayersModel | null = null;
  private patternModel: tf.LayersModel | null = null;
  
  // Configuration
  private modelConfig: TensorFlowModelConfig = {
    vocabSize: 1000,
    numCategories: 10,
    embeddingDim: 128,
    sequenceLength: 50,
    lstmUnits: 64,
    denseUnits: [128, 64],
    dropoutRate: 0.3,
    learningRate: 0.001
  };

  private featureConfig: FeatureConfig = {
    textFeatures: {
      maxSequenceLength: 50,
      vocabularySize: 1000,
      embeddingDim: 128,
      includeNGrams: true,
      nGramRange: [2, 3]
    },
    numericalFeatures: {
      includeAmount: true,
      includeDate: true,
      includeBalance: false,
      normalizationMethod: 'minmax'
    }
  };
  
  // Statistics and Training Data
  private modelStats: TensorFlowModelStats = {
    totalPredictions: 0,
    accuratePredictions: 0,
    averageConfidence: 0,
    modelVersion: '2.0.0',
    lastTrainingDate: new Date().toISOString(),
    trainingDataSize: 0
  };

  private trainingHistory: TrainingDataPoint[] = [];
  
  // Storage keys
  private readonly MODEL_STATS_KEY = 'tms_tensorflow_model_stats';
  private readonly TRAINING_HISTORY_KEY = 'tms_tensorflow_training_history';
  private readonly VOCABULARY_KEY = 'tms_tensorflow_vocabulary';
  private readonly CATEGORY_MAPPING_KEY = 'tms_tensorflow_category_mapping';

  constructor() {
    this.initializeTensorFlow();
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if we're in debug mode
      if (checkDebugMode()) {
        console.log('🔧 TensorFlow Method: Debug mode detected - limited availability');
        return false;
      }
      
      // Check TensorFlow.js availability and GPU support
      await tf.ready();
      return this.isInitialized && this.categorizationModel !== null;
    } catch (error) {
      console.error('TensorFlow availability check failed:', error);
      return false;
    }
  }

  async categorize(transaction: Transaction): Promise<UnifiedCategorizationResult> {
    if (!this.isInitialized) {
      throw new Error('TensorFlow method not initialized');
    }

    const startTime = Date.now();
    
    try {
      // This will be implemented in the next micro-job
      throw new Error('TensorFlow categorization logic not yet implemented');
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError('categorize', error, 'high');
      return this.createFallbackResult(transaction, processingTime, String(error));
    }
  }

  async batchCategorize(transactions: Transaction[]): Promise<UnifiedCategorizationResult[]> {
    return Promise.all(transactions.map(t => this.categorize(t)));
  }

  // INITIALIZATION
  private async initializeTensorFlow(): Promise<void> {
    try {
      console.log('🧠 Initializing TensorFlow Categorization Method...');
      
      // Check debug mode first
      if (checkDebugMode()) {
        console.log('🔧 TensorFlow Method: Debug mode detected - skipping initialization');
        this.isInitialized = false;
        return;
      }
      
      // Initialize TensorFlow.js
      await tf.ready();
      console.log(`📊 TensorFlow.js ready - Backend: ${tf.getBackend()}`);
      
      // Load saved data
      this.loadVocabulary();
      this.loadCategoryMappings();
      this.loadModelStats();
      this.loadTrainingHistory();
      
      // Build vocabulary and mappings if needed
      if (this.vocabulary.size === 0) {
        this.buildAdvancedVocabulary();
      }
      if (this.categoryMapping.size === 0) {
        this.buildCategoryMappings();
      }
      
      // Load or create models
      await this.loadOrCreateModels();
      
      // Register with cleanup manager
      this.registerCleanup();
      
      this.isInitialized = true;
      console.log('✅ TensorFlow Categorization Method Ready');
      
    } catch (error) {
      this.logError('initializeTensorFlow', error, 'critical');
      this.isInitialized = false;
    }
  }

  // VOCABULARY AND MAPPING MANAGEMENT
  private buildAdvancedVocabulary(): void {
    console.log('📚 Building Advanced Vocabulary...');
    
    const allTransactions = localStorageManager.getAllTransactions();
    const descriptionTokens = new Set<string>();
    
    allTransactions.forEach(transaction => {
      const tokens = this.advancedTokenization(transaction.description);
      tokens.forEach(token => descriptionTokens.add(token));
    });
    
    this.vocabulary.clear();
    Array.from(descriptionTokens).forEach((token, index) => {
      this.vocabulary.set(token, index);
    });
    
    this.saveVocabulary();
    console.log(`📊 Vocabulary built: ${this.vocabulary.size} unique tokens`);
  }

  private buildCategoryMappings(): void {
    const categories = localStorageManager.getAllCategories();
    this.categoryMapping.clear();
    this.reverseCategoryMapping.clear();

    categories.forEach((category, index) => {
      this.categoryMapping.set(category.id, index);
      this.reverseCategoryMapping.set(index, category.id);
    });

    this.saveCategoryMappings();
    console.log(`📋 Category mappings built: ${categories.length} categories`);
  }

  private advancedTokenization(text: string): string[] {
    const cleaned = text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const tokens = cleaned.split(' ').filter(token => token.length > 1);
    
    if (!this.featureConfig.textFeatures.includeNGrams) {
      return tokens;
    }
    
    const nGrams: string[] = [];
    const [minN, maxN] = this.featureConfig.textFeatures.nGramRange;
    
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        nGrams.push(tokens.slice(i, i + n).join('_'));
      }
    }
    
    return [...tokens, ...nGrams];
  }

  // UTILITY METHODS
  private createFallbackResult(
    _transaction: Transaction,
    processingTime: number,
    error?: string
  ): UnifiedCategorizationResult {
    return {
      categoryId: 'cat_expense',
      categoryName: 'Expense',
      confidence: 0.1,
      method: 'fallback',
      reasoning: error || 'TensorFlow method failed - using default category',
      suggestions: ['Check TensorFlow.js status', 'Consider using rule-based method'],
      alternatives: [],
      processingTime,
      metadata: {
        anomalyDetected: false,
        fallbackReason: error || 'tensorflow_failure',
        strategyUsed: 'tensorflow-fallback'
      }
    };
  }

  private logError(operation: string, error: unknown, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    systemIntegrityService.logServiceError(
      'TensorFlowMethod',
      operation,
      error instanceof Error ? error : new Error(String(error)),
      severity,
      { method: 'tensorflow' }
    );
  }

  private registerCleanup(): void {
    // Register models with cleanup manager - simplify for now, will be enhanced later
    try {
      if (this.categorizationModel) {
        cleanupManager.registerResource(
          'tensorflow-categorization-model', 
          'tensorflow-model', 
          'high',
          () => this.categorizationModel?.dispose()
        );
      }
      if (this.sentimentModel) {
        cleanupManager.registerResource(
          'tensorflow-sentiment-model', 
          'tensorflow-model', 
          'medium',
          () => this.sentimentModel?.dispose()
        );
      }
      if (this.anomalyModel) {
        cleanupManager.registerResource(
          'tensorflow-anomaly-model', 
          'tensorflow-model', 
          'medium',
          () => this.anomalyModel?.dispose()
        );
      }
      if (this.patternModel) {
        cleanupManager.registerResource(
          'tensorflow-pattern-model', 
          'tensorflow-model', 
          'low',
          () => this.patternModel?.dispose()
        );
      }
    } catch (error) {
      console.warn('Failed to register cleanup for TensorFlow models:', error);
    }
  }

  // TENSORFLOW.JS MODEL CREATION AND LOADING
  private async loadOrCreateModels(): Promise<void> {
    console.log('🔧 Loading/Creating TensorFlow.js Models...');
    
    try {
      // Try to load existing models from localStorage
      await this.loadModelsFromStorage();
      console.log('📂 Models loaded from localStorage');
    } catch (error) {
      console.log('📦 Creating new models...');
      await this.createNewModels();
      await this.saveModelsToStorage();
    }
  }

  // CREATE ADVANCED NEURAL NETWORK MODELS
  private async createNewModels(): Promise<void> {
    const vocabSize = Math.max(this.vocabulary.size, this.modelConfig.vocabSize);
    const numCategories = Math.max(this.categoryMapping.size, this.modelConfig.numCategories);
    
    // Update model config with actual sizes
    this.modelConfig.vocabSize = vocabSize;
    this.modelConfig.numCategories = numCategories;
    
    console.log(`🔧 Creating models - Vocab: ${vocabSize}, Categories: ${numCategories}`);
    
    // TRANSACTION CATEGORIZATION MODEL (Enhanced)
    this.categorizationModel = tf.sequential({
      layers: [
        // Embedding layer for text vectorization
        tf.layers.embedding({
          inputDim: vocabSize,
          outputDim: this.modelConfig.embeddingDim,
          inputLength: this.modelConfig.sequenceLength
        }),
        
        // Bidirectional LSTM for sequence understanding
        tf.layers.bidirectional({
          layer: tf.layers.lstm({
            units: this.modelConfig.lstmUnits,
            returnSequences: true,
            dropout: this.modelConfig.dropoutRate,
            recurrentDropout: this.modelConfig.dropoutRate
          })
        }),
        
        // Global average pooling
        tf.layers.globalAveragePooling1d(),
        
        // Dense layers with batch normalization
        tf.layers.dense({ 
          units: this.modelConfig.denseUnits[0], 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.5 }),
        
        tf.layers.dense({ 
          units: this.modelConfig.denseUnits[1], 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: this.modelConfig.dropoutRate }),
        
        // Output layer with softmax for probability distribution
        tf.layers.dense({ units: numCategories, activation: 'softmax' })
      ]
    });
    
    this.categorizationModel.compile({
      optimizer: tf.train.adam(this.modelConfig.learningRate),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // SENTIMENT ANALYSIS MODEL
    this.sentimentModel = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: vocabSize,
          outputDim: 64,
          inputLength: this.modelConfig.sequenceLength
        }),
        tf.layers.lstm({ units: 32, dropout: 0.2 }),
        tf.layers.dense({ 
          units: 16, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ units: 3, activation: 'softmax' }) // positive, neutral, negative
      ]
    });
    
    this.sentimentModel.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // ANOMALY DETECTION MODEL (Autoencoder)
    this.anomalyModel = tf.sequential({
      layers: [
        tf.layers.dense({ 
          units: 48, 
          activation: 'relu', 
          inputShape: [10],
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ 
          units: 24, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ 
          units: 12, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ 
          units: 6, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ 
          units: 12, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ 
          units: 24, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ 
          units: 10, 
          activation: 'linear',
          kernelInitializer: 'glorotUniform'
        }) // Autoencoder reconstruction
      ]
    });
    
    this.anomalyModel.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    // PATTERN RECOGNITION MODEL
    this.patternModel = tf.sequential({
      layers: [
        tf.layers.dense({ 
          units: 96, 
          activation: 'relu', 
          inputShape: [20],
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ 
          units: 48, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ 
          units: 24, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dense({ units: 5, activation: 'softmax' }) // Pattern types
      ]
    });
    
    this.patternModel.compile({
      optimizer: tf.train.adamax(0.002),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('✅ Advanced TensorFlow.js Models Created');
  }

  // SAVE MODELS TO LOCAL STORAGE
  private async saveModelsToStorage(): Promise<void> {
    try {
      if (this.categorizationModel) {
        await this.categorizationModel.save('localstorage://tms-tf-categorization-model');
        console.log('💾 Categorization model saved to localStorage');
      }
      
      if (this.sentimentModel) {
        await this.sentimentModel.save('localstorage://tms-tf-sentiment-model');
        console.log('💾 Sentiment model saved to localStorage');
      }
      
      if (this.anomalyModel) {
        await this.anomalyModel.save('localstorage://tms-tf-anomaly-model');
        console.log('💾 Anomaly model saved to localStorage');
      }
      
      if (this.patternModel) {
        await this.patternModel.save('localstorage://tms-tf-pattern-model');
        console.log('💾 Pattern model saved to localStorage');
      }
      
    } catch (error) {
      this.logError('saveModelsToStorage', error, 'high');
    }
  }

  // LOAD MODELS FROM LOCAL STORAGE
  private async loadModelsFromStorage(): Promise<void> {
    try {
      this.categorizationModel = await tf.loadLayersModel('localstorage://tms-tf-categorization-model');
      console.log('📂 Categorization model loaded from localStorage');
      
      this.sentimentModel = await tf.loadLayersModel('localstorage://tms-tf-sentiment-model');
      console.log('📂 Sentiment model loaded from localStorage');
      
      this.anomalyModel = await tf.loadLayersModel('localstorage://tms-tf-anomaly-model');
      console.log('📂 Anomaly model loaded from localStorage');
      
      this.patternModel = await tf.loadLayersModel('localstorage://tms-tf-pattern-model');
      console.log('📂 Pattern model loaded from localStorage');
      
    } catch (error) {
      throw new Error('Models not found in localStorage - will create new models');
    }
  }

  private loadVocabulary(): void {
    try {
      const data = localStorage.getItem(this.VOCABULARY_KEY);
      if (data) {
        const vocabArray = JSON.parse(data);
        this.vocabulary = new Map(vocabArray);
      }
    } catch (error) {
      console.warn('Failed to load vocabulary:', error);
    }
  }

  private saveVocabulary(): void {
    try {
      const vocabArray = Array.from(this.vocabulary.entries());
      localStorage.setItem(this.VOCABULARY_KEY, JSON.stringify(vocabArray));
    } catch (error) {
      console.warn('Failed to save vocabulary:', error);
    }
  }

  private loadCategoryMappings(): void {
    try {
      const data = localStorage.getItem(this.CATEGORY_MAPPING_KEY);
      if (data) {
        const mappings = JSON.parse(data);
        this.categoryMapping = new Map(mappings.categoryMapping);
        this.reverseCategoryMapping = new Map(mappings.reverseCategoryMapping);
      }
    } catch (error) {
      console.warn('Failed to load category mappings:', error);
    }
  }

  private saveCategoryMappings(): void {
    try {
      const mappings = {
        categoryMapping: Array.from(this.categoryMapping.entries()),
        reverseCategoryMapping: Array.from(this.reverseCategoryMapping.entries())
      };
      localStorage.setItem(this.CATEGORY_MAPPING_KEY, JSON.stringify(mappings));
    } catch (error) {
      console.warn('Failed to save category mappings:', error);
    }
  }

  private loadModelStats(): void {
    try {
      const data = localStorage.getItem(this.MODEL_STATS_KEY);
      if (data) {
        this.modelStats = { ...this.modelStats, ...JSON.parse(data) };
      }
    } catch (error) {
      console.warn('Failed to load model stats:', error);
    }
  }

  private loadTrainingHistory(): void {
    try {
      const data = localStorage.getItem(this.TRAINING_HISTORY_KEY);
      if (data) {
        this.trainingHistory = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load training history:', error);
    }
  }

  // PUBLIC API METHODS
  getModelStatus(): TensorFlowModelStatus {
    return {
      isAvailable: this.isInitialized,
      modelLoaded: this.categorizationModel !== null,
      localModelLoaded: this.categorizationModel !== null,
      vocabularySize: this.vocabulary.size,
      categoriesCount: this.categoryMapping.size,
      lastCheck: new Date().toISOString(),
      modelStats: {
        ...this.modelStats,
        trainingDataSize: this.trainingHistory.length
      },
      tfVersion: tf.version.tfjs,
      modelsLoaded: {
        categorization: this.categorizationModel !== null,
        sentiment: this.sentimentModel !== null,
        anomaly: this.anomalyModel !== null,
        pattern: this.patternModel !== null
      },
      memoryInfo: tf.memory()
    };
  }

  getModelConfig(): TensorFlowModelConfig {
    return { ...this.modelConfig };
  }

  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeTensorFlow();
    }
  }

  dispose(): void {
    // Dispose TensorFlow models
    if (this.categorizationModel) {
      this.categorizationModel.dispose();
      this.categorizationModel = null;
    }
    if (this.sentimentModel) {
      this.sentimentModel.dispose();
      this.sentimentModel = null;
    }
    if (this.anomalyModel) {
      this.anomalyModel.dispose();
      this.anomalyModel = null;
    }
    if (this.patternModel) {
      this.patternModel.dispose();
      this.patternModel = null;
    }
    
    // Clear data structures
    this.vocabulary.clear();
    this.categoryMapping.clear();
    this.reverseCategoryMapping.clear();
    this.trainingHistory = [];
    
    this.isInitialized = false;
    console.log('🧹 TensorFlow method disposed and memory cleaned');
  }
} 