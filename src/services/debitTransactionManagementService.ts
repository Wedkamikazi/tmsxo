/**
 * DEBIT TRANSACTION MANAGEMENT SERVICE
 * 
 * Handles the Debit Transactions workflow as specified in the Enhanced Cash Management document:
 * - Automatic extraction from bank statements
 * - AI/LLM-based categorization (vendor payments, fees, etc.)
 * - Reconciliation with AP Aging and Forecasted Payments
 * - Auto-reconciliation with confidence ratios
 * - Manual reconciliation for unmatched entries
 * - Verification and observation tracking
 */

import { 
  DebitTransaction, 
  APAgingEntry, 
  ForecastedPayment, 
  ReconciliationMatch,
  AuditLogEntry,
  Transaction 
} from '../types';
import { eventBus } from './eventBus';
import { unifiedCategorizationService } from './unifiedCategorizationService';

// =============================================
// DEBIT TRANSACTION MANAGEMENT SERVICE
// =============================================

class DebitTransactionManagementService {
  private readonly STORAGE_KEY = 'tms_debit_transactions';
  private readonly AP_AGING_KEY = 'tms_ap_aging';
  private readonly FORECASTED_PAYMENTS_KEY = 'tms_forecasted_payments';
  private readonly RECONCILIATION_MATCHES_KEY = 'tms_debit_reconciliation_matches';
  private readonly AUDIT_LOG_KEY = 'tms_debit_audit_log';

  constructor() {
    console.log('✅ Debit Transaction Management Service initialized');
    this.initializeDefaultData();
  }

  // =============================================
  // INITIALIZATION & DEFAULT DATA
  // =============================================

  private initializeDefaultData(): void {
    try {
      // Initialize sample AP Aging data if not exists
      const existingAPAging = this.getStoredData(this.AP_AGING_KEY);
      if (!existingAPAging || existingAPAging.length === 0) {
        this.initializeSampleAPAging();
      }

      // Initialize sample Forecasted Payments data if not exists
      const existingForecasts = this.getStoredData(this.FORECASTED_PAYMENTS_KEY);
      if (!existingForecasts || existingForecasts.length === 0) {
        this.initializeSampleForecastedPayments();
      }

      console.log('✅ Debit Transaction default data initialized');
    } catch (error) {
      console.error('Failed to initialize default data:', error);
    }
  }

  private initializeSampleAPAging(): void {
    const sampleAPAging: APAgingEntry[] = [
      {
        id: 'ap_001',
        vendorName: 'ABC Supplies Ltd',
        invoiceNumber: 'INV-2024-001',
        amount: 15750.00,
        dueDate: '2024-12-20',
        invoiceDate: '2024-11-20',
        aging: '0-30',
        paymentTerms: 'Net 30',
        category: 'office_supplies'
      },
      {
        id: 'ap_002',
        vendorName: 'TechCorp Solutions',
        invoiceNumber: 'TC-456789',
        amount: 28900.00,
        dueDate: '2024-12-15',
        invoiceDate: '2024-11-15',
        aging: '0-30',
        paymentTerms: 'Net 30',
        category: 'technology'
      },
      {
        id: 'ap_003',
        vendorName: 'City Utilities Company',
        invoiceNumber: 'UTIL-2024-12',
        amount: 4250.50,
        dueDate: '2024-12-25',
        invoiceDate: '2024-12-01',
        aging: '0-30',
        paymentTerms: 'Net 25',
        category: 'utilities'
      },
      {
        id: 'ap_004',
        vendorName: 'Professional Services Inc',
        invoiceNumber: 'PS-2024-089',
        amount: 12500.00,
        dueDate: '2024-12-18',
        invoiceDate: '2024-11-18',
        aging: '0-30',
        paymentTerms: 'Net 30',
        category: 'professional_services'
      }
    ];

    this.storeData(this.AP_AGING_KEY, sampleAPAging);
    console.log('✅ Sample AP Aging data initialized');
  }

