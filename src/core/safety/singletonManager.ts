/**
 * CENTRALIZED SINGLETON MANAGER
 * 
 * PROBLEM SOLVED: 21 different singleton patterns across codebase
 * - SystemSafetyManager.getInstance()
 * - StateManager.getInstance() 
 * - SystemTerminator.getInstance()
 * - 18 services with direct instantiation patterns
 * 
 * SOLUTION: Central registry that manages ALL singleton lifecycles
 * - Prevents duplicate instances
 * - Provides consistent API
 * - Enables proper disposal and testing
 * - Integrates with dependency container
 */

interface SingletonEntry<T = any> {
  name: string;
  factory: () => T;
  instance: T | null;
  created: Date | null;
  disposed: boolean;
}

interface SingletonStats {
  totalSingletons: number;
  activeSingletons: number;
  disposedSingletons: number;
  memoryUsageApprox: number;
}

class SingletonManager {
  private singletons = new Map<string, SingletonEntry>();
  private creationOrder: string[] = [];

  /**
   * Register a singleton factory
   */
  register<T>(name: string, factory: () => T): void {
    if (this.singletons.has(name)) {
      console.warn(`⚠️ SingletonManager: ${name} already registered, replacing`);
    }

    this.singletons.set(name, {
      name,
      factory,
      instance: null,
      created: null,
      disposed: false
    });

    console.log(`📋 SingletonManager: Registered ${name}`);
  }

  /**
   * Get or create singleton instance
   */
  get<T>(name: string): T {
    const entry = this.singletons.get(name);
    if (!entry) {
      throw new Error(`Singleton not registered: ${name}`);
    }

    if (entry.disposed) {
      throw new Error(`Singleton ${name} has been disposed`);
    }

    if (!entry.instance) {
      console.log(`🏗️ SingletonManager: Creating ${name}`);
      entry.instance = entry.factory();
      entry.created = new Date();
      this.creationOrder.push(name);
    }

    return entry.instance as T;
  }

  /**
   * Check if singleton exists and is created
   */
  has(name: string): boolean {
    const entry = this.singletons.get(name);
    return entry ? entry.instance !== null && !entry.disposed : false;
  }

  /**
   * Dispose specific singleton
   */
  dispose(name: string): boolean {
    const entry = this.singletons.get(name);
    if (!entry || !entry.instance) {
      return false;
    }

    try {
      // Call dispose method if it exists
      if (typeof entry.instance.dispose === 'function') {
        entry.instance.dispose();
      }

      entry.instance = null;
      entry.disposed = true;
      
      // Remove from creation order
      const index = this.creationOrder.indexOf(name);
      if (index > -1) {
        this.creationOrder.splice(index, 1);
      }

      console.log(`🗑️ SingletonManager: Disposed ${name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error disposing ${name}:`, error);
      return false;
    }
  }

