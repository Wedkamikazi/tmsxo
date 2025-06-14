// BROWSER-ONLY FILE STORAGE SERVICE
// Handles local storage operations without Node.js dependencies

import { localStorageManager } from './localStorageManager';

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

/**
 * BROWSER-COMPATIBLE FILE STORAGE SERVICE
 * Pure localStorage implementation without Node.js dependencies
 */
class FileStorageService {
  private readonly BACKUP_KEY_PREFIX = 'tms_backup_';
  private readonly MAX_BACKUPS = 10;

  // Get all uploaded files
  getAllUploadedFiles(): UploadedFile[] {
    return localStorageManager.getAllFiles();
  }

  // Add a new uploaded file record
  addUploadedFile(fileData: Omit<UploadedFile, 'id' | 'uploadDate'>): UploadedFile {
    const newFile = localStorageManager.addFile(fileData);
    if (!newFile) {
      throw new Error('Failed to save file record');
    }
    return newFile;
  }

  // Delete an uploaded file record and its associated transactions with verification
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
      const stats = localStorageManager.getStorageStats();
      deletionReport.totalTransactionsBefore = stats.itemCounts.transactions;

      // Create backup before deletion
      const backupResult = this.createBackup(fileToDelete);
      deletionReport.backupCreated = backupResult.success;
      deletionReport.backupKey = backupResult.backupKey;

      if (!backupResult.success) {
        deletionReport.error = 'Failed to create backup';
        return { success: false, deletionReport };
      }

      // Delete using unified storage manager
      const success = localStorageManager.deleteFile(fileId);
      
      if (!success) {
        deletionReport.error = 'Failed to delete file';
        return { success: false, deletionReport };
      }

      // Get updated stats
      const newStats = localStorageManager.getStorageStats();
      deletionReport.totalTransactionsAfter = newStats.itemCounts.transactions;
      deletionReport.actualDeletedCount = deletionReport.totalTransactionsBefore - deletionReport.totalTransactionsAfter;

      // Verify deletion was correct
      deletionReport.isVerified = (
        deletionReport.actualDeletedCount === deletionReport.expectedTransactionCount &&
        deletionReport.totalTransactionsAfter === (deletionReport.totalTransactionsBefore - deletionReport.expectedTransactionCount)
      );

      return { success: true, deletionReport };
    } catch (error) {
      deletionReport.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting uploaded file:', error);
      return { success: false, deletionReport };
    }
  }

  // Get file by ID
  getFileById(fileId: string): UploadedFile | null {
    const files = this.getAllUploadedFiles();
    return files.find(f => f.id === fileId) || null;
  }

  // Get files by account ID
  getFilesByAccount(accountId: string): UploadedFile[] {
    const files = this.getAllUploadedFiles();
    return files.filter(f => f.accountId === accountId);
  }

  // Update transaction count for a file
  updateTransactionCount(fileId: string, count: number): void {
    const files = this.getAllUploadedFiles();
    const file = files.find(f => f.id === fileId);
    
    if (file) {
      const updatedFile = { ...file, transactionCount: count };
      // This would require an update method in localStorageManager
      // For now, we'll recreate the file list
      const updatedFiles = files.map(f => f.id === fileId ? updatedFile : f);
      // Note: This is a temporary solution - should be handled by localStorageManager
      localStorage.setItem('tms_files', JSON.stringify(updatedFiles));
    }
  }

  // Get total transaction count across all accounts
  getTotalTransactionCount(): number {
    const stats = localStorageManager.getStorageStats();
    return stats.itemCounts.transactions;
  }

  // Create backup before deletion
  createBackup(file: UploadedFile): { success: boolean; backupKey: string } {
    try {
      const backupKey = `${this.BACKUP_KEY_PREFIX}${file.id}_${Date.now()}`;
      
      // Get all transactions for this file
      const transactions = localStorageManager.getAllTransactions()
        .filter(t => t.fileId === file.id);

      const backupData: BackupData = {
        fileRecord: file,
        transactions,
        timestamp: new Date().toISOString(),
        accountBalance: localStorageManager.getAllAccounts()
          .find(a => a.id === file.accountId)?.currentBalance
      };

      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
      // Clean old backups
      this.cleanOldBackups();
      
      return { success: true, backupKey };
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, backupKey: '' };
    }
  }

  // Restore from backup
  restoreFromBackup(backupKey: string): { success: boolean; restoredCount: number; error?: string } {
    try {
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        return { success: false, restoredCount: 0, error: 'Backup not found' };
      }

      const backup: BackupData = JSON.parse(backupData);
      
      // Restore file record
      const restoredFile = localStorageManager.addFile(backup.fileRecord);
      if (!restoredFile) {
        return { success: false, restoredCount: 0, error: 'Failed to restore file record' };
      }

      // Restore transactions
      const transactionsToRestore = backup.transactions.map(t => ({
        ...t,
        fileId: restoredFile.id // Update to new file ID if different
      }));
      
      const success = localStorageManager.addTransactions(transactionsToRestore);
      if (!success) {
        return { success: false, restoredCount: 0, error: 'Failed to restore transactions' };
      }

      // Clean up backup
      localStorage.removeItem(backupKey);

      return { success: true, restoredCount: backup.transactions.length };
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return { success: false, restoredCount: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get all backup keys
  getAllBackupKeys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.BACKUP_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    return keys.sort();
  }

  // Clean old backups (older than 7 days)
  cleanOldBackups(): number {
    try {
      const backupKeys = this.getAllBackupKeys();
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

      // Keep only the most recent backups
      if (backupKeys.length > this.MAX_BACKUPS) {
        const toDelete = backupKeys.slice(0, backupKeys.length - this.MAX_BACKUPS);
        toDelete.forEach(key => {
          localStorage.removeItem(key);
          cleanedCount++;
        });
      }

      // Also clean by age
      backupKeys.forEach(key => {
        try {
          const backupData = localStorage.getItem(key);
          if (backupData) {
            const backup: BackupData = JSON.parse(backupData);
            const backupTime = new Date(backup.timestamp).getTime();
            
            if (backupTime < sevenDaysAgo) {
              localStorage.removeItem(key);
              cleanedCount++;
            }
          }
        } catch (error) {
          // If backup is corrupted, remove it
          localStorage.removeItem(key);
          cleanedCount++;
        }
      });

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning old backups:', error);
      return 0;
    }
  }

  // Clear all uploaded files (for testing/reset purposes)
  clearAllFiles(): void {
    localStorageManager.clearAllData();
  }

  // Get storage statistics
  getStorageStats(): { totalFiles: number; totalTransactions: number; totalSize: number } {
    const stats = localStorageManager.getStorageStats();
    return {
      totalFiles: stats.itemCounts.files,
      totalTransactions: stats.itemCounts.transactions,
      totalSize: stats.totalSize
    };
  }

  // Browser-compatible data operations
  readData<T>(filename: string, defaultValue: T): T {
    try {
      const key = `tms_data_${filename}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Error reading data for ${filename}:`, error);
      return defaultValue;
    }
  }

  writeData<T>(filename: string, data: T): boolean {
    try {
      const key = `tms_data_${filename}`;
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error writing data for ${filename}:`, error);
      return false;
    }
  }

  getDataDirectory(): string {
    return 'localStorage://tms/';
  }
}

export const fileStorageService = new FileStorageService(); 