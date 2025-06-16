import { StoredTransaction } from './unifiedDataService';
import { unifiedDataService } from './unifiedDataService';
import { BankAccount } from '../types';
import { importHistoryService } from './importHistoryService';
import { systemIntegrityService } from './systemIntegrityService';

// UNIFIED BALANCE SERVICE
// Consolidates daily balance calculations with balance validation and adjustment tracking
// Combines functionality from bankBalanceService + balanceManagementService

// Daily Balance Interfaces (from bankBalanceService)
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

// Balance Management Interfaces (from balanceManagementService)
export interface BalanceAdjustment {
  id: string;
  accountId: string;
  date: string;
  previousBalance: number;
  newBalance: number;
  adjustmentAmount: number;
  reason: string;
  type: 'manual' | 'import' | 'correction';
  createdAt: number;
  createdBy: string;
}

export interface BalanceValidationResult {
  isValid: boolean;
  issues: BalanceIssue[];
  recommendations: BalanceRecommendation[];
  expectedBalance?: number;
  actualBalance: number;
  variance?: number;
}

export interface BalanceIssue {
  type: 'gap' | 'overlap' | 'mismatch' | 'backward_import';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedDate: string;
  expectedBalance?: number;
  actualBalance?: number;
  variance?: number;
}

export interface BalanceRecommendation {
  action: 'create_adjustment' | 'update_opening_balance' | 'split_import' | 'manual_review';
  description: string;
  suggestedDate?: string;
  suggestedAmount?: number;
}

export interface DateBasedBalance {
  date: string;
  balance: number;
  source: 'import' | 'manual' | 'calculated';
  confidence: 'high' | 'medium' | 'low';
}

class UnifiedBalanceService {
  private readonly ADJUSTMENTS_KEY = 'treasury_balance_adjustments';
  private readonly BALANCE_HISTORY_KEY = 'treasury_balance_history';

  // ==========================================
  // DAILY BALANCE CALCULATIONS (from bankBalanceService)
  // ==========================================

