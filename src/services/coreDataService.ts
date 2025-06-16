/**
 * CORE DATA SERVICE
 * 
 * Consolidated service that merges:
 * - localStorageManager.ts (storage operations)
 * - unifiedDataService.ts (API layer)
 * - storageQuotaManager.ts (quota management)
 * 
 * Features:
 * - Atomic transaction operations with rollback
 * - Real-time quota monitoring and cleanup
 * - Event-driven architecture for UI updates
 * - Comprehensive data validation and integrity
 * - Emergency fallback modes and recovery
 * - Performance monitoring and optimization
 */

import { Transaction, BankAccount, UploadedFile, TransactionCategory, TransactionCategorization } from '../types';
import { performanceManager } from './performanceManager';
import { systemIntegrityService } from './systemIntegrityService';
import { eventBus } from './eventBus';

// ======================
// TYPE DEFINITIONS
// ======================

export interface StoredTransaction extends Transaction {
  accountId: string;
  importDate: string;
  fileId?: string;
  postDateTime: string;
}

export interface StorageSnapshot {
  timestamp: string;
  transactions: StoredTransaction[];
  accounts: BankAccount[];
  files: UploadedFile[];
  categories: TransactionCategory[];
  categorizations: TransactionCategorization[];
}

export interface StorageStats {
  totalSize: number;
  itemCounts: {
    transactions: number;
    accounts: number;
    files: number;
    categories: number;
    categorizations: number;
  };
  lastUpdated: string;
}

export interface StorageQuotaInfo {
  total: number;
  used: number;
  available: number;
  utilization: number;
  isNearLimit: boolean;
  isCritical: boolean;
  lastChecked: string;
}

export interface DataSummary {
  totalTransactions: number;
  totalFiles: number;
  totalAccounts: number;
  storageUsed: number;
  lastUpdated: string;
  quotaInfo?: StorageQuotaInfo;
  activeAlerts?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface QuotaAlert {
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
  availableActions: string[];
  timestamp: string;
  acknowledged: boolean;
}

export interface CleanupStrategy {
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedSpaceSaved: number;
  execute: () => Promise<{ success: boolean; spaceFreed: number; details: string }>;
}

// ======================
// CORE DATA SERVICE
// ======================

class CoreDataService {
  // Storage keys
  private readonly STORAGE_KEYS = {
    transactions: 'tms_transactions',
    accounts: 'tms_accounts',
    files: 'tms_files',
    categories: 'tms_categories',
    categorizations: 'tms_categorizations',
    metadata: 'tms_metadata',
    snapshots: 'tms_snapshots',
    quotaHistory: 'tms_quota_history',
    cleanupLog: 'tms_cleanup_log',
    userPreferences: 'tms_quota_preferences'
  } as const;

  // Configuration constants
  private readonly MAX_SNAPSHOTS = 5;
  private readonly STORAGE_VERSION = '2.0.0';
  private readonly QUOTA_WARNING_THRESHOLD = 0.80;
  private readonly QUOTA_CRITICAL_THRESHOLD = 0.95;
  private readonly QUOTA_EMERGENCY_THRESHOLD = 0.98;
  private readonly MONITORING_INTERVAL = 60000; // 1 minute

  // State management
  private monitoringTimer: NodeJS.Timeout | null = null;
  private currentQuotaInfo: StorageQuotaInfo | null = null;
  private activeAlerts: QuotaAlert[] = [];
  private cleanupHistory: Array<{ timestamp: string; strategy: string; spaceFreed: number }> = [];

  constructor() {
    this.initializeService();
  }

  // ======================
  // INITIALIZATION
  // ======================

  private async initializeService(): Promise<void> {
    try {
      // Initialize quota monitoring
      await this.updateQuotaInfo();
      this.startQuotaMonitoring();
      
      console.log('✅ Core Data Service initialized');
    } catch (error) {
      systemIntegrityService.logServiceError(
        'CoreDataService',
        'initializeService',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { operation: 'initialization' }
      );
    }
  }

  // ======================
  // TRANSACTION OPERATIONS
  // ======================

  getAllTransactions(): StoredTransaction[] {
    return this.getStorageData(this.STORAGE_KEYS.transactions, []);
  }

  getTransactionsByAccount(accountId: string): StoredTransaction[] {
    return this.getAllTransactions().filter(t => t.accountId === accountId);
  }