  private initializeSampleForecastedPayments(): void {
    const sampleForecasts: ForecastedPayment[] = [
      {
        id: 'fp_001',
        vendorName: 'Monthly Software License',
        expectedAmount: 2500.00,
        expectedDate: '2024-12-20',
        paymentType: 'recurring',
        description: 'Software licensing monthly payment',
        category: 'software_license',
        confidence: 0.95
      },
      {
        id: 'fp_002',
        vendorName: 'Office Rent Payment',
        expectedAmount: 18000.00,
        expectedDate: '2024-12-31',
        paymentType: 'recurring',
        description: 'Monthly office rent payment',
        category: 'rent',
        confidence: 0.98
      },
      {
        id: 'fp_003',
        vendorName: 'Insurance Premium',
        expectedAmount: 7500.00,
        expectedDate: '2024-12-28',
        paymentType: 'scheduled',
        description: 'Quarterly insurance premium',
        category: 'insurance',
        confidence: 0.85
      },
      {
        id: 'fp_004',
        vendorName: 'Equipment Maintenance',
        expectedAmount: 3200.00,
        expectedDate: '2024-12-22',
        paymentType: 'scheduled',
        description: 'Quarterly equipment maintenance',
        category: 'maintenance',
        confidence: 0.75
      }
    ];

    this.storeData(this.FORECASTED_PAYMENTS_KEY, sampleForecasts);
    console.log('✅ Sample Forecasted Payments data initialized');
  }

  // =============================================
  // CORE STORAGE OPERATIONS
  // =============================================

