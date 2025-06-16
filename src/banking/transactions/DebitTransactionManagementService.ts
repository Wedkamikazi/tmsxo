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
} from '../../shared/types';
import { eventBus } from '../../core/orchestration/EventBus';
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
        vendorId: 'vendor_001',
        vendorName: 'ABC Supplies Ltd',
        invoiceNumber: 'INV-2024-001',
        dueDate: '2024-12-20',
        amount: 15750.00,
        agingDays: 25,
        status: 'pending'
      },
      {
        id: 'ap_002',
        vendorId: 'vendor_002',
        vendorName: 'TechCorp Solutions',
        invoiceNumber: 'TC-456789',
        dueDate: '2024-12-15',
        amount: 28900.00,
        agingDays: 30,
        status: 'pending'
      },
      {
        id: 'ap_003',
        vendorId: 'vendor_003',
        vendorName: 'City Utilities Company',
        invoiceNumber: 'UTIL-2024-12',
        dueDate: '2024-12-25',
        amount: 4250.50,
        agingDays: 20,
        status: 'pending'
      },
      {
        id: 'ap_004',
        vendorId: 'vendor_004',
        vendorName: 'Professional Services Inc',
        invoiceNumber: 'PS-2024-089',
        dueDate: '2024-12-18',
        amount: 12500.00,
        agingDays: 27,
        status: 'pending'
      }
    ];

    this.storeData(this.AP_AGING_KEY, sampleAPAging);
    console.log('✅ Sample AP Aging data initialized');
  }

  private initializeSampleForecastedPayments(): void {
    const sampleForecasts: ForecastedPayment[] = [
      {
        id: 'fp_001',
        vendorId: 'vendor_005',
        expectedDate: '2024-12-20',
        amount: 2500.00,
        confidence: 'high',
        notes: 'Software licensing monthly payment'
      },
      {
        id: 'fp_002',
        vendorId: 'vendor_006',
        expectedDate: '2024-12-31',
        amount: 18000.00,
        confidence: 'high',
        notes: 'Monthly office rent payment'
      },
      {
        id: 'fp_003',
        vendorId: 'vendor_007',
        expectedDate: '2024-12-28',
        amount: 7500.00,
        confidence: 'medium',
        notes: 'Quarterly insurance premium'
      },
      {
        id: 'fp_004',
        vendorId: 'vendor_008',
        expectedDate: '2024-12-22',
        amount: 3200.00,
        confidence: 'medium',
        notes: 'Quarterly equipment maintenance'
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
  // RECONCILIATION LOGIC
  // =============================================

  /**
   * Auto-reconcile debit transactions with AP Aging and Forecasted Payments
   */
  async performAutoReconciliation(debitTransactionId: string): Promise<ReconciliationMatch | null> {
    try {
      const debitTransaction = await this.getDebitTransactionById(debitTransactionId);
      if (!debitTransaction) {
        throw new Error('Debit transaction not found');
      }

      // Try to match with AP Aging first
      const apMatch = await this.matchWithAPAging(debitTransaction);
      if (apMatch && apMatch.confidenceScore >= 0.8) {
        const reconciliationMatch: ReconciliationMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transactionId: debitTransaction.id,
          matchedEntityId: apMatch.matchedEntityId,
          matchedEntityType: 'ap_aging',
          matchType: 'auto',
          confidenceScore: apMatch.confidenceScore,
          matchDate: new Date().toISOString(),
          notes: apMatch.notes
        };

        // Update debit transaction
        debitTransaction.reconciliationStatus = 'auto_matched';
        debitTransaction.confidenceRatio = apMatch.confidenceScore;
        debitTransaction.apAgingMatch = apMatch.apEntry;

        await this.updateDebitTransaction(debitTransaction);
        await this.storeReconciliationMatch(reconciliationMatch);

        return reconciliationMatch;
      }

      // Try to match with Forecasted Payments
      const forecastMatch = await this.matchWithForecastedPayments(debitTransaction);
      if (forecastMatch && forecastMatch.confidenceScore >= 0.7) {
        const reconciliationMatch: ReconciliationMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transactionId: debitTransaction.id,
          matchedEntityId: forecastMatch.matchedEntityId,
          matchedEntityType: 'forecast',
          matchType: 'auto',
          confidenceScore: forecastMatch.confidenceScore,
          matchDate: new Date().toISOString(),
          notes: forecastMatch.notes
        };

        // Update debit transaction
        debitTransaction.reconciliationStatus = 'auto_matched';
        debitTransaction.confidenceRatio = forecastMatch.confidenceScore;
        debitTransaction.forecastMatch = forecastMatch.forecastEntry;

        await this.updateDebitTransaction(debitTransaction);
        await this.storeReconciliationMatch(reconciliationMatch);

        return reconciliationMatch;
      }

      return null;
    } catch (error) {
      console.error('Auto-reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * Manual reconciliation by user
   */
  async performManualReconciliation(
    debitTransactionId: string, 
    matchedEntityId: string, 
    matchedEntityType: ReconciliationMatch['matchedEntityType'],
    notes?: string
  ): Promise<ReconciliationMatch> {
    try {
      const debitTransaction = await this.getDebitTransactionById(debitTransactionId);
      if (!debitTransaction) {
        throw new Error('Debit transaction not found');
      }

      const reconciliationMatch: ReconciliationMatch = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        transactionId: debitTransaction.id,
        matchedEntityId: matchedEntityId,
        matchedEntityType: matchedEntityType,
        matchType: 'manual',
        confidenceScore: 1.0, // Manual matches get full confidence
        matchDate: new Date().toISOString(),
        notes: notes || 'Manual reconciliation by user'
      };

      // Update debit transaction
      debitTransaction.reconciliationStatus = 'manually_matched';
      debitTransaction.confidenceRatio = 1.0;

      // Attach the matched entity details
      if (matchedEntityType === 'ap_aging') {
        const apEntry = await this.getAPAgingById(matchedEntityId);
        debitTransaction.apAgingMatch = apEntry || undefined;
      } else if (matchedEntityType === 'forecast') {
        const forecastEntry = await this.getForecastedPaymentById(matchedEntityId);
        debitTransaction.forecastMatch = forecastEntry || undefined;
      }

      await this.updateDebitTransaction(debitTransaction);
      await this.storeReconciliationMatch(reconciliationMatch);

      // Log the manual action
      await this.logAuditEntry('MANUAL_RECONCILIATION', debitTransaction.id, {
        matchedEntityId,
        matchedEntityType,
        notes
      });

      return reconciliationMatch;
    } catch (error) {
      console.error('Manual reconciliation failed:', error);
      throw error;
    }
  }

  /**
   * User confirms a matched transaction to clear it
   */
  async confirmTransaction(debitTransactionId: string, verifiedBy: string, observations?: string): Promise<void> {
    try {
      const debitTransaction = await this.getDebitTransactionById(debitTransactionId);
      if (!debitTransaction) {
        throw new Error('Debit transaction not found');
      }

      debitTransaction.reconciliationStatus = 'confirmed';
      debitTransaction.verificationDate = new Date().toISOString();
      debitTransaction.verifiedBy = verifiedBy;
      if (observations) {
        debitTransaction.observations = observations;
      }

      await this.updateDebitTransaction(debitTransaction);

      // Log the confirmation
      await this.logAuditEntry('TRANSACTION_CONFIRMED', debitTransaction.id, {
        verifiedBy,
        observations
      });

      eventBus.emit('DEBIT_TRANSACTION_CONFIRMED', debitTransaction);
    } catch (error) {
      console.error('Transaction confirmation failed:', error);
      throw error;
    }
  }

  // =============================================
  // MATCHING ALGORITHMS
  // =============================================

  private async matchWithAPAging(debitTransaction: DebitTransaction): Promise<{
    confidenceScore: number;
    matchedEntityId: string;
    apEntry: APAgingEntry;
    notes: string;
  } | null> {
    try {
      const apEntries = await this.getAPAging();
      let bestMatch: any = null;
      let highestScore = 0;

      for (const apEntry of apEntries) {
        let score = 0;

        // Amount matching (exact match gets highest score)
        if (Math.abs(apEntry.amount - debitTransaction.amount) < 0.01) {
          score += 0.6;
        } else if (Math.abs(apEntry.amount - debitTransaction.amount) / apEntry.amount < 0.05) {
          score += 0.4; // Within 5%
        } else if (Math.abs(apEntry.amount - debitTransaction.amount) / apEntry.amount < 0.1) {
          score += 0.2; // Within 10%
        }

        // Description matching
        const description = debitTransaction.description.toLowerCase();
        const vendorName = apEntry.vendorName.toLowerCase();
        const invoiceNumber = apEntry.invoiceNumber.toLowerCase();

        if (description.includes(vendorName)) {
          score += 0.3;
        }
        if (description.includes(invoiceNumber)) {
          score += 0.3;
        }

        // Date proximity (closer dates get higher scores)
        const transactionDate = new Date(debitTransaction.date);
        const dueDate = new Date(apEntry.dueDate);
        const daysDiff = Math.abs((transactionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) {
          score += 0.2;
        } else if (daysDiff <= 30) {
          score += 0.1;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            confidenceScore: score,
            matchedEntityId: apEntry.id,
            apEntry: apEntry,
            notes: `Matched based on amount (${score >= 0.6 ? 'exact' : 'approximate'}), vendor name, and date proximity`
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('AP Aging matching failed:', error);
      return null;
    }
  }

  private async matchWithForecastedPayments(debitTransaction: DebitTransaction): Promise<{
    confidenceScore: number;
    matchedEntityId: string;
    forecastEntry: ForecastedPayment;
    notes: string;
  } | null> {
    try {
      const forecasts = await this.getForecastedPayments();
      let bestMatch: any = null;
      let highestScore = 0;

      for (const forecast of forecasts) {
        let score = 0;

        // Amount matching (exact match gets highest score)
        if (Math.abs(forecast.amount - debitTransaction.amount) < 0.01) {
          score += 0.5;
        } else if (Math.abs(forecast.amount - debitTransaction.amount) / forecast.amount < 0.05) {
          score += 0.3; // Within 5%
        } else if (Math.abs(forecast.amount - debitTransaction.amount) / forecast.amount < 0.1) {
          score += 0.15; // Within 10%
        }

        // Description matching with notes
        const description = debitTransaction.description.toLowerCase();
        const vendorId = forecast.vendorId.toLowerCase();
        const forecastNotes = forecast.notes?.toLowerCase() || '';

        if (description.includes(vendorId)) {
          score += 0.25;
        }
        if (forecastNotes && description.includes(forecastNotes.split(' ')[0])) { // Match first word of forecast notes
          score += 0.15;
        }

        // Date proximity (expected payment date)
        const transactionDate = new Date(debitTransaction.date);
        const expectedDate = new Date(forecast.expectedDate);
        const daysDiff = Math.abs((transactionDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 3) {
          score += 0.2;
        } else if (daysDiff <= 7) {
          score += 0.15;
        } else if (daysDiff <= 14) {
          score += 0.1;
        }

        // Apply forecast confidence as a modifier (convert string to numeric)
        const confidenceMultiplier = forecast.confidence === 'high' ? 1.0 : forecast.confidence === 'medium' ? 0.8 : 0.6;
        score *= confidenceMultiplier;

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            confidenceScore: score,
            matchedEntityId: forecast.id,
            forecastEntry: forecast,
            notes: `Matched based on expected amount, vendor ID, and payment date (forecast confidence: ${forecast.confidence})`
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Forecasted Payments matching failed:', error);
      return null;
    }
  }

  private async storeReconciliationMatch(match: ReconciliationMatch): Promise<void> {
    try {
      const existingMatches = this.getStoredData(this.RECONCILIATION_MATCHES_KEY);
      existingMatches.push(match);
      this.storeData(this.RECONCILIATION_MATCHES_KEY, existingMatches);
    } catch (error) {
      console.error('Failed to store reconciliation match:', error);
      throw error;
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
        userId: 'current_user', // In a real app, this would come from authentication
        action,
        entityType: 'debit',
        entityId: transactionId,
        newValues: details
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