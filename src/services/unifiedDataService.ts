import { Transaction, BankAccount, UploadedFile } from '../types';
import { eventBus } from './eventBus';

// UNIFIED DATA SERVICE - SINGLE SOURCE OF TRUTH
// Coordinates all data operations across the application

// Enhanced interfaces for rollback functionality
export interface DataSnapshot {
  timestamp: string;
  transactions: StoredTransaction[];
  files: UploadedFile[];
  accounts: BankAccount[];
  operationType: 'import' | 'delete' | 'update' | 'cleanup';
  operationId: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
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

export interface StoredTransaction extends Transaction {
  accountId: string;
  importDate: string;
  fileId?: string;
  postDateTime: string;
}

export interface DataSummary {
  totalTransactions: number;
  totalFiles: number;
  totalAccounts: number;
  storageUsed: number;
  lastUpdated: string;
}

class UnifiedDataService {
  private readonly TRANSACTIONS_KEY = 'treasury-data-transactions';
  private readonly FILES_KEY = 'treasury-data-files';
  private readonly ACCOUNTS_KEY = 'treasury-data-accounts';
  private readonly METADATA_KEY = 'treasury-data-metadata';

  // TRANSACTION OPERATIONS
  getAllTransactions(): StoredTransaction[] {
    try {
      const stored = localStorage.getItem(this.TRANSACTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  }

  getTransactionsByAccount(accountId: string): StoredTransaction[] {
    return this.getAllTransactions()
      .filter(t => t.accountId === accountId)
      .sort((a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime());
  }

  addTransactions(transactions: StoredTransaction[]): boolean {
    try {
      const existing = this.getAllTransactions();
      const existingIds = new Set(existing.map(t => t.id));
      
      // Add only new transactions
      const newTransactions = transactions.filter(t => !existingIds.has(t.id));
      const updated = [...existing, ...newTransactions];
      
      localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(updated));
      this.updateMetadata();
      
      // Emit event for UI updates
      eventBus.emit('TRANSACTIONS_UPDATED', { count: newTransactions.length }, 'UnifiedDataService');
      
      return true;
    } catch (error) {
      console.error('Error adding transactions:', error);
      return false;
    }
  }

  deleteTransactionsByFile(fileId: string): number {
    try {
      const all = this.getAllTransactions();
      const remaining = all.filter(t => t.fileId !== fileId);
      const deletedCount = all.length - remaining.length;
      
      localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(remaining));
      this.updateMetadata();
      
      // Emit event for UI updates
      eventBus.emit('TRANSACTIONS_UPDATED', { deletedCount }, 'UnifiedDataService');
      
      return deletedCount;
    } catch (error) {
      console.error('Error deleting transactions by file:', error);
      return 0;
    }
  }

  // FILE OPERATIONS
  getAllFiles(): UploadedFile[] {
    try {
      const stored = localStorage.getItem(this.FILES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading files:', error);
      return [];
    }
  }

  addFile(file: Omit<UploadedFile, 'id' | 'uploadDate'>): UploadedFile {
    const newFile: UploadedFile = {
      ...file,
      id: this.generateId('file'),
      uploadDate: new Date().toISOString()
    };

    const files = this.getAllFiles();
    files.push(newFile);
    
    localStorage.setItem(this.FILES_KEY, JSON.stringify(files));
    this.updateMetadata();
    
    // Emit event for UI updates
    eventBus.emit('FILE_UPLOADED', { fileId: newFile.id, fileName: newFile.fileName }, 'UnifiedDataService');
    
    return newFile;
  }

  deleteFile(fileId: string): boolean {
    try {
      const files = this.getAllFiles();
      const filtered = files.filter(f => f.id !== fileId);
      
      if (filtered.length < files.length) {
        localStorage.setItem(this.FILES_KEY, JSON.stringify(filtered));
        this.updateMetadata();
        
        // Emit event for UI updates
        eventBus.emit('FILE_DELETED', { fileId }, 'UnifiedDataService');
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // ACCOUNT OPERATIONS
  getAllAccounts(): BankAccount[] {
    try {
      const stored = localStorage.getItem(this.ACCOUNTS_KEY);
      return stored ? JSON.parse(stored) : this.getDefaultAccounts();
    } catch (error) {
      console.error('Error loading accounts:', error);
      return this.getDefaultAccounts();
    }
  }

  addAccount(account: Omit<BankAccount, 'id'>): BankAccount {
    const newAccount: BankAccount = {
      ...account,
      id: this.generateId('acc')
    };

    const accounts = this.getAllAccounts();
    accounts.push(newAccount);
    
    localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
    this.updateMetadata();
    
    // Emit event for UI updates
    eventBus.emit('ACCOUNT_UPDATED', { accountId: newAccount.id, action: 'created' }, 'UnifiedDataService');
    
    return newAccount;
  }

  updateAccount(accountId: string, updates: Partial<BankAccount>): boolean {
    try {
      const accounts = this.getAllAccounts();
      const index = accounts.findIndex(a => a.id === accountId);
      
      if (index !== -1) {
        accounts[index] = { ...accounts[index], ...updates };
        localStorage.setItem(this.ACCOUNTS_KEY, JSON.stringify(accounts));
        this.updateMetadata();
        
        // Emit event for UI updates
        eventBus.emit('ACCOUNT_UPDATED', { accountId, action: 'updated' }, 'UnifiedDataService');
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating account:', error);
      return false;
    }
  }

  // DATA INTEGRITY OPERATIONS
  validateDataIntegrity(): {
    isValid: boolean;
    issues: string[];
    totalTransactions: number;
    totalFiles: number;
    orphanedTransactions: number;
    orphanedFiles: number;
  } {
    const transactions = this.getAllTransactions();
    const files = this.getAllFiles();
    const accounts = this.getAllAccounts();
    
    const issues: string[] = [];
    const fileIds = new Set(files.map(f => f.id));
    const accountIds = new Set(accounts.map(a => a.id));
    
    // Check for orphaned transactions
    const orphanedTransactions = transactions.filter(t => 
      (t.fileId && !fileIds.has(t.fileId)) || !accountIds.has(t.accountId)
    );
    
    // Check for files with no transactions
    const transactionFileIds = new Set(transactions.filter(t => t.fileId).map(t => t.fileId!));
    const orphanedFiles = files.filter(f => !transactionFileIds.has(f.id));
    
    if (orphanedTransactions.length > 0) {
      issues.push(`${orphanedTransactions.length} transactions reference missing files/accounts`);
    }
    
    if (orphanedFiles.length > 0) {
      issues.push(`${orphanedFiles.length} files have no associated transactions`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      totalTransactions: transactions.length,
      totalFiles: files.length,
      orphanedTransactions: orphanedTransactions.length,
      orphanedFiles: orphanedFiles.length
    };
  }

  cleanupOrphanedData(): { deletedTransactions: number; deletedFiles: number } {
    const transactions = this.getAllTransactions();
    const files = this.getAllFiles();
    const accounts = this.getAllAccounts();
    
    const fileIds = new Set(files.map(f => f.id));
    const accountIds = new Set(accounts.map(a => a.id));
    
    // Remove orphaned transactions
    const validTransactions = transactions.filter(t => 
      (!t.fileId || fileIds.has(t.fileId)) && accountIds.has(t.accountId)
    );
    
    // Remove orphaned files
    const transactionFileIds = new Set(validTransactions.filter(t => t.fileId).map(t => t.fileId!));
    const validFiles = files.filter(f => transactionFileIds.has(f.id));
    
    const deletedTransactions = transactions.length - validTransactions.length;
    const deletedFiles = files.length - validFiles.length;
    
    if (deletedTransactions > 0 || deletedFiles > 0) {
      localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(validTransactions));
      localStorage.setItem(this.FILES_KEY, JSON.stringify(validFiles));
      this.updateMetadata();
    }
    
    return { deletedTransactions, deletedFiles };
  }

  // MIGRATION FROM LEGACY STORAGE
  migrateLegacyData(): { migratedTransactions: number; migratedFiles: number } {
    let migratedTransactions = 0;
    let migratedFiles = 0;
    
    // Migrate legacy transaction keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('treasury-transactions-') && key !== this.TRANSACTIONS_KEY) {
        try {
          const legacyData = localStorage.getItem(key);
          if (legacyData) {
            const legacyTransactions: StoredTransaction[] = JSON.parse(legacyData);
            this.addTransactions(legacyTransactions);
            migratedTransactions += legacyTransactions.length;
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.error(`Error migrating ${key}:`, error);
        }
      }
    }
    
    // Migrate legacy file keys
    const legacyFileKey = 'treasury-uploaded-files';
    const legacyFileData = localStorage.getItem(legacyFileKey);
    if (legacyFileData && legacyFileKey !== this.FILES_KEY) {
      try {
        const legacyFiles: UploadedFile[] = JSON.parse(legacyFileData);
        const currentFiles = this.getAllFiles();
        const currentFileIds = new Set(currentFiles.map(f => f.id));
        
        const newFiles = legacyFiles.filter(f => !currentFileIds.has(f.id));
        if (newFiles.length > 0) {
          localStorage.setItem(this.FILES_KEY, JSON.stringify([...currentFiles, ...newFiles]));
          migratedFiles += newFiles.length;
        }
        
        localStorage.removeItem(legacyFileKey);
      } catch (error) {
        console.error('Error migrating legacy files:', error);
      }
    }
    
    if (migratedTransactions > 0 || migratedFiles > 0) {
      this.updateMetadata();
    }
    
    return { migratedTransactions, migratedFiles };
  }

  // UTILITY METHODS
  getDataSummary(): DataSummary {
    const transactions = this.getAllTransactions();
    const files = this.getAllFiles();
    const accounts = this.getAllAccounts();
    
    const storageUsedBytes = 
      (localStorage.getItem(this.TRANSACTIONS_KEY)?.length || 0) +
      (localStorage.getItem(this.FILES_KEY)?.length || 0) +
      (localStorage.getItem(this.ACCOUNTS_KEY)?.length || 0);
    
    return {
      totalTransactions: transactions.length,
      totalFiles: files.length,
      totalAccounts: accounts.length,
      storageUsed: Math.round(storageUsedBytes / 1024), // KB
      lastUpdated: new Date().toISOString()
    };
  }

  clearAllData(): void {
    localStorage.removeItem(this.TRANSACTIONS_KEY);
    localStorage.removeItem(this.FILES_KEY);
    localStorage.removeItem(this.ACCOUNTS_KEY);
    localStorage.removeItem(this.METADATA_KEY);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetadata(): void {
    const metadata = {
      lastUpdated: new Date().toISOString(),
      version: '1.0.0'
    };
    localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
  }

  private getDefaultAccounts(): BankAccount[] {
    // Production system starts with empty account list
    // Users must create accounts manually
    return [];
  }

  private createPostDateTime(postDate: string, time: string): string {
    const dateParts = postDate.split('/');
    if (dateParts.length === 3) {
      const formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
      
      let timeString = '00:00:00';
      if (time && time.trim()) {
        const cleanTime = time.trim();
        if (cleanTime.includes(':')) {
          timeString = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
        } else if (cleanTime.length === 4) {
          timeString = `${cleanTime.substring(0, 2)}:${cleanTime.substring(2)}:00`;
        }
      }
      
      return `${formattedDate}T${timeString}`;
    }
    
    return new Date().toISOString();
  }
}

export const unifiedDataService = new UnifiedDataService(); 