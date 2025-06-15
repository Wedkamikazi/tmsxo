import { Transaction, BankAccount, UploadedFile, TransactionCategory, TransactionCategorization } from '../types';
import { performanceManager } from './performanceManager';

export interface StorageSnapshot {
  timestamp: string;
  transactions: StoredTransaction[];
  accounts: BankAccount[];
  files: UploadedFile[];
  categories: TransactionCategory[];
  categorizations: TransactionCategorization[];
}

export interface StoredTransaction extends Transaction {
  accountId: string;
  importDate: string;
  fileId?: string;
  postDateTime: string;
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

/**
 * UNIFIED LOCAL STORAGE MANAGER
 * Single source of truth for all data operations
 * Handles atomic operations, error recovery, and data integrity
 */
class LocalStorageManager {
  private readonly STORAGE_KEYS = {
    transactions: 'tms_transactions',
    accounts: 'tms_accounts', 
    files: 'tms_files',
    categories: 'tms_categories',
    categorizations: 'tms_categorizations',
    metadata: 'tms_metadata',
    snapshots: 'tms_snapshots'
  } as const;

  private readonly MAX_SNAPSHOTS = 5;
  private readonly STORAGE_VERSION = '2.0.0';

  // ATOMIC TRANSACTION OPERATIONS
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

  // TRANSACTION DATA OPERATIONS
  getAllTransactions(): StoredTransaction[] {
    return this.getStorageData(this.STORAGE_KEYS.transactions, []);
  }

  addTransactions(transactions: StoredTransaction[]): boolean {
    return this.executeTransaction(() => {
      const existing = this.getAllTransactions();
      const existingIds = new Set(existing.map(t => t.id));
      const newTransactions = transactions.filter(t => !existingIds.has(t.id));
      
      if (newTransactions.length === 0) return true;
      
      const updated = [...existing, ...newTransactions].sort(
        (a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime()
      );
      
      this.setStorageData(this.STORAGE_KEYS.transactions, updated);
      return true;
    }).success;
  }

  getTransactionsByAccount(accountId: string): StoredTransaction[] {
    return this.getAllTransactions().filter(t => t.accountId === accountId);
  }

  deleteTransactionsByFile(fileId: string): number {
    const result = this.executeTransaction(() => {
      const all = this.getAllTransactions();
      const remaining = all.filter(t => t.fileId !== fileId);
      const deletedCount = all.length - remaining.length;
      
      this.setStorageData(this.STORAGE_KEYS.transactions, remaining);
      return deletedCount;
    });
    
    return result.success ? result.result! : 0;
  }

  deleteTransactionsByAccount(accountId: string): number {
    const result = this.executeTransaction(() => {
      const all = this.getAllTransactions();
      const remaining = all.filter(t => t.accountId !== accountId);
      const deletedCount = all.length - remaining.length;
      
      this.setStorageData(this.STORAGE_KEYS.transactions, remaining);
      return deletedCount;
    });
    
    return result.success ? result.result! : 0;
  }

  // ACCOUNT OPERATIONS
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
    
    return result.success ? result.result! : null;
  }

  updateAccount(accountId: string, updates: Partial<BankAccount>): boolean {
    return this.executeTransaction(() => {
      const accounts = this.getAllAccounts();
      const index = accounts.findIndex(a => a.id === accountId);
      
      if (index === -1) throw new Error('Account not found');
      
      accounts[index] = { ...accounts[index], ...updates };
      this.setStorageData(this.STORAGE_KEYS.accounts, accounts);
      
      return true;
    }).success;
  }

