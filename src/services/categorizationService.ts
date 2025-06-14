import { TransactionCategory, CategorizationRule, TransactionCategorization, Transaction } from '../types';

class CategorizationService {
  private readonly CATEGORIES_KEY = 'treasury_categories';
  private readonly RULES_KEY = 'treasury_categorization_rules';
  private readonly CATEGORIZATIONS_KEY = 'treasury_categorizations';

  constructor() {
    this.initializeDefaultCategories();
  }

  // Initialize default categories for first-time setup
  private initializeDefaultCategories(): void {
    const existing = this.getAllCategories();
    if (existing.length === 0) {
      const defaultCategories: TransactionCategory[] = [
        {
          id: 'cat_revenue',
          name: 'Revenue',
          description: 'Income and revenue transactions',
          keywords: ['payment', 'deposit', 'income', 'revenue', 'receipt'],
          color: '#10B981',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        },
        {
          id: 'cat_expenses',
          name: 'Expenses',
          description: 'Operating expenses and costs',
          keywords: ['payment', 'expense', 'cost', 'bill', 'fee'],
          color: '#EF4444',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        },
        {
          id: 'cat_payroll',
          name: 'Payroll',
          description: 'Employee salaries and wages',
          keywords: ['salary', 'wage', 'payroll', 'employee', 'staff'],
          color: '#8B5CF6',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        },
        {
          id: 'cat_tax',
          name: 'Tax',
          description: 'Tax payments and withholdings',
          keywords: ['tax', 'vat', 'withholding', 'irs', 'hmrc'],
          color: '#F59E0B',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        },
        {
          id: 'cat_banking',
          name: 'Banking Fees',
          description: 'Bank charges and fees',
          keywords: ['bank fee', 'charge', 'commission', 'interest'],
          color: '#6B7280',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        },
        {
          id: 'cat_transfer',
          name: 'Internal Transfer',
          description: 'Transfers between accounts',
          keywords: ['transfer', 'interco', 'internal'],
          color: '#06B6D4',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        },
        {
          id: 'cat_uncategorized',
          name: 'Uncategorized',
          description: 'Transactions requiring categorization',
          keywords: [],
          color: '#9CA3AF',
          isSystem: true,
          createdDate: new Date().toISOString(),
          modifiedDate: new Date().toISOString()
        }
      ];

      this.saveCategories(defaultCategories);
    }
  }

  // Category Management
  getAllCategories(): TransactionCategory[] {
    const data = localStorage.getItem(this.CATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  }

  getCategoryById(id: string): TransactionCategory | undefined {
    return this.getAllCategories().find(cat => cat.id === id);
  }

  createCategory(category: Omit<TransactionCategory, 'id' | 'createdDate' | 'modifiedDate'>): TransactionCategory {
    const newCategory: TransactionCategory = {
      ...category,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString()
    };

    const categories = this.getAllCategories();
    categories.push(newCategory);
    this.saveCategories(categories);
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<TransactionCategory>): TransactionCategory | null {
    const categories = this.getAllCategories();
    const index = categories.findIndex(cat => cat.id === id);
    
    if (index === -1) return null;

    categories[index] = {
      ...categories[index],
      ...updates,
      modifiedDate: new Date().toISOString()
    };

    this.saveCategories(categories);
    return categories[index];
  }

  deleteCategory(id: string): boolean {
    const categories = this.getAllCategories();
    const filteredCategories = categories.filter(cat => cat.id !== id && cat.isSystem !== true);
    
    if (filteredCategories.length === categories.length) return false;

    // Move transactions from deleted category to uncategorized
    const categorizations = this.getAllCategorizations();
    categorizations.forEach(cat => {
      if (cat.categoryId === id) {
        cat.categoryId = 'cat_uncategorized';
        cat.modifiedDate = new Date().toISOString();
      }
    });
    this.saveCategorizations(categorizations);

    this.saveCategories(filteredCategories);
    return true;
  }

  private saveCategories(categories: TransactionCategory[]): void {
    localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(categories));
  }

