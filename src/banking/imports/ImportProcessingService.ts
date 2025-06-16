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

import { coreDataService } from '../../data/storage/CoreDataService';
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

export interface ValidationResult {
  isValid: boolean;
  rowsProcessed: number;
  errors: string[];
  warnings: string[];
  invalidRows: number[];
}

export interface ProcessedRow {
  rowIndex: number;
  date: string;
  description: string;
  amount: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
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
  // CSV PROCESSING
  // ======================

  /**
   * Parse CSV content into rows
   */
  parseCSV(csvContent: string): string[][] {
    try {
      const rows: string[][] = [];
      const lines = csvContent.split('\n');
      
      let currentRow: string[] = [];
      let inQuotes = false;
      let currentField = '';
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        
        if (!inQuotes) {
          // End of row
          currentRow.push(currentField.trim());
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          // Multi-line field, add newline
          currentField += '\n';
        }
      }
      
      // Handle any remaining row
      if (currentRow.length > 0 || currentField !== '') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
      }
      
      return rows;
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'parseCSV',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { contentLength: csvContent.length }
      );
      throw new Error('Failed to parse CSV content');
    }
  }

  /**
   * Validate CSV data structure
   */
  validateCSVData(rows: string[][]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      rowsProcessed: 0,
      errors: [],
      warnings: [],
      invalidRows: []
    };

    if (rows.length === 0) {
      result.isValid = false;
      result.errors.push('CSV file is empty');
      return result;
    }

    // Check header row
    const header = rows[0];
    const requiredColumns = ['date', 'description', 'amount'];
    const normalizedHeader = header.map(h => h.toLowerCase().trim());
    
    const missingColumns = requiredColumns.filter(col => 
      !normalizedHeader.some(h => h.includes(col))
    );
    
    if (missingColumns.length > 0) {
      result.errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
      result.isValid = false;
    }

    // Find column indices
    const dateIndex = normalizedHeader.findIndex(h => h.includes('date'));
    const descIndex = normalizedHeader.findIndex(h => h.includes('description'));
    const amountIndex = normalizedHeader.findIndex(h => h.includes('amount'));

    if (result.isValid) {
      // Validate data rows
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        result.rowsProcessed++;
        
        if (row.length < header.length) {
          result.warnings.push(`Row ${i + 1}: Insufficient columns`);
        }
        
        // Check date format
        if (dateIndex >= 0 && row[dateIndex]) {
          const dateStr = row[dateIndex].trim();
          const parsedDate = new Date(dateStr);
          if (isNaN(parsedDate.getTime())) {
            result.errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
            result.invalidRows.push(i);
            result.isValid = false;
          }
        }
        
        // Check description
        if (descIndex >= 0 && (!row[descIndex] || row[descIndex].trim() === '')) {
          result.warnings.push(`Row ${i + 1}: Empty description`);
        }
        
        // Check amount
        if (amountIndex >= 0 && row[amountIndex]) {
          const amountStr = row[amountIndex].trim().replace(/[,$]/g, '');
          const amount = parseFloat(amountStr);
          if (isNaN(amount)) {
            result.errors.push(`Row ${i + 1}: Invalid amount "${row[amountIndex]}"`);
            result.invalidRows.push(i);
            result.isValid = false;
          }
        }
      }
    }

    return result;
  }

  /**
   * Process individual CSV row into standardized format
   */
  processCSVRow(row: string[], header: string[], rowIndex: number): ProcessedRow {
    const normalizedHeader = header.map(h => h.toLowerCase().trim());
    
    const dateIndex = normalizedHeader.findIndex(h => h.includes('date'));
    const descIndex = normalizedHeader.findIndex(h => h.includes('description'));
    const amountIndex = normalizedHeader.findIndex(h => h.includes('amount'));
    
    const processed: ProcessedRow = {
      rowIndex,
      date: '',
      description: '',
      amount: 0,
      isValid: true,
      errors: [],
      warnings: []
    };

    // Process date
    if (dateIndex >= 0 && row[dateIndex]) {
      const dateStr = row[dateIndex].trim();
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        processed.errors.push(`Invalid date format: ${dateStr}`);
        processed.isValid = false;
      } else {
        processed.date = parsedDate.toISOString().split('T')[0];
      }
    } else {
      processed.errors.push('Missing date');
      processed.isValid = false;
    }

    // Process description
    if (descIndex >= 0 && row[descIndex]) {
      processed.description = row[descIndex].trim();
      if (processed.description === '') {
        processed.warnings.push('Empty description');
      }
    } else {
      processed.warnings.push('Missing description');
      processed.description = 'Unknown Transaction';
    }

    // Process amount
    if (amountIndex >= 0 && row[amountIndex]) {
      const amountStr = row[amountIndex].trim().replace(/[,$]/g, '');
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) {
        processed.errors.push(`Invalid amount: ${row[amountIndex]}`);
        processed.isValid = false;
      } else {
        processed.amount = amount;
      }
    } else {
      processed.errors.push('Missing amount');
      processed.isValid = false;
    }

    return processed;
  }

  /**
   * Convert processed CSV data to transactions
   */
  convertToTransactions(rows: string[][], accountId: string, fileId: string): any[] {
    if (rows.length === 0) return [];
    
    const header = rows[0];
    const transactions: any[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const processedRow = this.processCSVRow(rows[i], header, i);
      
      if (processedRow.isValid) {
        const transaction = {
          id: `${fileId}_${i}_${Date.now()}`,
          accountId,
          fileId,
          date: processedRow.date,
          description: processedRow.description,
          debitAmount: processedRow.amount < 0 ? Math.abs(processedRow.amount) : 0,
          creditAmount: processedRow.amount > 0 ? processedRow.amount : 0,
          balance: 0, // Will be calculated later
          category: 'Uncategorized',
          rawAmount: processedRow.amount,
          isProcessed: false,
          rowIndex: processedRow.rowIndex
        };
        
        transactions.push(transaction);
      }
    }
    
    return transactions;
  }

  /**
   * Generate CSV template for import
   */
  generateCSVTemplate(): string {
    const template = [
      ['Date', 'Description', 'Amount', 'Category'],
      ['2024-01-01', 'Sample Transaction', '-50.00', 'Office Supplies'],
      ['2024-01-02', 'Income Payment', '1000.00', 'Revenue'],
      ['2024-01-03', 'Bank Fee', '-5.00', 'Bank Fees']
    ];
    
    return template.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  }

  /**
   * Process uploaded file end-to-end
   */
  async processFile(
    csvContent: string, 
    fileName: string, 
    accountId: string
  ): Promise<{
    success: boolean;
    fileId?: string;
    transactionCount: number;
    validationResult: ValidationResult;
    error?: string;
  }> {
    try {
      // Step 1: Parse CSV
      const rows = this.parseCSV(csvContent);
      
      // Step 2: Validate data
      const validationResult = this.validateCSVData(rows);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          transactionCount: 0,
          validationResult,
          error: `Validation failed: ${validationResult.errors.join(', ')}`
        };
      }
      
      // Step 3: Create file record
      const fileRecord = this.addUploadedFile({
        fileName,
        accountId,
        accountName: coreDataService.getAllAccounts().find(a => a.id === accountId)?.name || 'Unknown',
        transactionCount: validationResult.rowsProcessed,
        fileSize: csvContent.length,
        checksum: this.generateChecksum(csvContent)
      });
      
      // Step 4: Convert to transactions
      const transactions = this.convertToTransactions(rows, accountId, fileRecord.id);
      
      // Step 5: Save transactions
      if (transactions.length > 0) {
        const saveSuccess = coreDataService.addTransactions(transactions);
        if (!saveSuccess) {
          // Cleanup file record on failure
          coreDataService.deleteFile(fileRecord.id);
          return {
            success: false,
            transactionCount: 0,
            validationResult,
            error: 'Failed to save transactions'
          };
        }
      }
      
      // Step 6: Update import history
      const lastTransaction = transactions[transactions.length - 1];
      if (lastTransaction) {
        const closingBalance = coreDataService.getAllAccounts()
          .find(a => a.id === accountId)?.currentBalance || 0;
        
        this.updateImportHistory(accountId, lastTransaction.date, closingBalance);
      }
      
      return {
        success: true,
        fileId: fileRecord.id,
        transactionCount: transactions.length,
        validationResult
      };
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'processFile',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { fileName, accountId, contentLength: csvContent.length }
      );
      
      return {
        success: false,
        transactionCount: 0,
        validationResult: {
          isValid: false,
          rowsProcessed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          invalidRows: []
        },
        error: error instanceof Error ? error.message : 'Processing failed'
      };
    }
  }

  /**
   * Generate simple checksum for file content
   */
  private generateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate import workflow before processing
   */
  validateImportWorkflow(
    csvContent: string, 
    fileName: string, 
    accountId: string
  ): {
    canProceed: boolean;
    issues: string[];
    warnings: string[];
    historyValidation: ImportHistoryValidation;
    csvValidation: ValidationResult;
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check account exists
    const account = coreDataService.getAllAccounts().find(a => a.id === accountId);
    if (!account) {
      issues.push('Account not found');
    }
    
    // Check file name
    if (!fileName || fileName.trim() === '') {
      issues.push('File name is required');
    }
    
    // Check CSV content
    if (!csvContent || csvContent.trim() === '') {
      issues.push('CSV content is empty');
    }
    
    // Parse and validate CSV
    let csvValidation: ValidationResult = {
      isValid: false,
      rowsProcessed: 0,
      errors: ['Content validation not performed'],
      warnings: [],
      invalidRows: []
    };
    
    try {
      if (csvContent && csvContent.trim() !== '') {
        const rows = this.parseCSV(csvContent);
        csvValidation = this.validateCSVData(rows);
        
        if (!csvValidation.isValid) {
          issues.push(...csvValidation.errors);
        }
        warnings.push(...csvValidation.warnings);
      }
    } catch (error) {
      issues.push('Failed to parse CSV content');
    }
    
    // Validate import history (using current date as placeholder)
    const today = new Date().toISOString().split('T')[0];
    const historyValidation = this.validateImportHistory(accountId, today);
    
    if (!historyValidation.isValid) {
      warnings.push(...historyValidation.issues);
    }
    
    return {
      canProceed: issues.length === 0,
      issues,
      warnings,
      historyValidation,
      csvValidation
    };
  }

  // ======================
  // SERVICE ORCHESTRATION
  // ======================

  /**
   * Execute complete import workflow with comprehensive validation
   */
  async executeImportWithValidation(
    csvContent: string, 
    fileName: string, 
    accountId: string
  ): Promise<{
    success: boolean;
    fileId?: string;
    transactionCount: number;
    backupKey?: string;
    validation: {
      canProceed: boolean;
      issues: string[];
      warnings: string[];
      historyValidation: ImportHistoryValidation;
      csvValidation: ValidationResult;
    };
    processing?: {
      success: boolean;
      fileId?: string;
      transactionCount: number;
      validationResult: ValidationResult;
      error?: string;
    };
    error?: string;
  }> {
    try {
      // Step 1: Comprehensive pre-validation
      const validation = this.validateImportWorkflow(csvContent, fileName, accountId);
      
      if (!validation.canProceed) {
        return {
          success: false,
          transactionCount: 0,
          validation,
          error: `Validation failed: ${validation.issues.join(', ')}`
        };
      }
      
      // Step 2: Create backup before processing
      const account = coreDataService.getAllAccounts().find(a => a.id === accountId);
      let backupKey = '';
      
      if (account) {
        const currentFiles = this.getFilesByAccount(accountId);
        if (currentFiles.length > 0) {
          // Create backup of current state
          const backupData = {
            files: currentFiles,
            transactions: coreDataService.getAllTransactions().filter(t => t.accountId === accountId),
            account: account,
            timestamp: new Date().toISOString()
          };
          
          backupKey = `${this.BACKUP_KEY_PREFIX}preimport_${accountId}_${Date.now()}`;
          localStorage.setItem(backupKey, JSON.stringify(backupData));
        }
      }
      
      // Step 3: Process the file
      const processing = await this.processFile(csvContent, fileName, accountId);
      
      if (!processing.success) {
        return {
          success: false,
          transactionCount: 0,
          validation,
          processing,
          backupKey: backupKey || undefined,
          error: processing.error
        };
      }
      
      // Step 4: Final verification
      const finalValidation = this.validateImportWorkflow(csvContent, fileName, accountId);
      
      return {
        success: true,
        fileId: processing.fileId,
        transactionCount: processing.transactionCount,
        validation: finalValidation,
        processing,
        backupKey: backupKey || undefined
      };
      
    } catch (error) {
      systemIntegrityService.logServiceError(
        'ImportProcessingService',
        'executeImportWithValidation',
        error instanceof Error ? error : new Error(String(error)),
        'critical',
        { fileName, accountId, operation: 'complete_import_workflow' }
      );
      
      return {
        success: false,
        transactionCount: 0,
        validation: this.validateImportWorkflow(csvContent, fileName, accountId),
        error: error instanceof Error ? error.message : 'Import workflow failed'
      };
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Get service health status
   */
  getServiceHealth(): {
    status: 'healthy' | 'warning' | 'error';
    components: {
      importHistory: boolean;
      fileStorage: boolean;
      csvProcessing: boolean;
    };
    statistics: {
      totalFiles: number;
      totalTransactions: number;
      totalBackups: number;
      importHistoryEntries: number;
    };
  } {
    try {
      const fileStats = this.getFileStorageStats();
      const importStats = this.getImportStatistics();
      
      const components = {
        importHistory: true,
        fileStorage: true,
        csvProcessing: true
      };
      
      // Test each component
      try {
        this.getImportHistory();
      } catch {
        components.importHistory = false;
      }
      
      try {
        this.getAllUploadedFiles();
      } catch {
        components.fileStorage = false;
      }
      
      try {
        this.generateCSVTemplate();
      } catch {
        components.csvProcessing = false;
      }
      
      const healthyComponents = Object.values(components).filter(Boolean).length;
      const status = healthyComponents === 3 ? 'healthy' : 
                    healthyComponents === 2 ? 'warning' : 'error';
      
      return {
        status,
        components,
        statistics: {
          totalFiles: fileStats.totalFiles,
          totalTransactions: fileStats.totalTransactions,
          totalBackups: fileStats.backupCount,
          importHistoryEntries: importStats.accountsWithHistory
        }
      };
    } catch (error) {
      return {
        status: 'error',
        components: {
          importHistory: false,
          fileStorage: false,
          csvProcessing: false
        },
        statistics: {
          totalFiles: 0,
          totalTransactions: 0,
          totalBackups: 0,
          importHistoryEntries: 0
        }
      };
    }
  }
}

// Export singleton instance
export const importProcessingService = new ImportProcessingService();
export default importProcessingService; 