/**
 * DAILY CASH MANAGEMENT SERVICE
 * 
 * Micro-Job 2.1.1: Service Foundation
 * 
 * Central service that integrates all transaction types into unified daily cash entries.
 * Provides daily balance reconciliation, discrepancy detection, and verification workflow.
 * 
 * Features:
 * - Daily entry generation for each account/date combination
 * - Integration with credit, debit, and HR transaction services
 * - Balance calculation and discrepancy detection
 * - Daily verification workflow with observations
 * - Real-time updates via event system
 */

import {
  DailyCashEntry,
  AuditLogEntry
} from '../../shared/types';
import { eventBus } from '../../core/orchestration/EventBus';

// =============================================
// DAILY CASH MANAGEMENT SERVICE FOUNDATION
// =============================================

class DailyCashManagementService {
  private readonly STORAGE_KEY = 'tms_daily_cash_entries';
  private readonly AUDIT_LOG_KEY = 'tms_daily_cash_audit_log';

  constructor() {
    console.log('✅ Daily Cash Management Service initialized');
    this.initializeEventListeners();
  }

  // =============================================
  // SERVICE INTEGRATION & EVENT COORDINATION
  // =============================================

  /**
   * Initialize event listeners for real-time integration with transaction services
   */
  private initializeEventListeners(): void {
    try {
      // Listen for credit transaction updates
      eventBus.on('CREDIT_TRANSACTIONS_EXTRACTED', this.handleCreditTransactionsUpdate.bind(this));
      eventBus.on('CREDIT_TRANSACTION_UPDATED', this.handleCreditTransactionUpdate.bind(this));
      eventBus.on('CREDIT_TRANSACTION_CONFIRMED', this.handleCreditTransactionUpdate.bind(this));

      // Listen for debit transaction updates
      eventBus.on('DEBIT_TRANSACTIONS_EXTRACTED', this.handleDebitTransactionsUpdate.bind(this));
      eventBus.on('DEBIT_TRANSACTION_UPDATED', this.handleDebitTransactionUpdate.bind(this));
      eventBus.on('DEBIT_TRANSACTION_CONFIRMED', this.handleDebitTransactionUpdate.bind(this));

      // Listen for HR payment updates
      eventBus.on('HR_PAYMENTS_EXTRACTED', this.handleHRPaymentsUpdate.bind(this));
      eventBus.on('HR_PAYMENT_UPDATED', this.handleHRPaymentUpdate.bind(this));
      eventBus.on('HR_PAYMENT_CONFIRMED', this.handleHRPaymentUpdate.bind(this));

      // Listen for intercompany transfer updates (Job 1.4)
      eventBus.on('INTERCOMPANY_TRANSFERS_EXTRACTED', this.handleIntercompanyTransfersUpdate.bind(this));
      eventBus.on('INTERCOMPANY_TRANSFER_RECONCILED', this.handleIntercompanyTransferUpdate.bind(this));
      eventBus.on('INTERCOMPANY_TRANSFER_VERIFIED', this.handleIntercompanyTransferUpdate.bind(this));

      // Listen for time deposit updates (Job 1.5)
      eventBus.on('TIME_DEPOSITS_EXTRACTED', this.handleTimeDepositsUpdate.bind(this));
      eventBus.on('INVESTMENT_SUGGESTIONS_GENERATED', this.handleInvestmentSuggestionsUpdate.bind(this));

      // Listen for bank import events
      eventBus.on('BANK_STATEMENT_IMPORTED', this.handleBankStatementImport.bind(this));
      eventBus.on('TRANSACTION_DATA_UPDATED', this.handleTransactionDataUpdate.bind(this));

      console.log('✅ Daily Cash Management event listeners initialized');
    } catch (error) {
      console.error('Failed to initialize event listeners:', error);
    }
  }

