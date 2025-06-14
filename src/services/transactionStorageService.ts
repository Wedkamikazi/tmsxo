import { Transaction } from '../types';
import { fileStorageService } from './fileStorageService';

export interface StoredTransaction extends Transaction {
  accountId: string;
  importDate: string;
  postDateTime: string; // Combined Post date + Time for sorting
}

export interface BalanceValidationResult {
  isValid: boolean;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  lastTransactionDate: string;
  currentBalance: number;
  dailyMovement: number;
}

class TransactionStorageService {
  private readonly STORAGE_FILENAME = 'transactions';

  // Get all stored transactions for an account
  getTransactionsByAccount(accountId: string): StoredTransaction[] {
    const allTransactions = this.getAllTransactions();
    return allTransactions
      .filter(t => t.accountId === accountId)
      .sort((a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime());
  }

  // Get all transactions from storage
  getAllTransactions(): StoredTransaction[] {
    // UNIFIED STORAGE: Use single source of truth for all transactions
    const transactions = fileStorageService.readData<StoredTransaction[]>(this.STORAGE_FILENAME, []);
    
    // MIGRATION: Merge any legacy account-specific transactions
    this.migrateLegacyTransactions(transactions);
    
    return transactions;
  }

  // Save transactions to storage
  private saveTransactions(transactions: StoredTransaction[]): void {
    const success = fileStorageService.writeData(this.STORAGE_FILENAME, transactions);
    if (!success) {
      console.error('Failed to save transactions to unified storage');
      throw new Error('Transaction storage failed - data integrity compromised');
    }
  }

  // MIGRATION: Consolidate legacy account-specific transaction storage
  private migrateLegacyTransactions(currentTransactions: StoredTransaction[]): void {
    const existingIds = new Set(currentTransactions.map(t => t.id));
    let migrationCount = 0;
    
    // Find all legacy transaction keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('treasury-transactions-') && key !== 'treasury-data-transactions') {
        try {
          const legacyData = localStorage.getItem(key);
          if (legacyData) {
            const legacyTransactions: StoredTransaction[] = JSON.parse(legacyData);
            
            // Add non-duplicate transactions
            legacyTransactions.forEach(transaction => {
              if (!existingIds.has(transaction.id)) {
                currentTransactions.push(transaction);
                existingIds.add(transaction.id);
                migrationCount++;
              }
            });
            
            // Remove legacy key after migration
            localStorage.removeItem(key);
          }
        } catch (error) {
          console.error(`Error migrating legacy transactions from ${key}:`, error);
        }
      }
    }
    
