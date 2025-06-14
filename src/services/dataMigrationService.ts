import { fileStorageService, UploadedFile } from './fileStorageService';
import { transactionStorageService, StoredTransaction } from './transactionStorageService';

interface MigrationReport {
  totalTransactions: number;
  orphanedTransactions: number;
  migratedTransactions: number;
  deletedTransactions: number;
  legacyStorageCleared: number;
  errors: string[];
}

interface OrphanedTransaction extends StoredTransaction {
  reason: 'no_file_id' | 'file_not_found' | 'date_mismatch';
  possibleFileId?: string;
}

class DataMigrationService {
  
  // Main migration method to clean up legacy data
  async migrateLegacyData(): Promise<MigrationReport> {
    console.log('🔄 Starting legacy data migration...');
    
    const report: MigrationReport = {
      totalTransactions: 0,
      orphanedTransactions: 0,
      migratedTransactions: 0,
      deletedTransactions: 0,
      legacyStorageCleared: 0,
      errors: []
    };

    try {
      // Step 1: Get all current data
      const allTransactions = this.getAllTransactions();
      const allFiles = fileStorageService.getAllUploadedFiles();
      
      report.totalTransactions = allTransactions.length;
      console.log(`📊 Found ${allTransactions.length} total transactions`);
      console.log(`📁 Found ${allFiles.length} uploaded files`);

      // Step 2: Identify orphaned transactions
      const orphanedTransactions = this.identifyOrphanedTransactions(allTransactions, allFiles);
      report.orphanedTransactions = orphanedTransactions.length;
      console.log(`🔍 Found ${orphanedTransactions.length} orphaned transactions`);

      // Step 3: Try to migrate orphaned transactions to files
      const migrationResults = this.attemptTransactionMigration(orphanedTransactions, allFiles);
      report.migratedTransactions = migrationResults.migrated;
      report.deletedTransactions = migrationResults.deleted;

      // Step 4: Clean up legacy localStorage entries
      report.legacyStorageCleared = this.cleanupLegacyStorage();

      // Step 5: Save the cleaned data
      const cleanedTransactions = allTransactions.filter(t => 
        !orphanedTransactions.some(o => o.id === t.id) || 
        migrationResults.migratedTransactionIds.includes(t.id)
      );
      
      this.saveTransactions(cleanedTransactions);

      console.log('✅ Migration completed successfully');
      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      report.errors.push(errorMessage);
      console.error('❌ Migration failed:', error);
      return report;
    }
  }

  // Get all transactions (public method for external access)
  getAllTransactions(): StoredTransaction[] {
    return fileStorageService.readData<StoredTransaction[]>('transactions', []);
  }

  // Save transactions (public method for external access)
  saveTransactions(transactions: StoredTransaction[]): void {
    fileStorageService.writeData('transactions', transactions);
  }

  // Identify transactions that don't have proper file tracking
  private identifyOrphanedTransactions(
    transactions: StoredTransaction[], 
    files: UploadedFile[]
  ): OrphanedTransaction[] {
    const orphaned: OrphanedTransaction[] = [];

    transactions.forEach(transaction => {
      // Check if transaction has no fileId
      if (!transaction.fileId) {
        // Try to find a matching file by date and account
        const possibleFile = this.findMatchingFile(transaction, files);
        
        orphaned.push({
          ...transaction,
          reason: 'no_file_id',
          possibleFileId: possibleFile?.id
        });
        return;
      }

      // Check if the fileId references a file that no longer exists
      const fileExists = files.some(f => f.id === transaction.fileId);
      if (!fileExists) {
        orphaned.push({
          ...transaction,
          reason: 'file_not_found'
        });
      }
    });

    return orphaned;
  }

