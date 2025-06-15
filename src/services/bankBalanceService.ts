import { unifiedDataService, type StoredTransaction } from './unifiedDataService';

export interface DailyBalance {
  id: string;
  date: string; // YYYY-MM-DD format
  accountId: string;
  accountName: string;
  openingBalance: number;
  closingBalance: number;
  movement: number; // closingBalance - openingBalance
  transactionCount: number;
  lastTransactionTime: string; // Time of the last transaction that determined the closing balance
  lastTransactionId: string; // ID of the last transaction
  hasDuplicates?: boolean; // Flag to indicate if duplicates were detected
  duplicateCount?: number; // Number of duplicates found for this day
}

export interface BankBalanceFilters {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  balanceMin: string;
  balanceMax: string;
  movementMin: string;
  movementMax: string;
}

export interface BankBalanceStats {
  totalDays: number;
  totalAccounts: number;
  avgDailyBalance: number;
  totalMovement: number;
  positiveMovementDays: number;
  negativeMovementDays: number;
  highestBalance: number;
  lowestBalance: number;
  highestMovement: number;
  lowestMovement: number;
  daysWithDuplicates?: number; // Number of days that had duplicate transactions
}

type SortField = 'date' | 'accountName' | 'openingBalance' | 'closingBalance' | 'movement' | 'transactionCount';
type SortDirection = 'asc' | 'desc';

class BankBalanceService {
  /**
   * Detects potential duplicate transactions within a day's transactions
   * Uses sophisticated matching similar to the system's duplicate detection
   */
  private detectDayDuplicates(transactions: StoredTransaction[]): {
    uniqueTransactions: StoredTransaction[];
    duplicates: StoredTransaction[];
  } {
    if (transactions.length <= 1) {
      return { uniqueTransactions: transactions, duplicates: [] };
    }

    const seen = new Map<string, StoredTransaction>();
    const duplicates: StoredTransaction[] = [];
    const uniqueTransactions: StoredTransaction[] = [];

    transactions.forEach(transaction => {
      // Create sophisticated duplicate detection key
      const normalizedDesc = transaction.description.trim().toLowerCase();
      const key = [
        transaction.accountId,
        transaction.date,
        transaction.debitAmount || 0,
        transaction.creditAmount || 0,
        normalizedDesc.substring(0, 50) // First 50 chars of description
      ].join('|');
      
      if (seen.has(key)) {
        // Additional validation - check if they're really duplicates
        const existing = seen.get(key)!;
        const similarity = this.calculateTransactionSimilarity(existing, transaction);
        if (similarity > 0.9) {
          duplicates.push(transaction);
          return; // Skip adding to unique transactions
        }
      }
      
      seen.set(key, transaction);
      uniqueTransactions.push(transaction);
    });

    return { uniqueTransactions, duplicates };
  }

  /**
   * Calculate similarity between two transactions for duplicate detection
   */
  private calculateTransactionSimilarity(t1: StoredTransaction, t2: StoredTransaction): number {
    // Same basic data required
    if (t1.accountId !== t2.accountId || t1.date !== t2.date) return 0;
    if (t1.debitAmount !== t2.debitAmount || t1.creditAmount !== t2.creditAmount) return 0;
    
    // Calculate description similarity
    const desc1 = t1.description.trim().toLowerCase();
    const desc2 = t2.description.trim().toLowerCase();
    
    // Simple similarity calculation
    if (desc1 === desc2) return 1.0;
    
    const longer = desc1.length > desc2.length ? desc1 : desc2;
    const shorter = desc1.length > desc2.length ? desc2 : desc1;
    
    if (longer.length === 0) return 1.0;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  }

