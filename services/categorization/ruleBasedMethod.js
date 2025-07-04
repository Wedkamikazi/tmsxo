"use strict";
// RULE-BASED CATEGORIZATION METHOD
// Extracted from categorizationService.ts - implements rule-based transaction categorization
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleBasedMethod = void 0;
const localStorageManager_1 = require("../localStorageManager");
const eventBus_1 = require("../eventBus");
class RuleBasedMethod {
    constructor() {
        this.name = 'rule-based';
        this.priority = 3; // Lower priority than ML methods
        this.RULES_KEY = 'tms_categorization_rules';
        this.categoryCache = new Map();
        this.initializeDefaultRules();
        this.loadCategoryCache();
    }
    async isAvailable() {
        return true; // Rule-based method is always available
    }
    async categorize(transaction) {
        const startTime = Date.now();
        try {
            // Apply rule-based categorization
            const result = this.applyRuleBasedCategorization(transaction);
            const processingTime = Date.now() - startTime;
            if (result.categoryId) {
                const category = this.categoryCache.get(result.categoryId);
                return {
                    categoryId: result.categoryId,
                    categoryName: (category === null || category === void 0 ? void 0 : category.name) || result.categoryId,
                    confidence: result.confidence,
                    method: 'rule-based',
                    reasoning: result.reasoning,
                    suggestions: [],
                    alternatives: [],
                    processingTime,
                    metadata: {
                        ruleMatched: result.ruleId,
                        anomalyDetected: false,
                        strategyUsed: 'rule-based'
                    }
                };
            }
            // No rule matched - return fallback result
            return this.createFallbackResult(transaction, processingTime);
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('Rule-based categorization error:', error);
            return this.createFallbackResult(transaction, processingTime, String(error));
        }
    }
    async batchCategorize(transactions) {
        return Promise.all(transactions.map(t => this.categorize(t)));
    }
    // RULE MANAGEMENT METHODS
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
        }, 'RuleBasedMethod');
        return newRule;
    }
    updateRule(id, updates) {
        const rules = this.getAllRules();
        const ruleIndex = rules.findIndex(rule => rule.id === id);
        if (ruleIndex === -1)
            return null;
        const updatedRule = { ...rules[ruleIndex], ...updates };
        rules[ruleIndex] = updatedRule;
        this.saveRules(rules);
        eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
            ruleId: id,
            action: 'rule_updated'
        }, 'RuleBasedMethod');
        return updatedRule;
    }
    deleteRule(id) {
        const rules = this.getAllRules();
        const filteredRules = rules.filter(rule => rule.id !== id);
        if (filteredRules.length < rules.length) {
            this.saveRules(filteredRules);
            eventBus_1.eventBus.emit('CATEGORIES_UPDATED', {
                ruleId: id,
                action: 'rule_deleted'
            }, 'RuleBasedMethod');
            return true;
        }
        return false;
    }
    // CORE RULE-BASED CATEGORIZATION LOGIC
    applyRuleBasedCategorization(transaction) {
        const rules = this.getAllRules()
            .filter(rule => rule.isActive)
            .sort((a, b) => a.priority - b.priority);
        for (const rule of rules) {
            if (this.transactionMatchesRule(transaction, rule)) {
                return {
                    categoryId: rule.categoryId,
                    confidence: 0.8,
                    reasoning: `Matched rule: ${rule.description}`,
                    ruleId: rule.id
                };
            }
        }
        return {
            categoryId: null,
            confidence: 0,
            reasoning: 'No matching rules found',
        };
    }
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
    // UTILITY METHODS
    loadCategoryCache() {
        const categories = localStorageManager_1.localStorageManager.getAllCategories();
        this.categoryCache.clear();
        categories.forEach(cat => this.categoryCache.set(cat.id, cat));
    }
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
    saveRules(rules) {
        try {
            localStorage.setItem(this.RULES_KEY, JSON.stringify(rules));
        }
        catch (error) {
            console.error('Error saving categorization rules:', error);
        }
    }
    createFallbackResult(_transaction, processingTime, error) {
        return {
            categoryId: 'cat_expense',
            categoryName: 'Expense',
            confidence: 0.1,
            method: 'fallback',
            reasoning: error || 'No rules matched - using default category',
            suggestions: ['Consider creating a rule for this transaction type'],
            alternatives: [],
            processingTime,
            metadata: {
                anomalyDetected: false,
                fallbackReason: error || 'no_rules_matched',
                strategyUsed: 'rule-based-fallback'
            }
        };
    }
    dispose() {
        this.categoryCache.clear();
        // No other cleanup needed for rule-based method
    }
}
exports.RuleBasedMethod = RuleBasedMethod;
