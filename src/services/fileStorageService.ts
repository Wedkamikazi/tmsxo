// File Storage Service for local file system persistence
// This service handles reading and writing data to local JSON files

// Note: These would be used in a Node.js environment
// const fs = window.require ? window.require('fs') : null;
// const path = window.require ? window.require('path') : null;
// const os = window.require ? window.require('os') : null;

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
      // CRITICAL FIX: Use the unified transaction storage system with precise file ID matching
      const allTransactions = this.readData<any[]>('transactions', []);
      const originalCount = allTransactions.length;

      // Count transactions that will be deleted (for verification)
      const transactionsToDelete = allTransactions.filter((transaction: any) => {
        // Primary method: Use file ID if available (for new imports)
        if (transaction.fileId) {
          return transaction.fileId === file.id;
        }

        // Fallback method: Use date range for legacy transactions
        if (!transaction.importDate || transaction.accountId !== file.accountId) {
          return false;
        }

        const fileUploadDate = new Date(file.uploadDate);
        const startOfDay = new Date(fileUploadDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(fileUploadDate);
        endOfDay.setHours(23, 59, 59, 999);

        const importDate = new Date(transaction.importDate);
        return importDate >= startOfDay && importDate <= endOfDay;
      });

      // Filter out transactions that belong to this file
      const remainingTransactions = allTransactions.filter((transaction: any) => {
        // Primary method: Use file ID if available (for new imports)
        if (transaction.fileId) {
          return transaction.fileId !== file.id;
        }

        // Fallback method: Use date range for legacy transactions
        if (!transaction.importDate || transaction.accountId !== file.accountId) {
          return true;
        }

        const fileUploadDate = new Date(file.uploadDate);
        const startOfDay = new Date(fileUploadDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(fileUploadDate);
        endOfDay.setHours(23, 59, 59, 999);

        const importDate = new Date(transaction.importDate);
        return importDate < startOfDay || importDate > endOfDay;
      });

      // Save the filtered transactions back to the unified storage
      const success = this.writeData('transactions', remainingTransactions);

      if (!success) {
        console.error('❌ Failed to save transactions after deletion');
        return 0;
      }

      const deletedCount = originalCount - remainingTransactions.length;
      console.log(`✅ Successfully deleted ${deletedCount} transactions from file ${file.fileName}`);
      console.log(`📊 Transactions before: ${originalCount}, after: ${remainingTransactions.length}`);
      console.log(`🎯 Expected to delete: ${transactionsToDelete.length}, actually deleted: ${deletedCount}`);

      // ALSO clean up the old account-specific localStorage (for backward compatibility)
      const oldTransactionsKey = `treasury-transactions-${file.accountId}`;
      if (localStorage.getItem(oldTransactionsKey)) {
        localStorage.removeItem(oldTransactionsKey);
        console.log(`🧹 Cleaned up legacy storage: ${oldTransactionsKey}`);
      }

      return deletedCount;
    } catch (error) {
      console.error('❌ Error deleting transactions for file:', error);
      return 0;
    }
  }

  // Get total transaction count across all accounts
  getTotalTransactionCount(): number {
    try {
      let totalCount = 0;
      const files = this.getAllUploadedFiles();
      const accountIds = Array.from(new Set(files.map(f => f.accountId)));
      
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

      // FIXED: Get transactions from unified storage with precise file ID matching
      const allTransactions = this.readData<any[]>('transactions', []);

      // Filter transactions that belong to this file
      const fileTransactions = allTransactions.filter((transaction: any) => {
        // Primary method: Use file ID if available (for new imports)
        if (transaction.fileId) {
          return transaction.fileId === file.id;
        }

        // Fallback method: Use date range for legacy transactions
        if (!transaction.importDate || transaction.accountId !== file.accountId) {
          return false;
        }

        const fileUploadDate = new Date(file.uploadDate);
        const startOfDay = new Date(fileUploadDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(fileUploadDate);
        endOfDay.setHours(23, 59, 59, 999);

        const importDate = new Date(transaction.importDate);
        return importDate >= startOfDay && importDate <= endOfDay;
      });

      const backupData: BackupData = {
        fileRecord: file,
        transactions: fileTransactions,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(backupKey, JSON.stringify(backupData));

      console.log(`📦 Created backup for ${fileTransactions.length} transactions from file ${file.fileName}`);
      return { success: true, backupKey };
    } catch (error) {
      console.error('❌ Error creating backup:', error);
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

      // FIXED: Restore transactions to unified storage
      const existingTransactions = this.readData<any[]>('transactions', []);

      // Add backup transactions back (avoid duplicates)
      const backupTransactionIds = new Set(backup.transactions.map((t: any) => t.id));
      const filteredExisting = existingTransactions.filter((t: any) => !backupTransactionIds.has(t.id));
      const combinedTransactions = [...filteredExisting, ...backup.transactions];

      const success = this.writeData('transactions', combinedTransactions);

      if (!success) {
        return { success: false, restoredCount: 0, error: 'Failed to restore transactions to storage' };
      }

      // Clean up backup
      localStorage.removeItem(backupKey);

      console.log(`🔄 Restored ${backup.transactions.length} transactions from backup`);
      return { success: true, restoredCount: backup.transactions.length };
    } catch (error) {
      console.error('❌ Error restoring from backup:', error);
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

  // Generic data reading method
  readData<T>(filename: string, defaultValue: T): T {
    try {
      const key = `treasury-${filename}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.error(`Error reading data from ${filename}:`, error);
      return defaultValue;
    }
  }

  // Generic data writing method
  writeData(filename: string, data: any): boolean {
    try {
      const key = `treasury-${filename}`;
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error writing data to ${filename}:`, error);
      return false;
    }
  }

  // Get data directory (for display purposes)
  getDataDirectory(): string {
    return 'Browser Local Storage';
  }

  // List available data files
  listDataFiles(): string[] {
    const files: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('treasury-')) {
        files.push(key.replace('treasury-', ''));
      }
    }
    return files;
  }

  // Backup data to a specific path (simplified for browser)
  backupData(_backupPath: string): boolean {
    try {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('treasury-')) {
          data[key] = localStorage.getItem(key);
        }
      }
      
      // In a browser environment, we can't write to arbitrary paths
      // So we'll store it as another localStorage item
      const backupKey = `treasury-backup-${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(data));
      console.log(`Backup created with key: ${backupKey}`);
      return true;
    } catch (error) {
      console.error('Error creating backup:', error);
      return false;
    }
  }
}

export const fileStorageService = new FileStorageService(); 