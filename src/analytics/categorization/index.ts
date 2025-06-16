// UNIFIED CATEGORIZATION SYSTEM - CORE INTERFACES
// This file defines the strategy pattern interfaces for categorization methods

import { Transaction } from '../../types';

// UNIFIED CATEGORIZATION RESULT
export interface UnifiedCategorizationResult {
  categoryId: string;
  categoryName: string;
  confidence: number;
  method: 'rule-based' | 'ml-enhanced' | 'tensorflow' | 'manual' | 'fallback';
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
    fallbackReason?: string;
    strategyUsed?: string;
  };
}

// CATEGORIZATION STRATEGY INTERFACE
export interface CategorizationStrategy {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  categorize(transaction: Transaction): Promise<UnifiedCategorizationResult>;
  batchCategorize?(transactions: Transaction[]): Promise<UnifiedCategorizationResult[]>;
  dispose?(): void;
}

// STRATEGY CONFIGURATION
export interface StrategyConfig {
  primary: string;
  fallback: string[];
  confidenceThreshold: number;
  enableLearning: boolean;
  batchSize: number;
  autoApplyHighConfidence: boolean;
}

// PERFORMANCE METRICS
export interface StrategyPerformance {
  totalCategorizations: number;
  averageConfidence: number;
  averageProcessingTime: number;
  successRate: number;
  methodBreakdown: Record<string, number>;
  lastUpdated: string;
}

// STRATEGY REGISTRY
export class StrategyRegistry {
  private strategies: Map<string, CategorizationStrategy> = new Map();
  private config: StrategyConfig = {
    primary: 'ml-enhanced',
    fallback: ['tensorflow', 'rule-based'],
    confidenceThreshold: 0.7,
    enableLearning: true,
    batchSize: 10,
    autoApplyHighConfidence: true
  };

  register(strategy: CategorizationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  unregister(name: string): void {
    const strategy = this.strategies.get(name);
    if (strategy?.dispose) {
      strategy.dispose();
    }
    this.strategies.delete(name);
  }

  getStrategy(name: string): CategorizationStrategy | undefined {
    return this.strategies.get(name);
  }

  getAllStrategies(): CategorizationStrategy[] {
    return Array.from(this.strategies.values());
  }

  getAvailableStrategies(): Promise<CategorizationStrategy[]> {
    return Promise.all(
      Array.from(this.strategies.values()).map(async strategy => ({
        strategy,
        available: await strategy.isAvailable()
      }))
    ).then(results => 
      results.filter(r => r.available).map(r => r.strategy)
    );
  }

  getConfig(): StrategyConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<StrategyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  dispose(): void {
    for (const strategy of this.strategies.values()) {
      if (strategy.dispose) {
        strategy.dispose();
      }
    }
    this.strategies.clear();
  }
} 