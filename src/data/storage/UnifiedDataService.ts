// Architectural consistency imports - keep for future use
import { BankAccount, UploadedFile } from '@/shared/types';
import { eventBus } from '@/core/orchestration/EventBus';
import { localStorageManager, StoredTransaction as LSMStoredTransaction } from './LocalStorageManager';
import { systemIntegrityService } from '../integrity/SystemIntegrityService';
import { storageQuotaManager } from './StorageQuotaManager';



// UNIFIED DATA SERVICE - SINGLE SOURCE OF TRUTH
// Coordinates all data operations across the application using localStorageManager

// Re-export for backwards compatibility
export type StoredTransaction = LSMStoredTransaction;

export interface DataSummary {
  totalTransactions: number;
  totalFiles: number;
  totalAccounts: number;
  storageUsed: number;
  lastUpdated: string;
  quotaInfo?: {
    utilization: number;
    isNearLimit: boolean;
    isCritical: boolean;
    totalQuota: number;
    availableSpace: number;
  };
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

/**
 * UNIFIED DATA SERVICE
 * Single point of access for all data operations
 * Delegates to localStorageManager for actual storage operations
 * Handles event broadcasting for UI updates
 */
class UnifiedDataService {
  // TRANSACTION OPERATIONS
  getAllTransactions(): StoredTransaction[] {
    return localStorageManager.getAllTransactions();
  }

  getTransactionsByAccount(accountId: string): StoredTransaction[] {
    return localStorageManager.getTransactionsByAccount(accountId);
  }

  addTransactions(transactions: StoredTransaction[]): boolean {
    const success = localStorageManager.addTransactions(transactions);
    if (success) {
      eventBus.emit('TRANSACTIONS_UPDATED', { count: transactions.length }, 'UnifiedDataService');
    }
    return success;
  }

  deleteTransactionsByFile(fileId: string): number {
    const deletedCount = localStorageManager.deleteTransactionsByFile(fileId);
    if (deletedCount > 0) {
      eventBus.emit('TRANSACTIONS_UPDATED', { deletedCount }, 'UnifiedDataService');
    }
    return deletedCount;
  }

  deleteTransactionsByAccount(accountId: string): number {
    const deletedCount = localStorageManager.deleteTransactionsByAccount(accountId);
    if (deletedCount > 0) {
      eventBus.emit('TRANSACTIONS_UPDATED', { deletedCount, accountId }, 'UnifiedDataService');
    }
    return deletedCount;
  }

  // FILE OPERATIONS
  getAllFiles(): UploadedFile[] {
    return localStorageManager.getAllFiles();
  }

  addFile(file: Omit<UploadedFile, 'id' | 'uploadDate'>): UploadedFile | null {
    const newFile = localStorageManager.addFile(file);
    if (newFile) {
      eventBus.emit('FILE_UPLOADED', { fileId: newFile.id, fileName: newFile.fileName }, 'UnifiedDataService');
    }
    return newFile;
  }

  deleteFile(fileId: string): boolean {
    const success = localStorageManager.deleteFile(fileId);
    if (success) {
      eventBus.emit('FILE_DELETED', { fileId }, 'UnifiedDataService');
    }
    return success;
  }

  // ACCOUNT OPERATIONS
  getAllAccounts(): BankAccount[] {
    return localStorageManager.getAllAccounts();
  }

  addAccount(account: Omit<BankAccount, 'id'>): BankAccount | null {
    const newAccount = localStorageManager.addAccount(account);
    if (newAccount) {
      eventBus.emit('ACCOUNT_UPDATED', { accountId: newAccount.id, action: 'created' }, 'UnifiedDataService');
    }
    return newAccount;
  }

