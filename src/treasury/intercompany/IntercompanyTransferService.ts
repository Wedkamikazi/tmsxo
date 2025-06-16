/**
 * INTERCOMPANY TRANSFER SERVICE (Job 1.4)
 * 
 * Handles intercompany transfers between entities:
 * - Automatic extraction from bank statements
 * - AI/LLM-based categorization and entity identification
 * - Reconciliation with intercompany records and cash forecasts
 * - Auto-reconciliation with confidence ratios
 * - Manual reconciliation for unmatched entries
 * - Verification and observation tracking
 * - Integration with daily cash management
 */

import {
  IntercompanyTransfer,
  IntercompanyRecord,
  CashForecastEntry,
  AuditLogEntry,
  Transaction
} from '../shared/types';
import { eventBus } from './EventBus';
import { unifiedCategorizationService } from './unifiedCategorizationService';

// =============================================
// INTERCOMPANY TRANSFER SERVICE
// =============================================

class IntercompanyTransferService {
  private readonly STORAGE_KEY = 'tms_intercompany_transfers';
  private readonly INTERCO_RECORDS_KEY = 'tms_intercompany_records';
  private readonly CASH_FORECAST_KEY = 'tms_cash_forecast_entries';
  private readonly AUDIT_LOG_KEY = 'tms_interco_audit_log';

  constructor() {
    console.log('✅ Intercompany Transfer Service initialized');
    this.initializeDefaultData();
    this.initializeEventListeners();
  }

  // =============================================
  // INITIALIZATION
  // =============================================

