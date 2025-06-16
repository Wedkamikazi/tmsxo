import { Transaction, TransactionCategory } from '../shared/types';
import { enhancedMLOrchestrator, EnhancedMLResult } from './enhancedMLOrchestrator';
// import { localOllamaIntegration } from './localOllamaIntegration';
import { categorizationService } from './categorizationService';
import { systemIntegrityService } from './systemIntegrityService';
import { localStorageManager } from './localStorageManager';
import { eventBus } from './EventBus';
import { isDebugMode } from '../shared/utils/debugging/DebugMode';

// ENHANCED TRANSACTION CATEGORIZATION SERVICE
// Consolidates all categorization logic and eliminates duplication
// Provides unified categorization with ML enhancement and rule-based fallback

export interface CategorizationStrategy {
  primary: 'ml-enhanced' | 'rule-based' | 'manual';
  fallback: 'rule-based' | 'manual' | 'default';
  confidenceThreshold: number;
  useOllamaWhenAvailable: boolean;
  enableLearning: boolean;
}

export interface CategorizationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  method: 'ml-enhanced' | 'rule-based' | 'manual' | 'default';
  reasoning: string;
  suggestions: string[];
  alternatives: Array<{
    categoryId: string;
    categoryName: string;
    confidence: number;
  }>;
  processingTime: number;
  metadata: {
    modelUsed?: string;
    ruleMatched?: string;
    anomalyDetected: boolean;
    sentiment?: string;
    entities?: string[];
    patterns?: string[];
  };
}

export interface CategorizationPerformance {
  totalCategorizations: number;
  accuracyRate: number;
  averageConfidence: number;
  methodBreakdown: {
    mlEnhanced: number;
    ruleBased: number;
    manual: number;
    default: number;
  };
  averageProcessingTime: number;
  ollamaUsageRate: number;
  learningDataPoints: number;
}

class EnhancedCategorizationService {
  private isInitialized = false;
  private strategy: CategorizationStrategy = {
    primary: 'ml-enhanced',
    fallback: 'rule-based',
    confidenceThreshold: 0.7,
    useOllamaWhenAvailable: true,
    enableLearning: true
  };

  private performance: CategorizationPerformance = {
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
    learningDataPoints: 0
  };

  private categoryMappings: Map<string, TransactionCategory> = new Map();
  private learningHistory: Array<{
    transactionId: string;
    originalPrediction: string;
    correctedCategory: string;
    confidence: number;
    method: string;
    timestamp: string;
  }> = [];

  constructor() {
    this.initializeEnhancedCategorization();
  }

  // INITIALIZE ENHANCED CATEGORIZATION
  private async initializeEnhancedCategorization(): Promise<void> {
    try {
      console.log('🎯 Initializing Enhanced Categorization Service...');
      
      // Load categories and build mappings
      this.loadCategoryMappings();
      
      // Load performance history
      this.loadPerformanceHistory();
      
      // Load learning data
      this.loadLearningHistory();
      
      // Ensure ML orchestrator is ready
      await enhancedMLOrchestrator.ensureInitialized();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('✅ Enhanced Categorization Service Ready');
      
    } catch (error) {
      this.logCategorizationError('initializeEnhancedCategorization', error, 'critical');
      this.isInitialized = false;
    }
  }