  // Try to find a matching file for an orphaned transaction
  private findMatchingFile(transaction: StoredTransaction, files: UploadedFile[]): UploadedFile | null {
    if (!transaction.importDate || !transaction.accountId) return null;

    const transactionImportDate = new Date(transaction.importDate);
    
    // Look for files uploaded on the same day for the same account
    const matchingFiles = files.filter(file => {
      if (file.accountId !== transaction.accountId) return false;
      
      const fileUploadDate = new Date(file.uploadDate);
      const sameDay = 
        fileUploadDate.getFullYear() === transactionImportDate.getFullYear() &&
        fileUploadDate.getMonth() === transactionImportDate.getMonth() &&
        fileUploadDate.getDate() === transactionImportDate.getDate();
      
      return sameDay;
    });

    // Return the most likely match (closest upload time)
    if (matchingFiles.length === 1) {
      return matchingFiles[0];
    } else if (matchingFiles.length > 1) {
      // Find the file with the closest upload time
      return matchingFiles.reduce((closest, current) => {
        const closestDiff = Math.abs(new Date(closest.uploadDate).getTime() - transactionImportDate.getTime());
        const currentDiff = Math.abs(new Date(current.uploadDate).getTime() - transactionImportDate.getTime());
        return currentDiff < closestDiff ? current : closest;
      });
    }

    return null;
  }

  // Attempt to migrate orphaned transactions
  private attemptTransactionMigration(
    orphanedTransactions: OrphanedTransaction[], 
    files: UploadedFile[]
  ): { migrated: number; deleted: number; migratedTransactionIds: string[] } {
    let migrated = 0;
    let deleted = 0;
    const migratedTransactionIds: string[] = [];

    orphanedTransactions.forEach(transaction => {
      if (transaction.reason === 'no_file_id' && transaction.possibleFileId) {
        // Migrate to the possible file
        transaction.fileId = transaction.possibleFileId;
        migrated++;
        migratedTransactionIds.push(transaction.id);
        console.log(`✅ Migrated transaction ${transaction.id} to file ${transaction.possibleFileId}`);
      } else {
        // Mark for deletion
        deleted++;
        console.log(`🗑️ Marking orphaned transaction ${transaction.id} for deletion (${transaction.reason})`);
      }
    });

    return { migrated, deleted, migratedTransactionIds };
  }

  // Clean up legacy localStorage entries
  private cleanupLegacyStorage(): number {
    let cleaned = 0;
    
    // Look for old transaction storage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-transactions') {
        localStorage.removeItem(key);
        cleaned++;
        console.log(`🧹 Cleaned up legacy storage: ${key}`);
      }
    }

    return cleaned;
  }

  // Get migration status and recommendations
  getMigrationStatus(): {
    needsMigration: boolean;
    orphanedCount: number;
    legacyStorageCount: number;
    recommendations: string[];
  } {
    const allTransactions = this.getAllTransactions();
    const allFiles = fileStorageService.getAllUploadedFiles();
    const orphaned = this.identifyOrphanedTransactions(allTransactions, allFiles);
    
    let legacyStorageCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-transactions') {
        legacyStorageCount++;
      }
    }

    const recommendations: string[] = [];
    
    if (orphaned.length > 0) {
      recommendations.push(`Found ${orphaned.length} orphaned transactions that need cleanup`);
    }
    
    if (legacyStorageCount > 0) {
      recommendations.push(`Found ${legacyStorageCount} legacy storage entries to clean up`);
    }

    if (orphaned.length === 0 && legacyStorageCount === 0) {
      recommendations.push('Data is clean and up-to-date');
    }

    return {
      needsMigration: orphaned.length > 0 || legacyStorageCount > 0,
      orphanedCount: orphaned.length,
      legacyStorageCount,
      recommendations
    };
  }

  // Emergency cleanup - removes ALL transactions (use with caution)
  emergencyCleanup(): { success: boolean; deletedCount: number; error?: string } {
    try {
      const allTransactions = this.getAllTransactions();
      const deletedCount = allTransactions.length;
      
      // Clear all transaction data
      this.saveTransactions([]);
      
      // Clear all legacy storage
      this.cleanupLegacyStorage();
      
      console.log(`🚨 Emergency cleanup completed: ${deletedCount} transactions deleted`);
      
      return { success: true, deletedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Emergency cleanup failed:', error);
      return { success: false, deletedCount: 0, error: errorMessage };
    }
  }
}

export const dataMigrationService = new DataMigrationService();
