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
  // PLACEHOLDER METHODS FOR NEXT MICRO-TASKS
  // ======================

  // TODO: Micro-Task 2.1.2.2 - File Storage Integration
  // - getAllUploadedFiles()
  // - addUploadedFile()
  // - deleteUploadedFile()
  // - createBackup()
  // - restoreFromBackup()

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