  addTransactions(transactions: StoredTransaction[]): boolean {
    const result = this.executeTransaction(() => {
      const existing = this.getAllTransactions();
      const existingIds = new Set(existing.map(t => t.id));
      const newTransactions = transactions.filter(t => !existingIds.has(t.id));
      
      if (newTransactions.length === 0) return { success: true, affectedAccountIds: [] };
      
      const updated = [...existing, ...newTransactions].sort(
        (a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime()
      );
      
      this.setStorageData(this.STORAGE_KEYS.transactions, updated);
      
      const affectedAccountIds = [...new Set(newTransactions.map(t => t.accountId))];
      return { success: true, affectedAccountIds };
    });
    
    if (result.success && result.result) {
      const affectedAccountIds = result.result.affectedAccountIds;
      if (affectedAccountIds.length > 0) {
        this.updateAccountBalancesFromTransactions(affectedAccountIds);
      }
      
      eventBus.emit('TRANSACTIONS_UPDATED', { count: transactions.length }, 'CoreDataService');
    }
    
    return result.success;
  }

  deleteTransactionsByFile(fileId: string): number {
    const result = this.executeTransaction(() => {
      const all = this.getAllTransactions();
      const deletedTransactions = all.filter(t => t.fileId === fileId);
      const remaining = all.filter(t => t.fileId !== fileId);
      const deletedCount = all.length - remaining.length;
      
      this.setStorageData(this.STORAGE_KEYS.transactions, remaining);
      
      const affectedAccountIds = [...new Set(deletedTransactions.map(t => t.accountId))];
      return { deletedCount, affectedAccountIds };
    });
    
    if (result.success && result.result) {
      const { deletedCount, affectedAccountIds } = result.result;
      if (affectedAccountIds.length > 0) {
        this.updateAccountBalancesFromTransactions(affectedAccountIds);
      }
      
      if (deletedCount > 0) {
        eventBus.emit('TRANSACTIONS_UPDATED', { deletedCount }, 'CoreDataService');
      }
      
      return deletedCount;
    }
    
    return 0;
  }

  deleteTransactionsByAccount(accountId: string): number {
    const result = this.executeTransaction(() => {
      const all = this.getAllTransactions();
      const remaining = all.filter(t => t.accountId !== accountId);
      const deletedCount = all.length - remaining.length;
      
      this.setStorageData(this.STORAGE_KEYS.transactions, remaining);
      return deletedCount;
    });
    
    if (result.success && result.result) {
      this.updateAccountBalancesFromTransactions([accountId]);
      
      if (result.result > 0) {
        eventBus.emit('TRANSACTIONS_UPDATED', { deletedCount: result.result, accountId }, 'CoreDataService');
      }
      
      return result.result;
    }
    
    return 0;
  }

  // ======================
  // ACCOUNT OPERATIONS
  // ======================

  getAllAccounts(): BankAccount[] {
    const defaultAccounts = this.getDefaultAccounts();
    return this.getStorageData(this.STORAGE_KEYS.accounts, defaultAccounts);
  }

  addAccount(account: Omit<BankAccount, 'id'>): BankAccount | null {
    const result = this.executeTransaction(() => {
      const newAccount: BankAccount = {
        ...account,
        id: this.generateId('acc')
      };
      
      const accounts = this.getAllAccounts();
      accounts.push(newAccount);
      this.setStorageData(this.STORAGE_KEYS.accounts, accounts);
      
      return newAccount;
    });
    
    if (result.success && result.result) {
      eventBus.emit('ACCOUNT_UPDATED', { accountId: result.result.id, action: 'created' }, 'CoreDataService');
      return result.result;
    }
    
    return null;
  }

  updateAccount(accountId: string, updates: Partial<BankAccount>): boolean {
    const success = this.executeTransaction(() => {
      const accounts = this.getAllAccounts();
      const index = accounts.findIndex(a => a.id === accountId);
      
      if (index === -1) throw new Error('Account not found');
      
      accounts[index] = { ...accounts[index], ...updates };
      this.setStorageData(this.STORAGE_KEYS.accounts, accounts);
      
      return true;
    }).success;
    
    if (success) {
      eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'updated' }, 'CoreDataService');
    }
    
    return success;
  }

