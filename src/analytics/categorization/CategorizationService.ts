import { TransactionCategory, CategorizationRule, TransactionCategorization, Transaction } from '../../../shared/types';
import { localStorageManager } from './localStorageManager';
import { eventBus } from './EventBus';

/**
 * CATEGORIZATION SERVICE
 * Manages transaction categories and categorization rules
 * Uses localStorageManager for unified data storage
 */
class CategorizationService {
  private readonly RULES_KEY = 'tms_categorization_rules';

  constructor() {
    this.initializeDefaultRules();
  }

  // Initialize default categorization rules
  private initializeDefaultRules(): void {
    const existing = this.getAllRules();
    if (existing.length === 0) {
      const defaultRules: CategorizationRule[] = [
        {
          id: 'rule_payroll',
          categoryId: 'cat_income', // Use standard category from localStorageManager
          description: 'Payroll and salary transactions',
          priority: 1,
          isActive: true,
          createdDate: new Date().toISOString()
        },
        {
          id: 'rule_bank_fees',
          categoryId: 'cat_expense',
          description: 'Banking fees and charges',
          priority: 2,
          isActive: true,
          createdDate: new Date().toISOString()
        },
        {
          id: 'rule_transfers',
          categoryId: 'cat_transfer',
          description: 'Account transfers',
          priority: 3,
          isActive: true,
          createdDate: new Date().toISOString()
        }
      ];

      this.saveRules(defaultRules);
    }
  }

  // CATEGORY MANAGEMENT (delegated to localStorageManager)
  getAllCategories(): TransactionCategory[] {
    return localStorageManager.getAllCategories();
  }

  getCategoryById(id: string): TransactionCategory | undefined {
    return this.getAllCategories().find(cat => cat.id === id);
  }

  createCategory(category: Omit<TransactionCategory, 'id' | 'createdDate' | 'modifiedDate'>): TransactionCategory | null {
    const newCategory = localStorageManager.addCategory(category);
    if (newCategory) {
      eventBus.emit('CATEGORIES_UPDATED', { categoryId: newCategory.id, action: 'created' }, 'CategorizationService');
    }
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<TransactionCategory>): TransactionCategory | null {
    const categories = this.getAllCategories();
    const category = categories.find(cat => cat.id === id);
    
    if (!category) return null;

    const updatedCategory = { ...category, ...updates, modifiedDate: new Date().toISOString() };
    
    // Since localStorageManager doesn't have updateCategory method yet, 
    // we'll work with the existing category system
    const allCategories = categories.map(cat => 
      cat.id === id ? updatedCategory : cat
    );
    
    // This is a temporary workaround until localStorageManager has updateCategory
    try {
      localStorage.setItem('tms_categories', JSON.stringify(allCategories));
      eventBus.emit('CATEGORIES_UPDATED', { categoryId: id, action: 'updated' }, 'CategorizationService');
      return updatedCategory;
    } catch (error) {
      console.error('Error updating category:', error);
      return null;
    }
  }

  deleteCategory(id: string): boolean {
    const categories = this.getAllCategories();
    const category = categories.find(cat => cat.id === id);
    
    if (!category || category.isSystem) {
      return false; // Cannot delete system categories
    }

    // Move categorizations from deleted category to uncategorized
    const categorizations = this.getAllCategorizations();
    const uncategorizedId = 'cat_expense'; // Default fallback category
    
    const updatedCategorizations = categorizations.map(cat => {
      if (cat.categoryId === id) {
        return {
          ...cat,
          categoryId: uncategorizedId,
          modifiedDate: new Date().toISOString(),
          method: 'manual' as const // Reset to manual when moved
        };
      }
      return cat;
    });

    // Save updated categorizations
    this.saveCategorizations(updatedCategorizations);

    // Remove category
    const filteredCategories = categories.filter(cat => cat.id !== id);
    
    try {
      localStorage.setItem('tms_categories', JSON.stringify(filteredCategories));
      eventBus.emit('CATEGORIES_UPDATED', { categoryId: id, action: 'deleted' }, 'CategorizationService');
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  }

  // CATEGORIZATION MANAGEMENT (uses localStorageManager)
  getAllCategorizations(): TransactionCategorization[] {
    return localStorageManager.getAllCategorizations();
  }

  getCategorizationByTransactionId(transactionId: string): TransactionCategorization | undefined {
    return this.getAllCategorizations().find(cat => cat.transactionId === transactionId);
  }

  categorizeTransaction(
    transactionId: string,
    categoryId: string,
    method: 'manual' | 'ml' | 'rule',
    confidence?: number,
    reasoning?: string
  ): TransactionCategorization | null {
    // Validate that category exists
    const category = this.getCategoryById(categoryId);
    if (!category) {
      console.error(`Category ${categoryId} not found`);
      return null;
    }

    // Validate that transaction exists
    const transactions = localStorageManager.getAllTransactions();
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) {
      console.error(`Transaction ${transactionId} not found`);
      return null;
    }

    const categorization: Omit<TransactionCategorization, 'createdDate' | 'modifiedDate'> = {
      transactionId,
      categoryId,
      method,
      confidence,
      reasoning
    };

    const result = localStorageManager.addCategorization(categorization);
    
    if (result) {
      eventBus.emit('CATEGORIES_UPDATED', { 
        transactionId, 
        categoryId, 
        action: 'categorized' 
      }, 'CategorizationService');
    }
    
    return result;
  }

