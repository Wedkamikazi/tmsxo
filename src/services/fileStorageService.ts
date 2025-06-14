// File Storage Service for local file system persistence
// This service handles reading and writing data to local JSON files

const fs = window.require ? window.require('fs') : null;
const path = window.require ? window.require('path') : null;
const os = window.require ? window.require('os') : null;

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

class FileStorageService {
  private readonly STORAGE_KEY = 'treasury-uploaded-files';

  // Get all uploaded files
  getAllUploadedFiles(): UploadedFile[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading uploaded files:', error);
      return [];
    }
  }

  // Add a new uploaded file record
  addUploadedFile(fileData: Omit<UploadedFile, 'id' | 'uploadDate'>): UploadedFile {
    const newFile: UploadedFile = {
      ...fileData,
      id: this.generateFileId(),
      uploadDate: new Date().toISOString()
    };

    const files = this.getAllUploadedFiles();
    files.push(newFile);
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));
      return newFile;
    } catch (error) {
      console.error('Error saving uploaded file record:', error);
      throw new Error('Failed to save file record');
    }
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
      const fileIndex = files.findIndex(f => f.id === fileId);
      
      if (fileIndex === -1) {
        deletionReport.error = 'File not found';
        return { success: false, deletionReport };
      }

      const fileToDelete = files[fileIndex];
      deletionReport.fileName = fileToDelete.fileName;
      deletionReport.expectedTransactionCount = fileToDelete.transactionCount;

      // Count total transactions before deletion
      deletionReport.totalTransactionsBefore = this.getTotalTransactionCount();

      // Create backup before deletion
      const backupResult = this.createBackup(fileToDelete);
      deletionReport.backupCreated = backupResult.success;
      deletionReport.backupKey = backupResult.backupKey;

      if (!backupResult.success) {
        deletionReport.error = 'Failed to create backup';
        return { success: false, deletionReport };
      }

      // Delete transactions and get actual count deleted
      const deletedCount = this.deleteTransactionsByFile(fileToDelete);
      deletionReport.actualDeletedCount = deletedCount;

      // Remove the file record
      files.splice(fileIndex, 1);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));

      // Count total transactions after deletion
      deletionReport.totalTransactionsAfter = this.getTotalTransactionCount();

      // Verify deletion was correct
      const expectedTotalAfter = deletionReport.totalTransactionsBefore - deletionReport.expectedTransactionCount;
      deletionReport.isVerified = (
        deletionReport.actualDeletedCount === deletionReport.expectedTransactionCount &&
        deletionReport.totalTransactionsAfter === expectedTotalAfter
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
    const fileIndex = files.findIndex(f => f.id === fileId);
    
    if (fileIndex !== -1) {
      files[fileIndex].transactionCount = count;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));
    }
  }

  // Private helper methods
  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private deleteTransactionsByFile(file: UploadedFile): number {
    try {
      // Get all transactions for the account
      const transactionsKey = `treasury-transactions-${file.accountId}`;
      const stored = localStorage.getItem(transactionsKey);
      
      if (!stored) return 0;
      
      const transactions = JSON.parse(stored);
      const originalCount = transactions.length;
      
      // Filter out transactions that were imported from this file
      // We'll use the upload date to identify transactions from this file
      const fileUploadDate = new Date(file.uploadDate);
      const startOfDay = new Date(fileUploadDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(fileUploadDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const remainingTransactions = transactions.filter((transaction: any) => {
        if (!transaction.importDate) return true;
        
        const importDate = new Date(transaction.importDate);
        return importDate < startOfDay || importDate > endOfDay;
      });
      
      // Save the filtered transactions back
      localStorage.setItem(transactionsKey, JSON.stringify(remainingTransactions));
      
      const deletedCount = originalCount - remainingTransactions.length;
      console.log(`Deleted ${deletedCount} transactions from file ${file.fileName}`);
      return deletedCount;
    } catch (error) {
      console.error('Error deleting transactions for file:', error);
      return 0;
    }
  }

  // Get total transaction count across all accounts
  getTotalTransactionCount(): number {
    try {
      let totalCount = 0;
      const files = this.getAllUploadedFiles();
      const accountIds = [...new Set(files.map(f => f.accountId))];
      
      accountIds.forEach(accountId => {
        const transactionsKey = `treasury-transactions-${accountId}`;
        const stored = localStorage.getItem(transactionsKey);
        if (stored) {
          const transactions = JSON.parse(stored);
          totalCount += transactions.length;
        }
      });
      
      return totalCount;
    } catch (error) {
      console.error('Error counting total transactions:', error);
      return 0;
    }
  }

  // Create backup before deletion
  createBackup(file: UploadedFile): { success: boolean; backupKey: string } {
    try {
      const backupKey = `backup_${file.id}_${Date.now()}`;
      
      // Get transactions for this file
      const transactionsKey = `treasury-transactions-${file.accountId}`;
      const stored = localStorage.getItem(transactionsKey);
      const allTransactions = stored ? JSON.parse(stored) : [];
      
      // Filter transactions that belong to this file
      const fileUploadDate = new Date(file.uploadDate);
      const startOfDay = new Date(fileUploadDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(fileUploadDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const fileTransactions = allTransactions.filter((transaction: any) => {
        if (!transaction.importDate) return false;
        const importDate = new Date(transaction.importDate);
        return importDate >= startOfDay && importDate <= endOfDay;
      });

      const backupData: BackupData = {
        fileRecord: file,
        transactions: fileTransactions,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(backupKey, JSON.stringify(backupData));
      
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
      const files = this.getAllUploadedFiles();
      const existingIndex = files.findIndex(f => f.id === backup.fileRecord.id);
      
      if (existingIndex === -1) {
        files.push(backup.fileRecord);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(files));
      }

      // Restore transactions
      const transactionsKey = `treasury-transactions-${backup.fileRecord.accountId}`;
      const stored = localStorage.getItem(transactionsKey);
      const existingTransactions = stored ? JSON.parse(stored) : [];
      
      // Add backup transactions back
      const combinedTransactions = [...existingTransactions, ...backup.transactions];
      localStorage.setItem(transactionsKey, JSON.stringify(combinedTransactions));

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
      if (key && key.startsWith('backup_')) {
        keys.push(key);
      }
    }
    return keys;
  }

  // Clean old backups (older than 7 days)
  cleanOldBackups(): number {
    try {
      const backupKeys = this.getAllBackupKeys();
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      let cleanedCount = 0;

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
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Get storage statistics
  getStorageStats(): { totalFiles: number; totalTransactions: number; totalSize: number } {
    const files = this.getAllUploadedFiles();
    return {
      totalFiles: files.length,
      totalTransactions: files.reduce((sum, file) => sum + file.transactionCount, 0),
      totalSize: files.reduce((sum, file) => sum + file.fileSize, 0)
    };
  }
}

export const fileStorageService = new FileStorageService(); 