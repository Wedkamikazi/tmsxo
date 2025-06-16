"use strict";
// UNIFIED CATEGORIZATION SYSTEM - CORE INTERFACES
// This file defines the strategy pattern interfaces for categorization methods
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyRegistry = void 0;
// STRATEGY REGISTRY
class StrategyRegistry {
    constructor() {
        this.strategies = new Map();
        this.config = {
            primary: 'ml-enhanced',
            fallback: ['tensorflow', 'rule-based'],
            confidenceThreshold: 0.7,
            enableLearning: true,
            batchSize: 10,
            autoApplyHighConfidence: true
        };
    }
    register(strategy) {
        this.strategies.set(strategy.name, strategy);
    }
    unregister(name) {
        const strategy = this.strategies.get(name);
        if (strategy === null || strategy === void 0 ? void 0 : strategy.dispose) {
            strategy.dispose();
        }
        this.strategies.delete(name);
    }
    getStrategy(name) {
        return this.strategies.get(name);
    }
    getAllStrategies() {
        return Array.from(this.strategies.values());
    }
    getAvailableStrategies() {
        return Promise.all(Array.from(this.strategies.values()).map(async (strategy) => ({
            strategy,
            available: await strategy.isAvailable()
        }))).then(results => results.filter(r => r.available).map(r => r.strategy));
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    dispose() {
        for (const strategy of this.strategies.values()) {
            if (strategy.dispose) {
                strategy.dispose();
            }
        }
        this.strategies.clear();
    }
}
exports.StrategyRegistry = StrategyRegistry;
