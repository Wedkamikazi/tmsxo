/**
 * IMPORT PROCESSING SERVICE - FOUNDATION
 * 
 * Consolidated service that will merge:
 * - importHistoryService.ts (import tracking)
 * - fileStorageService.ts (file management) 
 * - csvProcessingService.ts (CSV processing)
 * 
 * Starting with: Import History Foundation (Micro-Task 2.1.2.1)
 * 
 * Features:
 * - Import history tracking and validation
 * - File record management with backup/restore
 * - CSV parsing and validation
 * - End-to-end import workflow orchestration
 */

import { coreDataService } from './coreDataService';
import { eventBus } from './eventBus';
import { systemIntegrityService } from './systemIntegrityService';

// ======================
// TYPE DEFINITIONS
// ======================

export interface ImportHistory {
  accountId: string;
  lastImportDate: string;
  lastClosingBalance: number;
  lastImportTimestamp: number;
}

export interface ImportHistoryValidation {
  isValid: boolean;
  issues: string[];
  expectedOpeningBalance: number | null;
  daysSinceLastImport: number | null;
  isNewImportAfterLast: boolean;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  uploadDate: string;
  accountId: string;
  accountName: string;
  transactionCount: number;
  fileSize: number;
  checksum?: string;
}

export interface DeletionReport {
  fileId: string;
  fileName: string;
  expectedTransactionCount: number;
  actualDeletedCount: number;
  totalTransactionsBefore: number;
  totalTransactionsAfter: number;
  backupCreated: boolean;
  backupKey: string;
  isVerified: boolean;
  error: string | null;
}

export interface BackupData {
  fileRecord: UploadedFile;
  transactions: any[];
  timestamp: string;
  accountBalance?: number;
}

// ======================
// IMPORT PROCESSING SERVICE - FOUNDATION
// ======================

class ImportProcessingService {
  private readonly IMPORT_HISTORY_STORAGE_KEY = 'treasury_import_history';
  private readonly BACKUP_KEY_PREFIX = 'tms_backup_';
  private readonly MAX_BACKUPS = 10;

  constructor() {
    console.log('✅ Import Processing Service (Foundation + File Storage) initialized');
  }

  // ======================
  // IMPORT HISTORY MANAGEMENT
  // ======================

  /**
   * Get import history for all accounts
   */
  getImportHistory(): ImportHistory[] {
    try {
      const stored = localStorage.getItem(this.IMPORT_HISTORY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'getImportHistory',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { operation: 'read_history' }
      );
      return [];
    }
  }

  /**
   * Get last import info for a specific account
   */
  getLastImportInfo(accountId: string): ImportHistory | null {
    const history = this.getImportHistory();
    return history.find(h => h.accountId === accountId) || null;
  }