  deleteAccount(accountId: string): boolean {
    const success = this.executeTransaction(() => {
      // First delete all transactions for this account
      this.deleteTransactionsByAccount(accountId);
      
      // Then delete the account
      const accounts = this.getAllAccounts();
      const filtered = accounts.filter(a => a.id !== accountId);
      
      if (filtered.length === accounts.length) {
        throw new Error('Account not found');
      }
      
      this.setStorageData(this.STORAGE_KEYS.accounts, filtered);
      return true;
    }).success;
    
    if (success) {
      eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'deleted' }, 'CoreDataService');
    }
    
    return success;
  }

  updateAllAccountBalances(): void {
    const accounts = this.getAllAccounts();
    const transactions = this.getAllTransactions();
    
    const updatedAccounts = accounts.map(account => {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      const balance = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      return { ...account, balance };
    });
    
    this.setStorageData(this.STORAGE_KEYS.accounts, updatedAccounts);
    eventBus.emit('BALANCES_UPDATED', { action: 'all_accounts_updated' }, 'CoreDataService');
  }

  private updateAccountBalancesFromTransactions(accountIds: string[]): void {
    const accounts = this.getAllAccounts();
    const transactions = this.getAllTransactions();
    
    const updatedAccounts = accounts.map(account => {
      if (accountIds.includes(account.id)) {
        const accountTransactions = transactions.filter(t => t.accountId === account.id);
        const balance = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
        return { ...account, balance };
      }
      return account;
    });
    
    this.setStorageData(this.STORAGE_KEYS.accounts, updatedAccounts);
  }

  // ======================
  // FILE OPERATIONS
  // ======================

  getAllFiles(): UploadedFile[] {
    return this.getStorageData(this.STORAGE_KEYS.files, []);
  }

  addFile(file: Omit<UploadedFile, 'id' | 'uploadDate'>): UploadedFile | null {
    const result = this.executeTransaction(() => {
      const newFile: UploadedFile = {
        ...file,
        id: this.generateId('file'),
        uploadDate: new Date().toISOString()
      };
      
      const files = this.getAllFiles();
      files.push(newFile);
      this.setStorageData(this.STORAGE_KEYS.files, files);
      
      return newFile;
    });
    
    if (result.success && result.result) {
      eventBus.emit('FILE_UPLOADED', { 
        fileId: result.result.id, 
        fileName: result.result.fileName 
      }, 'CoreDataService');
      return result.result;
    }
    
    return null;
  }

  deleteFile(fileId: string): boolean {
    const success = this.executeTransaction(() => {
      // First delete all transactions from this file
      this.deleteTransactionsByFile(fileId);
      
      // Then delete the file record
      const files = this.getAllFiles();
      const filtered = files.filter(f => f.id !== fileId);
      
      if (filtered.length === files.length) {
        throw new Error('File not found');
      }
      
      this.setStorageData(this.STORAGE_KEYS.files, filtered);
      return true;
    }).success;
    
    if (success) {
      eventBus.emit('FILE_DELETED', { fileId }, 'CoreDataService');
    }
    
    return success;
  }

  // ======================
  // CATEGORY OPERATIONS
  // ======================

  getAllCategories(): TransactionCategory[] {
    const defaultCategories = this.getDefaultCategories();
    return this.getStorageData(this.STORAGE_KEYS.categories, defaultCategories);
  }

  addCategory(category: Omit<TransactionCategory, 'id' | 'createdDate' | 'modifiedDate'>): TransactionCategory | null {
    const result = this.executeTransaction(() => {
      const newCategory: TransactionCategory = {
        ...category,
        id: this.generateId('cat'),
        createdDate: new Date().toISOString(),
        modifiedDate: new Date().toISOString()
      };
      
      const categories = this.getAllCategories();
      categories.push(newCategory);
      this.setStorageData(this.STORAGE_KEYS.categories, categories);
      
      return newCategory;
    });
    
    return result.success ? result.result! : null;
  }

  getAllCategorizations(): TransactionCategorization[] {
    return this.getStorageData(this.STORAGE_KEYS.categorizations, []);
  }

  addCategorization(categorization: Omit<TransactionCategorization, 'createdDate' | 'modifiedDate'>): TransactionCategorization | null {
    const result = this.executeTransaction(() => {
      const newCategorization: TransactionCategorization = {
        ...categorization,
        createdDate: new Date().toISOString(),
        modifiedDate: new Date().toISOString()
      };
      
      const categorizations = this.getAllCategorizations();
      
      // Remove existing categorization for this transaction if it exists
      const filtered = categorizations.filter(c => c.transactionId !== categorization.transactionId);
      filtered.push(newCategorization);
      
      this.setStorageData(this.STORAGE_KEYS.categorizations, filtered);
      
      return newCategorization;
    });
    
    return result.success ? result.result! : null;
  }

  // ======================
  // ATOMIC OPERATIONS
  // ======================

  executeTransaction<T>(operation: () => T): { success: boolean; result?: T; error?: string } {
    const endTimer = performanceManager.startOperation();
    const snapshot = this.createSnapshot('atomic_operation');
    
    try {
      const result = operation();
      this.updateMetadata();
      endTimer();
      return { success: true, result };
    } catch (error) {
      performanceManager.recordError();
      // Rollback on failure
      this.restoreSnapshot(snapshot);
      endTimer();
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // ======================
  // CONTINUE IN NEXT PART...
  // ======================
} 