  // MAIN CATEGORIZATION METHOD
  async categorizeTransaction(transaction: Transaction): Promise<CategorizationResult> {
    if (!this.isInitialized) {
      throw new Error('Enhanced Categorization Service not initialized');
    }

    const startTime = Date.now();
    this.performance.totalCategorizations++;

    try {
      let result: CategorizationResult;

      // Try primary strategy
      switch (this.strategy.primary) {
        case 'ml-enhanced':
          result = await this.categorizeWithMLEnhanced(transaction);
          break;
        case 'rule-based':
          result = await this.categorizeWithRules(transaction);
          break;
        case 'manual':
          result = await this.categorizeManually(transaction);
          break;
        default:
          result = await this.categorizeWithMLEnhanced(transaction);
      }

      // If confidence is too low, try fallback strategy
      if (result.confidence < this.strategy.confidenceThreshold) {
        console.log(`🔄 Low confidence (${result.confidence}), trying fallback strategy`);
        const fallbackResult = await this.tryFallbackStrategy(transaction);
        if (fallbackResult.confidence > result.confidence) {
          result = fallbackResult;
        }
      }

      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;

      // Update performance metrics
      this.updatePerformanceMetrics(result);

      // Store for learning if enabled
      if (this.strategy.enableLearning) {
        this.storeLearningData(transaction, result);
      }

      // Emit categorization event
      eventBus.emit('CATEGORIES_UPDATED', {
        transactionId: transaction.id,
        categoryId: result.categoryId,
        method: result.method,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logCategorizationError('categorizeTransaction', error, 'high');
      
      return this.createDefaultResult(transaction, processingTime);
    }
  }

  // ML-ENHANCED CATEGORIZATION
  private async categorizeWithMLEnhanced(transaction: Transaction): Promise<CategorizationResult> {
    try {
      const mlResult: EnhancedMLResult = await enhancedMLOrchestrator.categorizeTransaction(transaction);
      const category = this.categoryMappings.get(mlResult.categoryId);
      
      this.performance.methodBreakdown.mlEnhanced++;
      if (mlResult.modelUsed === 'ollama') {
        this.performance.ollamaUsageRate = 
          (this.performance.ollamaUsageRate * (this.performance.totalCategorizations - 1) + 1) / 
          this.performance.totalCategorizations;
      }

      return {
        categoryId: mlResult.categoryId,
        categoryName: category?.name || mlResult.categoryId,
        confidence: mlResult.confidence,
        method: 'ml-enhanced',
        reasoning: mlResult.reasoning,
        suggestions: mlResult.enhancedAnalysis?.businessInsights || [],
        alternatives: mlResult.alternativeCategories.map(alt => ({
          categoryId: alt.categoryId,
          categoryName: this.categoryMappings.get(alt.categoryId)?.name || alt.categoryId,
          confidence: alt.confidence
        })),
        processingTime: mlResult.processingTime,
        metadata: {
          modelUsed: mlResult.modelUsed,
          anomalyDetected: mlResult.metadata?.isAnomaly || false,
          sentiment: mlResult.metadata?.sentiment,
          entities: mlResult.enhancedAnalysis?.businessInsights,
          patterns: mlResult.enhancedAnalysis?.patternRecognition
        }
      };

    } catch (error) {
      this.logCategorizationError('categorizeWithMLEnhanced', error, 'medium');
      throw error;
    }
  }

  // RULE-BASED CATEGORIZATION
  private async categorizeWithRules(transaction: Transaction): Promise<CategorizationResult> {
    this.performance.methodBreakdown.ruleBased++;
    
    const rules = categorizationService.getAllRules();
    const amount = transaction.debitAmount || transaction.creditAmount;
    const description = transaction.description.toLowerCase();
    
    // Find matching rule
    for (const rule of rules) {
      if (!rule.isActive) continue;
      
      let matches = true;
      
      // Check amount range
      if (rule.amountMin !== undefined && amount < rule.amountMin) matches = false;
      if (rule.amountMax !== undefined && amount > rule.amountMax) matches = false;
      
      // Check description keywords
      const ruleKeywords = rule.description.toLowerCase().split(' ');
      const hasKeywordMatch = ruleKeywords.some(keyword => 
        description.includes(keyword.toLowerCase())
      );
      
      if (matches && hasKeywordMatch) {
        const category = this.categoryMappings.get(rule.categoryId);
        
        return {
          categoryId: rule.categoryId,
          categoryName: category?.name || rule.categoryId,
          confidence: 0.8, // Rule-based confidence
          method: 'rule-based',
          reasoning: `Matched rule: ${rule.description}`,
          suggestions: [],
          alternatives: [],
          processingTime: 0,
          metadata: {
            ruleMatched: rule.id,
            anomalyDetected: false
          }
        };
      }
    }
    
    // No rule matched - use default categorization
    throw new Error('No matching rules found');
  }

  // MANUAL CATEGORIZATION (PLACEHOLDER)
  private async categorizeManually(transaction: Transaction): Promise<CategorizationResult> {
    this.performance.methodBreakdown.manual++;
    
    // This would typically prompt user input or return existing manual categorization
    const existingCategorization = categorizationService.getCategorizationByTransactionId(transaction.id);
    
    if (existingCategorization) {
      const category = this.categoryMappings.get(existingCategorization.categoryId);
      
      return {
        categoryId: existingCategorization.categoryId,
        categoryName: category?.name || existingCategorization.categoryId,
        confidence: 1.0, // Manual categorization is always high confidence
        method: 'manual',
        reasoning: existingCategorization.reasoning || 'Manual categorization',
        suggestions: [],
        alternatives: [],
        processingTime: 0,
        metadata: {
          anomalyDetected: false
        }
      };
    }
    
    throw new Error('No manual categorization available');
  }

  // FALLBACK STRATEGY
  private async tryFallbackStrategy(transaction: Transaction): Promise<CategorizationResult> {
    try {
      switch (this.strategy.fallback) {
        case 'rule-based':
          return await this.categorizeWithRules(transaction);
        case 'manual':
          return await this.categorizeManually(transaction);
        default:
          return this.createDefaultResult(transaction, 0);
      }
    } catch (error) {
      return this.createDefaultResult(transaction, 0);
    }
  }

  // BATCH CATEGORIZATION
  async batchCategorizeTransactions(transactions: Transaction[]): Promise<CategorizationResult[]> {
    console.log(`🔄 Batch categorizing ${transactions.length} transactions...`);
    
    const results: CategorizationResult[] = [];
    const batchSize = 20;
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (transaction) => {
        try {
          return await this.categorizeTransaction(transaction);
        } catch (error) {
          this.logCategorizationError('batchCategorizeTransactions', error, 'medium');
          return this.createDefaultResult(transaction, 0);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Progress logging
      console.log(`📊 Processed ${Math.min(i + batchSize, transactions.length)} / ${transactions.length} transactions`);
      
      // Small delay between batches
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Batch categorization complete: ${results.length} transactions processed`);
    return results;
  }

  // LEARNING AND IMPROVEMENT
  async improveFromFeedback(transactionId: string, correctCategoryId: string): Promise<void> {
    const transaction = localStorageManager.getAllTransactions().find(t => t.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Find the original prediction
    const originalLearning = this.learningHistory.find(l => l.transactionId === transactionId);
    
    if (originalLearning) {
      // Update learning history
      originalLearning.correctedCategory = correctCategoryId;
      
      // If using ML, this feedback can be used for future training
      if (this.strategy.enableLearning) {
        this.performance.learningDataPoints++;
        
        // Store learning data for future model training (using direct localStorage since this is custom data)
        try {
          localStorage.setItem(`categorization-feedback-${transactionId}`, JSON.stringify({
            transactionId,
            description: transaction.description,
            amount: transaction.debitAmount || transaction.creditAmount,
            originalPrediction: originalLearning.originalPrediction,
            correctCategory: correctCategoryId,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.warn('Failed to store categorization feedback:', error);
        }
      }
    }
    
    // Apply the correction immediately
    categorizationService.categorizeTransaction(transactionId, correctCategoryId, 'manual', 1.0, 'User correction');
    
    this.saveLearningHistory();
    
    eventBus.emit('CATEGORIES_UPDATED', {
      transactionId,
      correctCategoryId,
      method: 'user_feedback'
    });
  }

  // UTILITY METHODS
  private loadCategoryMappings(): void {
    const categories = categorizationService.getAllCategories();
    this.categoryMappings.clear();
    
    categories.forEach(category => {
      this.categoryMappings.set(category.id, category);
    });
    
    console.log(`📋 Loaded ${categories.length} category mappings`);
  }

  private createDefaultResult(_transaction: Transaction, processingTime: number): CategorizationResult {
    this.performance.methodBreakdown.default++;
    
    return {
      categoryId: 'Other',
      categoryName: 'Other',
      confidence: 0.3,
      method: 'default',
      reasoning: 'Default categorization due to processing failure',
      suggestions: ['Manual review recommended'],
      alternatives: [],
      processingTime,
      metadata: {
        anomalyDetected: false
      }
    };
  }

  private updatePerformanceMetrics(result: CategorizationResult): void {
    // Update average confidence
    this.performance.averageConfidence = (
      (this.performance.averageConfidence * (this.performance.totalCategorizations - 1) + result.confidence) /
      this.performance.totalCategorizations
    );
    
    // Update average processing time
    this.performance.averageProcessingTime = (
      (this.performance.averageProcessingTime * (this.performance.totalCategorizations - 1) + result.processingTime) /
      this.performance.totalCategorizations
    );
    
    this.savePerformanceHistory();
  }

  private storeLearningData(transaction: Transaction, result: CategorizationResult): void {
    this.learningHistory.push({
      transactionId: transaction.id,
      originalPrediction: result.categoryId,
      correctedCategory: result.categoryId, // Will be updated if user provides feedback
      confidence: result.confidence,
      method: result.method,
      timestamp: new Date().toISOString()
    });
    
    // Keep only recent learning data
    if (this.learningHistory.length > 1000) {
      this.learningHistory = this.learningHistory.slice(-500);
    }
  }

  private setupEventListeners(): void {
    // Listen for category changes
    eventBus.on('CATEGORY_UPDATED', () => {
      this.loadCategoryMappings();
    });
    
    // Listen for rule changes
    eventBus.on('CATEGORIZATION_RULE_UPDATED', () => {
      // Reload rules if needed
    });
  }

  private loadPerformanceHistory(): void {
    try {
      const saved = localStorage.getItem('enhanced-categorization-performance');
      if (saved) {
        this.performance = { ...this.performance, ...JSON.parse(saved) };
      }
    } catch (error) {
      // Ignore storage errors
    }
  }

  private savePerformanceHistory(): void {
    try {
      localStorage.setItem('enhanced-categorization-performance', JSON.stringify(this.performance));
    } catch (error) {
      // Ignore storage errors
    }
  }

  private loadLearningHistory(): void {
    try {
      const saved = localStorage.getItem('categorization-learning-history');
      if (saved) {
        this.learningHistory = JSON.parse(saved);
      }
    } catch (error) {
      // Ignore storage errors
    }
  }

  private saveLearningHistory(): void {
    try {
      localStorage.setItem('categorization-learning-history', JSON.stringify(this.learningHistory));
    } catch (error) {
      // Ignore storage errors
    }
  }

  private logCategorizationError(operation: string, error: unknown, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    systemIntegrityService.logServiceError(
      'EnhancedCategorizationService',
      operation,
      error instanceof Error ? error : new Error(String(error)),
      severity,
      { component: 'categorization', timestamp: new Date().toISOString() }
    );
  }

  // PUBLIC API METHODS
  getStrategy(): CategorizationStrategy {
    return { ...this.strategy };
  }

  async updateStrategy(newStrategy: Partial<CategorizationStrategy>): Promise<void> {
    this.strategy = { ...this.strategy, ...newStrategy };
    
    // Save strategy
    try {
      localStorage.setItem('categorization-strategy', JSON.stringify(this.strategy));
    } catch (error) {
      // Ignore storage errors
    }
    
    console.log('🔄 Categorization strategy updated:', this.strategy);
  }

  getPerformanceMetrics(): CategorizationPerformance {
    return { ...this.performance };
  }

  getCategoryMappings(): Map<string, TransactionCategory> {
    return new Map(this.categoryMappings);
  }

  async recategorizeAllTransactions(): Promise<{ success: number; failed: number }> {
    console.log('🔄 Starting full recategorization...');
    
    const transactions = localStorageManager.getAllTransactions();
    const results = await this.batchCategorizeTransactions(transactions);
    
    let success = 0;
    let failed = 0;
    
    results.forEach(result => {
      if (result.confidence > 0.5) {
        success++;
      } else {
        failed++;
      }
    });
    
    console.log(`✅ Recategorization complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeEnhancedCategorization();
    }
  }

  dispose(): void {
    this.learningHistory.length = 0;
    this.categoryMappings.clear();
    this.isInitialized = false;
  }
}

// Check for debug mode
const debugModeActive = isDebugMode();

// Export singleton instance (skip in debug mode)
let enhancedCategorizationService: EnhancedCategorizationService;

if (debugModeActive) {
  console.log('🔧 EnhancedCategorizationService: Debug mode detected - creating mock instance');
  enhancedCategorizationService = {
    categorizeTransaction: () => Promise.resolve({
      categoryId: 'Other',
      categoryName: 'Other',
      confidence: 0.5,
      method: 'default',
      reasoning: 'Debug mode',
      suggestions: [],
      alternatives: [],
      processingTime: 0,
      metadata: { anomalyDetected: false }
    }),
    ensureInitialized: () => Promise.resolve(),
    dispose: () => Promise.resolve(),
    getPerformanceMetrics: () => ({
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
      learningDataPoints: 0
    }),
    getStrategy: () => ({
      primary: 'rule-based' as const,
      fallback: 'default' as const,
      confidenceThreshold: 0.7,
      useOllamaWhenAvailable: false,
      enableLearning: false
    }),
    updateStrategy: () => Promise.resolve(),
    getCategoryMappings: () => new Map(),
    recategorizeAllTransactions: () => Promise.resolve({ success: 0, failed: 0 }),
    batchCategorizeTransactions: () => Promise.resolve([]),
    improveFromFeedback: () => Promise.resolve()
  } as any;
} else {
  enhancedCategorizationService = new EnhancedCategorizationService();
}

export { enhancedCategorizationService }; 