  /**
   * Update import history after successful import
   */
  updateImportHistory(accountId: string, lastImportDate: string, closingBalance: number): void {
    try {
      const history = this.getImportHistory();
      const existingIndex = history.findIndex(h => h.accountId === accountId);
      
      const newEntry: ImportHistory = {
        accountId,
        lastImportDate,
        lastClosingBalance: closingBalance,
        lastImportTimestamp: Date.now()
      };

      if (existingIndex >= 0) {
        history[existingIndex] = newEntry;
      } else {
        history.push(newEntry);
      }

      localStorage.setItem(this.IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(history));
      
      // Emit event for UI updates
      eventBus.emit('IMPORT_HISTORY_UPDATED', {
        accountId,
        lastImportDate,
        closingBalance
      }, 'ImportProcessingService');
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'updateImportHistory',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { accountId, lastImportDate, closingBalance }
      );
      throw error;
    }
  }

  /**
   * Check if new import date is after last import
   */
  isNewImportAfterLast(accountId: string, newImportDate: string): boolean {
    const lastImport = this.getLastImportInfo(accountId);
    if (!lastImport) return true; // First import
    
    const lastDate = new Date(lastImport.lastImportDate);
    const newDate = new Date(newImportDate);
    
    return newDate > lastDate;
  }

  /**
   * Calculate expected opening balance based on last import
   */
  getExpectedOpeningBalance(accountId: string): number | null {
    const lastImport = this.getLastImportInfo(accountId);
    return lastImport ? lastImport.lastClosingBalance : null;
  }

  /**
   * Get days since last import
   */
  getDaysSinceLastImport(accountId: string): number | null {
    const lastImport = this.getLastImportInfo(accountId);
    if (!lastImport) return null;
    
    const lastDate = new Date(lastImport.lastImportDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Comprehensive import history validation
   */
  validateImportHistory(accountId: string, newImportDate: string): ImportHistoryValidation {
    const issues: string[] = [];
    
    const expectedOpeningBalance = this.getExpectedOpeningBalance(accountId);
    const daysSinceLastImport = this.getDaysSinceLastImport(accountId);
    const isNewImportAfterLast = this.isNewImportAfterLast(accountId, newImportDate);
    
    // Validate import date continuity
    if (!isNewImportAfterLast) {
      issues.push('Import date is not after the last import date');
    }
    
    // Warn about gaps in import dates
    if (daysSinceLastImport && daysSinceLastImport > 30) {
      issues.push(`Large gap since last import: ${daysSinceLastImport} days`);
    }
    
    // Check account exists
    const account = coreDataService.getAllAccounts().find(a => a.id === accountId);
    if (!account) {
      issues.push('Account not found');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      expectedOpeningBalance,
      daysSinceLastImport,
      isNewImportAfterLast
    };
  }

  /**
   * Get import statistics for all accounts
   */
  getImportStatistics(): {
    totalAccounts: number;
    accountsWithHistory: number;
    oldestImport: string | null;
    newestImport: string | null;
    averageDaysBetweenImports: number | null;
  } {
    const history = this.getImportHistory();
    const accounts = coreDataService.getAllAccounts();
    
    if (history.length === 0) {
      return {
        totalAccounts: accounts.length,
        accountsWithHistory: 0,
        oldestImport: null,
        newestImport: null,
        averageDaysBetweenImports: null
      };
    }
    
    const sortedDates = history
      .map(h => new Date(h.lastImportDate))
      .sort((a, b) => a.getTime() - b.getTime());
    
    const oldestImport = sortedDates[0]?.toISOString() || null;
    const newestImport = sortedDates[sortedDates.length - 1]?.toISOString() || null;
    
    // Calculate average days between imports
    let totalDays = 0;
    let intervals = 0;
    
    for (let i = 1; i < sortedDates.length; i++) {
      const diffTime = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      totalDays += diffDays;
      intervals++;
    }
    
    const averageDaysBetweenImports = intervals > 0 ? totalDays / intervals : null;
    
    return {
      totalAccounts: accounts.length,
      accountsWithHistory: history.length,
      oldestImport,
      newestImport,
      averageDaysBetweenImports
    };
  }

  /**
   * Clear import history (for testing/reset)
   */
  clearImportHistory(): void {
    try {
      localStorage.removeItem(this.IMPORT_HISTORY_STORAGE_KEY);
      
      eventBus.emit('IMPORT_HISTORY_CLEARED', {
        timestamp: new Date().toISOString()
      }, 'ImportProcessingService');
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'clearImportHistory',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { operation: 'clear_history' }
      );
      throw error;
    }
  }

  /**
   * Export import history for backup
   */
  exportImportHistory(): string {
    const history = this.getImportHistory();
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      importHistory: history,
      statistics: this.getImportStatistics()
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import history from backup
   */
  importImportHistory(jsonData: string): { success: boolean; message: string; imported: number } {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.importHistory || !Array.isArray(data.importHistory)) {
        return { success: false, message: 'Invalid import history format', imported: 0 };
      }
      
      // Validate each history entry
      const validEntries = data.importHistory.filter((entry: any) => {
        return entry.accountId && entry.lastImportDate && 
               typeof entry.lastClosingBalance === 'number' &&
               typeof entry.lastImportTimestamp === 'number';
      });
      
      if (validEntries.length === 0) {
        return { success: false, message: 'No valid history entries found', imported: 0 };
      }
      
      // Backup current history
      const currentHistory = this.getImportHistory();
      const backupKey = `tms_import_history_backup_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(currentHistory));
      
      // Import new history
      localStorage.setItem(this.IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(validEntries));
      
      eventBus.emit('IMPORT_HISTORY_IMPORTED', {
        imported: validEntries.length,
        backupKey
      }, 'ImportProcessingService');
      
      return {
        success: true,
        message: `Successfully imported ${validEntries.length} history entries`,
        imported: validEntries.length
      };
      
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Import failed',
        imported: 0
      };
    }
  }

  // ======================
  // FILE STORAGE MANAGEMENT
  // ======================

  /**
   * Get all uploaded files
   */
  getAllUploadedFiles(): UploadedFile[] {
    return coreDataService.getAllFiles();
  }

  /**
   * Add a new uploaded file record
   */
  addUploadedFile(fileData: Omit<UploadedFile, 'id' | 'uploadDate'>): UploadedFile {
    const newFile = coreDataService.addFile(fileData);
    if (!newFile) {
      throw new Error('Failed to save file record');
    }

    eventBus.emit('FILE_UPLOADED', {
      fileId: newFile.id,
      fileName: newFile.fileName,
      accountId: fileData.accountId,
      transactionCount: fileData.transactionCount
    }, 'ImportProcessingService');

    return newFile;
  }

  /**
   * Delete an uploaded file record and its associated transactions with verification
   */
  deleteUploadedFile(fileId: string): { success: boolean; deletionReport: DeletionReport } {
    const deletionReport: DeletionReport = {
      fileId,
      fileName: '',
      expectedTransactionCount: 0,
      actualDeletedCount: 0,
      totalTransactionsBefore: 0,
      totalTransactionsAfter: 0,
      backupCreated: false,
      backupKey: '',
      isVerified: false,
      error: null
    };

    try {
      const files = this.getAllUploadedFiles();
      const fileToDelete = files.find(f => f.id === fileId);
      
      if (!fileToDelete) {
        deletionReport.error = 'File not found';
        return { success: false, deletionReport };
      }

      deletionReport.fileName = fileToDelete.fileName;
      deletionReport.expectedTransactionCount = fileToDelete.transactionCount;

      // Count total transactions before deletion
      const stats = coreDataService.getDataSummary();
      deletionReport.totalTransactionsBefore = stats.totalTransactions;

      // Create backup before deletion
      const backupResult = this.createFileBackup(fileToDelete);
      deletionReport.backupCreated = backupResult.success;
      deletionReport.backupKey = backupResult.backupKey;

      if (!backupResult.success) {
        deletionReport.error = 'Failed to create backup';
        return { success: false, deletionReport };
      }

      // Delete using core data service
      const success = coreDataService.deleteFile(fileId);
      
      if (!success) {
        deletionReport.error = 'Failed to delete file';
        return { success: false, deletionReport };
      }

      // Get updated stats
      const newStats = coreDataService.getDataSummary();
      deletionReport.totalTransactionsAfter = newStats.totalTransactions;
      deletionReport.actualDeletedCount = deletionReport.totalTransactionsBefore - deletionReport.totalTransactionsAfter;

      // Verify deletion was correct
      deletionReport.isVerified = (
        deletionReport.actualDeletedCount === deletionReport.expectedTransactionCount &&
        deletionReport.totalTransactionsAfter === (deletionReport.totalTransactionsBefore - deletionReport.expectedTransactionCount)
      );

      eventBus.emit('FILE_DELETED', {
        fileId,
        fileName: deletionReport.fileName,
        deletedTransactions: deletionReport.actualDeletedCount,
        backupKey: deletionReport.backupKey
      }, 'ImportProcessingService');

      return { success: true, deletionReport };
    } catch (error) {
      deletionReport.error = error instanceof Error ? error.message : 'Unknown error';
      
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'deleteUploadedFile',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { fileId, operation: 'file_deletion' }
      );
      
      return { success: false, deletionReport };
    }
  }

  /**
   * Get file by ID
   */
  getFileById(fileId: string): UploadedFile | null {
    const files = this.getAllUploadedFiles();
    return files.find(f => f.id === fileId) || null;
  }

  /**
   * Get files by account ID
   */
  getFilesByAccount(accountId: string): UploadedFile[] {
    const files = this.getAllUploadedFiles();
    return files.filter(f => f.accountId === accountId);
  }

  /**
   * Update transaction count for a file
   */
  updateTransactionCount(fileId: string, count: number): boolean {
    try {
      const file = this.getFileById(fileId);
      if (!file) {
        return false;
      }

      // Note: This functionality would need to be added to CoreDataService
      // For now, we'll use a workaround
      const files = this.getAllUploadedFiles();
      const updatedFiles = files.map(f => 
        f.id === fileId ? { ...f, transactionCount: count } : f
      );

      // This is a temporary workaround - should be handled by CoreDataService
      try {
        localStorage.setItem('tms_files', JSON.stringify(updatedFiles));
        return true;
      } catch (error) {
        console.error('Failed to update transaction count:', error);
        return false;
      }
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'updateTransactionCount',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { fileId, count }
      );
      return false;
    }
  }

  /**
   * Get total transaction count across all files
   */
  getTotalTransactionCount(): number {
    const stats = coreDataService.getDataSummary();
    return stats.totalTransactions;
  }

  /**
   * Create backup before file deletion
   */
  createFileBackup(file: UploadedFile): { success: boolean; backupKey: string } {
    try {
      const backupKey = `${this.BACKUP_KEY_PREFIX}${file.id}_${Date.now()}`;
      
      // Get all transactions for this file
      const transactions = coreDataService.getAllTransactions()
        .filter(t => t.fileId === file.id);

      const backupData: BackupData = {
        fileRecord: file,
        transactions,
        timestamp: new Date().toISOString(),
        accountBalance: coreDataService.getAllAccounts()
          .find(a => a.id === file.accountId)?.currentBalance
      };

      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // Clean old backups
      this.cleanOldBackups();
      
      return { success: true, backupKey };
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'createFileBackup',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { fileId: file.id, operation: 'backup_creation' }
      );
      return { success: false, backupKey: '' };
    }
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(backupKey: string): { success: boolean; restoredCount: number; error?: string } {
    try {
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        return { success: false, restoredCount: 0, error: 'Backup not found' };
      }

      const backup: BackupData = JSON.parse(backupData);
      
      // Restore file record
      const restoredFile = coreDataService.addFile(backup.fileRecord);
      if (!restoredFile) {
        return { success: false, restoredCount: 0, error: 'Failed to restore file record' };
      }

      // Restore transactions
      if (backup.transactions && backup.transactions.length > 0) {
        const success = coreDataService.addTransactions(backup.transactions);
        if (!success) {
          // Cleanup the file record if transaction restore failed
          coreDataService.deleteFile(restoredFile.id);
          return { success: false, restoredCount: 0, error: 'Failed to restore transactions' };
        }
      }

      eventBus.emit('FILE_RESTORED', {
        backupKey,
        fileId: restoredFile.id,
        fileName: restoredFile.fileName,
        restoredTransactions: backup.transactions.length
      }, 'ImportProcessingService');

      return { success: true, restoredCount: backup.transactions.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'restoreFromBackup',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { backupKey, operation: 'backup_restoration' }
      );
      
      return { success: false, restoredCount: 0, error: errorMessage };
    }
  }

  /**
   * Get all backup keys
   */
  getAllBackupKeys(): string[] {
    const keys: string[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.BACKUP_KEY_PREFIX)) {
          keys.push(key);
        }
      }
    } catch (error) {
      console.warn('Error getting backup keys:', error);
    }
    
    return keys.sort();
  }

  /**
   * Clean old backups to prevent storage bloat
   */
  cleanOldBackups(): number {
    const backupKeys = this.getAllBackupKeys();
    
    if (backupKeys.length <= this.MAX_BACKUPS) {
      return 0;
    }

    // Sort by timestamp (newest first) and remove old ones
    const sortedKeys = backupKeys.sort().reverse();
    const toDelete = sortedKeys.slice(this.MAX_BACKUPS);
    
    let deletedCount = 0;
    toDelete.forEach(key => {
      try {
        localStorage.removeItem(key);
        deletedCount++;
      } catch (error) {
        console.warn(`Failed to delete backup ${key}:`, error);
      }
    });

    if (deletedCount > 0) {
      eventBus.emit('BACKUPS_CLEANED', {
        deletedCount,
        remainingBackups: backupKeys.length - deletedCount
      }, 'ImportProcessingService');
    }

    return deletedCount;
  }

  /**
   * Clear all uploaded files (for testing/reset)
   */
  clearAllFiles(): void {
    try {
      const files = this.getAllUploadedFiles();
      const fileCount = files.length;
      
      files.forEach(file => {
        coreDataService.deleteFile(file.id);
      });

      eventBus.emit('ALL_FILES_CLEARED', {
        deletedCount: fileCount,
        timestamp: new Date().toISOString()
      }, 'ImportProcessingService');
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'clearAllFiles',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { operation: 'clear_all_files' }
      );
      throw error;
    }
  }

  /**
   * Get file storage statistics
   */
  getFileStorageStats(): { 
    totalFiles: number; 
    totalTransactions: number; 
    totalSize: number;
    backupCount: number;
    accountDistribution: Record<string, number>;
  } {
    const files = this.getAllUploadedFiles();
    const accounts = coreDataService.getAllAccounts();
    const stats = coreDataService.getDataSummary();
    
    // Calculate account distribution
    const accountDistribution: Record<string, number> = {};
    accounts.forEach(account => {
      const accountFiles = files.filter(f => f.accountId === account.id);
      accountDistribution[account.name] = accountFiles.length;
    });

    return {
      totalFiles: files.length,
      totalTransactions: stats.totalTransactions,
      totalSize: stats.storageUsed,
      backupCount: this.getAllBackupKeys().length,
      accountDistribution
    };
  }

  // ======================
  // PLACEHOLDER METHODS FOR NEXT MICRO-TASKS
  // ======================

  // TODO: Micro-Task 2.1.2.3 - CSV Processing Integration  
  // - parseCSV()
  // - validateCSVData()
  // - convertToTransactions()
  // - generateTemplate()
  // - processFile()

  // TODO: Micro-Task 2.1.2.4 - Service Orchestration
  // - processImportWorkflow()
  // - validateImportWorkflow()
  // - executeImportWithValidation()
}

// Export singleton instance
export const importProcessingService = new ImportProcessingService();
export default importProcessingService; 