  /**
   * Handle credit transactions extraction/update events
   */
  private async handleCreditTransactionsUpdate(data: any): Promise<void> {
    try {
      console.log('📊 Handling credit transactions update:', data);
      
      if (data.accountId) {
        // Recalculate daily cash entries for the affected account
        await this.recalculateEntriesForAccount(data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle credit transactions update:', error);
    }
  }

  /**
   * Handle individual credit transaction update
   */
  private async handleCreditTransactionUpdate(transaction: any): Promise<void> {
    try {
      if (transaction.date && transaction.accountId) {
        await this.recalculateEntriesForDateAndAccount(transaction.date, transaction.accountId);
      }
    } catch (error) {
      console.error('Failed to handle credit transaction update:', error);
    }
  }

  /**
   * Handle debit transactions extraction/update events
   */
  private async handleDebitTransactionsUpdate(data: any): Promise<void> {
    try {
      console.log('📊 Handling debit transactions update:', data);
      
      if (data.accountId) {
        await this.recalculateEntriesForAccount(data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle debit transactions update:', error);
    }
  }

  /**
   * Handle individual debit transaction update
   */
  private async handleDebitTransactionUpdate(transaction: any): Promise<void> {
    try {
      if (transaction.date && transaction.accountId) {
        await this.recalculateEntriesForDateAndAccount(transaction.date, transaction.accountId);
      }
    } catch (error) {
      console.error('Failed to handle debit transaction update:', error);
    }
  }

  /**
   * Handle HR payments extraction/update events
   */
  private async handleHRPaymentsUpdate(data: any): Promise<void> {
    try {
      console.log('📊 Handling HR payments update:', data);
      
      if (data.accountId) {
        await this.recalculateEntriesForAccount(data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle HR payments update:', error);
    }
  }

  /**
   * Handle individual HR payment update
   */
  private async handleHRPaymentUpdate(payment: any): Promise<void> {
    try {
      if (payment.date && payment.accountId) {
        await this.recalculateEntriesForDateAndAccount(payment.date, payment.accountId);
      }
    } catch (error) {
      console.error('Failed to handle HR payment update:', error);
    }
  }

  /**
   * Handle intercompany transfers extraction/update events (Job 1.4)
   */
  private async handleIntercompanyTransfersUpdate(data: any): Promise<void> {
    try {
      console.log('🔄 Handling intercompany transfers update:', data);
      
      if (data.accountId) {
        await this.recalculateEntriesForAccount(data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle intercompany transfers update:', error);
    }
  }

  /**
   * Handle individual intercompany transfer update (Job 1.4)
   */
  private async handleIntercompanyTransferUpdate(data: any): Promise<void> {
    try {
      if (data.transfer && data.transfer.date && data.transfer.accountId) {
        await this.recalculateEntriesForDateAndAccount(data.transfer.date, data.transfer.accountId);
      } else if (data.transferId) {
        // Try to get transfer details and recalculate
        try {
          const { intercompanyTransferService } = await import('../intercompany/IntercompanyTransferService');
          const transfers = await intercompanyTransferService.getAllIntercompanyTransfers();
          const transfer = transfers.find(t => t.id === data.transferId);
          
          if (transfer) {
            await this.recalculateEntriesForDateAndAccount(transfer.date, transfer.accountId);
          }
        } catch (error) {
          console.warn('Could not retrieve transfer details for recalculation:', error);
        }
      }
    } catch (error) {
      console.error('Failed to handle intercompany transfer update:', error);
    }
  }

  /**
   * Handle time deposits extraction/update events (Job 1.5)
   */
  private async handleTimeDepositsUpdate(data: any): Promise<void> {
    try {
      console.log('💰 Handling time deposits update:', data);
      
      if (data.accountId) {
        await this.recalculateEntriesForAccount(data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle time deposits update:', error);
    }
  }

  /**
   * Handle investment suggestions update (Job 1.5)
   */
  private async handleInvestmentSuggestionsUpdate(data: any): Promise<void> {
    try {
      console.log('💡 Investment suggestions generated:', data);
      
      // Investment suggestions don't directly affect daily cash entries
      // but we emit an event for UI updates
      eventBus.emit('DAILY_CASH_INVESTMENT_SUGGESTIONS_AVAILABLE', {
        accountId: data.accountId,
        suggestionCount: data.count,
        totalSuggestedAmount: data.totalSuggestedAmount
      });
    } catch (error) {
      console.error('Failed to handle investment suggestions update:', error);
    }
  }

  /**
   * Handle bank statement import events
   */
  private async handleBankStatementImport(data: any): Promise<void> {
    try {
      console.log('📊 Handling bank statement import:', data);
      
      // Generate daily cash entries for newly imported data
      if (data.dateRange && data.accountIds) {
        await this.generateDailyCashEntries(
          data.dateRange.from,
          data.dateRange.to,
          data.accountIds
        );
        
        // Recalculate balances for the imported period
        await this.recalculateBalances(
          data.dateRange.from,
          data.dateRange.to,
          data.accountIds
        );
      }
    } catch (error) {
      console.error('Failed to handle bank statement import:', error);
    }
  }

  /**
   * Handle general transaction data updates
   */
  private async handleTransactionDataUpdate(data: any): Promise<void> {
    try {
      console.log('📊 Handling transaction data update:', data);
      
      // Trigger recalculation for affected date range
      if (data.dateRange) {
        await this.recalculateBalances(data.dateRange.from, data.dateRange.to);
      }
    } catch (error) {
      console.error('Failed to handle transaction data update:', error);
    }
  }

  /**
   * Recalculate daily cash entries for a specific account
   */
  private async recalculateEntriesForAccount(accountId: string): Promise<void> {
    try {
      // Get last 30 days for recalculation (reasonable scope)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      await this.recalculateBalances(startDateStr, endDateStr, [accountId]);
    } catch (error) {
      console.error('Failed to recalculate entries for account:', error);
    }
  }

  /**
   * Recalculate daily cash entry for a specific date and account
   */
  private async recalculateEntriesForDateAndAccount(date: string, accountId: string): Promise<void> {
    try {
      const entry = await this.getDailyCashEntryByDateAndAccount(date, accountId);
      
      if (entry) {
        const recalculatedEntry = await this.calculateBalances(entry);
        await this.updateDailyCashEntry(recalculatedEntry);
        
        console.log(`✅ Recalculated daily cash entry for ${date}, account ${accountId}`);
      } else {
        // Entry doesn't exist, try to generate it
        const accounts = await this.getAccountsForGeneration([accountId]);
        if (accounts.length > 0) {
          const newEntry = await this.createDailyCashEntry(date, accounts[0]);
          const calculatedEntry = await this.calculateBalances(newEntry);
          await this.storeDailyCashEntries([calculatedEntry]);
        }
      }
    } catch (error) {
      console.error('Failed to recalculate entry for date and account:', error);
    }
  }

  /**
   * Check service availability and integration status
   */
  async checkServiceIntegration(): Promise<{
    creditTransactionService: boolean;
    debitTransactionService: boolean;
    hrPaymentService: boolean;
    intercompanyTransferService: boolean;
    timeDepositService: boolean;
    unifiedBalanceService: boolean;
    unifiedDataService: boolean;
    integrationScore: number;
  }> {
    const status = {
      creditTransactionService: false,
      debitTransactionService: false,
      hrPaymentService: false,
      intercompanyTransferService: false,
      timeDepositService: false,
      unifiedBalanceService: false,
      unifiedDataService: false,
      integrationScore: 0
    };

    try {
      // Test credit transaction service
      try {
        const { creditTransactionManagementService } = await import('../../banking/transactions/CreditTransactionManagementService');
        await creditTransactionManagementService.getAllCreditTransactions();
        status.creditTransactionService = true;
      } catch (error) {
        console.warn('Credit transaction service not available:', error);
      }

      // Test debit transaction service
      try {
        const { debitTransactionManagementService } = await import('../../banking/transactions/DebitTransactionManagementService');
        await debitTransactionManagementService.getAllDebitTransactions();
        status.debitTransactionService = true;
      } catch (error) {
        console.warn('Debit transaction service not available:', error);
      }

      // Test HR payment service
      try {
        const { hrPaymentManagementService } = await import('../payments/HRPaymentManagementService');
        await hrPaymentManagementService.getAllHRPayments();
        status.hrPaymentService = true;
      } catch (error) {
        console.warn('HR payment service not available:', error);
      }

      // Test intercompany transfer service (Job 1.4)
      try {
        const { intercompanyTransferService } = await import('../intercompany/IntercompanyTransferService');
        await intercompanyTransferService.getAllIntercompanyTransfers();
        status.intercompanyTransferService = true;
      } catch (error) {
        console.warn('Intercompany transfer service not available:', error);
      }

      // Test time deposit service (Job 1.5)
      try {
        const { timeDepositService } = await import('../time-deposits/TimeDepositService');
        await timeDepositService.getAllTimeDeposits();
        status.timeDepositService = true;
      } catch (error) {
        console.warn('Time deposit service not available:', error);
      }

      // Test unified balance service
      try {
        const { unifiedBalanceService } = await import('../../banking/accounts/UnifiedBalanceService');
        unifiedBalanceService.getDailyBalances();
        status.unifiedBalanceService = true;
      } catch (error) {
        console.warn('Unified balance service not available:', error);
      }

      // Test unified data service
      try {
        const { unifiedDataService } = await import('../../data/storage/UnifiedDataService');
        unifiedDataService.getAllAccounts();
        status.unifiedDataService = true;
      } catch (error) {
        console.warn('Unified data service not available:', error);
      }

      // Calculate integration score
      const availableServices = Object.values(status).filter(Boolean).length - 1; // Exclude integrationScore
      status.integrationScore = (availableServices / 7) * 100; // Now 7 services total

      console.log('📊 Service integration status:', status);
      return status;

    } catch (error) {
      console.error('Failed to check service integration:', error);
      return status;
    }
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

  private getStoredData(key: string): any[] {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(`Failed to get stored data for key ${key}:`, error);
      return [];
    }
  }

  // =============================================
  // DAILY CASH ENTRIES CRUD
  // =============================================

  async getAllDailyCashEntries(): Promise<DailyCashEntry[]> {
    try {
      return this.getStoredData(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to get all daily cash entries:', error);
      return [];
    }
  }

  async getDailyCashEntryById(id: string): Promise<DailyCashEntry | null> {
    try {
      const entries = await this.getAllDailyCashEntries();
      return entries.find(entry => entry.id === id) || null;
    } catch (error) {
      console.error('Failed to get daily cash entry by ID:', error);
      return null;
    }
  }

  async updateDailyCashEntry(entry: DailyCashEntry): Promise<void> {
    try {
      const entries = await this.getAllDailyCashEntries();
      const index = entries.findIndex(e => e.id === entry.id);
      
      if (index >= 0) {
        entries[index] = entry;
        this.storeData(this.STORAGE_KEY, entries);
        
        // Emit event for UI updates
        eventBus.emit('DAILY_CASH_ENTRY_UPDATED', entry);
      } else {
        throw new Error('Daily cash entry not found for update');
      }
    } catch (error) {
      console.error('Failed to update daily cash entry:', error);
      throw error;
    }
  }

  private async storeDailyCashEntries(entries: DailyCashEntry[]): Promise<void> {
    try {
      // Get existing entries
      const existing = await this.getAllDailyCashEntries();
      
      // Merge with new entries (avoid duplicates)
      const merged = [...existing];
      entries.forEach(newEntry => {
        const existingIndex = merged.findIndex(e => e.id === newEntry.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newEntry;
        } else {
          merged.push(newEntry);
        }
      });

      this.storeData(this.STORAGE_KEY, merged);
    } catch (error) {
      console.error('Failed to store daily cash entries:', error);
      throw error;
    }
  }

  // =============================================
  // VERIFICATION MANAGEMENT
  // =============================================

  async markDayAsVerified(
    date: string, 
    accountId: string, 
    verifiedBy: string, 
    observations?: string
  ): Promise<void> {
    try {
      const entry = await this.getDailyCashEntryByDateAndAccount(date, accountId);
      if (!entry) {
        throw new Error('Daily cash entry not found for verification');
      }

      entry.isVerified = true;
      entry.verifiedDate = new Date().toISOString();
      entry.verifiedBy = verifiedBy;
      if (observations) {
        entry.observations = observations;
      }

      await this.updateDailyCashEntry(entry);

      // Log the verification
      await this.logAuditEntry('DAY_VERIFIED', entry.id, {
        date,
        accountId,
        verifiedBy,
        observations
      });

      eventBus.emit('DAILY_CASH_DAY_VERIFIED', { date, accountId, verifiedBy });
    } catch (error) {
      console.error('Failed to mark day as verified:', error);
      throw error;
    }
  }

  private async getDailyCashEntryByDateAndAccount(
    date: string, 
    accountId: string
  ): Promise<DailyCashEntry | null> {
    try {
      const entries = await this.getAllDailyCashEntries();
      return entries.find(entry => 
        entry.date === date && entry.accountNumber === accountId
      ) || null;
    } catch (error) {
      console.error('Failed to get daily cash entry by date and account:', error);
      return null;
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
        userId: 'current_user', // In a real app, this would come from authentication
        action,
        entityType: 'daily_cash',
        entityId,
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
  // DAILY ENTRY GENERATION LOGIC
  // =============================================

  /**
   * Generate daily cash entries for a specified date range and accounts
   * Creates one entry per account per day
   */
  async generateDailyCashEntries(
    dateFrom: string, 
    dateTo: string, 
    accountIds?: string[]
  ): Promise<DailyCashEntry[]> {
    try {
      const accounts = await this.getAccountsForGeneration(accountIds);
      const dateRange = this.generateDateRange(dateFrom, dateTo);
      const newEntries: DailyCashEntry[] = [];

      for (const account of accounts) {
        for (const date of dateRange) {
          // Check if entry already exists
          const existingEntry = await this.getDailyCashEntryByDateAndAccount(date, account.accountNumber);
          
          if (!existingEntry) {
            // Create new daily cash entry
            const entry = await this.createDailyCashEntry(date, account);
            newEntries.push(entry);
          }
        }
      }

      // Store new entries
      if (newEntries.length > 0) {
        await this.storeDailyCashEntries(newEntries);
        
        // Emit event for UI updates
        eventBus.emit('DAILY_CASH_ENTRIES_GENERATED', {
          count: newEntries.length,
          dateRange: { from: dateFrom, to: dateTo },
          accounts: accounts.length
        });
      }

      return newEntries;
    } catch (error) {
      console.error('Failed to generate daily cash entries:', error);
      throw error;
    }
  }

  /**
   * Create a single daily cash entry for a specific date and account
   */
  private async createDailyCashEntry(date: string, account: any): Promise<DailyCashEntry> {
    const entryId = `${account.accountNumber}_${date}`;
    
    const entry: DailyCashEntry = {
      id: entryId,
      date: date,
      bankName: account.bankName || 'Unknown Bank',
      accountNumber: account.accountNumber,
      currency: account.currency || 'SAR',
      openingBalance: 0, // Will be calculated in balance calculation logic
      cashIn: 0, // Will be aggregated from credit transactions
      cashOut: 0, // Will be aggregated from debit/HR transactions
      intercoIn: 0, // Will be added when intercompany is implemented
      intercoOut: 0, // Will be added when intercompany is implemented
      timeDepositOut: 0, // Will be added when time deposits are implemented
      timeDepositIn: 0, // Will be added when time deposits are implemented
      closingBalanceActual: 0, // Will be extracted from bank balance data
      closingBalanceProjected: 0, // Will be calculated: opening + in - out
      discrepancy: 0, // Will be calculated: actual - projected
      notes: '',
      observations: '',
      isVerified: false,
      verifiedDate: undefined,
      verifiedBy: undefined
    };

    return entry;
  }

  /**
   * Generate array of dates between dateFrom and dateTo (inclusive)
   */
  private generateDateRange(dateFrom: string, dateTo: string): string[] {
    const dates: string[] = [];
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    
    // Ensure we don't go beyond reasonable limits (max 1 year)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      throw new Error('Date range cannot exceed 365 days');
    }

    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]); // YYYY-MM-DD format
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get accounts for daily entry generation
   */
  private async getAccountsForGeneration(accountIds?: string[]): Promise<any[]> {
    try {
      // Import here to avoid circular dependencies
      const { unifiedDataService } = await import('../../data/storage/UnifiedDataService');
      const allAccounts = unifiedDataService.getAllAccounts();
      
      if (accountIds && accountIds.length > 0) {
        return allAccounts.filter(account => accountIds.includes(account.id));
      }
      
      return allAccounts;
    } catch (error) {
      console.error('Failed to get accounts for generation:', error);
      // Return default account structure if service unavailable
      return [{
        id: 'default_account',
        accountNumber: '1001',
        bankName: 'Default Bank',
        currency: 'SAR'
      }];
    }
  }

  /**
   * Regenerate daily cash entries for existing date/account combinations
   * Useful for recalculating after transaction data changes
   */
  async regenerateDailyCashEntries(
    dateFrom?: string, 
    dateTo?: string, 
    accountIds?: string[]
  ): Promise<DailyCashEntry[]> {
    try {
      let existingEntries = await this.getAllDailyCashEntries();
      
      // Filter by date range if provided
      if (dateFrom) {
        existingEntries = existingEntries.filter(entry => entry.date >= dateFrom);
      }
      if (dateTo) {
        existingEntries = existingEntries.filter(entry => entry.date <= dateTo);
      }
      
      // Filter by accounts if provided
      if (accountIds && accountIds.length > 0) {
        existingEntries = existingEntries.filter(entry => 
          accountIds.includes(entry.accountNumber)
        );
      }

      const regeneratedEntries: DailyCashEntry[] = [];
      
      for (const existingEntry of existingEntries) {
        // Get account details
        const accounts = await this.getAccountsForGeneration([existingEntry.accountNumber]);
        const account = accounts[0];
        
        if (account) {
          // Create new entry with fresh data but preserve verification status
          const newEntry = await this.createDailyCashEntry(existingEntry.date, account);
          
          // Preserve verification data if it exists
          newEntry.isVerified = existingEntry.isVerified;
          newEntry.verifiedDate = existingEntry.verifiedDate;
          newEntry.verifiedBy = existingEntry.verifiedBy;
          newEntry.observations = existingEntry.observations;
          newEntry.notes = existingEntry.notes;
          
          regeneratedEntries.push(newEntry);
        }
      }

      // Store regenerated entries
      if (regeneratedEntries.length > 0) {
        await this.storeDailyCashEntries(regeneratedEntries);
        
        eventBus.emit('DAILY_CASH_ENTRIES_REGENERATED', {
          count: regeneratedEntries.length
        });
      }

      return regeneratedEntries;
    } catch (error) {
      console.error('Failed to regenerate daily cash entries:', error);
      throw error;
    }
  }

  // =============================================
  // BALANCE CALCULATION ENGINE
  // =============================================

  /**
   * Calculate all balances for a daily cash entry
   * Integrates with existing transaction services to populate cash flows
   */
  async calculateBalances(entry: DailyCashEntry): Promise<DailyCashEntry> {
    try {
      // Calculate opening balance
      entry.openingBalance = await this.calculateOpeningBalance(entry.date, entry.accountNumber);
      
      // Aggregate cash flows from transaction services
      entry.cashIn = await this.calculateCashIn(entry.date, entry.accountNumber);
      entry.cashOut = await this.calculateCashOut(entry.date, entry.accountNumber);
      
      // Calculate intercompany transfers (Job 1.4 - NOW IMPLEMENTED)
      const intercoData = await this.calculateIntercompanyTransfers(entry.date, entry.accountNumber);
      entry.intercoIn = intercoData.intercoIn;
      entry.intercoOut = intercoData.intercoOut;
      
      // Calculate time deposit movements (Job 1.5 - NOW IMPLEMENTED)
      const timeDepositData = await this.calculateTimeDepositMovements(entry.date, entry.accountNumber);
      entry.timeDepositOut = timeDepositData.timeDepositOut;
      entry.timeDepositIn = timeDepositData.timeDepositIn;
      
      // Calculate projected closing balance
      entry.closingBalanceProjected = entry.openingBalance + entry.cashIn - entry.cashOut + entry.intercoIn - entry.intercoOut - entry.timeDepositOut + entry.timeDepositIn;
      
      // Get actual closing balance from bank data
      entry.closingBalanceActual = await this.getActualClosingBalance(entry.date, entry.accountNumber);
      
      // Calculate discrepancy
      entry.discrepancy = entry.closingBalanceActual - entry.closingBalanceProjected;
      
      return entry;
    } catch (error) {
      console.error('Failed to calculate balances for entry:', error);
      throw error;
    }
  }

  /**
   * Calculate opening balance for a specific date and account
   * Uses previous day's closing balance or bank data if first day
   */
  private async calculateOpeningBalance(date: string, accountNumber: string): Promise<number> {
    try {
      // Get previous day's date
      const currentDate = new Date(date);
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split('T')[0];

      // Try to get previous day's entry
      const previousEntry = await this.getDailyCashEntryByDateAndAccount(previousDateStr, accountNumber);
      if (previousEntry && previousEntry.closingBalanceActual !== 0) {
        return previousEntry.closingBalanceActual;
      }

      // Fallback: get opening balance from bank balance service
      return await this.getOpeningBalanceFromBankData(date, accountNumber);
    } catch (error) {
      console.error('Failed to calculate opening balance:', error);
      return 0;
    }
  }

  /**
   * Calculate total cash in (credit transactions) for a specific date and account
   */
  private async calculateCashIn(date: string, accountNumber: string): Promise<number> {
    try {
      // Import credit transaction service
      const { creditTransactionManagementService } = await import('../../banking/transactions/CreditTransactionManagementService');
      
      const creditTransactions = await creditTransactionManagementService.getAllCreditTransactions();
      
      // Filter for specific date and account
      const dayCredits = creditTransactions.filter(transaction => 
        transaction.date === date && 
        transaction.accountId === accountNumber
      );

      // Sum up all credit amounts
      return dayCredits.reduce((sum, transaction) => sum + transaction.amount, 0);
    } catch (error) {
      console.error('Failed to calculate cash in:', error);
      return 0;
    }
  }

  /**
   * Calculate total cash out (debit + HR transactions) for a specific date and account
   */
  private async calculateCashOut(date: string, accountNumber: string): Promise<number> {
    try {
      let totalCashOut = 0;

      // Get debit transactions
      try {
        const { debitTransactionManagementService } = await import('../../banking/transactions/DebitTransactionManagementService');
        const debitTransactions = await debitTransactionManagementService.getAllDebitTransactions();
        
        const dayDebits = debitTransactions.filter(transaction => 
          transaction.date === date && 
          transaction.accountId === accountNumber
        );
        
        totalCashOut += dayDebits.reduce((sum, transaction) => sum + transaction.amount, 0);
      } catch (error) {
        console.warn('Debit transaction service not available:', error);
      }

      // Get HR payments
      try {
        const { hrPaymentManagementService } = await import('../payments/HRPaymentManagementService');
        const hrPayments = await hrPaymentManagementService.getAllHRPayments();
        
        const dayHRPayments = hrPayments.filter(payment => 
          payment.date === date && 
          payment.accountId === accountNumber
        );
        
        totalCashOut += dayHRPayments.reduce((sum, payment) => sum + payment.amount, 0);
      } catch (error) {
        console.warn('HR payment service not available:', error);
      }

      return totalCashOut;
    } catch (error) {
      console.error('Failed to calculate cash out:', error);
      return 0;
    }
  }

  /**
   * Calculate intercompany transfers for a specific date and account (Job 1.4 - IMPLEMENTED)
   */
  private async calculateIntercompanyTransfers(date: string, accountNumber: string): Promise<{
    intercoIn: number;
    intercoOut: number;
  }> {
    try {
      // Import intercompany transfer service
      const { intercompanyTransferService } = await import('../intercompany/IntercompanyTransferService');
      
      const intercoData = await intercompanyTransferService.getIntercompanyTransfersForDate(date, accountNumber);
      
      return {
        intercoIn: intercoData.intercoIn,
        intercoOut: intercoData.intercoOut
      };
    } catch (error) {
      console.warn('Intercompany transfer service not available:', error);
      return { intercoIn: 0, intercoOut: 0 };
    }
  }

  /**
   * Calculate time deposit movements for a specific date and account (Job 1.5 - IMPLEMENTED)
   */
  private async calculateTimeDepositMovements(date: string, accountNumber: string): Promise<{
    timeDepositOut: number;
    timeDepositIn: number;
  }> {
    try {
      // Import time deposit service
      const { timeDepositService } = await import('./timeDepositService');
      
      const timeDepositData = await timeDepositService.getTimeDepositMovementsForDate(date, accountNumber);
      
      return {
        timeDepositOut: timeDepositData.timeDepositOut,
        timeDepositIn: timeDepositData.timeDepositIn
      };
    } catch (error) {
      console.warn('Time deposit service not available:', error);
      return { timeDepositOut: 0, timeDepositIn: 0 };
    }
  }

  /**
   * Get actual closing balance from bank data for a specific date and account
   */
  private async getActualClosingBalance(date: string, accountNumber: string): Promise<number> {
    try {
      // Import unified balance service
      const { unifiedBalanceService } = await import('./unifiedBalanceService');
      
      const dailyBalances = unifiedBalanceService.getDailyBalances();
      
      // Find balance for specific date and account
      const dayBalance = dailyBalances.find(balance => 
        balance.date === date && 
        balance.accountNumber === accountNumber
      );

      return dayBalance ? dayBalance.closingBalance : 0;
    } catch (error) {
      console.error('Failed to get actual closing balance:', error);
      return 0;
    }
  }

  /**
   * Get opening balance from bank data when no previous day entry exists
   */
  private async getOpeningBalanceFromBankData(date: string, accountNumber: string): Promise<number> {
    try {
      // Import unified balance service
      const { unifiedBalanceService } = await import('./unifiedBalanceService');
      
      const dailyBalances = unifiedBalanceService.getDailyBalances();
      
      // Find balance for specific date and account
      const dayBalance = dailyBalances.find(balance => 
        balance.date === date && 
        balance.accountNumber === accountNumber
      );

      return dayBalance ? dayBalance.openingBalance : 0;
    } catch (error) {
      console.error('Failed to get opening balance from bank data:', error);
      return 0;
    }
  }

  /**
   * Recalculate balances for existing daily cash entries
   * Useful when transaction data is updated
   */
  async recalculateBalances(
    dateFrom?: string, 
    dateTo?: string, 
    accountIds?: string[]
  ): Promise<DailyCashEntry[]> {
    try {
      let entries = await this.getDailyCashEntriesForDisplay({
        dateFrom,
        dateTo,
        accountId: accountIds?.[0] // For simplicity, take first account if multiple
      });

      // Filter by account IDs if provided
      if (accountIds && accountIds.length > 0) {
        entries = entries.filter(entry => accountIds.includes(entry.accountNumber));
      }

      const recalculatedEntries: DailyCashEntry[] = [];

      for (const entry of entries) {
        const recalculatedEntry = await this.calculateBalances(entry);
        recalculatedEntries.push(recalculatedEntry);
      }

      // Store recalculated entries
      if (recalculatedEntries.length > 0) {
        await this.storeDailyCashEntries(recalculatedEntries);
        
        eventBus.emit('DAILY_CASH_BALANCES_RECALCULATED', {
          count: recalculatedEntries.length,
          dateRange: { from: dateFrom, to: dateTo }
        });
      }

      return recalculatedEntries;
    } catch (error) {
      console.error('Failed to recalculate balances:', error);
      throw error;
    }
  }

  /**
   * Calculate balance summary statistics
   */
  async getBalanceSummaryStats(entries: DailyCashEntry[]): Promise<{
    totalCashIn: number;
    totalCashOut: number;
    totalDiscrepancies: number;
    averageDiscrepancy: number;
    maxDiscrepancy: number;
    entriesWithDiscrepancies: number;
    discrepancyPercentage: number;
  }> {
    try {
      if (entries.length === 0) {
        return {
          totalCashIn: 0,
          totalCashOut: 0,
          totalDiscrepancies: 0,
          averageDiscrepancy: 0,
          maxDiscrepancy: 0,
          entriesWithDiscrepancies: 0,
          discrepancyPercentage: 0
        };
      }

      const totalCashIn = entries.reduce((sum, entry) => sum + entry.cashIn, 0);
      const totalCashOut = entries.reduce((sum, entry) => sum + entry.cashOut, 0);
      const discrepancies = entries.map(entry => Math.abs(entry.discrepancy));
      const entriesWithDiscrepancies = entries.filter(entry => Math.abs(entry.discrepancy) > 0.01).length;

      return {
        totalCashIn,
        totalCashOut,
        totalDiscrepancies: discrepancies.reduce((sum, d) => sum + d, 0),
        averageDiscrepancy: discrepancies.length > 0 
          ? discrepancies.reduce((sum, d) => sum + d, 0) / discrepancies.length 
          : 0,
        maxDiscrepancy: discrepancies.length > 0 ? Math.max(...discrepancies) : 0,
        entriesWithDiscrepancies,
        discrepancyPercentage: entries.length > 0 
          ? (entriesWithDiscrepancies / entries.length) * 100 
          : 0
      };
    } catch (error) {
      console.error('Failed to calculate balance summary stats:', error);
      throw error;
    }
  }

  // =============================================
  // PUBLIC API FOR UI COMPONENTS
  // =============================================

  /**
   * Get daily cash entries with optional filtering
   */
  async getDailyCashEntriesForDisplay(filters?: {
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
    isVerified?: boolean;
  }): Promise<DailyCashEntry[]> {
    try {
      let entries = await this.getAllDailyCashEntries();

      if (filters) {
        if (filters.accountId) {
          entries = entries.filter(entry => entry.accountNumber === filters.accountId);
        }
        if (filters.dateFrom) {
          entries = entries.filter(entry => entry.date >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          entries = entries.filter(entry => entry.date <= filters.dateTo!);
        }
        if (filters.isVerified !== undefined) {
          entries = entries.filter(entry => entry.isVerified === filters.isVerified);
        }
      }

      return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Failed to get daily cash entries for display:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for daily cash management
   */
  async getDailyCashSummary(): Promise<{
    totalEntries: number;
    verifiedEntries: number;
    unverifiedEntries: number;
    totalDiscrepancies: number;
    averageDiscrepancy: number;
    dateRange: { from: string; to: string } | null;
  }> {
    try {
      const entries = await this.getAllDailyCashEntries();
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          verifiedEntries: 0,
          unverifiedEntries: 0,
          totalDiscrepancies: 0,
          averageDiscrepancy: 0,
          dateRange: null
        };
      }

      const verifiedEntries = entries.filter(entry => entry.isVerified);
      const discrepancies = entries.map(entry => Math.abs(entry.discrepancy));
      const dates = entries.map(entry => entry.date).sort();

      return {
        totalEntries: entries.length,
        verifiedEntries: verifiedEntries.length,
        unverifiedEntries: entries.length - verifiedEntries.length,
        totalDiscrepancies: discrepancies.reduce((sum, d) => sum + d, 0),
        averageDiscrepancy: discrepancies.length > 0 
          ? discrepancies.reduce((sum, d) => sum + d, 0) / discrepancies.length 
          : 0,
        dateRange: {
          from: dates[0],
          to: dates[dates.length - 1]
        }
      };
    } catch (error) {
      console.error('Failed to get daily cash summary:', error);
      return {
        totalEntries: 0,
        verifiedEntries: 0,
        unverifiedEntries: 0,
        totalDiscrepancies: 0,
        averageDiscrepancy: 0,
        dateRange: null
      };
    }
  }
}

// Export singleton instance
export const dailyCashManagementService = new DailyCashManagementService(); 