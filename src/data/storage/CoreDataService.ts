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

import { Transaction, BankAccount, UploadedFile, TransactionCategory, TransactionCategorization } from '../../../shared/types';
import { performanceManager } from './performanceManager';
import { systemIntegrityService } from '../integrity/SystemIntegrityService';
import { eventBus } from './EventBus';

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
      const balance = accountTransactions.reduce((sum, t) => {
        // Calculate net amount from debit and credit amounts
        const netAmount = (t.creditAmount || 0) - (t.debitAmount || 0);
        return sum + netAmount;
      }, 0);
      
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
        const balance = accountTransactions.reduce((sum, t) => {
          // Calculate net amount from debit and credit amounts
          const netAmount = (t.creditAmount || 0) - (t.debitAmount || 0);
          return sum + netAmount;
        }, 0);
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

  // ======================
  // QUOTA MANAGEMENT
  // ======================

  private startQuotaMonitoring(): void {
    if (this.monitoringTimer) return;
    
    this.monitoringTimer = setInterval(async () => {
      await this.updateQuotaInfo();
      await this.checkQuotaThresholds();
    }, this.MONITORING_INTERVAL);
  }

  private stopQuotaMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  private async updateQuotaInfo(): Promise<void> {
    try {
      const quotaInfo = await this.calculateStorageQuota();
      this.currentQuotaInfo = quotaInfo;
      
      this.recordQuotaHistory(quotaInfo);
      eventBus.emit('QUOTA_UPDATED', quotaInfo, 'CoreDataService');
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'CoreDataService',
        'updateQuotaInfo',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { operation: 'quota_calculation' }
      );
    }
  }

  private async calculateStorageQuota(): Promise<StorageQuotaInfo> {
    const used = this.calculateUsedSpace();
    const total = await this.estimateQuotaSize();
    const available = Math.max(0, total - used);
    const utilization = (used / total) * 100;

    return {
      total,
      used,
      available,
      utilization,
      isNearLimit: utilization >= this.QUOTA_WARNING_THRESHOLD * 100,
      isCritical: utilization >= this.QUOTA_CRITICAL_THRESHOLD * 100,
      lastChecked: new Date().toISOString()
    };
  }

  private calculateUsedSpace(): number {
    let totalSize = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += (key.length + value.length) * 2; // UTF-16 = 2 bytes each
          }
        }
      }
    } catch (error) {
      console.warn('Error calculating used space:', error);
    }
    
    return totalSize;
  }

  private async estimateQuotaSize(): Promise<number> {
    // Check cached estimate
    try {
      const cached = localStorage.getItem('tms_quota_estimate');
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;
        if (age < 24 * 60 * 60 * 1000) { // 24 hours
          return parsed.size;
        }
      }
    } catch {}
    
    // Default estimate: 5MB for modern browsers
    const estimate = 5 * 1024 * 1024;
    
    try {
      localStorage.setItem('tms_quota_estimate', JSON.stringify({
        size: estimate,
        timestamp: Date.now()
      }));
    } catch {}
    
    return estimate;
  }

  private async checkQuotaThresholds(): Promise<void> {
    if (!this.currentQuotaInfo) return;

    const { utilization } = this.currentQuotaInfo;

    if (utilization >= this.QUOTA_EMERGENCY_THRESHOLD * 100) {
      await this.handleEmergencyQuota();
    } else if (utilization >= this.QUOTA_CRITICAL_THRESHOLD * 100) {
      await this.handleCriticalQuota();
    } else if (utilization >= this.QUOTA_WARNING_THRESHOLD * 100) {
      await this.handleWarningQuota();
    }
  }

  private async handleEmergencyQuota(): Promise<void> {
    const alert: QuotaAlert = {
      severity: 'emergency',
      message: 'Storage quota critically full (>98%). Immediate cleanup required!',
      availableActions: ['Emergency Cleanup', 'Export Data', 'Clear Old Files'],
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.addAlert(alert);
    await this.performEmergencyCleanup();
  }

  private async handleCriticalQuota(): Promise<void> {
    const alert: QuotaAlert = {
      severity: 'critical',
      message: 'Storage quota almost full (>95%). Cleanup recommended.',
      availableActions: ['Cleanup Old Data', 'Remove Snapshots', 'Archive Files'],
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.addAlert(alert);
    await this.performCriticalCleanup();
  }

  private async handleWarningQuota(): Promise<void> {
    const alert: QuotaAlert = {
      severity: 'warning',
      message: 'Storage quota approaching limit (>80%). Consider cleanup.',
      availableActions: ['Cleanup Cache', 'Remove Old Snapshots', 'Archive Data'],
      timestamp: new Date().toISOString(),
      acknowledged: false
    };

    this.addAlert(alert);
    await this.performPreventiveCleanup();
  }

  async performEmergencyCleanup(): Promise<{ success: boolean; spaceFreed: number }> {
    let totalFreed = 0;

    try {
      // Execute multiple cleanup strategies in order of priority
      const strategies = [
        'removeSnapshots',
        'clearCache',
        'compressOldData',
        'removePerformanceData'
      ];

      for (const strategy of strategies) {
        const result = await this.executeCleanupStrategy(strategy);
        if (result.success) {
          totalFreed += result.spaceFreed;
        }
      }

      this.recordCleanup('emergency', totalFreed);
      eventBus.emit('EMERGENCY_CLEANUP_COMPLETED', { spaceFreed: totalFreed }, 'CoreDataService');

      return { success: true, spaceFreed: totalFreed };
    } catch (error) {
      systemIntegrityService.logServiceError(
        'CoreDataService',
        'performEmergencyCleanup',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { spaceFreed: totalFreed }
      );
      return { success: false, spaceFreed: totalFreed };
    }
  }

  async performCriticalCleanup(): Promise<{ success: boolean; spaceFreed: number }> {
    let totalFreed = 0;

    try {
      const result = await this.executeCleanupStrategy('removeOldSnapshots');
      if (result.success) {
        totalFreed += result.spaceFreed;
      }

      this.recordCleanup('critical', totalFreed);
      return { success: true, spaceFreed: totalFreed };
    } catch (error) {
      return { success: false, spaceFreed: totalFreed };
    }
  }

  async performPreventiveCleanup(): Promise<{ success: boolean; spaceFreed: number }> {
    let totalFreed = 0;

    try {
      const result = await this.executeCleanupStrategy('clearCache');
      if (result.success) {
        totalFreed += result.spaceFreed;
      }

      this.recordCleanup('preventive', totalFreed);
      return { success: true, spaceFreed: totalFreed };
    } catch (error) {
      return { success: false, spaceFreed: totalFreed };
    }
  }

  private async executeCleanupStrategy(strategyName: string): Promise<{ success: boolean; spaceFreed: number; details: string }> {
    const beforeSize = this.calculateUsedSpace();
    
    try {
      switch (strategyName) {
        case 'removeSnapshots':
          this.removeAllSnapshots();
          break;
        case 'clearCache':
          this.clearCacheData();
          break;
        case 'removeOldSnapshots':
          this.removeOldSnapshots();
          break;
        case 'compressOldData':
          await this.compressOldTransactions();
          break;
        case 'removePerformanceData':
          this.clearPerformanceData();
          break;
        default:
          throw new Error(`Unknown cleanup strategy: ${strategyName}`);
      }

      const afterSize = this.calculateUsedSpace();
      const spaceFreed = beforeSize - afterSize;

      return {
        success: true,
        spaceFreed,
        details: `${strategyName}: ${Math.round(spaceFreed / 1024)}KB freed`
      };
    } catch (error) {
      return {
        success: false,
        spaceFreed: 0,
        details: `${strategyName} failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // ======================
  // DATA VALIDATION
  // ======================

  validateDataIntegrity(): {
    isValid: boolean;
    issues: string[];
    totalTransactions: number;
    totalFiles: number;
    orphanedTransactions: number;
    orphanedFiles: number;
    duplicateTransactions: StoredTransaction[];
    anomalies: string[];
    integrityScore: number;
    recommendations: string[];
  } {
    const transactions = this.getAllTransactions();
    const files = this.getAllFiles();
    const accounts = this.getAllAccounts();
    
    const accountIds = new Set(accounts.map(a => a.id));
    const fileIds = new Set(files.map(f => f.id));
    
    const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId)).length;
    const orphanedFiles = transactions.filter(t => t.fileId && !fileIds.has(t.fileId)).length;
    
    // Simple duplicate detection
    const seenIds = new Set<string>();
    const duplicateTransactions: StoredTransaction[] = [];
    for (const transaction of transactions) {
      if (seenIds.has(transaction.id)) {
        duplicateTransactions.push(transaction);
      } else {
        seenIds.add(transaction.id);
      }
    }

    const issues: string[] = [];
    const anomalies: string[] = [];
    const recommendations: string[] = [];

    if (orphanedTransactions > 0) {
      issues.push(`${orphanedTransactions} orphaned transactions found`);
      anomalies.push(`${orphanedTransactions} orphaned transactions`);
      recommendations.push('Clean up orphaned transactions');
    }

    if (orphanedFiles > 0) {
      issues.push(`${orphanedFiles} orphaned file references found`);
      anomalies.push(`${orphanedFiles} orphaned file references`);
      recommendations.push('Clean up orphaned file references');
    }

    if (duplicateTransactions.length > 0) {
      issues.push(`${duplicateTransactions.length} duplicate transactions found`);
      anomalies.push(`${duplicateTransactions.length} duplicate transactions`);
      recommendations.push('Remove duplicate transactions');
    }

    const isValid = issues.length === 0;
    const integrityScore = isValid ? 100 : Math.max(0, 100 - (issues.length * 20));

    return {
      isValid,
      issues,
      totalTransactions: transactions.length,
      totalFiles: files.length,
      orphanedTransactions,
      orphanedFiles,
      duplicateTransactions,
      anomalies,
      integrityScore,
      recommendations
    };
  }

  cleanupOrphanedData(): { deletedTransactions: number; deletedFiles: number } {
    const transactions = this.getAllTransactions();
    const accounts = this.getAllAccounts();
    
    const accountIds = new Set(accounts.map(a => a.id));
    const validTransactions = transactions.filter(t => accountIds.has(t.accountId));
    const deletedTransactions = transactions.length - validTransactions.length;
    
    if (deletedTransactions > 0) {
      this.setStorageData(this.STORAGE_KEYS.transactions, validTransactions);
      eventBus.emit('DATA_CLEARED', { deletedTransactions }, 'CoreDataService');
    }

    return { deletedTransactions, deletedFiles: 0 };
  }

  validateTransaction(transaction: Partial<StoredTransaction>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!transaction.id) {
      errors.push({ field: 'id', message: 'Transaction ID is required', severity: 'critical' });
    }

    // Check both debit and credit amounts
    const hasDebitAmount = transaction.debitAmount !== undefined && transaction.debitAmount !== 0;
    const hasCreditAmount = transaction.creditAmount !== undefined && transaction.creditAmount !== 0;
    
    if (!hasDebitAmount && !hasCreditAmount) {
      errors.push({ field: 'amount', message: 'Transaction must have either debit or credit amount', severity: 'high' });
    }

    if (!transaction.description?.trim()) {
      warnings.push({ field: 'description', message: 'Transaction description is empty', suggestion: 'Add a meaningful description' });
    }

    if (!transaction.accountId) {
      errors.push({ field: 'accountId', message: 'Account ID is required', severity: 'critical' });
    }

    if (!transaction.postDateTime) {
      errors.push({ field: 'postDateTime', message: 'Post date is required', severity: 'high' });
    } else {
      const postDate = new Date(transaction.postDateTime);
      if (isNaN(postDate.getTime())) {
        errors.push({ field: 'postDateTime', message: 'Invalid post date format', severity: 'high' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateBankAccount(account: Partial<BankAccount>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!account.name?.trim()) {
      errors.push({ field: 'name', message: 'Account name is required', severity: 'critical' });
    }

    // Note: Type checking removed as BankAccount interface may not have 'type' property
    // Check the actual BankAccount interface for available properties

    if (account.currentBalance === undefined || account.currentBalance === null) {
      warnings.push({ field: 'currentBalance', message: 'Account balance not set', suggestion: 'Set initial balance' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ======================
  // SNAPSHOT MANAGEMENT
  // ======================

    createSnapshot(operationType: string): string {
    const timestamp = new Date().toISOString();
    console.log(`📸 Creating snapshot for operation: ${operationType}`);

    const snapshot: StorageSnapshot = {
      timestamp,
      transactions: this.getAllTransactions(),
      accounts: this.getAllAccounts(),
      files: this.getAllFiles(),
      categories: this.getAllCategories(),
      categorizations: this.getAllCategorizations()
    };

    try {
      const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, {} as Record<string, StorageSnapshot>);
      snapshots[timestamp] = snapshot;
      
      // Keep only the most recent snapshots
      const timestamps = Object.keys(snapshots).sort().reverse();
      if (timestamps.length > this.MAX_SNAPSHOTS) {
        const toDelete = timestamps.slice(this.MAX_SNAPSHOTS);
        toDelete.forEach(ts => delete snapshots[ts]);
      }
      
      this.setStorageData(this.STORAGE_KEYS.snapshots, snapshots);
      return timestamp;
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      return timestamp;
    }
  }

  restoreSnapshot(timestamp: string): boolean {
    try {
      const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, {} as Record<string, StorageSnapshot>);
      const snapshot = snapshots[timestamp];
      
      if (!snapshot) return false;
      
      this.setStorageData(this.STORAGE_KEYS.transactions, snapshot.transactions);
      this.setStorageData(this.STORAGE_KEYS.accounts, snapshot.accounts);
      this.setStorageData(this.STORAGE_KEYS.files, snapshot.files);
      this.setStorageData(this.STORAGE_KEYS.categories, snapshot.categories);
      this.setStorageData(this.STORAGE_KEYS.categorizations, snapshot.categorizations);
      
      this.updateMetadata();
      eventBus.emit('DATA_RESTORED', { timestamp }, 'CoreDataService');
      
      return true;
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      return false;
    }
  }

  getAllSnapshots() {
    return this.getStorageData(this.STORAGE_KEYS.snapshots, {} as Record<string, StorageSnapshot>);
  }

  deleteSnapshot(snapshotTimestamp: string): boolean {
    try {
      const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, {} as Record<string, StorageSnapshot>);
      delete snapshots[snapshotTimestamp];
      this.setStorageData(this.STORAGE_KEYS.snapshots, snapshots);
      return true;
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      return false;
    }
  }

  private removeAllSnapshots(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.snapshots);
    } catch (error) {
      console.error('Failed to remove snapshots:', error);
    }
  }

  private removeOldSnapshots(): void {
    try {
      const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, {} as Record<string, StorageSnapshot>);
      const timestamps = Object.keys(snapshots).sort().reverse();
      
      if (timestamps.length > 2) {
        const toDelete = timestamps.slice(2);
        toDelete.forEach(ts => delete snapshots[ts]);
        this.setStorageData(this.STORAGE_KEYS.snapshots, snapshots);
      }
    } catch (error) {
      console.error('Failed to remove old snapshots:', error);
    }
  }

  // ======================
  // DATA SUMMARIES
  // ======================

  getDataSummary(): DataSummary {
    const transactions = this.getAllTransactions();
    const files = this.getAllFiles();
    const accounts = this.getAllAccounts();
    const storageUsed = this.calculateUsedSpace();

    return {
      totalTransactions: transactions.length,
      totalFiles: files.length,
      totalAccounts: accounts.length,
      storageUsed,
      lastUpdated: new Date().toISOString(),
      quotaInfo: this.currentQuotaInfo || undefined,
      activeAlerts: this.activeAlerts.length
    };
  }

  getEnhancedDataSummary(): DataSummary & { 
    cleanupHistory?: Array<{ timestamp: string; strategy: string; spaceFreed: number }>;
    availableStrategies?: Array<{ name: string; estimatedSpaceSaved: number }>;
  } {
    const summary = this.getDataSummary();
    
    return {
      ...summary,
      cleanupHistory: this.cleanupHistory.slice(-10), // Last 10 cleanups
      availableStrategies: [
        { name: 'removeOldSnapshots', estimatedSpaceSaved: 50000 },
        { name: 'clearCache', estimatedSpaceSaved: 25000 },
        { name: 'compressOldData', estimatedSpaceSaved: 100000 }
      ]
    };
  }

  // ======================
  // QUOTA PUBLIC API
  // ======================

  getQuotaInfo(): StorageQuotaInfo | null {
    return this.currentQuotaInfo;
  }

  getActiveAlerts(): QuotaAlert[] {
    return this.activeAlerts.filter(alert => !alert.acknowledged);
  }

  acknowledgeAlert(timestamp: string): boolean {
    const alert = this.activeAlerts.find(a => a.timestamp === timestamp);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getCleanupHistory(): Array<{ timestamp: string; strategy: string; spaceFreed: number }> {
    return [...this.cleanupHistory];
  }

  async forceQuotaCheck(): Promise<void> {
    await this.updateQuotaInfo();
    await this.checkQuotaThresholds();
  }

  async performManualCleanup(aggressiveness: 'gentle' | 'moderate' | 'aggressive' = 'moderate'): Promise<{ success: boolean; spaceFreed: number }> {
    switch (aggressiveness) {
      case 'gentle':
        return await this.performPreventiveCleanup();
      case 'moderate':
        return await this.performCriticalCleanup();
      case 'aggressive':
        return await this.performEmergencyCleanup();
      default:
        return { success: false, spaceFreed: 0 };
    }
  }

  // ======================
  // DATA IMPORT/EXPORT
  // ======================

  exportData(): string {
    const data = {
      version: this.STORAGE_VERSION,
      exportDate: new Date().toISOString(),
      transactions: this.getAllTransactions(),
      accounts: this.getAllAccounts(),
      files: this.getAllFiles(),
      categories: this.getAllCategories(),
      categorizations: this.getAllCategorizations()
    };
    
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string): { success: boolean; message: string; imported: any } {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.version || !data.transactions || !data.accounts) {
        return { success: false, message: 'Invalid data format', imported: null };
      }
      
      // Backup current data
      const backupTimestamp = this.createSnapshot('import_backup');
      
      try {
        // Import data
        this.setStorageData(this.STORAGE_KEYS.transactions, data.transactions || []);
        this.setStorageData(this.STORAGE_KEYS.accounts, data.accounts || []);
        this.setStorageData(this.STORAGE_KEYS.files, data.files || []);
        this.setStorageData(this.STORAGE_KEYS.categories, data.categories || []);
        this.setStorageData(this.STORAGE_KEYS.categorizations, data.categorizations || []);
        
        this.updateMetadata();
        
        eventBus.emit('DATA_IMPORTED', {
          transactions: data.transactions?.length || 0,
          accounts: data.accounts?.length || 0,
          files: data.files?.length || 0
        }, 'CoreDataService');
        
        return {
          success: true,
          message: 'Data imported successfully',
          imported: {
            transactions: data.transactions?.length || 0,
            accounts: data.accounts?.length || 0,
            files: data.files?.length || 0
          }
        };
      } catch (importError) {
        // Restore backup on failure
        this.restoreSnapshot(backupTimestamp);
        throw importError;
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
        imported: null
      };
    }
  }

  clearAllData(): void {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove ${key}:`, error);
      }
    });
    
    this.updateMetadata();
    eventBus.emit('DATA_CLEARED', { action: 'all_data_cleared' }, 'CoreDataService');
  }

  // ======================
  // UTILITY METHODS
  // ======================

  private getStorageData<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      
      const parsed = JSON.parse(item);
      return parsed !== null ? parsed : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      systemIntegrityService.logServiceError(
        'CoreDataService',
        'getStorageData',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { key, operation: 'read' }
      );
      return defaultValue;
    }
  }

  private setStorageData<T>(key: string, data: T): void {
    try {
      // Check quota before writing
      if (this.currentQuotaInfo?.utilization && this.currentQuotaInfo.utilization > 95) {
        // Attempt cleanup before writing
        this.performPreventiveCleanup().catch(() => {});
      }

      const jsonString = JSON.stringify(data);
      localStorage.setItem(key, jsonString);
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        // Emergency cleanup and retry
        this.performEmergencyCleanup().then(() => {
          try {
            localStorage.setItem(key, JSON.stringify(data));
          } catch (retryError) {
            systemIntegrityService.logServiceError(
              'CoreDataService',
              'setStorageData',
              retryError instanceof Error ? retryError : new Error(String(retryError)),
              'critical',
              { key, operation: 'write_retry_failed' }
            );
            throw retryError;
          }
        }).catch(() => {
          systemIntegrityService.logServiceError(
            'CoreDataService',
            'setStorageData',
            error instanceof Error ? error : new Error(String(error)),
            'critical',
            { key, operation: 'quota_exceeded' }
          );
          throw error;
        });
      } else {
        systemIntegrityService.logServiceError(
          'CoreDataService',
          'setStorageData',
          error instanceof Error ? error : new Error(String(error)),
          'high',
          { key, operation: 'write' }
        );
        throw error;
      }
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetadata(): void {
    const metadata = {
      version: this.STORAGE_VERSION,
      lastUpdated: new Date().toISOString(),
      itemCounts: {
        transactions: this.getAllTransactions().length,
        accounts: this.getAllAccounts().length,
        files: this.getAllFiles().length,
        categories: this.getAllCategories().length,
        categorizations: this.getAllCategorizations().length
      }
    };
    
    try {
      localStorage.setItem(this.STORAGE_KEYS.metadata, JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to update metadata:', error);
    }
  }

  private getDefaultAccounts(): BankAccount[] {
    return [
      {
        id: 'acc_default_checking',
        name: 'Primary Checking',
        accountNumber: '****1234',
        bankName: 'Default Bank',
        currency: 'USD',
        currentBalance: 0
      }
    ];
  }

  private getDefaultCategories(): TransactionCategory[] {
    return [
      { id: 'cat_groceries', name: 'Groceries', description: 'Food and grocery purchases', keywords: ['grocery', 'food', 'supermarket'], color: '#4CAF50', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() },
      { id: 'cat_utilities', name: 'Utilities', description: 'Utility bills and services', keywords: ['utility', 'electric', 'gas', 'water'], color: '#FF9800', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() },
      { id: 'cat_entertainment', name: 'Entertainment', description: 'Entertainment and leisure', keywords: ['entertainment', 'movie', 'music'], color: '#9C27B0', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() },
      { id: 'cat_transport', name: 'Transportation', description: 'Transportation costs', keywords: ['transport', 'gas', 'fuel', 'taxi'], color: '#2196F3', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() },
      { id: 'cat_healthcare', name: 'Healthcare', description: 'Medical and healthcare', keywords: ['medical', 'doctor', 'pharmacy'], color: '#F44336', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() },
      { id: 'cat_income', name: 'Income', description: 'Income and earnings', keywords: ['salary', 'income', 'payment'], color: '#8BC34A', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() },
      { id: 'cat_other', name: 'Other', description: 'Miscellaneous transactions', keywords: ['other', 'misc'], color: '#607D8B', parentCategoryId: undefined, isSystem: true, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString() }
    ];
  }

  private async compressOldTransactions(): Promise<void> {
    const transactions = this.getAllTransactions();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const oldTransactions = transactions.filter(t => new Date(t.postDateTime) < oneYearAgo);
    const recentTransactions = transactions.filter(t => new Date(t.postDateTime) >= oneYearAgo);

    if (oldTransactions.length > 0) {
      // Compress old transactions (simplified - in real implementation, could use compression library)
      const compressedData = this.compressData(oldTransactions);
      localStorage.setItem('tms_archived_transactions', compressedData);
      
      // Keep only recent transactions in main storage
      this.setStorageData(this.STORAGE_KEYS.transactions, recentTransactions);
    }
  }

  private compressData(data: any): string {
    // Simple compression - remove unnecessary whitespace
    return JSON.stringify(data);
  }

  private clearCacheData(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('cache') || key.includes('temp') || key.includes('tms_temp')) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove cache key ${key}:`, error);
        }
      }
    });
  }

  private clearPerformanceData(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.includes('performance') || key.includes('metrics') || key.includes('tms_perf')) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove performance key ${key}:`, error);
        }
      }
    });
  }

  private addAlert(alert: QuotaAlert): void {
    this.activeAlerts.push(alert);
    
    // Keep only the most recent 10 alerts
    if (this.activeAlerts.length > 10) {
      this.activeAlerts = this.activeAlerts.slice(-10);
    }
    
    eventBus.emit('QUOTA_ALERT', alert, 'CoreDataService');
  }

  private recordCleanup(strategy: string, spaceFreed: number): void {
    this.cleanupHistory.push({
      timestamp: new Date().toISOString(),
      strategy,
      spaceFreed
    });
    
    // Keep only the most recent 20 cleanup records
    if (this.cleanupHistory.length > 20) {
      this.cleanupHistory = this.cleanupHistory.slice(-20);
    }

    eventBus.emit('STORAGE_CLEANED', { strategy, spaceFreed }, 'CoreDataService');
  }

  private recordQuotaHistory(quotaInfo: StorageQuotaInfo): void {
    try {
      const history = this.getStorageData(this.STORAGE_KEYS.quotaHistory, [] as Array<{
        timestamp: string;
        utilization: number;
        used: number;
        total: number;
      }>);
      history.push({
        timestamp: quotaInfo.lastChecked,
        utilization: quotaInfo.utilization,
        used: quotaInfo.used,
        total: quotaInfo.total
      });
      
      // Keep only the last 100 quota history entries
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      this.setStorageData(this.STORAGE_KEYS.quotaHistory, history);
    } catch (error) {
      console.warn('Failed to record quota history:', error);
    }
  }

  // ======================
  // CLEANUP AND DESTROY
  // ======================

  destroy(): void {
    this.stopQuotaMonitoring();
    this.currentQuotaInfo = null;
    this.activeAlerts = [];
    this.cleanupHistory = [];
  }
}

// Export singleton instance
export const coreDataService = new CoreDataService();
export default coreDataService; 