    if (migrationCount > 0) {
      console.log(`Migrated ${migrationCount} transactions from legacy storage`);
      this.saveTransactions(currentTransactions);
    }
  }

  // Get the most recent transaction for an account (by Post date + Time)
  getLatestTransaction(accountId: string): StoredTransaction | null {
    const transactions = this.getTransactionsByAccount(accountId);
    return transactions.length > 0 ? transactions[0] : null;
  }

  // Create Post date + Time string for sorting
  private createPostDateTime(postDate: string, time: string): string {
    // Convert DD/MM/YYYY to YYYY-MM-DD format
    const dateParts = postDate.split('/');
    if (dateParts.length === 3) {
      const formattedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
      
      // Handle time format
      let timeString = '00:00:00';
      if (time && time.trim()) {
        const cleanTime = time.trim();
        if (cleanTime.includes(':')) {
          timeString = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
        } else if (cleanTime.length === 4) {
          // Convert HHMM to HH:MM:SS
          timeString = `${cleanTime.substring(0, 2)}:${cleanTime.substring(2)}:00`;
        }
      }
      
      return `${formattedDate}T${timeString}`;
    }
    
    // Fallback
    return new Date().toISOString();
  }

  // Validate balance against stored transactions
  validateBalance(accountId: string, newTransactions: Transaction[], currentAccountBalance: number): BalanceValidationResult {
    const latestStoredTransaction = this.getLatestTransaction(accountId);
    
    if (!latestStoredTransaction) {
      // No previous transactions - first import
      const closingBalance = newTransactions.length > 0 ? newTransactions[0].balance : 0;
      const openingBalance = newTransactions.length > 0 ? newTransactions[newTransactions.length - 1].balance : 0;
      const dailyMovement = closingBalance - openingBalance;
      
      return {
        isValid: Math.abs(currentAccountBalance - closingBalance) < 0.01,
        expectedBalance: closingBalance,
        actualBalance: closingBalance,
        difference: 0,
        lastTransactionDate: '',
        currentBalance: currentAccountBalance,
        dailyMovement
      };
    }

    // Find the most recent new transaction by Post date + Time
    const sortedNewTransactions = [...newTransactions].sort((a, b) => {
      const dateTimeA = this.createPostDateTime(a.postDate || a.date, a.time || '00:00');
      const dateTimeB = this.createPostDateTime(b.postDate || b.date, b.time || '00:00');
      return new Date(dateTimeB).getTime() - new Date(dateTimeA).getTime();
    });

    const latestNewTransaction = sortedNewTransactions[0];
    const latestNewDateTime = this.createPostDateTime(
      latestNewTransaction.postDate || latestNewTransaction.date,
      latestNewTransaction.time || '00:00'
    );

    // Check if new transactions are newer than stored ones
    const isNewerImport = new Date(latestNewDateTime).getTime() > new Date(latestStoredTransaction.postDateTime).getTime();
    
    if (isNewerImport) {
      // New transactions are newer - validate against current balance + daily movement
      const dailyMovement = latestNewTransaction.balance - latestStoredTransaction.balance;
      const expectedBalance = latestStoredTransaction.balance + dailyMovement;
      const actualBalance = latestNewTransaction.balance;
      
      return {
        isValid: Math.abs(expectedBalance - actualBalance) < 0.01,
        expectedBalance,
        actualBalance,
        difference: actualBalance - expectedBalance,
        lastTransactionDate: latestStoredTransaction.postDateTime,
        currentBalance: currentAccountBalance,
        dailyMovement
      };
    } else {
      // Importing older transactions - different validation logic
      const oldestNewTransaction = sortedNewTransactions[sortedNewTransactions.length - 1];
      const dailyMovement = latestNewTransaction.balance - oldestNewTransaction.balance;
      
      return {
        isValid: true, // Assume valid for historical imports
        expectedBalance: latestNewTransaction.balance,
        actualBalance: latestNewTransaction.balance,
        difference: 0,
        lastTransactionDate: latestStoredTransaction.postDateTime,
        currentBalance: currentAccountBalance,
        dailyMovement
      };
    }
  }

  // Store new transactions
  storeTransactions(accountId: string, transactions: Transaction[]): void {
    const allTransactions = this.getAllTransactions();
    
    const newStoredTransactions: StoredTransaction[] = transactions.map(transaction => ({
      ...transaction,
      accountId,
      importDate: new Date().toISOString(),
      postDateTime: this.createPostDateTime(
        transaction.postDate || transaction.date,
        transaction.time || '00:00'
      )
    }));

    // Remove any existing transactions with the same IDs (for updates)
    const filteredExisting = allTransactions.filter(existing => 
      !newStoredTransactions.some(newTxn => newTxn.id === existing.id)
    );

    const updatedTransactions = [...filteredExisting, ...newStoredTransactions];
    this.saveTransactions(updatedTransactions);
  }

  // Get account balance as of a specific date
  getBalanceAsOfDate(accountId: string, targetDate: string): number {
    const transactions = this.getTransactionsByAccount(accountId);
    
    // Find the first transaction on or before the target date
    const targetDateTime = new Date(targetDate).getTime();
    const relevantTransaction = transactions.find(t => 
      new Date(t.postDateTime).getTime() <= targetDateTime
    );
    
    return relevantTransaction ? relevantTransaction.balance : 0;
  }

  // Clear all transactions for an account
  clearAccountTransactions(accountId: string): void {
    const allTransactions = this.getAllTransactions();
    const filteredTransactions = allTransactions.filter(t => t.accountId !== accountId);
    this.saveTransactions(filteredTransactions);
  }

  // Get transaction statistics for an account
  getAccountStatistics(accountId: string): {
    totalTransactions: number;
    dateRange: { from: string; to: string };
    totalDebits: number;
    totalCredits: number;
    currentBalance: number;
  } {
    const transactions = this.getTransactionsByAccount(accountId);
    
    if (transactions.length === 0) {
      return {
        totalTransactions: 0,
        dateRange: { from: '', to: '' },
        totalDebits: 0,
        totalCredits: 0,
        currentBalance: 0
      };
    }

    const sortedByDate = [...transactions].sort((a, b) => 
      new Date(a.postDateTime).getTime() - new Date(b.postDateTime).getTime()
    );

    return {
      totalTransactions: transactions.length,
      dateRange: {
        from: sortedByDate[0].date,
        to: sortedByDate[sortedByDate.length - 1].date
      },
      totalDebits: transactions.reduce((sum, t) => sum + t.debitAmount, 0),
      totalCredits: transactions.reduce((sum, t) => sum + t.creditAmount, 0),
      currentBalance: transactions[0].balance // Most recent balance
    };
  }

  // Get data storage location for debugging/info
  getStorageInfo(): { location: string; filename: string } {
    return {
      location: fileStorageService.getDataDirectory(),
      filename: `${this.STORAGE_FILENAME}.json`
    };
  }
}

export const transactionStorageService = new TransactionStorageService(); 