  // Batch categorize multiple transactions
  batchCategorizeTransactions(
    categorizations: Array<{
      transactionId: string;
      categoryId: string;
      method: 'manual' | 'ml' | 'rule';
      confidence?: number;
      reasoning?: string;
    }>
  ): { success: number; failed: number; errors: string[] } {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    categorizations.forEach(cat => {
      const result = this.categorizeTransaction(
        cat.transactionId,
        cat.categoryId,
        cat.method,
        cat.confidence,
        cat.reasoning
      );

      if (result) {
        success++;
      } else {
        failed++;
        errors.push(`Failed to categorize transaction ${cat.transactionId}`);
      }
    });

    if (success > 0) {
      eventBus.emit('CATEGORIES_UPDATED', { 
        action: 'batch_categorized', 
        count: success 
      }, 'CategorizationService');
    }

    return { success, failed, errors };
  }

  // Remove categorization
  removeCategorization(transactionId: string): boolean {
    const categorizations = this.getAllCategorizations();
    const filtered = categorizations.filter(cat => cat.transactionId !== transactionId);
    
    if (filtered.length < categorizations.length) {
      this.saveCategorizations(filtered);
      eventBus.emit('CATEGORIES_UPDATED', { 
        transactionId, 
        action: 'uncategorized' 
      }, 'CategorizationService');
      return true;
    }
    
    return false;
  }

  private saveCategorizations(categorizations: TransactionCategorization[]): void {
    // Temporary direct storage until localStorageManager has setCategorizations method
    try {
      localStorage.setItem('tms_categorizations', JSON.stringify(categorizations));
    } catch (error) {
      console.error('Error saving categorizations:', error);
    }
  }

  // RULE-BASED CATEGORIZATION
  getAllRules(): CategorizationRule[] {
    try {
      const data = localStorage.getItem(this.RULES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading categorization rules:', error);
      return [];
    }
  }

  createRule(rule: Omit<CategorizationRule, 'id' | 'createdDate'>): CategorizationRule {
    const newRule: CategorizationRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdDate: new Date().toISOString()
    };

    const rules = this.getAllRules();
    rules.push(newRule);
    this.saveRules(rules);
    
    eventBus.emit('CATEGORIES_UPDATED', { 
      ruleId: newRule.id, 
      action: 'rule_created' 
    }, 'CategorizationService');
    
    return newRule;
  }

  updateRule(id: string, updates: Partial<CategorizationRule>): CategorizationRule | null {
    const rules = this.getAllRules();
    const index = rules.findIndex(rule => rule.id === id);
    
    if (index === -1) return null;

    rules[index] = { ...rules[index], ...updates };
    this.saveRules(rules);
    
    eventBus.emit('CATEGORIES_UPDATED', { 
      ruleId: id, 
      action: 'rule_updated' 
    }, 'CategorizationService');
    
    return rules[index];
  }

  deleteRule(id: string): boolean {
    const rules = this.getAllRules();
    const filtered = rules.filter(rule => rule.id !== id);
    
    if (filtered.length < rules.length) {
      this.saveRules(filtered);
      eventBus.emit('CATEGORIES_UPDATED', { 
        ruleId: id, 
        action: 'rule_deleted' 
      }, 'CategorizationService');
      return true;
    }
    
    return false;
  }

