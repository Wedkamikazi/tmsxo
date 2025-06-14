import { StoredTransaction } from './unifiedDataService';
import { unifiedDataService } from './unifiedDataService';
import { bankAccountService } from './bankAccountService';

export interface DailyBalance {
  id: string;
  accountId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  date: string; // YYYY-MM-DD format
  closingBalance: number;
  openingBalance: number;
  dailyMovement: number;
  transactionCount: number;
  lastTransactionTime: string;
  lastTransactionId: string;
}

export interface BalanceFilters {
  accountId: string;
  dateFrom: string;
  dateTo: string;
  balanceFrom: string;
  balanceTo: string;
  movementFrom: string;
  movementTo: string;
}

export interface BalanceStats {
  totalAccounts: number;
  totalDays: number;
  averageBalance: number;
  highestBalance: number;
  lowestBalance: number;
  totalMovement: number;
  dateRange: {
    from: string;
    to: string;
  };
}

class BankBalanceService {
  // Extract daily closing balances from all accounts
  getDailyBalances(): DailyBalance[] {
    const allAccounts = bankAccountService.getAllAccounts();
    const allBalances: DailyBalance[] = [];

    allAccounts.forEach(account => {
      const accountBalances = this.getDailyBalancesForAccount(account.id);
      allBalances.push(...accountBalances);
    });

    // Sort by date descending (newest first), then by account name
    return allBalances.sort((a, b) => {
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateComparison !== 0) return dateComparison;
      return a.accountName.localeCompare(b.accountName);
    });
  }

  // Extract daily closing balances for a specific account
  getDailyBalancesForAccount(accountId: string): DailyBalance[] {
    const account = bankAccountService.getAccountById(accountId);
    if (!account) return [];

    const transactions = transactionStorageService.getTransactionsByAccount(accountId);
    if (transactions.length === 0) return [];

    // Group transactions by date (using post date)
    const transactionsByDate = new Map<string, StoredTransaction[]>();
    
    transactions.forEach(transaction => {
      const postDate = this.extractDateFromTransaction(transaction);
      if (!transactionsByDate.has(postDate)) {
        transactionsByDate.set(postDate, []);
      }
      transactionsByDate.get(postDate)!.push(transaction);
    });

    const dailyBalances: DailyBalance[] = [];
    const sortedDates = Array.from(transactionsByDate.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    let previousClosingBalance: number | null = null;

    sortedDates.forEach(date => {
      const dayTransactions = transactionsByDate.get(date)!;
      
      // Sort transactions by postDateTime to get the last one of the day
      const sortedDayTransactions = dayTransactions.sort((a, b) => 
        new Date(b.postDateTime).getTime() - new Date(a.postDateTime).getTime()
      );

      const lastTransaction = sortedDayTransactions[0]; // Most recent transaction of the day

      // Determine opening balance for the day
      let openingBalance: number;
      if (previousClosingBalance !== null) {
        openingBalance = previousClosingBalance;
      } else {
        // For the first day, calculate opening balance from first transaction
        const totalDayMovement = this.calculateDayMovement(dayTransactions);
        openingBalance = lastTransaction.balance - totalDayMovement;
      }

      const closingBalance = lastTransaction.balance;
      const dailyMovement = closingBalance - openingBalance;

      dailyBalances.push({
        id: `${accountId}_${date}`,
        accountId,
        accountName: account.name,
        accountNumber: account.accountNumber,
        bankName: account.bankName,
        currency: account.currency,
        date,
        closingBalance,
        openingBalance,
        dailyMovement,
        transactionCount: dayTransactions.length,
        lastTransactionTime: this.extractTimeFromTransaction(lastTransaction),
        lastTransactionId: lastTransaction.id
      });

      previousClosingBalance = closingBalance;
    });

    return dailyBalances;
  }

  // Calculate total movement for a day (sum of all debits and credits)
  private calculateDayMovement(transactions: StoredTransaction[]): number {
    return transactions.reduce((sum, transaction) => {
      const debitAmount = transaction.debitAmount || 0;
      const creditAmount = transaction.creditAmount || 0;
      return sum + creditAmount - debitAmount; // Credits positive, debits negative
    }, 0);
  }

  // Extract date from transaction (prefers postDate, falls back to date)
  private extractDateFromTransaction(transaction: StoredTransaction): string {
    const postDate = transaction.postDate || transaction.date;
    
    // Convert DD/MM/YYYY to YYYY-MM-DD
    if (postDate.includes('/')) {
      const parts = postDate.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    
    // If already in YYYY-MM-DD format or ISO format, extract date part
    return postDate.split('T')[0];
  }

  // Extract time from transaction
  private extractTimeFromTransaction(transaction: StoredTransaction): string {
    if (transaction.time) {
      return transaction.time;
    }
    
    // Extract time from postDateTime if available
    if (transaction.postDateTime && transaction.postDateTime.includes('T')) {
      const timePart = transaction.postDateTime.split('T')[1];
      return timePart.split('.')[0]; // Remove milliseconds if present
    }
    
    return '00:00:00';
  }

  // Get balance statistics
  getBalanceStats(balances: DailyBalance[]): BalanceStats {
    if (balances.length === 0) {
      return {
        totalAccounts: 0,
        totalDays: 0,
        averageBalance: 0,
        highestBalance: 0,
        lowestBalance: 0,
        totalMovement: 0,
        dateRange: { from: '', to: '' }
      };
    }

    const uniqueAccounts = new Set(balances.map(b => b.accountId)).size;
    const balanceValues = balances.map(b => b.closingBalance);
    const movementValues = balances.map(b => Math.abs(b.dailyMovement));
    const dates = balances.map(b => b.date).sort();

    return {
      totalAccounts: uniqueAccounts,
      totalDays: balances.length,
      averageBalance: balanceValues.reduce((sum, val) => sum + val, 0) / balanceValues.length,
      highestBalance: Math.max(...balanceValues),
      lowestBalance: Math.min(...balanceValues),
      totalMovement: movementValues.reduce((sum, val) => sum + val, 0),
      dateRange: {
        from: dates[0] || '',
        to: dates[dates.length - 1] || ''
      }
    };
  }

  // Filter balances based on criteria
  filterBalances(balances: DailyBalance[], filters: BalanceFilters): DailyBalance[] {
    return balances.filter(balance => {
      // Account filter
      if (filters.accountId && balance.accountId !== filters.accountId) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom && balance.date < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && balance.date > filters.dateTo) {
        return false;
      }

      // Balance range filter
      if (filters.balanceFrom && balance.closingBalance < parseFloat(filters.balanceFrom)) {
        return false;
      }
      if (filters.balanceTo && balance.closingBalance > parseFloat(filters.balanceTo)) {
        return false;
      }

      // Movement range filter
      if (filters.movementFrom && Math.abs(balance.dailyMovement) < parseFloat(filters.movementFrom)) {
        return false;
      }
      if (filters.movementTo && Math.abs(balance.dailyMovement) > parseFloat(filters.movementTo)) {
        return false;
      }

      return true;
    });
  }

  // Export balances to CSV
  exportToCSV(balances: DailyBalance[]): string {
    const headers = [
      'Date',
      'Account Name',
      'Account Number',
      'Bank Name',
      'Currency',
      'Opening Balance',
      'Closing Balance',
      'Daily Movement',
      'Transaction Count',
      'Last Transaction Time'
    ];

    const csvContent = [
      headers.join(','),
      ...balances.map(balance => [
        balance.date,
        `"${balance.accountName}"`,
        `"${balance.accountNumber}"`,
        `"${balance.bankName}"`,
        balance.currency,
        balance.openingBalance.toFixed(2),
        balance.closingBalance.toFixed(2),
        balance.dailyMovement.toFixed(2),
        balance.transactionCount,
        `"${balance.lastTransactionTime}"`
      ].join(','))
    ].join('\n');

    return csvContent;
  }

  // Get unique dates for filtering
  getAvailableDates(): string[] {
    const balances = this.getDailyBalances();
    const dates = Array.from(new Set(balances.map(b => b.date))).sort();
    return dates;
  }

  // Get balance for specific account and date
  getBalanceForAccountAndDate(accountId: string, date: string): DailyBalance | null {
    const accountBalances = this.getDailyBalancesForAccount(accountId);
    return accountBalances.find(balance => balance.date === date) || null;
  }
}

export const bankBalanceService = new BankBalanceService(); 