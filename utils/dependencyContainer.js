"use strict";
/**
 * DEPENDENCY INJECTION CONTAINER
 *
 * Resolves circular dependencies by providing a central container for service registration
 * and lazy resolution. Services register themselves and request dependencies through this container.
 *
 * ELIMINATES CIRCULAR IMPORTS:
 * - Services no longer directly import each other
 * - Dependencies are resolved at runtime through the container
 * - Lazy loading prevents circular reference issues
 *
 * INTEGRATION WITH EXISTING SYSTEM:
 * - Works alongside existing serviceOrchestrator.ts
 * - Maintains singleton patterns where needed
 * - Provides type-safe dependency resolution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExistingSingletons = exports.inject = exports.Injectable = exports.dependencyContainer = void 0;
class DependencyContainer {
    constructor() {
        this.services = new Map();
        this.instances = new Map();
        this.resolutionStack = new Set();
        this.stats = {
            totalServices: 0,
            initializedServices: 0,
            pendingServices: 0,
            circularDependencies: [],
            resolutionTime: 0
        };
    }
    /**
     * Register a service with the container
     */
    register(name, factory, options = {}) {
        const definition = {
            name,
            factory,
            dependencies: options.dependencies || [],
            singleton: options.singleton !== false,
            lazy: options.lazy !== false,
            initialized: false
        };
        this.services.set(name, definition);
        this.stats.totalServices = this.services.size;
        console.log(`📋 DependencyContainer: Registered ${name} (singleton: ${definition.singleton}, lazy: ${definition.lazy})`);
    }
    /**
     * Resolve a service and its dependencies
     */
    async resolve(name) {
        const startTime = performance.now();
        try {
            const result = await this._resolveInternal(name);
            const endTime = performance.now();
            this.stats.resolutionTime = endTime - startTime;
            return result;
        }
        catch (error) {
            this.resolutionStack.clear();
            throw error;
        }
    }
    /**
     * Internal resolution with circular dependency detection
     */
    async _resolveInternal(name) {
        // Check for circular dependency
        if (this.resolutionStack.has(name)) {
            const cycle = Array.from(this.resolutionStack).join(' -> ') + ' -> ' + name;
            this.stats.circularDependencies.push(cycle);
            throw new Error(`Circular dependency detected: ${cycle}`);
        }
        // Return existing instance if singleton
        if (this.instances.has(name)) {
            return this.instances.get(name);
        }
        const definition = this.services.get(name);
        if (!definition) {
            throw new Error(`Service not found: ${name}`);
        }
        this.resolutionStack.add(name);
        try {
            // Resolve dependencies first
            const resolvedDependencies = [];
            for (const depName of definition.dependencies) {
                const dependency = await this._resolveInternal(depName);
                resolvedDependencies.push(dependency);
            }
            // Create the service instance
            const instance = await definition.factory();
            // Store instance if singleton
            if (definition.singleton) {
                this.instances.set(name, instance);
            }
            definition.initialized = true;
            this.stats.initializedServices++;
            this.stats.pendingServices = this.stats.totalServices - this.stats.initializedServices;
            this.resolutionStack.delete(name);
            console.log(`✅ DependencyContainer: Resolved ${name} with ${definition.dependencies.length} dependencies`);
            return instance;
        }
        catch (error) {
            this.resolutionStack.delete(name);
            throw new Error(`Failed to resolve ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Check if a service is registered
     */
    has(name) {
        return this.services.has(name);
    }
    /**
     * Get list of registered service names
     */
    getRegisteredServices() {
        return Array.from(this.services.keys());
    }
    /**
     * Get container statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Validate dependency graph for circular dependencies
     */
    validateDependencyGraph() {
        const issues = [];
        const visited = new Set();
        const visiting = new Set();
        const validateService = (serviceName, path = []) => {
            if (visiting.has(serviceName)) {
                const cycle = [...path, serviceName].join(' -> ');
                issues.push(`Circular dependency: ${cycle}`);
                return;
            }
            if (visited.has(serviceName))
                return;
            visiting.add(serviceName);
            const service = this.services.get(serviceName);
            if (service) {
                for (const dep of service.dependencies) {
                    if (!this.services.has(dep)) {
                        issues.push(`Missing dependency: ${serviceName} depends on ${dep} (not registered)`);
                    }
                    else {
                        validateService(dep, [...path, serviceName]);
                    }
                }
            }
            visiting.delete(serviceName);
            visited.add(serviceName);
        };
        // Validate all services
        for (const serviceName of this.services.keys()) {
            validateService(serviceName);
        }
        return {
            isValid: issues.length === 0,
            issues
        };
    }
    /**
     * Pre-initialize all non-lazy services
     */
    async preInitialize() {
        const results = { success: 0, failed: 0, errors: [] };
        const nonLazyServices = Array.from(this.services.entries())
            .filter(([_, definition]) => !definition.lazy)
            .map(([name, _]) => name);
        console.log(`🚀 DependencyContainer: Pre-initializing ${nonLazyServices.length} non-lazy services`);
        for (const serviceName of nonLazyServices) {
            try {
                await this.resolve(serviceName);
                results.success++;
            }
            catch (error) {
                results.failed++;
                results.errors.push(`${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                console.error(`❌ Failed to pre-initialize ${serviceName}:`, error);
            }
        }
        return results;
    }
    /**
     * Clear all instances (useful for testing)
     */
    clear() {
        this.instances.clear();
        this.services.clear();
        this.resolutionStack.clear();
        this.stats = {
            totalServices: 0,
            initializedServices: 0,
            pendingServices: 0,
            circularDependencies: [],
            resolutionTime: 0
        };
    }
    /**
     * Dispose of all singleton instances
     */
    dispose() {
        for (const [name, instance] of this.instances) {
            if (instance && typeof instance.dispose === 'function') {
                try {
                    instance.dispose();
                    console.log(`🗑️ DependencyContainer: Disposed ${name}`);
                }
                catch (error) {
                    console.error(`❌ Error disposing ${name}:`, error);
                }
            }
        }
        this.clear();
    }
}
// Export singleton instance
exports.dependencyContainer = new DependencyContainer();
/**
 * Decorator for automatic service registration
 */
