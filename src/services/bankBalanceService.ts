import { unifiedDataService, type StoredTransaction } from './unifiedDataService';
import { BankAccount } from '../types';

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
}

type SortField = 'date' | 'accountName' | 'openingBalance' | 'closingBalance' | 'movement' | 'transactionCount';
type SortDirection = 'asc' | 'desc';

class BankBalanceService {
  /**
   * Extracts daily closing balances from transaction data
   * Uses the last transaction of each day by postDateTime to determine closing balance
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
        
        // Sort transactions by postDateTime (or fallback to time)
        dayTransactions.sort((a, b) => {
          const aDateTime = a.postDateTime || `${a.postDate || a.date}T${a.time || '00:00'}:00`;
          const bDateTime = b.postDateTime || `${b.postDate || b.date}T${b.time || '00:00'}:00`;
          return new Date(aDateTime).getTime() - new Date(bDateTime).getTime();
        });
        
        // Last transaction determines the closing balance
        const lastTransaction = dayTransactions[dayTransactions.length - 1];
        const closingBalance = lastTransaction.balance;
        
        // Opening balance is either previous day's closing or calculated from first transaction
        let openingBalance: number;
        if (index === 0) {
          // For first day, calculate opening balance from first transaction
          const firstTransaction = dayTransactions[0];
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
          transactionCount: dayTransactions.length,
          lastTransactionTime,
          lastTransactionId: lastTransaction.id
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
        lowestMovement: 0
      };
    }
    
    const uniqueAccounts = new Set(balances.map(b => b.accountId)).size;
    const totalBalance = balances.reduce((sum, b) => sum + b.closingBalance, 0);
    const totalMovement = balances.reduce((sum, b) => sum + Math.abs(b.movement), 0);
    const positiveMovementDays = balances.filter(b => b.movement > 0).length;
    const negativeMovementDays = balances.filter(b => b.movement < 0).length;
    
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
      lowestMovement: Math.min(...movements)
    };
  }

  /**
   * Export balances to CSV format
   */
  exportToCSV(balances: DailyBalance[]): string {
    const headers = [
      'Date',
      'Account',
      'Opening Balance',
      'Closing Balance',
      'Movement',
      'Transaction Count',
      'Last Transaction Time'
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
        balance.lastTransactionTime
      ].join(','))
    ].join('\n');
    
    return csvContent;
  }
}

// Export singleton instance
export const bankBalanceService = new BankBalanceService(); 