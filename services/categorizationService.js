"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizationService = void 0;
const localStorageManager_1 = require("./localStorageManager");
const eventBus_1 = require("./eventBus");
/**
 * CATEGORIZATION SERVICE
 * Manages transaction categories and categorization rules
 * Uses localStorageManager for unified data storage
 */
class CategorizationService {
    constructor() {
        this.RULES_KEY = 'tms_categorization_rules';
        this.initializeDefaultRules();
    }
    // Initialize default categorization rules
    initializeDefaultRules() {
        const existing = this.getAllRules();
        if (existing.length === 0) {
            const defaultRules = [
                {
                    id: 'rule_payroll',
                    categoryId: 'cat_income',
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
    getAllCategories() {
        return localStorageManager_1.localStorageManager.getAllCategories();
    }
    getCategoryById(id) {
        return this.getAllCategories().find(cat => cat.id === id);
    }
    createCategory(category) {
        const newCategory = localStorageManager_1.localStorageManager.addCategory(category);
        if (newCategory) {
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', { categoryId: newCategory.id, action: 'created' }, 'CategorizationService');
        }
        return newCategory;
    }
    updateCategory(id, updates) {
        const categories = this.getAllCategories();
        const category = categories.find(cat => cat.id === id);
        if (!category)
            return null;
        const updatedCategory = { ...category, ...updates, modifiedDate: new Date().toISOString() };
        // Since localStorageManager doesn't have updateCategory method yet, 
        // we'll work with the existing category system
        const allCategories = categories.map(cat => cat.id === id ? updatedCategory : cat);
        // This is a temporary workaround until localStorageManager has updateCategory
        try {
            localStorage.setItem('tms_categories', JSON.stringify(allCategories));
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', { categoryId: id, action: 'updated' }, 'CategorizationService');
            return updatedCategory;
        }
        catch (error) {
            console.error('Error updating category:', error);
            return null;
        }
    }
    deleteCategory(id) {
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
                    method: 'manual' // Reset to manual when moved
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
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', { categoryId: id, action: 'deleted' }, 'CategorizationService');
            return true;
        }
        catch (error) {
            console.error('Error deleting category:', error);
            return false;
        }
    }
    // CATEGORIZATION MANAGEMENT (uses localStorageManager)
    getAllCategorizations() {
        return localStorageManager_1.localStorageManager.getAllCategorizations();
    }
    getCategorizationByTransactionId(transactionId) {
        return this.getAllCategorizations().find(cat => cat.transactionId === transactionId);
    }
    categorizeTransaction(transactionId, categoryId, method, confidence, reasoning) {
        // Validate that category exists
        const category = this.getCategoryById(categoryId);
        if (!category) {
            console.error(`Category ${categoryId} not found`);
            return null;
        }
        // Validate that transaction exists
        const transactions = localStorageManager_1.localStorageManager.getAllTransactions();
        const transaction = transactions.find(t => t.id === transactionId);
        if (!transaction) {
            console.error(`Transaction ${transactionId} not found`);
            return null;
        }
        const categorization = {
            transactionId,
            categoryId,
            method,
            confidence,
            reasoning
        };
        const result = localStorageManager_1.localStorageManager.addCategorization(categorization);
        if (result) {
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
                transactionId,
                categoryId,
                action: 'categorized'
            }, 'CategorizationService');
        }
        return result;
    }
    // Batch categorize multiple transactions
    batchCategorizeTransactions(categorizations) {
        let success = 0;
        let failed = 0;
        const errors = [];
        categorizations.forEach(cat => {
            const result = this.categorizeTransaction(cat.transactionId, cat.categoryId, cat.method, cat.confidence, cat.reasoning);
            if (result) {
                success++;
            }
            else {
                failed++;
                errors.push(`Failed to categorize transaction ${cat.transactionId}`);
            }
        });
        if (success > 0) {
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
                action: 'batch_categorized',
                count: success
            }, 'CategorizationService');
        }
        return { success, failed, errors };
    }
    // Remove categorization
    removeCategorization(transactionId) {
        const categorizations = this.getAllCategorizations();
        const filtered = categorizations.filter(cat => cat.transactionId !== transactionId);
        if (filtered.length < categorizations.length) {
            this.saveCategorizations(filtered);
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
                transactionId,
                action: 'uncategorized'
            }, 'CategorizationService');
            return true;
        }
        return false;
    }
    saveCategorizations(categorizations) {
        // Temporary direct storage until localStorageManager has setCategorizations method
        try {
            localStorage.setItem('tms_categorizations', JSON.stringify(categorizations));
        }
        catch (error) {
            console.error('Error saving categorizations:', error);
        }
    }
    // RULE-BASED CATEGORIZATION
    getAllRules() {
        try {
            const data = localStorage.getItem(this.RULES_KEY);
            return data ? JSON.parse(data) : [];
        }
        catch (error) {
            console.error('Error loading categorization rules:', error);
            return [];
        }
    }
    createRule(rule) {
        const newRule = {
            ...rule,
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdDate: new Date().toISOString()
        };
        const rules = this.getAllRules();
        rules.push(newRule);
        this.saveRules(rules);
        eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
            ruleId: newRule.id,
            action: 'rule_created'
        }, 'CategorizationService');
        return newRule;
    }
    updateRule(id, updates) {
        const rules = this.getAllRules();
        const index = rules.findIndex(rule => rule.id === id);
        if (index === -1)
            return null;
        rules[index] = { ...rules[index], ...updates };
        this.saveRules(rules);
        eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
            ruleId: id,
            action: 'rule_updated'
        }, 'CategorizationService');
        return rules[index];
    }
    deleteRule(id) {
        const rules = this.getAllRules();
        const filtered = rules.filter(rule => rule.id !== id);
        if (filtered.length < rules.length) {
            this.saveRules(filtered);
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
                ruleId: id,
                action: 'rule_deleted'
            }, 'CategorizationService');
            return true;
        }
        return false;
    }
    saveRules(rules) {
        try {
            localStorage.setItem(this.RULES_KEY, JSON.stringify(rules));
        }
        catch (error) {
            console.error('Error saving categorization rules:', error);
        }
    }
    // Apply rule-based categorization
    applyRuleBasedCategorization(transaction) {
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
    transactionMatchesRule(transaction, rule) {
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
    applyRulesToUncategorizedTransactions() {
        const transactions = localStorageManager_1.localStorageManager.getAllTransactions();
        const categorizations = this.getAllCategorizations();
        const categorizedTransactionIds = new Set(categorizations.map(c => c.transactionId));
        const uncategorizedTransactions = transactions.filter(t => !categorizedTransactionIds.has(t.id));
        let categorized = 0;
        uncategorizedTransactions.forEach(transaction => {
            const categoryId = this.applyRuleBasedCategorization(transaction);
            if (categoryId) {
                const result = this.categorizeTransaction(transaction.id, categoryId, 'rule', 0.8, // Default confidence for rule-based categorization
                'Applied from categorization rule');
                if (result)
                    categorized++;
            }
        });
        return { categorized, total: uncategorizedTransactions.length };
    }
    // Get categorization statistics
    getCategorizationStats() {
        const transactions = localStorageManager_1.localStorageManager.getAllTransactions();
        const categorizations = this.getAllCategorizations();
        const categories = this.getAllCategories();
        const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));
        // Count by category
        const categoryCounts = new Map();
        categorizations.forEach(cat => {
            const count = categoryCounts.get(cat.categoryId) || 0;
            categoryCounts.set(cat.categoryId, count + 1);
        });
        // Count by method
        const methodCounts = {};
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
    getTransactionsByCategory(categoryId) {
        const transactions = localStorageManager_1.localStorageManager.getAllTransactions();
        const categorizations = this.getAllCategorizations();
        const transactionIds = new Set(categorizations
            .filter(cat => cat.categoryId === categoryId)
            .map(cat => cat.transactionId));
        return transactions.filter(t => transactionIds.has(t.id));
    }
    // Clear all categorizations (for testing/reset)
    clearAllCategorizations() {
        this.saveCategorizations([]);
        eventBus_1.eventBus.emit('CATEGORIES_UPDATED', { action: 'all_cleared' }, 'CategorizationService');
    }
}
exports.categorizationService = new CategorizationService();