  /**
   * Extracts daily closing balances from transaction data
   * Uses the last transaction of each day by postDateTime to determine closing balance
   * NOW WITH DUPLICATE DETECTION AND HANDLING
   */
  getDailyBalances(): DailyBalance[] {
    const transactions = unifiedDataService.getAllTransactions();
    const accounts = unifiedDataService.getAllAccounts();
    
    if (transactions.length === 0) {
      return [];
    }

    // Create account lookup
    const accountLookup = new Map(accounts.map(acc => [acc.id, acc.name]));
    
    // Group transactions by account and date
    const transactionsByAccountAndDate = new Map<string, Map<string, StoredTransaction[]>>();
    
    transactions.forEach(transaction => {
      // Extract date from postDateTime or fallback to date
      const dateTime = transaction.postDateTime || `${transaction.postDate || transaction.date}T${transaction.time || '00:00'}:00`;
      const date = dateTime.split('T')[0]; // Extract YYYY-MM-DD
      
      if (!transactionsByAccountAndDate.has(transaction.accountId)) {
        transactionsByAccountAndDate.set(transaction.accountId, new Map());
      }
      
      const accountDates = transactionsByAccountAndDate.get(transaction.accountId)!;
      if (!accountDates.has(date)) {
        accountDates.set(date, []);
      }
      
      accountDates.get(date)!.push(transaction);
    });

    const dailyBalances: DailyBalance[] = [];
    
    // Process each account
    transactionsByAccountAndDate.forEach((dateMap, accountId) => {
      const accountName = accountLookup.get(accountId) || 'Unknown Account';
      
      // Sort dates chronologically
      const sortedDates = Array.from(dateMap.keys()).sort();
      let previousClosingBalance = 0;
      
      sortedDates.forEach((date, index) => {
        const dayTransactions = dateMap.get(date)!;
        
        // DUPLICATE DETECTION AND HANDLING
        const { uniqueTransactions, duplicates } = this.detectDayDuplicates(dayTransactions);
        const hasDuplicates = duplicates.length > 0;
        
        // Use unique transactions for balance calculation to avoid duplicate impact
        const transactionsToProcess = uniqueTransactions;
        
        // Sort transactions by postDateTime (or fallback to time)
        transactionsToProcess.sort((a, b) => {
          const aDateTime = a.postDateTime || `${a.postDate || a.date}T${a.time || '00:00'}:00`;
          const bDateTime = b.postDateTime || `${b.postDate || b.date}T${b.time || '00:00'}:00`;
          return new Date(aDateTime).getTime() - new Date(bDateTime).getTime();
        });
        
        // Last transaction determines the closing balance
        const lastTransaction = transactionsToProcess[transactionsToProcess.length - 1];
        const closingBalance = lastTransaction.balance;
        
        // Opening balance is either previous day's closing or calculated from first transaction
        let openingBalance: number;
        if (index === 0) {
          // For first day, calculate opening balance from first transaction
          const firstTransaction = transactionsToProcess[0];
          openingBalance = firstTransaction.balance - (firstTransaction.creditAmount - firstTransaction.debitAmount);
        } else {
          openingBalance = previousClosingBalance;
        }
        
        const movement = closingBalance - openingBalance;
        const lastTransactionTime = (lastTransaction.postDateTime || `${lastTransaction.postDate || lastTransaction.date}T${lastTransaction.time || '00:00'}:00`).split('T')[1];
        
        dailyBalances.push({
          id: `${accountId}-${date}`,
          date,
          accountId,
          accountName,
          openingBalance,
          closingBalance,
          movement,
          transactionCount: transactionsToProcess.length, // Count of unique transactions only
          lastTransactionTime,
          lastTransactionId: lastTransaction.id,
          hasDuplicates,
          duplicateCount: duplicates.length
        });
        
        previousClosingBalance = closingBalance;
      });
    });
    
    // Sort by date descending (most recent first)
    return dailyBalances.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get filtered and sorted daily balances
   */
  getFilteredBalances(
    filters: BankBalanceFilters,
    sortField: SortField = 'date',
    sortDirection: SortDirection = 'desc'
  ): DailyBalance[] {
    let balances = this.getDailyBalances();
    
    // Apply filters
    if (filters.accountId) {
      balances = balances.filter(b => b.accountId === filters.accountId);
    }
    
    if (filters.dateFrom) {
      balances = balances.filter(b => b.date >= filters.dateFrom);
    }
    
    if (filters.dateTo) {
      balances = balances.filter(b => b.date <= filters.dateTo);
    }
    
    if (filters.balanceMin) {
      const minBalance = parseFloat(filters.balanceMin);
      if (!isNaN(minBalance)) {
        balances = balances.filter(b => b.closingBalance >= minBalance);
      }
    }
    
    if (filters.balanceMax) {
      const maxBalance = parseFloat(filters.balanceMax);
      if (!isNaN(maxBalance)) {
        balances = balances.filter(b => b.closingBalance <= maxBalance);
      }
    }
    
    if (filters.movementMin) {
      const minMovement = parseFloat(filters.movementMin);
      if (!isNaN(minMovement)) {
        balances = balances.filter(b => b.movement >= minMovement);
      }
    }
    
    if (filters.movementMax) {
      const maxMovement = parseFloat(filters.movementMax);
      if (!isNaN(maxMovement)) {
        balances = balances.filter(b => b.movement <= maxMovement);
      }
    }
    
    // Apply sorting
    balances.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'date':
          aValue = a.date;
          bValue = b.date;
          break;
        case 'accountName':
          aValue = a.accountName.toLowerCase();
          bValue = b.accountName.toLowerCase();
          break;
        case 'openingBalance':
          aValue = a.openingBalance;
          bValue = b.openingBalance;
          break;
        case 'closingBalance':
          aValue = a.closingBalance;
          bValue = b.closingBalance;
          break;
        case 'movement':
          aValue = a.movement;
          bValue = b.movement;
          break;
        case 'transactionCount':
          aValue = a.transactionCount;
          bValue = b.transactionCount;
          break;
        default:
          aValue = a.date;
          bValue = b.date;
      }
      
      if (typeof aValue === 'string') {
        const result = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? result : -result;
      } else {
        const result = aValue - bValue;
        return sortDirection === 'asc' ? result : -result;
      }
    });
    
    return balances;
  }

  /**
   * Calculate statistics for bank balances
   * NOW INCLUDES DUPLICATE DETECTION STATS
   */
  getBalanceStats(balances: DailyBalance[]): BankBalanceStats {
    if (balances.length === 0) {
      return {
        totalDays: 0,
        totalAccounts: 0,
        avgDailyBalance: 0,
        totalMovement: 0,
        positiveMovementDays: 0,
        negativeMovementDays: 0,
        highestBalance: 0,
        lowestBalance: 0,
        highestMovement: 0,
        lowestMovement: 0,
        daysWithDuplicates: 0
      };
    }
    
    const uniqueAccounts = new Set(balances.map(b => b.accountId)).size;
    const totalBalance = balances.reduce((sum, b) => sum + b.closingBalance, 0);
    const totalMovement = balances.reduce((sum, b) => sum + Math.abs(b.movement), 0);
    const positiveMovementDays = balances.filter(b => b.movement > 0).length;
    const negativeMovementDays = balances.filter(b => b.movement < 0).length;
    const daysWithDuplicates = balances.filter(b => b.hasDuplicates).length;
    
    const closingBalances = balances.map(b => b.closingBalance);
    const movements = balances.map(b => b.movement);
    
    return {
      totalDays: balances.length,
      totalAccounts: uniqueAccounts,
      avgDailyBalance: totalBalance / balances.length,
      totalMovement,
      positiveMovementDays,
      negativeMovementDays,
      highestBalance: Math.max(...closingBalances),
      lowestBalance: Math.min(...closingBalances),
      highestMovement: Math.max(...movements),
      lowestMovement: Math.min(...movements),
      daysWithDuplicates
    };
  }

  /**
   * Export balances to CSV format
   * NOW INCLUDES DUPLICATE INFORMATION
   */
  exportToCSV(balances: DailyBalance[]): string {
    const headers = [
      'Date',
      'Account',
      'Opening Balance',
      'Closing Balance',
      'Movement',
      'Transaction Count',
      'Last Transaction Time',
      'Has Duplicates',
      'Duplicate Count'
    ];
    
    const formatCurrency = (amount: number): string => {
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
    
    const csvContent = [
      headers.join(','),
      ...balances.map(balance => [
        balance.date,
        `"${balance.accountName}"`,
        formatCurrency(balance.openingBalance),
        formatCurrency(balance.closingBalance),
        formatCurrency(balance.movement),
        balance.transactionCount,
        balance.lastTransactionTime,
        balance.hasDuplicates ? 'Yes' : 'No',
        balance.duplicateCount || 0
      ].join(','))
    ].join('\n');
    
    return csvContent;
  }
}

// Export singleton instance
export const bankBalanceService = new BankBalanceService(); 