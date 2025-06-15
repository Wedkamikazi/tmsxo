// ML-ENHANCED CATEGORIZATION TYPES
// Extracted from enhancedCategorizationService.ts - interfaces and types for ML-enhanced categorization

// ENHANCED STRATEGY CONFIGURATION (extends base strategy)
export interface MLEnhancedStrategy {
  primary: 'ml-enhanced' | 'rule-based' | 'manual';
  fallback: 'rule-based' | 'manual' | 'default';
  confidenceThreshold: number;
  useOllamaWhenAvailable: boolean;
  enableLearning: boolean;
}

// ENHANCED CATEGORIZATION RESULT (more detailed than base)
export interface MLEnhancedResult {
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
    enhancedAnalysis?: {
      businessInsights?: string[];
      patternRecognition?: string[];
      contextualFactors?: string[];
    };
  };
}

// PERFORMANCE TRACKING
export interface MLEnhancedPerformance {
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
  enhancedMetrics: {
    fallbackRate: number;
    improvementRate: number;
    userCorrectionRate: number;
    averageAlternativesProvided: number;
  };
}

// LEARNING DATA STRUCTURE
export interface LearningDataPoint {
  transactionId: string;
  originalPrediction: string;
  correctedCategory: string;
  confidence: number;
  method: string;
  timestamp: string;
  improvementFactor?: number;
  contextualFactors?: string[];
}

// BATCH PROCESSING CONFIGURATION
export interface BatchProcessingConfig {
  batchSize: number;
  maxConcurrency: number;
  progressCallback?: (current: number, total: number) => void;
  errorHandling: 'stop' | 'continue' | 'retry';
  retryAttempts: number;
}

// FEEDBACK IMPROVEMENT DATA
export interface FeedbackData {
  transactionId: string;
  correctCategoryId: string;
  previousPrediction?: string;
  userReasoning?: string;
  confidence?: number;
  timestamp: string;
} 