  // Categorization Management
  getAllCategorizations(): TransactionCategorization[] {
    const data = localStorage.getItem(this.CATEGORIZATIONS_KEY);
    return data ? JSON.parse(data) : [];
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
  ): TransactionCategorization {
    const categorizations = this.getAllCategorizations();
    const existingIndex = categorizations.findIndex(cat => cat.transactionId === transactionId);

    const categorization: TransactionCategorization = {
      transactionId,
      categoryId,
      method,
      confidence,
      reasoning,
      createdDate: existingIndex === -1 ? new Date().toISOString() : categorizations[existingIndex].createdDate,
      modifiedDate: new Date().toISOString()
    };

    if (existingIndex === -1) {
      categorizations.push(categorization);
    } else {
      categorizations[existingIndex] = categorization;
    }

    this.saveCategorizations(categorizations);
    return categorization;
  }

  private saveCategorizations(categorizations: TransactionCategorization[]): void {
    localStorage.setItem(this.CATEGORIZATIONS_KEY, JSON.stringify(categorizations));
  }

  // Rule-based categorization
  getAllRules(): CategorizationRule[] {
    const data = localStorage.getItem(this.RULES_KEY);
    return data ? JSON.parse(data) : [];
  }

  createRule(rule: Omit<CategorizationRule, 'id' | 'createdDate'>): CategorizationRule {
    const newRule: CategorizationRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdDate: new Date().toISOString()
    };

    const rules = this.getAllRules();
    rules.push(newRule);
    rules.sort((a, b) => b.priority - a.priority); // Sort by priority descending
    this.saveRules(rules);
    return newRule;
  }

  private saveRules(rules: CategorizationRule[]): void {
    localStorage.setItem(this.RULES_KEY, JSON.stringify(rules));
  }

  // Apply rule-based categorization to a transaction
  applRuleBasedCategorization(transaction: Transaction): string | null {
    const rules = this.getAllRules().filter(rule => rule.isActive);
    const categories = this.getAllCategories();

    for (const rule of rules) {
      const category = categories.find(cat => cat.id === rule.categoryId);
      if (!category) continue;

      // Check amount range
      const amount = Math.abs(transaction.debitAmount || transaction.creditAmount || 0);
      if (rule.amountMin !== undefined && amount < rule.amountMin) continue;
      if (rule.amountMax !== undefined && amount > rule.amountMax) continue;

      // Check keywords
      const description = transaction.description.toLowerCase();
      const hasKeywordMatch = category.keywords?.some(keyword => 
        description.includes(keyword.toLowerCase())
      ) || false;

      if (hasKeywordMatch) {
        this.categorizeTransaction(transaction.id, rule.categoryId, 'rule');
        return rule.categoryId;
      }
    }

    return null;
  }

  // Get categorization statistics
  getCategorizationStats(): Record<string, unknown> {
    const categorizations = this.getAllCategorizations();
    const categories = this.getAllCategories();

    const stats = {
      totalCategorized: categorizations.length,
      byMethod: {
        manual: categorizations.filter(c => c.method === 'manual').length,
        ml: categorizations.filter(c => c.method === 'ml').length,
        rule: categorizations.filter(c => c.method === 'rule').length
      },
      byCategory: {} as Record<string, number>,
      averageConfidence: 0
    };

    // Calculate by category
    categories.forEach(cat => {
      stats.byCategory[cat.name] = categorizations.filter(c => c.categoryId === cat.id).length;
    });

    // Calculate average confidence for ML categorizations
    const mlCategorizations = categorizations.filter(c => c.method === 'ml' && c.confidence !== undefined);
    if (mlCategorizations.length > 0) {
      stats.averageConfidence = mlCategorizations.reduce((sum, c) => sum + (c.confidence || 0), 0) / mlCategorizations.length;
    }

    return stats;
  }
}

export const categorizationService = new CategorizationService(); 