  deleteAccount(accountId: string): boolean {
    return this.executeTransaction(() => {
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
  }

  // FILE OPERATIONS
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
    
    return result.success ? result.result! : null;
  }

  deleteFile(fileId: string): boolean {
    return this.executeTransaction(() => {
      // First delete all transactions for this file
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
  }

  // CATEGORY OPERATIONS
  getAllCategories(): TransactionCategory[] {
    return this.getStorageData(this.STORAGE_KEYS.categories, this.getDefaultCategories());
  }

  addCategory(category: Omit<TransactionCategory, 'id' | 'createdDate' | 'modifiedDate'>): TransactionCategory | null {
    const result = this.executeTransaction(() => {
      const now = new Date().toISOString();
      const newCategory: TransactionCategory = {
        ...category,
        id: this.generateId('cat'),
        createdDate: now,
        modifiedDate: now
      };
      
      const categories = this.getAllCategories();
      categories.push(newCategory);
      this.setStorageData(this.STORAGE_KEYS.categories, categories);
      
      return newCategory;
    });
    
    return result.success ? result.result! : null;
  }

  // CATEGORIZATION OPERATIONS
  getAllCategorizations(): TransactionCategorization[] {
    return this.getStorageData(this.STORAGE_KEYS.categorizations, []);
  }

  addCategorization(categorization: Omit<TransactionCategorization, 'createdDate' | 'modifiedDate'>): TransactionCategorization | null {
    const result = this.executeTransaction(() => {
      const now = new Date().toISOString();
      const newCategorization: TransactionCategorization = {
        ...categorization,
        createdDate: now,
        modifiedDate: now
      };
      
      const categorizations = this.getAllCategorizations();
      const existingIndex = categorizations.findIndex(c => c.transactionId === categorization.transactionId);
      
      if (existingIndex >= 0) {
        categorizations[existingIndex] = newCategorization;
      } else {
        categorizations.push(newCategorization);
      }
      
      this.setStorageData(this.STORAGE_KEYS.categorizations, categorizations);
      return newCategorization;
    });
    
    return result.success ? result.result! : null;
  }

  // DATA INTEGRITY AND MAINTENANCE
  validateDataIntegrity(): { isValid: boolean; issues: string[]; stats: StorageStats } {
    const issues: string[] = [];
    const transactions = this.getAllTransactions();
    const accounts = this.getAllAccounts();
    const files = this.getAllFiles();
    const categorizations = this.getAllCategorizations();

    // Check for orphaned transactions
    const accountIds = new Set(accounts.map(a => a.id));
    const orphanedTransactions = transactions.filter(t => !accountIds.has(t.accountId));
    if (orphanedTransactions.length > 0) {
      issues.push(`${orphanedTransactions.length} orphaned transactions found`);
    }

    // Check for orphaned files
    const fileIds = new Set(files.map(f => f.id));
    const orphanedFileRefs = transactions.filter(t => t.fileId && !fileIds.has(t.fileId));
    if (orphanedFileRefs.length > 0) {
      issues.push(`${orphanedFileRefs.length} transactions reference missing files`);
    }

    // Check for orphaned categorizations
    const transactionIds = new Set(transactions.map(t => t.id));
    const orphanedCategorizations = categorizations.filter(c => !transactionIds.has(c.transactionId));
    if (orphanedCategorizations.length > 0) {
      issues.push(`${orphanedCategorizations.length} orphaned categorizations found`);
    }

    const stats = this.getStorageStats();
    
    return {
      isValid: issues.length === 0,
      issues,
      stats
    };
  }

  cleanupOrphanedData(): { deletedTransactions: number; deletedCategorizations: number } {
    const result = this.executeTransaction(() => {
      let deletedTransactions = 0;
      let deletedCategorizations = 0;

      // Clean orphaned transactions
      const transactions = this.getAllTransactions();
      const accounts = this.getAllAccounts();
      const accountIds = new Set(accounts.map(a => a.id));
      
      const validTransactions = transactions.filter(t => {
        if (!accountIds.has(t.accountId)) {
          deletedTransactions++;
          return false;
        }
        return true;
      });
      
      this.setStorageData(this.STORAGE_KEYS.transactions, validTransactions);

      // Clean orphaned categorizations
      const categorizations = this.getAllCategorizations();
      const transactionIds = new Set(validTransactions.map(t => t.id));
      
      const validCategorizations = categorizations.filter(c => {
        if (!transactionIds.has(c.transactionId)) {
          deletedCategorizations++;
          return false;
        }
        return true;
      });
      
      this.setStorageData(this.STORAGE_KEYS.categorizations, validCategorizations);

      return { deletedTransactions, deletedCategorizations };
    });

    return result.success ? result.result! : { deletedTransactions: 0, deletedCategorizations: 0 };
  }

  // SNAPSHOT AND BACKUP OPERATIONS
  createSnapshot(_operationType: string): string {
    const timestamp = new Date().toISOString();
    const snapshot: StorageSnapshot = {
      timestamp,
      transactions: this.getAllTransactions(),
      accounts: this.getAllAccounts(),
      files: this.getAllFiles(),
      categories: this.getAllCategories(),
      categorizations: this.getAllCategorizations()
    };

    const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, []);
    snapshots.push(snapshot);

    // Keep only the most recent snapshots
    if (snapshots.length > this.MAX_SNAPSHOTS) {
      snapshots.splice(0, snapshots.length - this.MAX_SNAPSHOTS);
    }

    this.setStorageData(this.STORAGE_KEYS.snapshots, snapshots);
    return timestamp;
  }

  restoreSnapshot(timestamp: string): boolean {
    const snapshots = this.getStorageData(this.STORAGE_KEYS.snapshots, []);
    const snapshot = snapshots.find(s => s.timestamp === timestamp);
    
    if (!snapshot) return false;

    try {
      this.setStorageData(this.STORAGE_KEYS.transactions, snapshot.transactions);
      this.setStorageData(this.STORAGE_KEYS.accounts, snapshot.accounts);
      this.setStorageData(this.STORAGE_KEYS.files, snapshot.files);
      this.setStorageData(this.STORAGE_KEYS.categories, snapshot.categories);
      this.setStorageData(this.STORAGE_KEYS.categorizations, snapshot.categorizations);
      
      this.updateMetadata();
      return true;
    } catch {
      return false;
    }
  }

  // UTILITY METHODS
  getStorageStats(): StorageStats {
    const transactions = this.getAllTransactions();
    const accounts = this.getAllAccounts();
    const files = this.getAllFiles();
    const categories = this.getAllCategories();
    const categorizations = this.getAllCategorizations();

    let totalSize = 0;
    Object.values(this.STORAGE_KEYS).forEach(key => {
      const data = localStorage.getItem(key);
      if (data) totalSize += data.length;
    });

    return {
      totalSize: Math.round(totalSize / 1024), // KB
      itemCounts: {
        transactions: transactions.length,
        accounts: accounts.length,
        files: files.length,
        categories: categories.length,
        categorizations: categorizations.length
      },
      lastUpdated: new Date().toISOString()
    };
  }

  exportData(): string {
    const data = {
      version: this.STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      transactions: this.getAllTransactions(),
      accounts: this.getAllAccounts(),
      files: this.getAllFiles(),
      categories: this.getAllCategories(),
      categorizations: this.getAllCategorizations()
    };
    
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string): { success: boolean; message: string; imported: any } {
    return this.executeTransaction(() => {
      const data = JSON.parse(jsonData);
      
      if (data.version !== this.STORAGE_VERSION) {
        throw new Error(`Version mismatch. Expected ${this.STORAGE_VERSION}, got ${data.version}`);
      }

      this.setStorageData(this.STORAGE_KEYS.transactions, data.transactions || []);
      this.setStorageData(this.STORAGE_KEYS.accounts, data.accounts || []);
      this.setStorageData(this.STORAGE_KEYS.files, data.files || []);
      this.setStorageData(this.STORAGE_KEYS.categories, data.categories || []);
      this.setStorageData(this.STORAGE_KEYS.categorizations, data.categorizations || []);

      const imported = {
        transactions: data.transactions?.length || 0,
        accounts: data.accounts?.length || 0,
        files: data.files?.length || 0,
        categories: data.categories?.length || 0,
        categorizations: data.categorizations?.length || 0
      };

      return { success: true, message: 'Data imported successfully', imported };
    });
  }

  clearAllData(): void {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // PRIVATE HELPER METHODS
  private getStorageData<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return defaultValue;
    }
  }

  private setStorageData<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      throw error;
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetadata(): void {
    const metadata = {
      version: this.STORAGE_VERSION,
      lastUpdated: new Date().toISOString()
    };
    this.setStorageData(this.STORAGE_KEYS.metadata, metadata);
  }

  private getDefaultAccounts(): BankAccount[] {
    return [
      {
        id: 'default_current',
        name: 'Current Account',
        accountNumber: '00000000',
        bankName: 'Default Bank',
        currency: 'USD',
        currentBalance: 0
      }
    ];
  }

  private getDefaultCategories(): TransactionCategory[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'cat_income',
        name: 'Income',
        description: 'All income transactions',
        keywords: ['salary', 'wage', 'income', 'payment'],
        color: '#4CAF50',
        isSystem: true,
        createdDate: now,
        modifiedDate: now
      },
      {
        id: 'cat_expense',
        name: 'Expenses',
        description: 'General expenses',
        keywords: ['purchase', 'payment', 'expense'],
        color: '#F44336',
        isSystem: true,
        createdDate: now,
        modifiedDate: now
      },
      {
        id: 'cat_transfer',
        name: 'Transfers',
        description: 'Account transfers',
        keywords: ['transfer', 'move'],
        color: '#2196F3',
        isSystem: true,
        createdDate: now,
        modifiedDate: now
      }
    ];
  }
}

export const localStorageManager = new LocalStorageManager(); 