function Injectable(name, dependencies = []) {
    return function (constructor) {
        exports.dependencyContainer.register(name, () => new constructor(), { dependencies, singleton: true, lazy: true });
        return constructor;
    };
}
exports.Injectable = Injectable;
/**
 * Helper for resolving services with type safety
 */
async function inject(serviceName) {
    return exports.dependencyContainer.resolve(serviceName);
}
exports.inject = inject;
/**
 * Register existing singleton services with the container
 */
function registerExistingSingletons() {
    console.log('🔄 DependencyContainer: Registering existing singleton services...');
    // Register core services
    exports.dependencyContainer.register('eventBus', async () => (await Promise.resolve().then(() => require('../services/eventBus'))).eventBus, { dependencies: [], singleton: true, lazy: false });
    exports.dependencyContainer.register('localStorageManager', async () => (await Promise.resolve().then(() => require('../services/localStorageManager'))).localStorageManager, { dependencies: [], singleton: true, lazy: false });
    exports.dependencyContainer.register('unifiedDataService', async () => (await Promise.resolve().then(() => require('../services/unifiedDataService'))).unifiedDataService, { dependencies: ['localStorageManager', 'eventBus'], singleton: true, lazy: false });
    exports.dependencyContainer.register('unifiedCategorizationService', async () => (await Promise.resolve().then(() => require('../services/unifiedCategorizationService'))).unifiedCategorizationService, { dependencies: ['eventBus'], singleton: true, lazy: true });
    exports.dependencyContainer.register('systemIntegrityService', async () => (await Promise.resolve().then(() => require('../services/systemIntegrityService'))).systemIntegrityService, { dependencies: ['localStorageManager', 'eventBus', 'performanceManager'], singleton: true, lazy: true });
    exports.dependencyContainer.register('performanceManager', async () => (await Promise.resolve().then(() => require('../services/performanceManager'))).performanceManager, { dependencies: [], singleton: true, lazy: true });
    exports.dependencyContainer.register('storageQuotaManager', async () => (await Promise.resolve().then(() => require('../services/storageQuotaManager'))).storageQuotaManager, { dependencies: ['eventBus'], singleton: true, lazy: true });
    console.log(`✅ DependencyContainer: Registered ${exports.dependencyContainer.getRegisteredServices().length} existing services`);
}
exports.registerExistingSingletons = registerExistingSingletons;
