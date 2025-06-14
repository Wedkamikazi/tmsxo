import { BankAccount } from '../types';
import { importHistoryService } from './importHistoryService';

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

class BalanceManagementService {
  private readonly ADJUSTMENTS_KEY = 'treasury_balance_adjustments';
  private readonly BALANCE_HISTORY_KEY = 'treasury_balance_history';

  // Get all balance adjustments for an account
  getBalanceAdjustments(accountId: string): BalanceAdjustment[] {
    const stored = localStorage.getItem(this.ADJUSTMENTS_KEY);
    const allAdjustments: BalanceAdjustment[] = stored ? JSON.parse(stored) : [];
    return allAdjustments.filter(adj => adj.accountId === accountId).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
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

    const stored = localStorage.getItem(this.ADJUSTMENTS_KEY);
    const adjustments: BalanceAdjustment[] = stored ? JSON.parse(stored) : [];
    adjustments.push(adjustment);
    localStorage.setItem(this.ADJUSTMENTS_KEY, JSON.stringify(adjustments));

    // Update balance history
    this.updateBalanceHistory(accountId, date, newBalance, 'manual');

    return adjustment;
  }

  // Get balance history for an account
  getBalanceHistory(accountId: string): DateBasedBalance[] {
    const stored = localStorage.getItem(this.BALANCE_HISTORY_KEY);
    const allHistory: Record<string, DateBasedBalance[]> = stored ? JSON.parse(stored) : {};
    return (allHistory[accountId] || []).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  // Update balance history
  private updateBalanceHistory(accountId: string, date: string, balance: number, source: DateBasedBalance['source']): void {
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

  // Validate import against existing balance data
  validateImportBalance(
    accountId: string, 
    importOpeningBalance: number, 
    importClosingBalance: number,
    importDateRange: { from: string; to: string }
  ): BalanceValidationResult {
    const issues: BalanceIssue[] = [];
    const recommendations: BalanceRecommendation[] = [];

    // Get existing balance data
    const balanceHistory = this.getBalanceHistory(accountId);
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

    // Check for overlapping periods
    if (balanceHistory.length > 0) {
      const overlappingBalances = balanceHistory.filter(h => 
        new Date(h.date) >= new Date(importDateRange.from) && 
        new Date(h.date) <= new Date(importDateRange.to)
      );

      if (overlappingBalances.length > 0) {
        issues.push({
          type: 'overlap',
          severity: 'info',
          message: `Import period overlaps with ${overlappingBalances.length} existing balance entries`,
          affectedDate: importDateRange.from
        });

        recommendations.push({
          action: 'manual_review',
          description: 'Review overlapping transactions for potential duplicates'
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
  }

  // Create balance adjustment from import validation
  createAdjustmentFromValidation(
    accountId: string,
    validation: BalanceValidationResult,
    reason: string
  ): BalanceAdjustment | null {
    if (!validation.variance || !validation.expectedBalance) return null;

    const gapIssue = validation.issues.find(i => i.type === 'gap' || i.type === 'mismatch');
    if (!gapIssue?.affectedDate) return null;

    return this.createBalanceAdjustment(
      accountId,
      gapIssue.affectedDate,
      validation.actualBalance,
      reason,
      validation.expectedBalance
    );
  }

  // Update account balance with date
  updateAccountBalance(account: BankAccount, newBalance: number, effectiveDate: string, reason: string): BankAccount {
    // Create balance adjustment record
    this.createBalanceAdjustment(
      account.id,
      effectiveDate,
      newBalance,
      reason,
      account.currentBalance
    );

    // Update the account
    const updatedAccount: BankAccount = {
      ...account,
      currentBalance: newBalance
    };

    return updatedAccount;
  }

  // Get balance reconciliation report
  getBalanceReconciliation(accountId: string): {
    currentBalance: number;
    lastImportBalance?: number;
    lastImportDate?: string;
    adjustments: BalanceAdjustment[];
    totalAdjustments: number;
    balanceHistory: DateBasedBalance[];
  } {
    const adjustments = this.getBalanceAdjustments(accountId);
    const lastImport = importHistoryService.getLastImportInfo(accountId);
    const balanceHistory = this.getBalanceHistory(accountId);
    
    const totalAdjustments = adjustments.reduce((sum, adj) => sum + adj.adjustmentAmount, 0);

    return {
      currentBalance: balanceHistory.length > 0 ? balanceHistory[balanceHistory.length - 1].balance : 0,
      lastImportBalance: lastImport?.lastClosingBalance,
      lastImportDate: lastImport?.lastImportDate,
      adjustments,
      totalAdjustments,
      balanceHistory
    };
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
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  // Clear all balance data (for testing)
  clearBalanceData(): void {
    localStorage.removeItem(this.ADJUSTMENTS_KEY);
    localStorage.removeItem(this.BALANCE_HISTORY_KEY);
  }
}

export const balanceManagementService = new BalanceManagementService(); 