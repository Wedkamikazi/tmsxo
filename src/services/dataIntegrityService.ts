import { StoredTransaction } from './transactionStorageService';
import { UploadedFile } from './fileStorageService';

export interface DataIntegrityReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  orphanedTransactions: StoredTransaction[];
  duplicateTransactions: StoredTransaction[];
  missingFileReferences: string[];
  fixedIssues: string[];
}

export interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  transactionId: string;
  beforeState?: StoredTransaction;
  afterState?: StoredTransaction;
  timestamp: string;
}

class DataIntegrityService {
  private readonly OPERATION_LOG_KEY = 'treasury-operation-log';
  private readonly MAX_LOG_ENTRIES = 1000;

  // Validate entire data integrity
  validateDataIntegrity(): DataIntegrityReport {
    const report: DataIntegrityReport = {
      isValid: true,
      errors: [],
      warnings: [],
      orphanedTransactions: [],
      duplicateTransactions: [],
      missingFileReferences: [],
      fixedIssues: []
    };

    try {
      // Check for duplicate transactions
      const duplicates = this.findDuplicateTransactions();
      if (duplicates.length > 0) {
        report.duplicateTransactions = duplicates;
        report.warnings.push(`Found ${duplicates.length} duplicate transactions`);
      }

      // Check for orphaned transactions
      const orphans = this.findOrphanedTransactions();
      if (orphans.length > 0) {
        report.orphanedTransactions = orphans;
        report.warnings.push(`Found ${orphans.length} orphaned transactions`);
      }

      // Check file references
      const missingRefs = this.findMissingFileReferences();
      if (missingRefs.length > 0) {
        report.missingFileReferences = missingRefs;
        report.warnings.push(`Found ${missingRefs.length} missing file references`);
      }

      report.isValid = report.errors.length === 0;
    } catch (error) {
      report.isValid = false;
      report.errors.push(`Data integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return report;
  }

  // Find duplicate transactions
  private findDuplicateTransactions(): StoredTransaction[] {
    const transactions = this.getAllTransactionsFromStorage();
    const seen = new Map<string, StoredTransaction>();
    const duplicates: StoredTransaction[] = [];

    transactions.forEach(transaction => {
      const key = `${transaction.accountId}-${transaction.date}-${transaction.debitAmount}-${transaction.creditAmount}-${transaction.description}`;
      
      if (seen.has(key)) {
        duplicates.push(transaction);
      } else {
        seen.set(key, transaction);
      }
    });

    return duplicates;
  }

  // Find orphaned transactions (transactions without file references)
  private findOrphanedTransactions(): StoredTransaction[] {
    const transactions = this.getAllTransactionsFromStorage();
    const files = this.getAllFilesFromStorage();
    const fileImportDates = new Set(files.map(f => f.uploadDate.split('T')[0])); // Just date part

    return transactions.filter(transaction => {
      if (!transaction.importDate) return true; // No import date = orphaned
      
      const importDate = transaction.importDate.split('T')[0];
      return !fileImportDates.has(importDate);
    });
  }

  // Find missing file references
  private findMissingFileReferences(): string[] {
    const files = this.getAllFilesFromStorage();
    const transactions = this.getAllTransactionsFromStorage();
    const missing: string[] = [];

    files.forEach(file => {
      const fileDate = file.uploadDate.split('T')[0];
      const relatedTransactions = transactions.filter(t => 
        t.importDate && t.importDate.split('T')[0] === fileDate && t.accountId === file.accountId
      );

      if (relatedTransactions.length !== file.transactionCount) {
        missing.push(`File ${file.fileName}: Expected ${file.transactionCount} transactions, found ${relatedTransactions.length}`);
      }
    });

    return missing;
  }

  // Auto-fix common data issues
  autoFixDataIssues(): DataIntegrityReport {
    const report = this.validateDataIntegrity();
    
    // Fix duplicate transactions
    if (report.duplicateTransactions.length > 0) {
      const fixedCount = this.removeDuplicateTransactions(report.duplicateTransactions);
      report.fixedIssues.push(`Removed ${fixedCount} duplicate transactions`);
    }

    // Update file transaction counts
    if (report.missingFileReferences.length > 0) {
      const updated = this.updateFileTransactionCounts();
      report.fixedIssues.push(`Updated transaction counts for ${updated} files`);
    }

    return report;
  }

  // Remove duplicate transactions
  private removeDuplicateTransactions(duplicates: StoredTransaction[]): number {
    const allTransactions = this.getAllTransactionsFromStorage();
    const duplicateIds = new Set(duplicates.map(d => d.id));
    
    const uniqueTransactions = allTransactions.filter(t => !duplicateIds.has(t.id));
    
    // Save back to storage
    this.saveTransactionsToStorage(uniqueTransactions);
    
    return duplicates.length;
  }

  // Update file transaction counts to match actual data
  private updateFileTransactionCounts(): number {
    const files = this.getAllFilesFromStorage();
    const transactions = this.getAllTransactionsFromStorage();
    let updatedCount = 0;

    files.forEach(file => {
      const fileDate = file.uploadDate.split('T')[0];
      const actualCount = transactions.filter(t => 
        t.importDate && t.importDate.split('T')[0] === fileDate && t.accountId === file.accountId
      ).length;

      if (actualCount !== file.transactionCount) {
        file.transactionCount = actualCount;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this.saveFilesToStorage(files);
    }

    return updatedCount;
  }

  // Log transaction operations for rollback capability
  logOperation(operation: TransactionOperation): void {
    try {
      const logData = localStorage.getItem(this.OPERATION_LOG_KEY);
      const log: TransactionOperation[] = logData ? JSON.parse(logData) : [];
      
      log.push(operation);
      
      // Keep only recent operations
      if (log.length > this.MAX_LOG_ENTRIES) {
        log.splice(0, log.length - this.MAX_LOG_ENTRIES);
      }
      
      localStorage.setItem(this.OPERATION_LOG_KEY, JSON.stringify(log));
    } catch (error) {
      console.error('Failed to log operation:', error);
    }
  }

  // Rollback last N operations
  rollbackOperations(count: number): { success: boolean; rolledBack: number; error?: string } {
    try {
      const logData = localStorage.getItem(this.OPERATION_LOG_KEY);
      if (!logData) {
        return { success: false, rolledBack: 0, error: 'No operation log found' };
      }

      const log: TransactionOperation[] = JSON.parse(logData);
      const toRollback = log.slice(-count);
      
      let rolledBackCount = 0;
      const allTransactions = this.getAllTransactionsFromStorage();

      // Process rollbacks in reverse order
      toRollback.reverse().forEach(operation => {
        switch (operation.type) {
          case 'create':
            // Remove created transaction
            const createIndex = allTransactions.findIndex(t => t.id === operation.transactionId);
            if (createIndex !== -1) {
              allTransactions.splice(createIndex, 1);
              rolledBackCount++;
            }
            break;
          
          case 'update':
            // Restore previous state
            if (operation.beforeState) {
              const updateIndex = allTransactions.findIndex(t => t.id === operation.transactionId);
              if (updateIndex !== -1) {
                allTransactions[updateIndex] = operation.beforeState;
                rolledBackCount++;
              }
            }
            break;
          
          case 'delete':
            // Restore deleted transaction
            if (operation.beforeState) {
              allTransactions.push(operation.beforeState);
              rolledBackCount++;
            }
            break;
        }
      });

      // Save rolled back transactions
      this.saveTransactionsToStorage(allTransactions);
      
      // Remove rolled back operations from log
      const remainingLog = log.slice(0, -count);
      localStorage.setItem(this.OPERATION_LOG_KEY, JSON.stringify(remainingLog));

      return { success: true, rolledBack: rolledBackCount };
    } catch (error) {
      return { 
        success: false, 
        rolledBack: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Helper methods for storage access
  private getAllTransactionsFromStorage(): StoredTransaction[] {
    try {
      const data = localStorage.getItem('treasury-data-transactions');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private getAllFilesFromStorage(): UploadedFile[] {
    try {
      const data = localStorage.getItem('treasury-uploaded-files');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveTransactionsToStorage(transactions: StoredTransaction[]): void {
    localStorage.setItem('treasury-data-transactions', JSON.stringify(transactions));
  }

  private saveFilesToStorage(files: UploadedFile[]): void {
    localStorage.setItem('treasury-uploaded-files', JSON.stringify(files));
  }

  // Get operation log for debugging
  getOperationLog(): TransactionOperation[] {
    try {
      const logData = localStorage.getItem(this.OPERATION_LOG_KEY);
      return logData ? JSON.parse(logData) : [];
    } catch {
      return [];
    }
  }

  // Clear operation log
  clearOperationLog(): void {
    localStorage.removeItem(this.OPERATION_LOG_KEY);
  }
}

export const dataIntegrityService = new DataIntegrityService(); 