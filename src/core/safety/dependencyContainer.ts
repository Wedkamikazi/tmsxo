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

export interface ServiceDefinition<T = any> {
  name: string;
  factory: () => T | Promise<T>;
  dependencies: string[];
  singleton: boolean;
  lazy: boolean;
  initialized: boolean;
}

export interface ContainerStats {
  totalServices: number;
  initializedServices: number;
  pendingServices: number;
  circularDependencies: string[];
  resolutionTime: number;
}

class DependencyContainer {
  private services = new Map<string, ServiceDefinition>();
  private instances = new Map<string, any>();
  private resolutionStack = new Set<string>();
  private stats: ContainerStats = {
    totalServices: 0,
    initializedServices: 0,
    pendingServices: 0,
    circularDependencies: [],
    resolutionTime: 0
  };

  /**
   * Register a service with the container
   */
  register<T>(
    name: string,
    factory: () => T | Promise<T>,
    options: {
      dependencies?: string[];
      singleton?: boolean;
      lazy?: boolean;
    } = {}
  ): void {
    const definition: ServiceDefinition<T> = {
      name,
      factory,
      dependencies: options.dependencies || [],
      singleton: options.singleton !== false, // Default to singleton
      lazy: options.lazy !== false, // Default to lazy
      initialized: false
    };

    this.services.set(name, definition);
    this.stats.totalServices = this.services.size;

    console.log(`📋 DependencyContainer: Registered ${name} (singleton: ${definition.singleton}, lazy: ${definition.lazy})`);
  }

  /**
   * Resolve a service and its dependencies
   */
  async resolve<T>(name: string): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await this._resolveInternal<T>(name);
      const endTime = performance.now();
      this.stats.resolutionTime = endTime - startTime;
      return result;
    } catch (error) {
      this.resolutionStack.clear();
      throw error;
    }
  }

  /**
   * Internal resolution with circular dependency detection
   */
  private async _resolveInternal<T>(name: string): Promise<T> {
    // Check for circular dependency
    if (this.resolutionStack.has(name)) {
      const cycle = Array.from(this.resolutionStack).join(' -> ') + ' -> ' + name;
      this.stats.circularDependencies.push(cycle);
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    // Return existing instance if singleton
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
    }

    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`Service not found: ${name}`);
    }

    this.resolutionStack.add(name);

    try {
      // Resolve dependencies first
      const resolvedDependencies: any[] = [];
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
      return instance as T;

    } catch (error) {
      this.resolutionStack.delete(name);
      throw new Error(`Failed to resolve ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get list of registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get container statistics
   */
  getStats(): ContainerStats {
    return { ...this.stats };
  }

  /**
   * Validate dependency graph for circular dependencies
   */
  validateDependencyGraph(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const validateService = (serviceName: string, path: string[] = []): void => {
      if (visiting.has(serviceName)) {
        const cycle = [...path, serviceName].join(' -> ');
        issues.push(`Circular dependency: ${cycle}`);
        return;
      }

      if (visited.has(serviceName)) return;

      visiting.add(serviceName);
      const service = this.services.get(serviceName);
      
      if (service) {
        for (const dep of service.dependencies) {
          if (!this.services.has(dep)) {
            issues.push(`Missing dependency: ${serviceName} depends on ${dep} (not registered)`);
          } else {
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
  async preInitialize(): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    const nonLazyServices = Array.from(this.services.entries())
      .filter(([_, definition]) => !definition.lazy)
      .map(([name, _]) => name);

    console.log(`🚀 DependencyContainer: Pre-initializing ${nonLazyServices.length} non-lazy services`);

    for (const serviceName of nonLazyServices) {
      try {
        await this.resolve(serviceName);
        results.success++;
      } catch (error) {
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
  clear(): void {
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
  dispose(): void {
    for (const [name, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
          console.log(`🗑️ DependencyContainer: Disposed ${name}`);
        } catch (error) {
          console.error(`❌ Error disposing ${name}:`, error);
        }
      }
    }
    this.clear();
  }
}

// Export singleton instance
export const dependencyContainer = new DependencyContainer();

/**
 * Decorator for automatic service registration
 */
export function Injectable(name: string, dependencies: string[] = []) {
  return function<T extends new (...args: any[]) => any>(constructor: T) {
    dependencyContainer.register(
      name,
      () => new constructor(),
      { dependencies, singleton: true, lazy: true }
    );
    return constructor;
  };
}

/**
 * Helper for resolving services with type safety
 */
export async function inject<T>(serviceName: string): Promise<T> {
  return dependencyContainer.resolve<T>(serviceName);
}

/**
 * Register existing singleton services with the container
 */
export function registerExistingSingletons(): void {
  console.log('🔄 DependencyContainer: Registering existing singleton services...');

  // Register core services
  dependencyContainer.register(
    'eventBus',
    async () => (await import('../services/eventBus')).eventBus,
    { dependencies: [], singleton: true, lazy: false }
  );

  dependencyContainer.register(
    'localStorageManager',
    async () => (await import('../services/localStorageManager')).localStorageManager,
    { dependencies: [], singleton: true, lazy: false }
  );

  dependencyContainer.register(
    'unifiedDataService',
    async () => (await import('../services/unifiedDataService')).unifiedDataService,
    { dependencies: ['localStorageManager', 'eventBus'], singleton: true, lazy: false }
  );

  dependencyContainer.register(
    'unifiedCategorizationService',
    async () => (await import('../services/unifiedCategorizationService')).unifiedCategorizationService,
    { dependencies: ['eventBus'], singleton: true, lazy: true }
  );

  dependencyContainer.register(
    'systemIntegrityService',
    async () => (await import('../services/systemIntegrityService')).systemIntegrityService,
    { dependencies: ['localStorageManager', 'eventBus', 'performanceManager'], singleton: true, lazy: true }
  );

  dependencyContainer.register(
    'performanceManager',
    async () => (await import('../services/performanceManager')).performanceManager,
    { dependencies: [], singleton: true, lazy: true }
  );

  dependencyContainer.register(
    'storageQuotaManager',
    async () => (await import('../services/storageQuotaManager')).storageQuotaManager,
    { dependencies: ['eventBus'], singleton: true, lazy: true }
  );

  console.log(`✅ DependencyContainer: Registered ${dependencyContainer.getRegisteredServices().length} existing services`);
} 