  updateAccount(accountId: string, updates: Partial<BankAccount>): boolean {
    const success = localStorageManager.updateAccount(accountId, updates);
    if (success) {
      eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'updated' }, 'UnifiedDataService');
    }
    return success;
  }

  deleteAccount(accountId: string): boolean {
    const success = localStorageManager.deleteAccount(accountId);
    if (success) {
      eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'deleted' }, 'UnifiedDataService');
    }
    return success;
  }

  // BALANCE MANAGEMENT
  updateAllAccountBalances(): void {
    localStorageManager.updateAllAccountBalances();
    eventBus.emit('BALANCES_UPDATED', { action: 'all_accounts_updated' }, 'UnifiedDataService');
  }

  // DATA INTEGRITY AND MAINTENANCE - DELEGATED TO SYSTEMINTEGRITYSERVICE
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
    // Fallback to basic validation since comprehensive check is async but this method needs to be sync
    const result = localStorageManager.validateDataIntegrity();
    const transactions = this.getAllTransactions();
    const files = this.getAllFiles();
    const accounts = this.getAllAccounts();
    
    // Basic orphaned data detection
    const accountIds = new Set(accounts.map(a => a.id));
    const fileIds = new Set(files.map(f => f.id));
    
    const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId)).length;
    const orphanedFiles = transactions.filter(t => t.fileId && !fileIds.has(t.fileId)).length;
    
    // Note: For comprehensive integrity checks including sophisticated duplicate detection,
    // use systemIntegrityService.performComprehensiveDataIntegrity() directly
    
    return {
      isValid: result.isValid && orphanedTransactions === 0,
      issues: result.issues,
      totalTransactions: result.stats.itemCounts.transactions,
      totalFiles: result.stats.itemCounts.files,
      orphanedTransactions,
      orphanedFiles,
      duplicateTransactions: [], // Simplified - use comprehensive method for full duplicate detection
      anomalies: orphanedTransactions > 0 ? [`${orphanedTransactions} orphaned transactions found`] : [],
      integrityScore: result.isValid && orphanedTransactions === 0 ? 100 : 80,
      recommendations: orphanedTransactions > 0 ? ['Clean up orphaned transactions using systemIntegrityService'] : []
    };
  }

  // NOTE: Data anomaly detection and balance consistency checks have been moved to systemIntegrityService
  // Use systemIntegrityService.performComprehensiveDataIntegrity() for advanced integrity checks

  cleanupOrphanedData(): { deletedTransactions: number; deletedFiles: number } {
    const result = localStorageManager.cleanupOrphanedData();
    
    if (result.deletedTransactions > 0 || result.deletedCategorizations > 0) {
      eventBus.emit('DATA_CLEARED', { 
        deletedTransactions: result.deletedTransactions,
        deletedCategorizations: result.deletedCategorizations
      }, 'UnifiedDataService');
    }
    
    return {
      deletedTransactions: result.deletedTransactions,
      deletedFiles: 0 // Files are handled by the storage manager
    };
  }

  // LEGACY DATA MIGRATION
  migrateLegacyData(): { migratedTransactions: number; migratedFiles: number } {
    // This method handles migration from old storage keys to new unified storage
    let migratedTransactions = 0;
    let migratedFiles = 0;
    
    try {
      // Migrate legacy transaction keys (treasury-transactions-*)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('treasury-transactions-') && key !== 'tms_transactions') {
          try {
            const legacyData = localStorage.getItem(key);
            if (legacyData) {
              const legacyTransactions: StoredTransaction[] = JSON.parse(legacyData);
              if (localStorageManager.addTransactions(legacyTransactions)) {
                migratedTransactions += legacyTransactions.length;
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            systemIntegrityService.logServiceError(
              'UnifiedDataService', 
              'migrateLegacyTransactions', 
              error instanceof Error ? error : new Error(String(error)),
              'medium',
              { key, migratedCount: migratedTransactions }
            );
          }
        }
      }
      
      // Migrate legacy file key (treasury-uploaded-files)
      const legacyFileKey = 'treasury-uploaded-files';
      const legacyFileData = localStorage.getItem(legacyFileKey);
      if (legacyFileData) {
        try {
          const legacyFiles: UploadedFile[] = JSON.parse(legacyFileData);
          const currentFiles = this.getAllFiles();
          const currentFileIds = new Set(currentFiles.map(f => f.id));
          
          legacyFiles.forEach(file => {
            if (!currentFileIds.has(file.id)) {
              const addedFile = localStorageManager.addFile(file);
              if (addedFile) {
                migratedFiles++;
              }
            }
          });
          
          localStorage.removeItem(legacyFileKey);
        } catch (error) {
          systemIntegrityService.logServiceError(
            'UnifiedDataService',
            'migrateLegacyFiles',
            error instanceof Error ? error : new Error(String(error)),
            'medium',
            { migratedFilesCount: migratedFiles }
          );
        }
      }
      
      // Migrate other legacy keys
      const legacyKeys = [
        'treasury-data-transactions',
        'treasury-data-files', 
        'treasury-data-accounts'
      ];
      
      legacyKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedDataService',
        'migrateLegacyData',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { migratedTransactions, migratedFiles }
      );
    }
    
    return { migratedTransactions, migratedFiles };
  }

  // UTILITY METHODS
  getDataSummary(): DataSummary {
    const stats = localStorageManager.getStorageStats();
    const quotaInfo = storageQuotaManager.getQuotaInfo();
    const activeAlerts = storageQuotaManager.getActiveAlerts();
    
    return {
      totalTransactions: stats.itemCounts.transactions,
      totalFiles: stats.itemCounts.files,
      totalAccounts: stats.itemCounts.accounts,
      storageUsed: stats.totalSize, // Already in KB
      lastUpdated: stats.lastUpdated,
      quotaInfo: quotaInfo ? {
        utilization: quotaInfo.utilization,
        isNearLimit: quotaInfo.isNearLimit,  
        isCritical: quotaInfo.isCritical,
        totalQuota: Math.round(quotaInfo.total / 1024), // KB
        availableSpace: Math.round(quotaInfo.available / 1024) // KB
      } : undefined,
      activeAlerts: activeAlerts.length
    };
  }

  /**
   * Get comprehensive data summary with enhanced quota and cleanup information
   */
  getEnhancedDataSummary(): DataSummary & { 
    cleanupHistory?: Array<{ timestamp: string; strategy: string; spaceFreed: number }>;
    availableStrategies?: Array<{ name: string; estimatedSpaceSaved: number }>;
  } {
    const basicSummary = this.getDataSummary();
    const cleanupHistory = storageQuotaManager.getCleanupHistory().slice(-5); // Last 5 cleanups
    
    // Get available cleanup strategies (async method, so we'll handle this differently)
    storageQuotaManager.getAvailableStrategies().then(strategies => {
      // This information could be cached or handled via events
      console.log('Available cleanup strategies:', strategies.map(s => ({ name: s.name, estimatedSpaceSaved: s.estimatedSpaceSaved })));
    }).catch(error => {
      console.warn('Could not get available cleanup strategies:', error);
    });
    
    return {
      ...basicSummary,
      cleanupHistory,
      availableStrategies: [] // This would be populated via async update or caching
    };
  }

  clearAllData(): void {
    localStorageManager.clearAllData();
    eventBus.emit('DATA_CLEARED', { cleared: true }, 'UnifiedDataService');
  }

  // STORAGE QUOTA MANAGEMENT METHODS

  /**
   * Get current storage quota information
   */
  getStorageQuotaInfo() {
    return storageQuotaManager.getQuotaInfo();
  }

  /**
   * Get active quota alerts
   */
  getQuotaAlerts() {
    return storageQuotaManager.getActiveAlerts();
  }

  /**
   * Acknowledge a quota alert
   */
  acknowledgeQuotaAlert(timestamp: string): boolean {
    return storageQuotaManager.acknowledgeAlert(timestamp);
  }

  /**
   * Perform manual storage cleanup
   */
  async performStorageCleanup(aggressiveness: 'gentle' | 'moderate' | 'aggressive' = 'moderate'): Promise<{ success: boolean; spaceFreed: number }> {
    const result = await storageQuotaManager.performManualCleanup(aggressiveness);
    
    if (result.success && result.spaceFreed > 0) {
      eventBus.emit('STORAGE_CLEANED', { 
        spaceFreed: result.spaceFreed, 
        aggressiveness 
      }, 'UnifiedDataService');
    }
    
    return result;
  }

  /**
   * Force immediate quota check
   */
  async checkStorageQuota(): Promise<void> {
    await storageQuotaManager.forceQuotaCheck();
  }

  /**
   * Get cleanup history
   */
  getCleanupHistory() {
    return storageQuotaManager.getCleanupHistory();
  }

  /**
   * Get available cleanup strategies
   */
  async getAvailableCleanupStrategies() {
    return await storageQuotaManager.getAvailableStrategies();
  }

  /**
   * Execute specific cleanup strategy
   */
  async executeCleanupStrategy(strategyName: string): Promise<{ success: boolean; spaceFreed: number; details: string }> {
    const result = await storageQuotaManager.executeStrategy(strategyName);
    
    if (result.success && result.spaceFreed > 0) {
      eventBus.emit('STORAGE_CLEANED', { 
        strategy: strategyName,
        spaceFreed: result.spaceFreed 
      }, 'UnifiedDataService');
    }
    
    return result;
  }

  // SNAPSHOT AND BACKUP OPERATIONS
  // @ts-ignore: operationId reserved for future snapshot tracking enhancement
  createSnapshot(operationType: 'import' | 'delete' | 'update' | 'cleanup', operationId: string): string {
    return localStorageManager.createSnapshot(operationType);
  }

  rollbackToSnapshot(snapshotTimestamp: string): boolean {
    const success = localStorageManager.restoreSnapshot(snapshotTimestamp);
    if (success) {
      eventBus.emit('DATA_CLEARED', { rollback: true }, 'UnifiedDataService');
    }
    return success;
  }

  getAllSnapshots() {
    // Return simplified snapshot info for UI
    return localStorageManager.getStorageStats();
  }

  deleteSnapshot(snapshotTimestamp: string): boolean {
    // Enhanced snapshot deletion with proper integration
    try {
      const snapshots = JSON.parse(localStorage.getItem('tms_snapshots') || '[]');
      const filteredSnapshots = snapshots.filter((s: any) => s.timestamp !== snapshotTimestamp);
      
      if (filteredSnapshots.length < snapshots.length) {
        localStorage.setItem('tms_snapshots', JSON.stringify(filteredSnapshots));
        eventBus.emit('DATA_CLEARED', { snapshotDeleted: snapshotTimestamp }, 'UnifiedDataService');
        return true;
      }
      return false;
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedDataService',
        'deleteSnapshot',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { snapshotTimestamp }
      );
      return false;
    }
  }

  // VALIDATION METHODS
  validateTransaction(transaction: Partial<StoredTransaction>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!transaction.id) {
      errors.push({ field: 'id', message: 'Transaction ID is required', severity: 'critical' });
    }
    
    if (!transaction.accountId) {
      errors.push({ field: 'accountId', message: 'Account ID is required', severity: 'critical' });
    }
    
    if (!transaction.date) {
      errors.push({ field: 'date', message: 'Transaction date is required', severity: 'critical' });
    }
    
    if (!transaction.description) {
      errors.push({ field: 'description', message: 'Transaction description is required', severity: 'high' });
    }

    // Amount validation
    const hasCredit = transaction.creditAmount && transaction.creditAmount > 0;
    const hasDebit = transaction.debitAmount && transaction.debitAmount > 0;
    
    if (!hasCredit && !hasDebit) {
      errors.push({ field: 'amount', message: 'Transaction must have either credit or debit amount', severity: 'critical' });
    }
    
    if (hasCredit && hasDebit) {
      warnings.push({ field: 'amount', message: 'Transaction has both credit and debit amounts', suggestion: 'Verify this is correct' });
    }

    // Date validation
    if (transaction.date) {
      const date = new Date(transaction.date);
      if (isNaN(date.getTime())) {
        errors.push({ field: 'date', message: 'Invalid date format', severity: 'high' });
      } else {
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        
        if (date < oneYearAgo) {
          warnings.push({ field: 'date', message: 'Transaction date is more than 1 year old', suggestion: 'Verify date is correct' });
        }
        
        if (date > oneYearAhead) {
          warnings.push({ field: 'date', message: 'Transaction date is more than 1 year in the future', suggestion: 'Verify date is correct' });
        }
      }
    }

    // Balance validation
    if (transaction.balance !== undefined && transaction.balance < 0) {
      warnings.push({ field: 'balance', message: 'Account balance is negative', suggestion: 'Verify balance is correct' });
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

    // Required fields validation
    if (!account.name || account.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Account name is required', severity: 'critical' });
    }
    
    if (!account.accountNumber || account.accountNumber.trim().length === 0) {
      errors.push({ field: 'accountNumber', message: 'Account number is required', severity: 'critical' });
    }
    
    if (!account.bankName || account.bankName.trim().length === 0) {
      errors.push({ field: 'bankName', message: 'Bank name is required', severity: 'high' });
    }
    
    if (!account.currency || account.currency.trim().length === 0) {
      errors.push({ field: 'currency', message: 'Currency is required', severity: 'high' });
    }

    // Format validation
    if (account.accountNumber && account.accountNumber.length < 4) {
      warnings.push({ field: 'accountNumber', message: 'Account number seems too short', suggestion: 'Verify account number is complete' });
    }
    
    if (account.currency && account.currency.length !== 3) {
      warnings.push({ field: 'currency', message: 'Currency should be 3-letter ISO code (e.g., USD, EUR)', suggestion: 'Use standard currency codes' });
    }

    // Business logic validation
    if (account.currentBalance !== undefined && account.currentBalance < -1000000) {
      warnings.push({ field: 'currentBalance', message: 'Account balance is extremely negative', suggestion: 'Verify balance is correct' });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // EXPORT/IMPORT OPERATIONS
  exportBackup(): string {
    return localStorageManager.exportData();
  }

  importBackup(backupData: string): { success: boolean; message: string; imported: { transactions: number; files: number; accounts: number } } {
    const result = localStorageManager.importData(backupData);
    
    if (result.success) {
      eventBus.emit('DATA_CLEARED', { imported: true }, 'UnifiedDataService');
    }
    
    return {
      success: result.success,
      message: result.message,
      imported: {
        transactions: result.imported?.transactions || 0,
        files: result.imported?.files || 0,
        accounts: result.imported?.accounts || 0
      }
    };
  }
}

// Export singleton instance
export const unifiedDataService = new UnifiedDataService(); 