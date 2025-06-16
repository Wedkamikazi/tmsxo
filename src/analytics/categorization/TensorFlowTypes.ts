// TENSORFLOW CATEGORIZATION TYPES
// Extracted from mlCategorizationService.ts - interfaces and types for TensorFlow-based categorization

import * as tf from '@tensorflow/tfjs';
import { Transaction } from '@/shared/types';

// TENSORFLOW MODEL CONFIGURATION
export interface TensorFlowModelConfig {
  vocabSize: number;
  numCategories: number;
  embeddingDim: number;
  sequenceLength: number;
  lstmUnits: number;
  denseUnits: number[];
  dropoutRate: number;
  learningRate: number;
}

// MODEL STATISTICS
export interface TensorFlowModelStats {
  totalPredictions: number;
  accuratePredictions: number;
  averageConfidence: number;
  modelVersion: string;
  lastTrainingDate: string;
  trainingDataSize: number;
  memoryUsage?: {
    tensors: number;
    bytes: number;
  };
}

// TRAINING HISTORY DATA
export interface TrainingDataPoint {
  transaction: Transaction;
  predictedCategory: string;
  actualCategory: string;
  confidence: number;
  wasCorrect: boolean;
  timestamp: string;
  features?: {
    textFeatures: number[];
    numericalFeatures: number[];
  };
}

// PREDICTION RESULTS
export interface TensorFlowPrediction {
  categoryId: string;
  confidence: number;
  probabilities: number[];
  sentiment?: {
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  };
  anomaly?: {
    isAnomaly: boolean;
    score: number;
  };
  pattern?: {
    type: string;
    confidence: number;
  };
  processingTime: number;
  modelUsed: 'categorization' | 'ensemble';
}

// MODEL STATUS
export interface TensorFlowModelStatus {
  isAvailable: boolean;
  modelLoaded: boolean;
  localModelLoaded: boolean;
  vocabularySize: number;
  categoriesCount: number;
  lastCheck: string;
  modelStats: TensorFlowModelStats;
  tfVersion: string;
  modelsLoaded: {
    categorization: boolean;
    sentiment: boolean;
    anomaly: boolean;
    pattern: boolean;
  };
  memoryInfo?: tf.MemoryInfo;
}

// BATCH PROCESSING CONFIGURATION
export interface TensorFlowBatchConfig {
  batchSize: number;
  maxConcurrency: number;
  memoryThreshold: number; // MB
  progressCallback?: (processed: number, total: number, errors: number) => void;
  enableMemoryOptimization: boolean;
}

// TRAINING CONFIGURATION
export interface TensorFlowTrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  patience: number; // Early stopping
  minDelta: number; // Minimum improvement
  learningRate: number;
  useEarlyStopping: boolean;
  saveBestOnly: boolean;
}

// FEATURE PROCESSING CONFIGURATION
export interface FeatureConfig {
  textFeatures: {
    maxSequenceLength: number;
    vocabularySize: number;
    embeddingDim: number;
    includeNGrams: boolean;
    nGramRange: [number, number];
  };
  numericalFeatures: {
    includeAmount: boolean;
    includeDate: boolean;
    includeBalance: boolean;
    normalizationMethod: 'minmax' | 'zscore' | 'none';
  };
}

// RETRAINING FEEDBACK
export interface RetrainingFeedback {
  transactionId: string;
  correctCategory: string;
  previousPrediction: string;
  confidence?: number;
  userReasoning?: string;
  timestamp: string;
}

// PERFORMANCE METRICS
export interface TensorFlowPerformanceMetrics {
  modelName: string;
  averageLatency: number;
  totalCategorizations: number;
  totalRequests: number;
  successRate: number;
  confidenceDistribution: Array<{ range: string; count: number }>;
  lastUpdated: string;
  tensorflowMemory: tf.MemoryInfo;
  modelAccuracy: number;
  trainingHistory: number;
  anomaliesDetected: number;
  patternTypes: Record<string, number>;
}

// TEST RESULTS
export interface TensorFlowTestResult {
  success: boolean;
  result?: TensorFlowPrediction;
  error?: string;
  latency?: number;
  modelPerformance?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
} 