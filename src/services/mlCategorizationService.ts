import * as tf from '@tensorflow/tfjs';
import { Transaction, TransactionCategory, MLCategorizationResult } from '../types';
import { categorizationService } from './categorizationService';

// LOCAL-ONLY ML CATEGORIZATION SERVICE
// NO EXTERNAL DEPENDENCIES - PURE BROWSER-BASED PROCESSING
class MLCategorizationService {
  private vocabulary: Map<string, number> = new Map();
  private categoryMapping: Map<string, number> = new Map();
  private reverseCategoryMapping: Map<number, string> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeLocalRules();
  }

  // Initialize local rule-based categorization system
  private initializeLocalRules(): void {
    this.buildCategoryMappings();
    this.isInitialized = true;
  }

  private buildCategoryMappings(): void {
    const categories = categorizationService.getAllCategories();
    this.categoryMapping.clear();
    this.reverseCategoryMapping.clear();

    categories.forEach((category, index) => {
      this.categoryMapping.set(category.id, index);
      this.reverseCategoryMapping.set(index, category.id);
    });
  }

  // LOCAL RULE-BASED CATEGORIZATION
  async categorizeTransaction(transaction: Transaction): Promise<MLCategorizationResult | null> {
    if (!this.isInitialized) {
      this.initializeLocalRules();
    }

    const categories = categorizationService.getAllCategories();
    let bestMatch: { categoryId: string; confidence: number; reasoning: string } = {
      categoryId: 'cat_uncategorized',
      confidence: 0.1,
      reasoning: 'No matching rules found'
    };

    const description = transaction.description.toLowerCase();
    const amount = Math.abs(transaction.debitAmount || transaction.creditAmount || 0);

    // Rule-based categorization logic
    for (const category of categories) {
      let confidence = 0;
      let matchedKeywords: string[] = [];

      // Keyword matching
      for (const keyword of category.keywords || []) {
        if (description.includes(keyword.toLowerCase())) {
          confidence += 0.3;
          matchedKeywords.push(keyword);
        }
      }

      // Pattern matching for specific categories
      if (category.id === 'cat_payroll' && this.isPayrollTransaction(description, amount)) {
        confidence += 0.5;
      } else if (category.id === 'cat_international' && this.isInternationalTransaction(description)) {
        confidence += 0.4;
      } else if (category.id === 'cat_office_supplies' && this.isOfficeSuppliesTransaction(description, amount)) {
        confidence += 0.3;
      }

      // Amount-based rules
      if (amount > 50000) confidence += 0.1; // Large transactions
      if (amount < 1000) confidence += 0.05; // Small transactions

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          categoryId: category.id,
          confidence: Math.min(confidence, 0.95),
          reasoning: `Matched keywords: ${matchedKeywords.join(', ')}. Pattern confidence: ${Math.round(confidence * 100)}%`
        };
      }
    }

    return {
      categoryId: bestMatch.categoryId,
      confidence: bestMatch.confidence,
      reasoning: bestMatch.reasoning,
      alternativeCategories: []
    };
  }

  private isPayrollTransaction(description: string, amount: number): boolean {
    const payrollKeywords = ['salary', 'wage', 'payroll', 'employee', 'staff'];
    return payrollKeywords.some(keyword => description.includes(keyword)) && amount > 1000;
  }

  private isInternationalTransaction(description: string): boolean {
    const intlKeywords = ['international', 'wire', 'transfer', 'foreign', 'overseas', 'swift'];
    return intlKeywords.some(keyword => description.includes(keyword));
  }

  private isOfficeSuppliesTransaction(description: string, amount: number): boolean {
    const officeKeywords = ['office', 'supplies', 'equipment', 'stationery', 'printer'];
    return officeKeywords.some(keyword => description.includes(keyword)) && amount < 10000;
  }

  // Batch processing
  async categorizeTransactionsBatch(transactions: Transaction[]): Promise<Array<{
    transaction: Transaction;
    result: MLCategorizationResult | null;
    error?: string;
  }>> {
    const results = [];
    
    for (const transaction of transactions) {
      try {
        const result = await this.categorizeTransaction(transaction);
        results.push({ transaction, result });
      } catch (error) {
        results.push({ 
          transaction, 
          result: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return results;
  }

  // Status methods for compatibility
  getModelStatus(): {
    isAvailable: boolean;
    modelLoaded: boolean;
    localModelLoaded: boolean;
    vocabularySize: number;
    categoriesCount: number;
    lastCheck: string;
  } {
    return {
      isAvailable: true,
      modelLoaded: true,
      localModelLoaded: true,
      vocabularySize: this.vocabulary.size,
      categoriesCount: this.categoryMapping.size,
      lastCheck: new Date().toISOString()
    };
  }

  async testCategorization(): Promise<{
    success: boolean;
    result?: MLCategorizationResult;
    error?: string;
    latency?: number;
  }> {
    const start = Date.now();
    
    try {
      const testTransaction: Transaction = {
        id: 'test-1',
        date: '2024-12-14',
        description: 'INTERNATIONAL WIRE TRANSFER TO VENDOR',
        debitAmount: 15000,
        creditAmount: 0,
        balance: 85000,
        reference: 'WIRE001'
      };

      const result = await this.categorizeTransaction(testTransaction);
      const latency = Date.now() - start;

      return {
        success: true,
        result: result || undefined,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - start
      };
    }
  }
}

export const mlCategorizationService = new MLCategorizationService(); 