  // Extract daily closing balances from all accounts
  getDailyBalances(): DailyBalance[] {
    try {
      const allAccounts = unifiedDataService.getAllAccounts();
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
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'getDailyBalances',
        error instanceof Error ? error : new Error(String(error)),
        'medium'
      );
      return [];
    }
  }

  // Extract daily closing balances for a specific account
  getDailyBalancesForAccount(accountId: string): DailyBalance[] {
    try {
      const account = unifiedDataService.getAllAccounts().find(a => a.id === accountId);
      if (!account) return [];

      const transactions = unifiedDataService.getTransactionsByAccount(accountId);
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
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'getDailyBalancesForAccount',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { accountId }
      );
      return [];
    }
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
        from: dates[0],
        to: dates[dates.length - 1]
      }
    };
  }

  // Filter balances by criteria
  filterBalances(balances: DailyBalance[], filters: BalanceFilters): DailyBalance[] {
    return balances.filter(balance => {
      // Account filter
      if (filters.accountId && balance.accountId !== filters.accountId) return false;
      
      // Date range filter
      if (filters.dateFrom && balance.date < filters.dateFrom) return false;
      if (filters.dateTo && balance.date > filters.dateTo) return false;
      
      // Balance range filter
      if (filters.balanceFrom && balance.closingBalance < parseFloat(filters.balanceFrom)) return false;
      if (filters.balanceTo && balance.closingBalance > parseFloat(filters.balanceTo)) return false;
      
      // Movement range filter
      if (filters.movementFrom && Math.abs(balance.dailyMovement) < parseFloat(filters.movementFrom)) return false;
      if (filters.movementTo && Math.abs(balance.dailyMovement) > parseFloat(filters.movementTo)) return false;
      
      return true;
    });
  }

  // Export balances to CSV
  exportToCSV(balances: DailyBalance[]): string {
    const headers = [
      'Date', 'Account Name', 'Account Number', 'Bank', 'Currency',
      'Opening Balance', 'Closing Balance', 'Daily Movement', 'Transaction Count'
    ];
    
    const csvLines = [headers.join(',')];
    
    balances.forEach(balance => {
      const line = [
        balance.date,
        `"${balance.accountName}"`,
        `"${balance.accountNumber}"`,
        `"${balance.bankName}"`,
        balance.currency,
        balance.openingBalance.toFixed(2),
        balance.closingBalance.toFixed(2),
        balance.dailyMovement.toFixed(2),
        balance.transactionCount
      ].join(',');
      
      csvLines.push(line);
    });
    
    return csvLines.join('\n');
  }

  // ==========================================
  // BALANCE MANAGEMENT & VALIDATION (from balanceManagementService)
  // ==========================================

  // Get all balance adjustments for an account
  getBalanceAdjustments(accountId: string): BalanceAdjustment[] {
    try {
      const stored = localStorage.getItem(this.ADJUSTMENTS_KEY);
      const allAdjustments: BalanceAdjustment[] = stored ? JSON.parse(stored) : [];
      return allAdjustments.filter(adj => adj.accountId === accountId).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'getBalanceAdjustments',
        error instanceof Error ? error : new Error(String(error)),
        'low',
        { accountId }
      );
      return [];
    }
  }

  // Create a manual balance adjustment
  createBalanceAdjustment(
    accountId: string, 
    date: string, 
    newBalance: number, 
    reason: string,
    previousBalance: number
  ): BalanceAdjustment {
    const adjustment: BalanceAdjustment = {
      id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      accountId,
      date,
      previousBalance,
      newBalance,
      adjustmentAmount: newBalance - previousBalance,
      reason,
      type: 'manual',
      createdAt: Date.now(),
      createdBy: 'user'
    };

    try {
      const stored = localStorage.getItem(this.ADJUSTMENTS_KEY);
      const adjustments: BalanceAdjustment[] = stored ? JSON.parse(stored) : [];
      adjustments.push(adjustment);
      localStorage.setItem(this.ADJUSTMENTS_KEY, JSON.stringify(adjustments));

      // Update balance history
      this.updateBalanceHistory(accountId, date, newBalance, 'manual');
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'createBalanceAdjustment',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { accountId, date, adjustmentAmount: adjustment.adjustmentAmount }
      );
    }

    return adjustment;
  }

  // Create adjustment from validation result
  createAdjustmentFromValidation(
    accountId: string,
    validation: BalanceValidationResult,
    reason: string
  ): BalanceAdjustment | null {
    try {
      if (!validation.expectedBalance || validation.variance === undefined) {
        return null;
      }

      return this.createBalanceAdjustment(
        accountId,
        validation.issues[0]?.affectedDate || new Date().toISOString().split('T')[0],
        validation.expectedBalance,
        reason,
        validation.actualBalance
      );
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'createAdjustmentFromValidation',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { accountId, reason }
      );
      return null;
    }
  }

  // Update account balance with tracking
  updateAccountBalance(account: BankAccount, newBalance: number, effectiveDate: string, reason: string): BankAccount {
    try {
      const previousBalance = account.currentBalance || 0;
      
      // Create adjustment record
      this.createBalanceAdjustment(account.id, effectiveDate, newBalance, reason, previousBalance);
      
      // Return updated account
      // Update the account balance and return the updated account
      const updatedAccount = {
        ...account,
        currentBalance: newBalance
      };
      
      // Store the update timestamp separately if needed for tracking
      // Note: lastUpdated could be used for audit logging if needed
      
      return updatedAccount;
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'updateAccountBalance',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { accountId: account.id, newBalance, effectiveDate }
      );
      return account; // Return unchanged on error
    }
  }

  // Get balance reconciliation summary
  getBalanceReconciliation(accountId: string): {
    currentBalance: number;
    lastImportBalance?: number;
    lastImportDate?: string;
    adjustments: BalanceAdjustment[];
    totalAdjustments: number;
    balanceHistory: DateBasedBalance[];
  } {
    try {
      const adjustments = this.getBalanceAdjustments(accountId);
      const balanceHistory = this.getBalanceHistory(accountId);
      const lastImport = importHistoryService.getLastImportInfo(accountId);
      
      // Get current balance from most recent balance or account data
      let currentBalance = 0;
      if (balanceHistory.length > 0) {
        currentBalance = balanceHistory[balanceHistory.length - 1].balance;
      } else {
        const account = unifiedDataService.getAllAccounts().find(a => a.id === accountId);
        currentBalance = account?.currentBalance || 0;
      }

      return {
        currentBalance,
        lastImportBalance: lastImport?.lastClosingBalance,
        lastImportDate: lastImport?.lastImportDate,
        adjustments,
        totalAdjustments: adjustments.reduce((sum, adj) => sum + adj.adjustmentAmount, 0),
        balanceHistory
      };
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'getBalanceReconciliation',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { accountId }
      );
      
      return {
        currentBalance: 0,
        adjustments: [],
        totalAdjustments: 0,
        balanceHistory: []
      };
    }
  }

  // Validate import against existing balance data
  validateImportBalance(
    accountId: string, 
    importOpeningBalance: number, 
    importClosingBalance: number,
    importDateRange: { from: string; to: string }
  ): BalanceValidationResult {
    const issues: BalanceIssue[] = [];
    const recommendations: BalanceRecommendation[] = [];

    try {
      // Get existing balance data  
      const lastImport = importHistoryService.getLastImportInfo(accountId);

      // Check for backward import scenario
      if (lastImport && new Date(importDateRange.to) < new Date(lastImport.lastImportDate)) {
        issues.push({
          type: 'backward_import',
          severity: 'warning',
          message: `Importing historical data (${importDateRange.to}) before last import date (${lastImport.lastImportDate})`,
          affectedDate: importDateRange.to
        });

        // Check if there's a balance for the day after import period
        const nextDayBalance = this.getBalanceForDate(accountId, this.addDays(importDateRange.to, 1));
        if (nextDayBalance && Math.abs(nextDayBalance.balance - importClosingBalance) > 0.01) {
          const variance = nextDayBalance.balance - importClosingBalance;
          issues.push({
            type: 'mismatch',
            severity: 'error',
            message: `Import closing balance (${importClosingBalance.toFixed(2)}) doesn't match next day balance (${nextDayBalance.balance.toFixed(2)})`,
            affectedDate: importDateRange.to,
            expectedBalance: nextDayBalance.balance,
            actualBalance: importClosingBalance,
            variance
          });

          recommendations.push({
            action: 'create_adjustment',
            description: `Create balance adjustment for ${this.formatCurrency(Math.abs(variance))} on ${importDateRange.to}`,
            suggestedDate: importDateRange.to,
            suggestedAmount: variance
          });
        }
      }

      // Check for forward import scenario
      if (lastImport && new Date(importDateRange.from) > new Date(lastImport.lastImportDate)) {
        const expectedOpeningBalance = lastImport.lastClosingBalance;
        const variance = importOpeningBalance - expectedOpeningBalance;

        if (Math.abs(variance) > 0.01) {
          issues.push({
            type: 'gap',
            severity: variance > 0 ? 'warning' : 'error',
            message: `Gap detected: Import opening balance (${importOpeningBalance.toFixed(2)}) differs from last closing balance (${expectedOpeningBalance.toFixed(2)})`,
            affectedDate: importDateRange.from,
            expectedBalance: expectedOpeningBalance,
            actualBalance: importOpeningBalance,
            variance
          });

          recommendations.push({
            action: 'manual_review',
            description: `Review the ${this.formatCurrency(Math.abs(variance))} difference between ${lastImport.lastImportDate} and ${importDateRange.from}`,
            suggestedAmount: variance
          });
        }
      }

      return {
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        issues,
        recommendations,
        expectedBalance: lastImport?.lastClosingBalance,
        actualBalance: importOpeningBalance,
        variance: lastImport ? importOpeningBalance - lastImport.lastClosingBalance : undefined
      };
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'validateImportBalance',
        error instanceof Error ? error : new Error(String(error)),
        'high',
        { accountId, importDateRange }
      );
      
      return {
        isValid: false,
        issues: [{
          type: 'mismatch',
          severity: 'error',
          message: 'Balance validation failed due to system error',
          affectedDate: importDateRange.from
        }],
        recommendations: [{
          action: 'manual_review',
          description: 'Manual validation required due to system error'
        }],
        actualBalance: importOpeningBalance
      };
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  // Calculate total movement for a day
  private calculateDayMovement(transactions: StoredTransaction[]): number {
    return transactions.reduce((sum, transaction) => {
      const debitAmount = transaction.debitAmount || 0;
      const creditAmount = transaction.creditAmount || 0;
      return sum + creditAmount - debitAmount; // Credits positive, debits negative
    }, 0);
  }

  // Extract date from transaction
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

  // Update balance history
  private updateBalanceHistory(accountId: string, date: string, balance: number, source: DateBasedBalance['source']): void {
    try {
      const stored = localStorage.getItem(this.BALANCE_HISTORY_KEY);
      const allHistory: Record<string, DateBasedBalance[]> = stored ? JSON.parse(stored) : {};
      
      if (!allHistory[accountId]) {
        allHistory[accountId] = [];
      }

      // Remove existing entry for the same date
      allHistory[accountId] = allHistory[accountId].filter(h => h.date !== date);
      
      // Add new entry
      allHistory[accountId].push({
        date,
        balance,
        source,
        confidence: source === 'manual' ? 'high' : source === 'import' ? 'high' : 'medium'
      });

      localStorage.setItem(this.BALANCE_HISTORY_KEY, JSON.stringify(allHistory));
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'updateBalanceHistory',
        error instanceof Error ? error : new Error(String(error)),
        'medium',
        { accountId, date, source }
      );
    }
  }

  // Get balance history for an account
  getBalanceHistory(accountId: string): DateBasedBalance[] {
    try {
      const stored = localStorage.getItem(this.BALANCE_HISTORY_KEY);
      const allHistory: Record<string, DateBasedBalance[]> = stored ? JSON.parse(stored) : {};
      return (allHistory[accountId] || []).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'getBalanceHistory',
        error instanceof Error ? error : new Error(String(error)),
        'low',
        { accountId }
      );
      return [];
    }
  }

  // Get balance for a specific date
  getBalanceForDate(accountId: string, targetDate: string): DateBasedBalance | null {
    const history = this.getBalanceHistory(accountId);
    
    // Find exact date match first
    const exactMatch = history.find(h => h.date === targetDate);
    if (exactMatch) return exactMatch;

    // Find the closest date before the target date
    const beforeTarget = history.filter(h => new Date(h.date) <= new Date(targetDate));
    if (beforeTarget.length === 0) return null;

    return beforeTarget[beforeTarget.length - 1];
  }

  // Helper methods
  private addDays(dateString: string, days: number): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Get available dates for filtering
  getAvailableDates(): string[] {
    const balances = this.getDailyBalances();
    const dates = new Set(balances.map(b => b.date));
    return Array.from(dates).sort();
  }

  // Get balance for specific account and date
  getBalanceForAccountAndDate(accountId: string, date: string): DailyBalance | null {
    const accountBalances = this.getDailyBalancesForAccount(accountId);
    return accountBalances.find(b => b.date === date) || null;
  }

  // Clear balance data
  clearBalanceData(): void {
    try {
      localStorage.removeItem(this.ADJUSTMENTS_KEY);
      localStorage.removeItem(this.BALANCE_HISTORY_KEY);
    } catch (error) {
      systemIntegrityService.logServiceError(
        'UnifiedBalanceService',
        'clearBalanceData',
        error instanceof Error ? error : new Error(String(error)),
        'medium'
      );
    }
  }
}

export const unifiedBalanceService = new UnifiedBalanceService(); 