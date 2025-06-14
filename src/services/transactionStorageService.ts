import { Transaction } from '../types';
import { fileStorageService } from './fileStorageService';
import { categorizationService } from './categorizationService';
import { mlCategorizationService } from './mlCategorizationService';

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
    return fileStorageService.readData<StoredTransaction[]>(this.STORAGE_FILENAME, []);
  }

  // Save transactions to storage
  private saveTransactions(transactions: StoredTransaction[]): void {
    const success = fileStorageService.writeData(this.STORAGE_FILENAME, transactions);
    if (!success) {
      console.error('Failed to save transactions to file system');
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

  // ============ CATEGORIZATION METHODS ============

  // Update transaction category
  updateTransactionCategory(
    transactionId: string, 
    categoryId: string, 
    isManual: boolean = true
  ): boolean {
    const allTransactions = this.getAllTransactions();
    const transactionIndex = allTransactions.findIndex(t => t.id === transactionId);
    
    if (transactionIndex === -1) return false;

    const transaction = allTransactions[transactionIndex];
    const now = new Date().toISOString();

    // Update category history
    if (!transaction.categoryHistory) {
      transaction.categoryHistory = [];
    }

    transaction.categoryHistory.push({
      previousCategoryId: transaction.categoryId || transaction.manualCategoryId,
      changedDate: now,
      changedBy: isManual ? 'manual' : 'ml'
    });

    // Update appropriate category field
    if (isManual) {
      transaction.manualCategoryId = categoryId;
      transaction.categoryId = categoryId; // Manual takes precedence
    } else {
      transaction.categoryId = categoryId;
    }

    // Save updated transactions
    this.saveTransactions(allTransactions);

    // Note: ML training data would be handled here in future implementation
    if (isManual) {
      console.log('Manual categorization completed');
    }

    return true;
  }

  // Auto-categorize uncategorized transactions
  async autoCategorizeTransactions(accountId?: string): Promise<number> {
    let transactions = this.getAllTransactions();
    
    if (accountId) {
      transactions = transactions.filter(t => t.accountId === accountId);
    }

    // Filter uncategorized transactions
    const uncategorizedTransactions = transactions.filter(t => 
      !t.categoryId && !t.manualCategoryId
    );

    let categorizedCount = 0;

    for (const transaction of uncategorizedTransactions) {
      try {
                // Try rule-based categorization first
        const ruleCategoryId = categorizationService.applRuleBasedCategorization({
          ...transaction,
          description: transaction.description,
          debitAmount: transaction.debitAmount,
          creditAmount: transaction.creditAmount
        });

        if (ruleCategoryId) {
          this.updateTransactionCategory(transaction.id, ruleCategoryId, false);
          categorizedCount++;
          continue;
        }

        // Try ML categorization
        const mlCategorization = await mlCategorizationService.categorizeTransaction(transaction);

        if (mlCategorization && mlCategorization.confidence > 0.5) {
          // Update transaction with ML categorization
          const allTransactions = this.getAllTransactions();
          const transactionIndex = allTransactions.findIndex(t => t.id === transaction.id);
          
          if (transactionIndex !== -1) {
            allTransactions[transactionIndex].categoryId = mlCategorization.categoryId;
            allTransactions[transactionIndex].mlCategorization = {
              categoryId: mlCategorization.categoryId,
              confidence: mlCategorization.confidence,
              algorithm: 'neural_network' as const,
              features: [],
              trainingDate: new Date().toISOString()
            };
            this.saveTransactions(allTransactions);
            categorizedCount++;
          }
        }
      } catch (error) {
        console.error(`Error categorizing transaction ${transaction.id}:`, error);
      }
    }

    return categorizedCount;
  }

  // Get transactions by category
  getTransactionsByCategory(categoryId: string, accountId?: string): StoredTransaction[] {
    let transactions = this.getAllTransactions();
    
    if (accountId) {
      transactions = transactions.filter(t => t.accountId === accountId);
    }

    return transactions
      .filter(t => t.categoryId === categoryId || t.manualCategoryId === categoryId)
      .sort((a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime());
  }

  // Get categorization statistics
  getCategorizationStats(accountId?: string): {
    total: number;
    categorized: number;
    uncategorized: number;
    manuallyCateged: number;
    mlCategorized: number;
    ruleCategorized: number;
    categoryBreakdown: { categoryId: string; count: number; totalAmount: number }[];
  } {
    let transactions = this.getAllTransactions();
    
    if (accountId) {
      transactions = transactions.filter(t => t.accountId === accountId);
    }

    const stats = {
      total: transactions.length,
      categorized: 0,
      uncategorized: 0,
      manuallyCateged: 0,
      mlCategorized: 0,
      ruleCategorized: 0,
      categoryBreakdown: [] as { categoryId: string; count: number; totalAmount: number }[]
    };

    const categoryMap = new Map<string, { count: number; totalAmount: number }>();

    transactions.forEach(transaction => {
      const amount = (transaction.creditAmount || 0) - (transaction.debitAmount || 0);
      const categoryId = transaction.categoryId || transaction.manualCategoryId;

      if (categoryId) {
        stats.categorized++;
        
        // Check categorization type
        if (transaction.manualCategoryId) {
          stats.manuallyCateged++;
        } else if (transaction.mlCategorization) {
          stats.mlCategorized++;
        } else {
          stats.ruleCategorized++;
        }

        // Update category breakdown
        const existing = categoryMap.get(categoryId) || { count: 0, totalAmount: 0 };
        existing.count++;
        existing.totalAmount += Math.abs(amount);
        categoryMap.set(categoryId, existing);
      } else {
        stats.uncategorized++;
      }
    });

    // Convert map to array
    stats.categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
      categoryId,
      ...data
    }));

    return stats;
  }

  // Get uncategorized transactions
  getUncategorizedTransactions(accountId?: string): StoredTransaction[] {
    let transactions = this.getAllTransactions();
    
    if (accountId) {
      transactions = transactions.filter(t => t.accountId === accountId);
    }

    return transactions
      .filter(t => !t.categoryId && !t.manualCategoryId)
      .sort((a, b) => new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime());
  }

  // Bulk update categories
  bulkUpdateCategories(transactionIds: string[], categoryId: string): number {
    const allTransactions = this.getAllTransactions();
    let updatedCount = 0;

    transactionIds.forEach(id => {
      const transactionIndex = allTransactions.findIndex(t => t.id === id);
      if (transactionIndex !== -1) {
        const transaction = allTransactions[transactionIndex];
        const now = new Date().toISOString();

        // Update category history
        if (!transaction.categoryHistory) {
          transaction.categoryHistory = [];
        }

        transaction.categoryHistory.push({
          previousCategoryId: transaction.categoryId || transaction.manualCategoryId,
          changedDate: now,
          changedBy: 'manual'
        });

        transaction.manualCategoryId = categoryId;
        transaction.categoryId = categoryId;

        // Note: ML training data would be handled here in future implementation
        console.log('Bulk categorization completed');

        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this.saveTransactions(allTransactions);
    }

    return updatedCount;
  }
}

export const transactionStorageService = new TransactionStorageService(); 