  private saveRules(rules: CategorizationRule[]): void {
    try {
      localStorage.setItem(this.RULES_KEY, JSON.stringify(rules));
    } catch (error) {
      console.error('Error saving categorization rules:', error);
    }
  }

  // Apply rule-based categorization
  applyRuleBasedCategorization(transaction: Transaction): string | null {
    const rules = this.getAllRules()
      .filter(rule => rule.isActive)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      if (this.transactionMatchesRule(transaction, rule)) {
        return rule.categoryId;
      }
    }

    return null;
  }

  // Check if transaction matches rule criteria
  private transactionMatchesRule(transaction: Transaction, rule: CategorizationRule): boolean {
    const description = transaction.description.toLowerCase();
    
    // Simple keyword matching - can be enhanced with more sophisticated logic
    const matchesDescription = Boolean(rule.description && 
      description.includes(rule.description.toLowerCase()));

    // Amount range matching
    const amount = transaction.debitAmount || transaction.creditAmount || 0;
    const matchesAmountMin = Boolean(!rule.amountMin || amount >= rule.amountMin);
    const matchesAmountMax = Boolean(!rule.amountMax || amount <= rule.amountMax);

    return matchesDescription && matchesAmountMin && matchesAmountMax;
  }

  // Batch apply rules to uncategorized transactions
  applyRulesToUncategorizedTransactions(): { categorized: number; total: number } {
    const transactions = localStorageManager.getAllTransactions();
    const categorizations = this.getAllCategorizations();
    const categorizedTransactionIds = new Set(categorizations.map(c => c.transactionId));
    
    const uncategorizedTransactions = transactions.filter(t => 
      !categorizedTransactionIds.has(t.id)
    );

    let categorized = 0;

    uncategorizedTransactions.forEach(transaction => {
      const categoryId = this.applyRuleBasedCategorization(transaction);
      if (categoryId) {
        const result = this.categorizeTransaction(
          transaction.id,
          categoryId,
          'rule',
          0.8, // Default confidence for rule-based categorization
          'Applied from categorization rule'
        );
        if (result) categorized++;
      }
    });

    return { categorized, total: uncategorizedTransactions.length };
  }

  // Get categorization statistics
  getCategorizationStats(): {
    totalTransactions: number;
    categorizedTransactions: number;
    uncategorizedTransactions: number;
    categoriesByCount: Array<{ categoryId: string; categoryName: string; count: number }>;
    methodBreakdown: Record<string, number>;
  } {
    const transactions = localStorageManager.getAllTransactions();
    const categorizations = this.getAllCategorizations();
    const categories = this.getAllCategories();
    
    const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));
    
    // Count by category
    const categoryCounts = new Map<string, number>();
    categorizations.forEach(cat => {
      const count = categoryCounts.get(cat.categoryId) || 0;
      categoryCounts.set(cat.categoryId, count + 1);
    });

    // Count by method
    const methodCounts: Record<string, number> = {};
    categorizations.forEach(cat => {
      methodCounts[cat.method] = (methodCounts[cat.method] || 0) + 1;
    });

    const categoriesByCount = Array.from(categoryCounts.entries())
      .map(([categoryId, count]) => ({
        categoryId,
        categoryName: categoryMap.get(categoryId) || 'Unknown',
        count
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalTransactions: transactions.length,
      categorizedTransactions: categorizations.length,
      uncategorizedTransactions: transactions.length - categorizations.length,
      categoriesByCount,
      methodBreakdown: methodCounts
    };
  }

  // Get transactions by category
  getTransactionsByCategory(categoryId: string): Transaction[] {
    const transactions = localStorageManager.getAllTransactions();
    const categorizations = this.getAllCategorizations();
    
    const transactionIds = new Set(
      categorizations
        .filter(cat => cat.categoryId === categoryId)
        .map(cat => cat.transactionId)
    );

    return transactions.filter(t => transactionIds.has(t.id));
  }

  // Clear all categorizations (for testing/reset)
  clearAllCategorizations(): void {
    this.saveCategorizations([]);
    eventBus.emit('CATEGORIES_UPDATED', { action: 'all_cleared' }, 'CategorizationService');
  }
}

export const categorizationService = new CategorizationService(); 