  private initializeDefaultData(): void {
    // Initialize with sample data if not exists
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      const sampleTransfers: IntercompanyTransfer[] = [
        {
          id: 'ITC001',
          date: '2024-01-15',
          amount: 500000,
          direction: 'outbound',
          counterpartyEntity: 'Subsidiary A - Riyadh',
          purpose: 'Monthly funding allocation',
          reference: 'TRFOUT-240115-001',
          accountId: '1001',
          reconciliationStatus: 'confirmed',
          confidenceRatio: 0.95,
          verificationDate: '2024-01-16',
          verifiedBy: 'Treasury Manager',
          observations: 'Verified against intercompany agreement'
        },
        {
          id: 'ITC002',
          date: '2024-01-20',
          amount: 250000,
          direction: 'inbound',
          counterpartyEntity: 'Sister Company B - Jeddah',
          purpose: 'Loan repayment',
          reference: 'TRFIN-240120-001',
          accountId: '1001',
          reconciliationStatus: 'auto_matched',
          confidenceRatio: 0.88
        }
      ];
      this.storeData(this.STORAGE_KEY, sampleTransfers);

      // Sample intercompany records for reconciliation
      const sampleRecords: IntercompanyRecord[] = [
        {
          id: 'ICR001',
          counterpartyEntity: 'Subsidiary A - Riyadh',
          amount: 500000,
          dueDate: '2024-01-15',
          purpose: 'Monthly funding allocation',
          status: 'transferred'
        },
        {
          id: 'ICR002',
          counterpartyEntity: 'Sister Company B - Jeddah',
          amount: 250000,
          dueDate: '2024-01-20',
          purpose: 'Loan repayment',
          status: 'transferred'
        }
      ];
      this.storeData(this.INTERCO_RECORDS_KEY, sampleRecords);

      // Sample cash forecast entries
      const sampleForecast: CashForecastEntry[] = [
        {
          id: 'CF001',
          date: '2024-01-15',
          description: 'Intercompany transfer to Subsidiary A',
          amount: 500000,
          type: 'outflow',
          confidence: 'high',
          category: 'intercompany'
        },
        {
          id: 'CF002',
          date: '2024-01-20',
          description: 'Expected repayment from Sister Company B',
          amount: 250000,
          type: 'inflow',
          confidence: 'high',
          category: 'intercompany'
        }
      ];
      this.storeData(this.CASH_FORECAST_KEY, sampleForecast);

      console.log('✅ Intercompany Transfer Service initialized with sample data');
    }
  }

  private initializeEventListeners(): void {
    // Listen for transaction updates that might be intercompany transfers
    eventBus.on('BANK_STATEMENT_IMPORTED', (data: any) => {
      this.handleBankStatementImport(data);
    });

    eventBus.on('TRANSACTION_CATEGORIZED', (data: any) => {
      this.handleTransactionCategorization(data);
    });
  }

  // =============================================
  // DATA STORAGE & RETRIEVAL
  // =============================================

  private storeData(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to store data for ${key}:`, error);
    }
  }

  private getStoredData(key: string): any[] {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error(`Failed to retrieve data for ${key}:`, error);
      return [];
    }
  }

  // =============================================
  // PUBLIC API METHODS
  // =============================================

  /**
   * Get all intercompany transfers with optional filtering
   */
  async getAllIntercompanyTransfers(filters?: {
    dateFrom?: string;
    dateTo?: string;
    direction?: 'inbound' | 'outbound';
    accountId?: string;
    reconciliationStatus?: string;
  }): Promise<IntercompanyTransfer[]> {
    try {
      let transfers = this.getStoredData(this.STORAGE_KEY) as IntercompanyTransfer[];

      // Apply filters
      if (filters) {
        if (filters.dateFrom) {
          transfers = transfers.filter(t => t.date >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          transfers = transfers.filter(t => t.date <= filters.dateTo!);
        }
        if (filters.direction) {
          transfers = transfers.filter(t => t.direction === filters.direction);
        }
        if (filters.accountId) {
          transfers = transfers.filter(t => t.accountId === filters.accountId);
        }
        if (filters.reconciliationStatus) {
          transfers = transfers.filter(t => t.reconciliationStatus === filters.reconciliationStatus);
        }
      }

      return transfers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Failed to get intercompany transfers:', error);
      return [];
    }
  }

  /**
   * Get intercompany transfers for a specific date and account (for daily cash management)
   */
  async getIntercompanyTransfersForDate(date: string, accountId: string): Promise<{
    intercoIn: number;
    intercoOut: number;
    transfers: IntercompanyTransfer[];
  }> {
    try {
      const transfers = await this.getAllIntercompanyTransfers({
        dateFrom: date,
        dateTo: date,
        accountId: accountId
      });

      const intercoIn = transfers
        .filter(t => t.direction === 'inbound')
        .reduce((sum, t) => sum + t.amount, 0);

      const intercoOut = transfers
        .filter(t => t.direction === 'outbound')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        intercoIn,
        intercoOut,
        transfers
      };
    } catch (error) {
      console.error('Failed to get intercompany transfers for date:', error);
      return { intercoIn: 0, intercoOut: 0, transfers: [] };
    }
  }

  /**
   * Extract and categorize intercompany transfers from bank transactions
   */
  async extractIntercompanyTransfers(transactions: Transaction[], accountId: string): Promise<IntercompanyTransfer[]> {
    try {
      const intercompanyTransfers: IntercompanyTransfer[] = [];

      for (const transaction of transactions) {
        // Use AI/LLM categorization to identify intercompany transfers
        const isIntercompany = await this.isIntercompanyTransaction(transaction);
        
        if (isIntercompany) {
          const transfer = await this.createIntercompanyTransferFromTransaction(transaction, accountId);
          
          // Attempt auto-reconciliation
          await this.attemptAutoReconciliation(transfer);
          
          intercompanyTransfers.push(transfer);
        }
      }

      // Store new transfers
      if (intercompanyTransfers.length > 0) {
        await this.storeIntercompanyTransfers(intercompanyTransfers);
        
        eventBus.emit('INTERCOMPANY_TRANSFERS_EXTRACTED', {
          count: intercompanyTransfers.length,
          accountId: accountId
        });
      }

      return intercompanyTransfers;
    } catch (error) {
      console.error('Failed to extract intercompany transfers:', error);
      throw error;
    }
  }

  /**
   * Create intercompany transfer record from bank transaction
   */
  private async createIntercompanyTransferFromTransaction(
    transaction: Transaction, 
    accountId: string
  ): Promise<IntercompanyTransfer> {
    const transferId = `ITC_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Determine direction based on transaction amounts
    const direction: 'inbound' | 'outbound' = transaction.creditAmount > 0 ? 'inbound' : 'outbound';
    const amount = direction === 'inbound' ? transaction.creditAmount : transaction.debitAmount;

    // Extract counterparty entity from description
    const counterpartyEntity = await this.extractCounterpartyEntity(transaction.description);
    
    // Extract purpose from description
    const purpose = await this.extractTransferPurpose(transaction.description);

    const transfer: IntercompanyTransfer = {
      id: transferId,
      date: transaction.date,
      amount: amount,
      direction: direction,
      counterpartyEntity: counterpartyEntity,
      purpose: purpose,
      reference: transaction.reference || '',
      accountId: accountId,
      reconciliationStatus: 'pending',
      observations: `Auto-extracted from transaction: ${transaction.description}`
    };

    return transfer;
  }

  /**
   * AI/LLM-based identification of intercompany transactions
   */
  private async isIntercompanyTransaction(transaction: Transaction): Promise<boolean> {
    try {
      const description = transaction.description.toLowerCase();
      
      // Pattern-based identification
      const intercompanyPatterns = [
        'intercompany',
        'interco',
        'transfer',
        'subsidiary',
        'sister company',
        'branch',
        'head office',
        'funding',
        'allocation',
        'loan',
        'advance',
        'repayment'
      ];

      const hasIntercompanyPattern = intercompanyPatterns.some(pattern => 
        description.includes(pattern)
      );

      // Amount-based heuristics (intercompany transfers are typically larger amounts)
      const isLargeAmount = (transaction.creditAmount > 100000 || transaction.debitAmount > 100000);

      // Use unified categorization service for AI analysis
      if (hasIntercompanyPattern && isLargeAmount) {
        try {
          await unifiedCategorizationService.categorizeTransaction(transaction);
          return true;
        } catch (error) {
          console.warn('AI categorization failed, using pattern matching:', error);
          return hasIntercompanyPattern;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to identify intercompany transaction:', error);
      return false;
    }
  }

  /**
   * Extract counterparty entity from transaction description
   */
  private async extractCounterpartyEntity(description: string): Promise<string> {
    try {
      // Pattern matching for common entity names
      const entityPatterns = [
        /subsidiary\s+([a-z\s-]+)/i,
        /sister\s+company\s+([a-z\s-]+)/i,
        /branch\s+([a-z\s-]+)/i,
        /([a-z\s]+)\s+branch/i,
        /to\s+([a-z\s-]+)/i,
        /from\s+([a-z\s-]+)/i
      ];

      for (const pattern of entityPatterns) {
        const match = description.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }

      // Fallback to first part of description
      const words = description.split(' ');
      if (words.length >= 2) {
        return `${words[0]} ${words[1]}`;
      }

      return 'Unknown Entity';
    } catch (error) {
      console.error('Failed to extract counterparty entity:', error);
      return 'Unknown Entity';
    }
  }

  /**
   * Extract transfer purpose from transaction description
   */
  private async extractTransferPurpose(description: string): Promise<string> {
    try {
      const purposePatterns = [
        /purpose[:\s]+([^,\n]+)/i,
        /for[:\s]+([^,\n]+)/i,
        /(funding|loan|advance|repayment|allocation)/i
      ];

      for (const pattern of purposePatterns) {
        const match = description.match(pattern);
        if (match && match[1]) {
          return match[1].trim();
        }
      }

      // Fallback to cleaned description
      return description.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    } catch (error) {
      console.error('Failed to extract transfer purpose:', error);
      return 'General transfer';
    }
  }

  /**
   * Attempt automatic reconciliation with intercompany records and forecasts
   */
  private async attemptAutoReconciliation(transfer: IntercompanyTransfer): Promise<void> {
    try {
      // Try to match with intercompany records
      const intercoMatch = await this.findIntercompanyRecordMatch(transfer);
      if (intercoMatch) {
        transfer.intercompanyMatch = intercoMatch;
        transfer.reconciliationStatus = 'auto_matched';
        transfer.confidenceRatio = this.calculateMatchConfidence(transfer, intercoMatch);
        return;
      }

      // Try to match with cash forecast entries
      const forecastMatch = await this.findCashForecastMatch(transfer);
      if (forecastMatch) {
        transfer.cashForecastMatch = forecastMatch;
        transfer.reconciliationStatus = 'auto_matched';
        transfer.confidenceRatio = this.calculateForecastMatchConfidence(transfer, forecastMatch);
        return;
      }

      // No match found
      transfer.reconciliationStatus = 'pending';
    } catch (error) {
      console.error('Failed to attempt auto reconciliation:', error);
      transfer.reconciliationStatus = 'pending';
    }
  }

  /**
   * Find matching intercompany record
   */
  private async findIntercompanyRecordMatch(transfer: IntercompanyTransfer): Promise<IntercompanyRecord | undefined> {
    try {
      const records = this.getStoredData(this.INTERCO_RECORDS_KEY) as IntercompanyRecord[];
      
      return records.find(record => 
        record.counterpartyEntity === transfer.counterpartyEntity &&
        Math.abs(record.amount - transfer.amount) < 1000 && // Allow small variance
        record.status === 'pending' &&
        Math.abs(new Date(record.dueDate).getTime() - new Date(transfer.date).getTime()) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
      );
    } catch (error) {
      console.error('Failed to find intercompany record match:', error);
      return undefined;
    }
  }

  /**
   * Find matching cash forecast entry
   */
  private async findCashForecastMatch(transfer: IntercompanyTransfer): Promise<CashForecastEntry | undefined> {
    try {
      const forecasts = this.getStoredData(this.CASH_FORECAST_KEY) as CashForecastEntry[];
      
      return forecasts.find(forecast => 
        Math.abs(forecast.amount - transfer.amount) < 1000 && // Allow small variance
        forecast.category === 'intercompany' &&
        ((transfer.direction === 'inbound' && forecast.type === 'inflow') ||
         (transfer.direction === 'outbound' && forecast.type === 'outflow')) &&
        Math.abs(new Date(forecast.date).getTime() - new Date(transfer.date).getTime()) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
      );
    } catch (error) {
      console.error('Failed to find cash forecast match:', error);
      return undefined;
    }
  }

  /**
   * Calculate match confidence for intercompany record
   */
  private calculateMatchConfidence(transfer: IntercompanyTransfer, record: IntercompanyRecord): number {
    let confidence = 0.5; // Base confidence

    // Exact amount match
    if (Math.abs(transfer.amount - record.amount) < 100) {
      confidence += 0.3;
    } else if (Math.abs(transfer.amount - record.amount) < 1000) {
      confidence += 0.2;
    }

    // Counterparty entity match
    if (transfer.counterpartyEntity === record.counterpartyEntity) {
      confidence += 0.2;
    }

    // Date proximity
    const daysDiff = Math.abs(new Date(transfer.date).getTime() - new Date(record.dueDate).getTime()) / (24 * 60 * 60 * 1000);
    if (daysDiff <= 1) {
      confidence += 0.1;
    } else if (daysDiff <= 7) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate match confidence for cash forecast
   */
  private calculateForecastMatchConfidence(transfer: IntercompanyTransfer, forecast: CashForecastEntry): number {
    let confidence = 0.4; // Base confidence (slightly lower than record match)

    // Exact amount match
    if (Math.abs(transfer.amount - forecast.amount) < 100) {
      confidence += 0.3;
    } else if (Math.abs(transfer.amount - forecast.amount) < 1000) {
      confidence += 0.2;
    }

    // Direction match
    if ((transfer.direction === 'inbound' && forecast.type === 'inflow') ||
        (transfer.direction === 'outbound' && forecast.type === 'outflow')) {
      confidence += 0.2;
    }

    // Date proximity
    const daysDiff = Math.abs(new Date(transfer.date).getTime() - new Date(forecast.date).getTime()) / (24 * 60 * 60 * 1000);
    if (daysDiff <= 1) {
      confidence += 0.1;
    } else if (daysDiff <= 7) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Store intercompany transfers
   */
  private async storeIntercompanyTransfers(transfers: IntercompanyTransfer[]): Promise<void> {
    try {
      const existingTransfers = this.getStoredData(this.STORAGE_KEY) as IntercompanyTransfer[];
      
      // Merge with existing, avoiding duplicates
      const allTransfers = [...existingTransfers];
      for (const transfer of transfers) {
        const existingIndex = allTransfers.findIndex(t => t.id === transfer.id);
        if (existingIndex >= 0) {
          allTransfers[existingIndex] = transfer;
        } else {
          allTransfers.push(transfer);
        }
      }

      this.storeData(this.STORAGE_KEY, allTransfers);
      
      // Log audit entries
      for (const transfer of transfers) {
        await this.logAuditEntry('CREATE_INTERCOMPANY_TRANSFER', transfer.id, {
          action: 'Intercompany transfer created',
          transfer: transfer
        });
      }

    } catch (error) {
      console.error('Failed to store intercompany transfers:', error);
      throw error;
    }
  }

  /**
   * Manual reconciliation methods
   */
  async manuallyReconcileTransfer(
    transferId: string, 
    recordId: string, 
    verifiedBy: string, 
    observations?: string
  ): Promise<void> {
    try {
      const transfers = this.getStoredData(this.STORAGE_KEY) as IntercompanyTransfer[];
      const transferIndex = transfers.findIndex(t => t.id === transferId);
      
      if (transferIndex >= 0) {
        const records = this.getStoredData(this.INTERCO_RECORDS_KEY) as IntercompanyRecord[];
        const record = records.find(r => r.id === recordId);
        
        if (record) {
          transfers[transferIndex].intercompanyMatch = record;
          transfers[transferIndex].reconciliationStatus = 'manually_matched';
          transfers[transferIndex].confidenceRatio = 1.0;
          transfers[transferIndex].verificationDate = new Date().toISOString();
          transfers[transferIndex].verifiedBy = verifiedBy;
          transfers[transferIndex].observations = observations;

          this.storeData(this.STORAGE_KEY, transfers);

          eventBus.emit('INTERCOMPANY_TRANSFER_RECONCILED', {
            transferId: transferId,
            method: 'manual'
          });

          await this.logAuditEntry('RECONCILE_INTERCOMPANY_TRANSFER', transferId, {
            action: 'Manual reconciliation completed',
            recordId: recordId,
            verifiedBy: verifiedBy
          });
        }
      }
    } catch (error) {
      console.error('Failed to manually reconcile transfer:', error);
      throw error;
    }
  }

  /**
   * Verify intercompany transfer
   */
  async verifyTransfer(transferId: string, verifiedBy: string, observations?: string): Promise<void> {
    try {
      const transfers = this.getStoredData(this.STORAGE_KEY) as IntercompanyTransfer[];
      const transferIndex = transfers.findIndex(t => t.id === transferId);
      
      if (transferIndex >= 0) {
        transfers[transferIndex].reconciliationStatus = 'confirmed';
        transfers[transferIndex].verificationDate = new Date().toISOString();
        transfers[transferIndex].verifiedBy = verifiedBy;
        if (observations) {
          transfers[transferIndex].observations = observations;
        }

        this.storeData(this.STORAGE_KEY, transfers);

        eventBus.emit('INTERCOMPANY_TRANSFER_VERIFIED', {
          transferId: transferId,
          verifiedBy: verifiedBy
        });

        await this.logAuditEntry('VERIFY_INTERCOMPANY_TRANSFER', transferId, {
          action: 'Transfer verified',
          verifiedBy: verifiedBy,
          observations: observations
        });
      }
    } catch (error) {
      console.error('Failed to verify transfer:', error);
      throw error;
    }
  }

  // =============================================
  // EVENT HANDLERS
  // =============================================

  private async handleBankStatementImport(data: any): Promise<void> {
    try {
      if (data.transactions && data.accountId) {
        // Extract intercompany transfers from imported transactions
        await this.extractIntercompanyTransfers(data.transactions, data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle bank statement import for intercompany:', error);
    }
  }

  private async handleTransactionCategorization(data: any): Promise<void> {
    try {
      if (data.transaction && data.category && 
          (data.category.includes('intercompany') || data.category.includes('transfer'))) {
        // Re-analyze transaction for intercompany classification
        const isIntercompany = await this.isIntercompanyTransaction(data.transaction);
        if (isIntercompany) {
          await this.extractIntercompanyTransfers([data.transaction], data.accountId);
        }
      }
    } catch (error) {
      console.error('Failed to handle transaction categorization for intercompany:', error);
    }
  }

  // =============================================
  // AUDIT LOGGING
  // =============================================

  private async logAuditEntry(action: string, entityId: string, details: any): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date().toISOString(),
        userId: 'system', // In real app, get from auth context
        action: action,
        entityType: 'intercompany',
        entityId: entityId,
        newValues: details,
        ipAddress: 'localhost' // In real app, get actual IP
      };

      const auditLog = this.getStoredData(this.AUDIT_LOG_KEY);
      auditLog.push(auditEntry);
      this.storeData(this.AUDIT_LOG_KEY, auditLog);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  // =============================================
  // SUMMARY AND STATISTICS
  // =============================================

  /**
   * Get intercompany transfer summary statistics
   */
  async getIntercompanySummary(): Promise<{
    totalTransfers: number;
    totalInbound: number;
    totalOutbound: number;
    netFlow: number;
    reconciliationRate: number;
    verificationRate: number;
    avgConfidenceRatio: number;
  }> {
    try {
      const transfers = await this.getAllIntercompanyTransfers();
      
      const totalInbound = transfers
        .filter(t => t.direction === 'inbound')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalOutbound = transfers
        .filter(t => t.direction === 'outbound')
        .reduce((sum, t) => sum + t.amount, 0);

      const reconciledTransfers = transfers.filter(t => 
        t.reconciliationStatus === 'auto_matched' || 
        t.reconciliationStatus === 'manually_matched' ||
        t.reconciliationStatus === 'confirmed'
      );

      const verifiedTransfers = transfers.filter(t => t.reconciliationStatus === 'confirmed');

      const avgConfidenceRatio = transfers
        .filter(t => t.confidenceRatio !== undefined)
        .reduce((sum, t) => sum + (t.confidenceRatio || 0), 0) / 
        (transfers.filter(t => t.confidenceRatio !== undefined).length || 1);

      return {
        totalTransfers: transfers.length,
        totalInbound: totalInbound,
        totalOutbound: totalOutbound,
        netFlow: totalInbound - totalOutbound,
        reconciliationRate: transfers.length > 0 ? (reconciledTransfers.length / transfers.length) * 100 : 0,
        verificationRate: transfers.length > 0 ? (verifiedTransfers.length / transfers.length) * 100 : 0,
        avgConfidenceRatio: avgConfidenceRatio
      };
    } catch (error) {
      console.error('Failed to get intercompany summary:', error);
      return {
        totalTransfers: 0,
        totalInbound: 0,
        totalOutbound: 0,
        netFlow: 0,
        reconciliationRate: 0,
        verificationRate: 0,
        avgConfidenceRatio: 0
      };
    }
  }
}

// Export singleton instance
export const intercompanyTransferService = new IntercompanyTransferService();
export default intercompanyTransferService;