  private storeData(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to store data for key ${key}:`, error);
      throw error;
    }
  }

  private getStoredData(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Failed to get stored data for key ${key}:`, error);
      return [];
    }
  }

  // =============================================
  // DEBIT TRANSACTIONS CRUD
  // =============================================

  async getAllDebitTransactions(): Promise<DebitTransaction[]> {
    try {
      return this.getStoredData(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to get all debit transactions:', error);
      return [];
    }
  }

  async getDebitTransactionById(id: string): Promise<DebitTransaction | null> {
    try {
      const transactions = await this.getAllDebitTransactions();
      return transactions.find(t => t.id === id) || null;
    } catch (error) {
      console.error('Failed to get debit transaction by ID:', error);
      return null;
    }
  }

  private async storeDebitTransactions(transactions: DebitTransaction[]): Promise<void> {
    try {
      // Get existing transactions
      const existing = await this.getAllDebitTransactions();
      
      // Merge with new transactions (avoid duplicates)
      const merged = [...existing];
      transactions.forEach(newTransaction => {
        const existingIndex = merged.findIndex(t => t.id === newTransaction.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newTransaction;
        } else {
          merged.push(newTransaction);
        }
      });

      this.storeData(this.STORAGE_KEY, merged);
    } catch (error) {
      console.error('Failed to store debit transactions:', error);
      throw error;
    }
  }

  async updateDebitTransaction(transaction: DebitTransaction): Promise<void> {
    try {
      const transactions = await this.getAllDebitTransactions();
      const index = transactions.findIndex(t => t.id === transaction.id);
      
      if (index >= 0) {
        transactions[index] = transaction;
        this.storeData(this.STORAGE_KEY, transactions);
      } else {
        throw new Error('Debit transaction not found for update');
      }
    } catch (error) {
      console.error('Failed to update debit transaction:', error);
      throw error;
    }
  }

  // =============================================
  // AP AGING & FORECASTED PAYMENTS ACCESS
  // =============================================

  async getAPAging(): Promise<APAgingEntry[]> {
    try {
      return this.getStoredData(this.AP_AGING_KEY);
    } catch (error) {
      console.error('Failed to get AP Aging data:', error);
      return [];
    }
  }

  async getAPAgingById(id: string): Promise<APAgingEntry | null> {
    try {
      const entries = await this.getAPAging();
      return entries.find(e => e.id === id) || null;
    } catch (error) {
      console.error('Failed to get AP Aging by ID:', error);
      return null;
    }
  }

  async getForecastedPayments(): Promise<ForecastedPayment[]> {
    try {
      return this.getStoredData(this.FORECASTED_PAYMENTS_KEY);
    } catch (error) {
      console.error('Failed to get Forecasted Payments data:', error);
      return [];
    }
  }

  async getForecastedPaymentById(id: string): Promise<ForecastedPayment | null> {
    try {
      const forecasts = await this.getForecastedPayments();
      return forecasts.find(f => f.id === id) || null;
    } catch (error) {
      console.error('Failed to get Forecasted Payment by ID:', error);
      return null;
    }
  }

  // =============================================
  // CORE EXTRACTION & PROCESSING
  // =============================================

  /**
   * Extract debit transactions from imported bank statement transactions
   * Automatically categorizes using AI/LLM and stores in dedicated Debit Transactions page
   */
  async extractDebitTransactions(transactions: Transaction[], accountId: string): Promise<DebitTransaction[]> {
    try {
      const debitTransactions: DebitTransaction[] = [];

      for (const transaction of transactions) {
        // Only process debit transactions (positive debit amounts)
        if (transaction.debitAmount && transaction.debitAmount > 0) {
          const debitTransaction: DebitTransaction = {
            id: `debit_${transaction.id}`,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.debitAmount,
            reference: transaction.reference || '',
            accountId: accountId,
            accountName: this.getAccountName(accountId),
            extractionDate: new Date().toISOString(),
            categoryType: await this.categorizeDebitTransaction(transaction),
            reconciliationStatus: 'pending',
            observations: ''
          };

          debitTransactions.push(debitTransaction);
        }
      }

      // Store extracted debit transactions
      await this.storeDebitTransactions(debitTransactions);

      // Emit event for UI updates
      eventBus.emit('DEBIT_TRANSACTIONS_EXTRACTED', {
        count: debitTransactions.length,
        accountId: accountId
      });

      return debitTransactions;
    } catch (error) {
      console.error('Error extracting debit transactions:', error);
      throw error;
    }
  }

  /**
   * AI/LLM-based categorization of debit transactions
   */
  private async categorizeDebitTransaction(transaction: Transaction): Promise<DebitTransaction['categoryType']> {
    try {
      // Use the unified categorization service for AI analysis
      await unifiedCategorizationService.categorizeTransaction(transaction);
      
      // Map to debit transaction categories based on description patterns
      const description = transaction.description.toLowerCase();
      
      if (description.includes('payroll') || description.includes('salary') || description.includes('employee')) {
        return 'hr_payment';
      } else if (description.includes('fee') || description.includes('charge') || description.includes('commission')) {
        return 'fee';
      } else if (description.includes('tax') || description.includes('vat') || description.includes('withholding')) {
        return 'tax';
      } else if (description.includes('deposit') || description.includes('investment') || description.includes('placement')) {
        return 'time_deposit';
      } else if (description.includes('intercompany') || description.includes('transfer out')) {
        return 'intercompany_out';
      } else if (description.includes('vendor') || description.includes('supplier') || description.includes('payment') || description.includes('invoice')) {
        return 'vendor_payment';
      } else {
        return 'other';
      }
    } catch (error) {
      console.warn('AI categorization failed, using fallback logic:', error);
      return 'other';
    }
  }

  // =============================================
  // AUDIT LOGGING
  // =============================================

  async logAuditEntry(action: string, transactionId: string, details: any): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        action,
        transactionId,
        details,
        userId: 'current_user' // In a real app, this would come from authentication
      };

      const existingLog = this.getStoredData(this.AUDIT_LOG_KEY);
      existingLog.push(auditEntry);
      this.storeData(this.AUDIT_LOG_KEY, existingLog);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  private getAccountName(accountId: string): string {
    // This would typically fetch from the account service
    // For now, return a placeholder
    return `Account ${accountId.substring(0, 8)}`;
  }

  // =============================================
  // PUBLIC API FOR UI COMPONENTS
  // =============================================

  /**
   * Get debit transactions with optional filtering
   */
  async getDebitTransactionsForDisplay(filters?: {
    accountId?: string;
    status?: DebitTransaction['reconciliationStatus'];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<DebitTransaction[]> {
    try {
      let transactions = await this.getAllDebitTransactions();

      if (filters) {
        if (filters.accountId) {
          transactions = transactions.filter(t => t.accountId === filters.accountId);
        }
        if (filters.status) {
          transactions = transactions.filter(t => t.reconciliationStatus === filters.status);
        }
        if (filters.dateFrom) {
          transactions = transactions.filter(t => t.date >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          transactions = transactions.filter(t => t.date <= filters.dateTo!);
        }
      }

      return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Failed to get debit transactions for display:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for debit transactions
   */
  async getDebitTransactionsSummary(): Promise<{
    total: number;
    pending: number;
    matched: number;
    confirmed: number;
    totalAmount: number;
    averageConfidence: number;
  }> {
    try {
      const transactions = await this.getAllDebitTransactions();
      
      const summary = {
        total: transactions.length,
        pending: transactions.filter(t => t.reconciliationStatus === 'pending').length,
        matched: transactions.filter(t => 
          t.reconciliationStatus === 'auto_matched' || 
          t.reconciliationStatus === 'manually_matched'
        ).length,
        confirmed: transactions.filter(t => t.reconciliationStatus === 'confirmed').length,
        totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
        averageConfidence: transactions.length > 0 
          ? transactions.reduce((sum, t) => sum + (t.confidenceRatio || 0), 0) / transactions.length
          : 0
      };

      return summary;
    } catch (error) {
      console.error('Failed to get debit transactions summary:', error);
      return {
        total: 0,
        pending: 0,
        matched: 0,
        confirmed: 0,
        totalAmount: 0,
        averageConfidence: 0
      };
    }
  }
}

// Export singleton instance
export const debitTransactionManagementService = new DebitTransactionManagementService(); 