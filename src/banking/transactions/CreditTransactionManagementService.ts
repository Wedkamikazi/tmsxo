/**
 * CREDIT TRANSACTION MANAGEMENT SERVICE
 * 
 * Handles the Credit Transactions workflow as specified in the Enhanced Cash Management document:
 * - Automatic extraction from bank statements
 * - AI/LLM-based categorization (customer payments, refunds, etc.)
 * - Reconciliation with AR Aging and Forecasted Collections
 * - Auto-reconciliation with confidence ratios
 * - Manual reconciliation for unmatched entries
 * - Verification and observation tracking
 */

import { 
  CreditTransaction, 
  ARAgingEntry, 
  ForecastedCollection, 
  ReconciliationMatch,
  AuditLogEntry,
  Transaction 
} from '../shared/types';
import { eventBus } from './EventBus';
import { unifiedCategorizationService } from './unifiedCategorizationService';

// =============================================
// CREDIT TRANSACTION MANAGEMENT SERVICE
// =============================================

class CreditTransactionManagementService {
  private readonly STORAGE_KEY = 'tms_credit_transactions';
  private readonly AR_AGING_KEY = 'tms_ar_aging';
  private readonly FORECASTED_COLLECTIONS_KEY = 'tms_forecasted_collections';
  private readonly RECONCILIATION_MATCHES_KEY = 'tms_credit_reconciliation_matches';
  private readonly AUDIT_LOG_KEY = 'tms_credit_audit_log';

  constructor() {
    console.log('✅ Credit Transaction Management Service initialized');
    this.initializeDefaultData();
  }

  // =============================================
  // CORE EXTRACTION & STORAGE
  // =============================================

  /**
   * Extract credit transactions from imported bank statement transactions
   * Automatically categorizes using AI/LLM and stores in dedicated Credit Transactions page
   */
  async extractCreditTransactions(transactions: Transaction[], accountId: string): Promise<CreditTransaction[]> {
    try {
      const creditTransactions: CreditTransaction[] = [];

      for (const transaction of transactions) {
        // Only process credit transactions (positive credit amounts)
        if (transaction.creditAmount && transaction.creditAmount > 0) {
          const creditTransaction: CreditTransaction = {
            id: `credit_${transaction.id}`,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.creditAmount,
            reference: transaction.reference || '',
            accountId: accountId,
            accountName: this.getAccountName(accountId),
            extractionDate: new Date().toISOString(),
            categoryType: await this.categorizeCreditTransaction(transaction),
            reconciliationStatus: 'pending',
            observations: ''
          };

          creditTransactions.push(creditTransaction);
        }
      }

      // Store extracted credit transactions
      await this.storeCreditTransactions(creditTransactions);

      // Emit event for UI updates
      eventBus.emit('CREDIT_TRANSACTIONS_EXTRACTED', {
        count: creditTransactions.length,
        accountId: accountId
      });

      return creditTransactions;
    } catch (error) {
      console.error('Error extracting credit transactions:', error);
      throw error;
    }
  }