  /**
   * Dispose all singletons in reverse creation order
   */
  disposeAll(): { success: number; failed: number; errors: string[] } {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    // Dispose in reverse order to handle dependencies
    const disposeOrder = [...this.creationOrder].reverse();
    
    for (const name of disposeOrder) {
      try {
        if (this.dispose(name)) {
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🗑️ SingletonManager: Disposed ${results.success}/${results.success + results.failed} singletons`);
    return results;
  }

  /**
   * Get singleton statistics
   */
  getStats(): SingletonStats {
    let activeSingletons = 0;
    let disposedSingletons = 0;
    let memoryUsageApprox = 0;

    for (const entry of this.singletons.values()) {
      if (entry.disposed) {
        disposedSingletons++;
      } else if (entry.instance) {
        activeSingletons++;
        // Rough memory estimation
        memoryUsageApprox += this.estimateObjectSize(entry.instance);
      }
    }

    return {
      totalSingletons: this.singletons.size,
      activeSingletons,
      disposedSingletons,
      memoryUsageApprox
    };
  }

  /**
   * List all registered singletons with their status
   */
  listSingletons(): Array<{
    name: string;
    status: 'registered' | 'created' | 'disposed';
    created: Date | null;
  }> {
    return Array.from(this.singletons.values()).map(entry => ({
      name: entry.name,
      status: entry.disposed ? 'disposed' : entry.instance ? 'created' : 'registered',
      created: entry.created
    }));
  }

  /**
   * Reset all singletons (for testing)
   */
  reset(): void {
    this.disposeAll();
    this.singletons.clear();
    this.creationOrder = [];
  }

  /**
   * Rough object size estimation
   */
  private estimateObjectSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // Rough estimate in bytes
    } catch {
      return 1024; // Default estimate for non-serializable objects
    }
  }
}

// Export singleton instance of the manager itself
export const singletonManager = new SingletonManager();

/**
 * Convenience function for registering singletons
 */
export function registerSingleton<T>(name: string, factory: () => T): void {
  singletonManager.register(name, factory);
}

/**
 * Convenience function for getting singletons
 */
export function getSingleton<T>(name: string): T {
  return singletonManager.get<T>(name);
}

/**
 * Register all existing singletons with the manager
 */
export function registerExistingSingletons(): void {
  console.log('🔄 SingletonManager: Registering existing singletons...');

  // Utils singletons (these use getInstance pattern)
  singletonManager.register('systemSafetyManager', () => {
    const { systemSafetyManager } = require('../utils/systemSafetyManager');
    return systemSafetyManager;
  });

  singletonManager.register('stateManager', () => {
    const { stateManager } = require('../utils/stateManager');
    return stateManager;
  });

  singletonManager.register('systemTerminator', () => {
    const { systemTerminator } = require('../utils/systemTerminator');
    return systemTerminator;
  });

  // Service singletons (these use direct export pattern)
  singletonManager.register('eventBus', () => {
    const { eventBus } = require('../services/eventBus');
    return eventBus;
  });

  singletonManager.register('localStorageManager', () => {
    const { localStorageManager } = require('../services/localStorageManager');
    return localStorageManager;
  });

  singletonManager.register('unifiedDataService', () => {
    const { unifiedDataService } = require('../services/unifiedDataService');
    return unifiedDataService;
  });

  singletonManager.register('unifiedCategorizationService', () => {
    const { unifiedCategorizationService } = require('../services/unifiedCategorizationService');
    return unifiedCategorizationService;
  });

  singletonManager.register('systemIntegrityService', () => {
    const { systemIntegrityService } = require('../services/systemIntegrityService');
    return systemIntegrityService;
  });

  singletonManager.register('performanceManager', () => {
    const { performanceManager } = require('../services/performanceManager');
    return performanceManager;
  });

  singletonManager.register('storageQuotaManager', () => {
    const { storageQuotaManager } = require('../services/storageQuotaManager');
    return storageQuotaManager;
  });

  singletonManager.register('serviceOrchestrator', () => {
    const { serviceOrchestrator } = require('../services/serviceOrchestrator');
    return serviceOrchestrator;
  });

  singletonManager.register('cleanupManager', () => {
    const { cleanupManager } = require('../services/cleanupManager');
    return cleanupManager;
  });

  singletonManager.register('crossTabSyncService', () => {
    const { crossTabSyncService } = require('../services/crossTabSyncService');
    return crossTabSyncService;
  });

  // Transaction management services
  singletonManager.register('creditTransactionManagementService', () => {
    const { creditTransactionManagementService } = require('../services/creditTransactionManagementService');
    return creditTransactionManagementService;
  });

  singletonManager.register('debitTransactionManagementService', () => {
    const { debitTransactionManagementService } = require('../services/debitTransactionManagementService');
    return debitTransactionManagementService;
  });

  singletonManager.register('hrPaymentManagementService', () => {
    const { hrPaymentManagementService } = require('../services/hrPaymentManagementService');
    return hrPaymentManagementService;
  });

  singletonManager.register('dailyCashManagementService', () => {
    const { dailyCashManagementService } = require('../services/dailyCashManagementService');
    return dailyCashManagementService;
  });

  singletonManager.register('intercompanyTransferService', () => {
    const { intercompanyTransferService } = require('../services/intercompanyTransferService');
    return intercompanyTransferService;
  });

  singletonManager.register('timeDepositService', () => {
    const { timeDepositService } = require('../services/timeDepositService');
    return timeDepositService;
  });

  singletonManager.register('importProcessingService', () => {
    const { importProcessingService } = require('../services/importProcessingService');
    return importProcessingService;
  });

  singletonManager.register('coreDataService', () => {
    const { coreDataService } = require('../services/coreDataService');
    return coreDataService;
  });

  singletonManager.register('bankBalanceService', () => {
    const { bankBalanceService } = require('../services/bankBalanceService');
    return bankBalanceService;
  });

  singletonManager.register('unifiedBalanceService', () => {
    const { unifiedBalanceService } = require('../services/unifiedBalanceService');
    return unifiedBalanceService;
  });

  console.log(`✅ SingletonManager: Registered ${singletonManager.getStats().totalSingletons} existing singletons`);
}

/**
 * Initialize singleton manager and register existing services
 */
export function initializeSingletonManager(): void {
  console.log('🚀 Initializing Singleton Manager...');
  registerExistingSingletons();
  
  const stats = singletonManager.getStats();
  console.log(`📊 SingletonManager ready: ${stats.totalSingletons} singletons registered`);
} 