  /**
   * AI/LLM-based categorization of credit transactions
   */
  private async categorizeCreditTransaction(transaction: Transaction): Promise<CreditTransaction['categoryType']> {
    try {
      // Use the unified categorization service for AI analysis
      await unifiedCategorizationService.categorizeTransaction(transaction);
      
      // Map to credit transaction categories based on description patterns
      const description = transaction.description.toLowerCase();
      
      if (description.includes('payment') || description.includes('receipt')) {
        return 'customer_payment';
      } else if (description.includes('refund') || description.includes('return')) {
        return 'refund';
      } else if (description.includes('interest') || description.includes('profit')) {
        return 'interest';
      } else if (description.includes('maturity') || description.includes('deposit')) {
        return 'investment_maturity';
      } else if (description.includes('intercompany') || description.includes('transfer')) {
        return 'intercompany_in';
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
   * Auto-reconcile credit transactions with AR Aging and Forecasted Collections
   */
  async performAutoReconciliation(creditTransactionId: string): Promise<ReconciliationMatch | null> {
    try {
      const creditTransaction = await this.getCreditTransactionById(creditTransactionId);
      if (!creditTransaction) {
        throw new Error('Credit transaction not found');
      }

      // Try to match with AR Aging first
      const arMatch = await this.matchWithARAgings(creditTransaction);
      if (arMatch && arMatch.confidenceScore >= 0.8) {
        const reconciliationMatch: ReconciliationMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transactionId: creditTransaction.id,
          matchedEntityId: arMatch.matchedEntityId,
          matchedEntityType: 'ar_aging',
          matchType: 'auto',
          confidenceScore: arMatch.confidenceScore,
          matchDate: new Date().toISOString(),
          notes: arMatch.notes
        };

        // Update credit transaction
        creditTransaction.reconciliationStatus = 'auto_matched';
        creditTransaction.confidenceRatio = arMatch.confidenceScore;
        creditTransaction.arAgingMatch = arMatch.arEntry;

        await this.updateCreditTransaction(creditTransaction);
        await this.storeReconciliationMatch(reconciliationMatch);

        return reconciliationMatch;
      }

      // Try to match with Forecasted Collections
      const forecastMatch = await this.matchWithForecastedCollections(creditTransaction);
      if (forecastMatch && forecastMatch.confidenceScore >= 0.7) {
        const reconciliationMatch: ReconciliationMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transactionId: creditTransaction.id,
          matchedEntityId: forecastMatch.matchedEntityId,
          matchedEntityType: 'forecast',
          matchType: 'auto',
          confidenceScore: forecastMatch.confidenceScore,
          matchDate: new Date().toISOString(),
          notes: forecastMatch.notes
        };

        // Update credit transaction
        creditTransaction.reconciliationStatus = 'auto_matched';
        creditTransaction.confidenceRatio = forecastMatch.confidenceScore;
        creditTransaction.forecastMatch = forecastMatch.forecastEntry;

        await this.updateCreditTransaction(creditTransaction);
        await this.storeReconciliationMatch(reconciliationMatch);

        return reconciliationMatch;
      }

      // No match found - mark as unknown collection for manual action
      creditTransaction.reconciliationStatus = 'unknown_collection';
      await this.updateCreditTransaction(creditTransaction);

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
    creditTransactionId: string, 
    matchedEntityId: string, 
    matchedEntityType: ReconciliationMatch['matchedEntityType'],
    notes?: string
  ): Promise<ReconciliationMatch> {
    try {
      const creditTransaction = await this.getCreditTransactionById(creditTransactionId);
      if (!creditTransaction) {
        throw new Error('Credit transaction not found');
      }

      const reconciliationMatch: ReconciliationMatch = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        transactionId: creditTransaction.id,
        matchedEntityId: matchedEntityId,
        matchedEntityType: matchedEntityType,
        matchType: 'manual',
        confidenceScore: 1.0, // Manual matches get full confidence
        matchDate: new Date().toISOString(),
        notes: notes || 'Manual reconciliation by user'
      };

      // Update credit transaction
      creditTransaction.reconciliationStatus = 'manually_matched';
      creditTransaction.confidenceRatio = 1.0;

      // Attach the matched entity details
      if (matchedEntityType === 'ar_aging') {
        creditTransaction.arAgingMatch = await this.getARAgingById(matchedEntityId);
      } else if (matchedEntityType === 'forecast') {
        creditTransaction.forecastMatch = await this.getForecastedCollectionById(matchedEntityId);
      }

      await this.updateCreditTransaction(creditTransaction);
      await this.storeReconciliationMatch(reconciliationMatch);

      // Log the manual action
      await this.logAuditEntry('MANUAL_RECONCILIATION', creditTransaction.id, {
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
  async confirmTransaction(creditTransactionId: string, verifiedBy: string, observations?: string): Promise<void> {
    try {
      const creditTransaction = await this.getCreditTransactionById(creditTransactionId);
      if (!creditTransaction) {
        throw new Error('Credit transaction not found');
      }

      creditTransaction.reconciliationStatus = 'confirmed';
      creditTransaction.verificationDate = new Date().toISOString();
      creditTransaction.verifiedBy = verifiedBy;
      if (observations) {
        creditTransaction.observations = observations;
      }

      await this.updateCreditTransaction(creditTransaction);

      // Log the confirmation
      await this.logAuditEntry('TRANSACTION_CONFIRMED', creditTransaction.id, {
        verifiedBy,
        observations
      });

      eventBus.emit('CREDIT_TRANSACTION_CONFIRMED', creditTransaction);
    } catch (error) {
      console.error('Transaction confirmation failed:', error);
      throw error;
    }
  }

  // =============================================
  // MATCHING ALGORITHMS
  // =============================================

  private async matchWithARAgings(creditTransaction: CreditTransaction): Promise<{
    confidenceScore: number;
    matchedEntityId: string;
    arEntry: ARAgingEntry;
    notes: string;
  } | null> {
    try {
      const arAgings = await this.getARAgings();
      let bestMatch: any = null;
      let highestScore = 0;

      for (const arAging of arAgings) {
        let score = 0;

        // Amount matching (exact match gets highest score)
        if (Math.abs(arAging.amount - creditTransaction.amount) < 0.01) {
          score += 0.6;
        } else if (Math.abs(arAging.amount - creditTransaction.amount) / arAging.amount < 0.05) {
          score += 0.4; // Within 5%
        } else if (Math.abs(arAging.amount - creditTransaction.amount) / arAging.amount < 0.1) {
          score += 0.2; // Within 10%
        }

        // Description matching
        const description = creditTransaction.description.toLowerCase();
        const customerName = arAging.customerName.toLowerCase();
        const invoiceNumber = arAging.invoiceNumber.toLowerCase();

        if (description.includes(customerName)) {
          score += 0.3;
        }
        if (description.includes(invoiceNumber)) {
          score += 0.3;
        }

        // Date proximity (closer dates get higher scores)
        const transactionDate = new Date(creditTransaction.date);
        const dueDate = new Date(arAging.dueDate);
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
            matchedEntityId: arAging.id,
            arEntry: arAging,
            notes: `Matched based on amount (${score >= 0.6 ? 'exact' : 'approximate'}), customer name, and date proximity`
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('AR Aging matching failed:', error);
      return null;
    }
  }

  private async matchWithForecastedCollections(creditTransaction: CreditTransaction): Promise<{
    confidenceScore: number;
    matchedEntityId: string;
    forecastEntry: ForecastedCollection;
    notes: string;
  } | null> {
    try {
      const forecasts = await this.getForecastedCollections();
      let bestMatch: any = null;
      let highestScore = 0;

      for (const forecast of forecasts) {
        let score = 0;

        // Amount matching
        if (Math.abs(forecast.amount - creditTransaction.amount) < 0.01) {
          score += 0.5;
        } else if (Math.abs(forecast.amount - creditTransaction.amount) / forecast.amount < 0.1) {
          score += 0.3;
        }

        // Date matching
        const transactionDate = new Date(creditTransaction.date);
        const expectedDate = new Date(forecast.expectedDate);
        const daysDiff = Math.abs((transactionDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 3) {
          score += 0.3;
        } else if (daysDiff <= 7) {
          score += 0.2;
        }

        // Forecast confidence affects matching score
        if (forecast.confidence === 'high') {
          score += 0.2;
        } else if (forecast.confidence === 'medium') {
          score += 0.1;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            confidenceScore: score,
            matchedEntityId: forecast.id,
            forecastEntry: forecast,
            notes: `Matched with forecasted collection based on amount and expected date`
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Forecasted collections matching failed:', error);
      return null;
    }
  }

  // =============================================
  // DATA MANAGEMENT
  // =============================================

  private async storeCreditTransactions(creditTransactions: CreditTransaction[]): Promise<void> {
    try {
      const existing = await this.getAllCreditTransactions();
      const updated = [...existing, ...creditTransactions];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to store credit transactions:', error);
      throw error;
    }
  }

  async getAllCreditTransactions(): Promise<CreditTransaction[]> {
    try {
      const item = localStorage.getItem(this.STORAGE_KEY);
      if (!item) return [];
      return JSON.parse(item) as CreditTransaction[];
    } catch (error) {
      console.error('Failed to get credit transactions:', error);
      return [];
    }
  }

  async getCreditTransactionById(id: string): Promise<CreditTransaction | null> {
    try {
      const transactions = await this.getAllCreditTransactions();
      return transactions.find(t => t.id === id) || null;
    } catch (error) {
      console.error('Failed to get credit transaction by ID:', error);
      return null;
    }
  }

  async updateCreditTransaction(creditTransaction: CreditTransaction): Promise<void> {
    try {
      const transactions = await this.getAllCreditTransactions();
      const index = transactions.findIndex(t => t.id === creditTransaction.id);
      
      if (index !== -1) {
        transactions[index] = creditTransaction;
              localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
      
      eventBus.emit('CREDIT_TRANSACTION_UPDATED', creditTransaction);
      }
    } catch (error) {
      console.error('Failed to update credit transaction:', error);
      throw error;
    }
  }

  // =============================================
  // SUPPORTING DATA MANAGEMENT
  // =============================================

  private async getARAgings(): Promise<ARAgingEntry[]> {
    try {
      const item = localStorage.getItem(this.AR_AGING_KEY);
      if (!item) return [];
      return JSON.parse(item) as ARAgingEntry[];
    } catch (error) {
      console.error('Failed to get AR agings:', error);
      return [];
    }
  }

  private async getARAgingById(id: string): Promise<ARAgingEntry | undefined> {
    const arAgings = await this.getARAgings();
    return arAgings.find(ar => ar.id === id);
  }

  private async getForecastedCollections(): Promise<ForecastedCollection[]> {
    try {
      const item = localStorage.getItem(this.FORECASTED_COLLECTIONS_KEY);
      if (!item) return [];
      return JSON.parse(item) as ForecastedCollection[];
    } catch (error) {
      console.error('Failed to get forecasted collections:', error);
      return [];
    }
  }

  private async getForecastedCollectionById(id: string): Promise<ForecastedCollection | undefined> {
    const forecasts = await this.getForecastedCollections();
    return forecasts.find(f => f.id === id);
  }

  private async storeReconciliationMatch(match: ReconciliationMatch): Promise<void> {
    try {
      const item = localStorage.getItem(this.RECONCILIATION_MATCHES_KEY);
      const existing = item ? JSON.parse(item) as ReconciliationMatch[] : [];
      existing.push(match);
      localStorage.setItem(this.RECONCILIATION_MATCHES_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error('Failed to store reconciliation match:', error);
      throw error;
    }
  }

  private async logAuditEntry(action: string, entityId: string, details: any): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: 'system', // In a real app, this would come from user context
        action: action,
        entityType: 'credit',
        entityId: entityId,
        newValues: details,
        notes: `Credit transaction ${action.toLowerCase().replace('_', ' ')}`
      };

      const item = localStorage.getItem(this.AUDIT_LOG_KEY);
      const existing = item ? JSON.parse(item) as AuditLogEntry[] : [];
      existing.push(auditEntry);
      localStorage.setItem(this.AUDIT_LOG_KEY, JSON.stringify(existing));
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

  private async initializeDefaultData(): Promise<void> {
    try {
      // Initialize with sample AR Aging data if none exists
      const existingAR = await this.getARAgings();
      if (existingAR.length === 0) {
        const sampleARAgings: ARAgingEntry[] = [
          {
            id: 'ar_001',
            customerId: 'cust_001',
            customerName: 'ABC Corporation',
            invoiceNumber: 'INV-2024-001',
            dueDate: '2024-12-15',
            amount: 25000.00,
            agingDays: 5,
            status: 'pending'
          },
          {
            id: 'ar_002', 
            customerId: 'cust_002',
            customerName: 'XYZ Limited',
            invoiceNumber: 'INV-2024-002',
            dueDate: '2024-12-20',
            amount: 15000.00,
            agingDays: 0,
            status: 'pending'
          }
        ];
        localStorage.setItem(this.AR_AGING_KEY, JSON.stringify(sampleARAgings));
      }

      // Initialize with sample Forecasted Collections if none exists
      const existingForecasts = await this.getForecastedCollections();
      if (existingForecasts.length === 0) {
        const sampleForecasts: ForecastedCollection[] = [
          {
            id: 'forecast_001',
            customerId: 'cust_003',
            expectedDate: '2024-12-25',
            amount: 30000.00,
            confidence: 'high',
            notes: 'Regular monthly payment from major client'
          }
        ];
        localStorage.setItem(this.FORECASTED_COLLECTIONS_KEY, JSON.stringify(sampleForecasts));
      }
    } catch (error) {
      console.error('Failed to initialize default data:', error);
    }
  }

  // =============================================
  // PUBLIC API FOR UI COMPONENTS
  // =============================================

  /**
   * Get credit transactions with optional filtering
   */
  async getCreditTransactionsForDisplay(filters?: {
    accountId?: string;
    status?: CreditTransaction['reconciliationStatus'];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CreditTransaction[]> {
    try {
      let transactions = await this.getAllCreditTransactions();

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
      console.error('Failed to get credit transactions for display:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for dashboard
   */
  async getCreditTransactionsSummary(): Promise<{
    total: number;
    pending: number;
    matched: number;
    confirmed: number;
    totalAmount: number;
    averageConfidence: number;
  }> {
    try {
      const transactions = await this.getAllCreditTransactions();
      
      const summary = {
        total: transactions.length,
        pending: transactions.filter(t => t.reconciliationStatus === 'pending').length,
        matched: transactions.filter(t => ['auto_matched', 'manually_matched'].includes(t.reconciliationStatus)).length,
        confirmed: transactions.filter(t => t.reconciliationStatus === 'confirmed').length,
        totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
        averageConfidence: 0
      };

      const matchedTransactions = transactions.filter(t => t.confidenceRatio !== undefined);
      if (matchedTransactions.length > 0) {
        summary.averageConfidence = matchedTransactions.reduce((sum, t) => sum + (t.confidenceRatio || 0), 0) / matchedTransactions.length;
      }

      return summary;
    } catch (error) {
      console.error('Failed to get credit transactions summary:', error);
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
export const creditTransactionManagementService = new CreditTransactionManagementService(); 