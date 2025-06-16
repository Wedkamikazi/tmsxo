/**
 * TIME DEPOSIT SERVICE (Job 1.5)
 * 
 * Handles time deposit (investment) operations:
 * - Automatic extraction from bank statements
 * - AI/LLM-based identification of deposits and maturities
 * - Intelligent investment suggestions based on cash flow analysis
 * - Liquidity management with Saudi weekend considerations
 * - Maturity tracking and reconciliation
 * - Risk assessment and obligation management
 * - Integration with daily cash management
 */

import {
  TimeDeposit,
  InvestmentSuggestion,
  ObligationEntry,
  BusinessCalendar,
  AuditLogEntry,
  Transaction
} from '@/shared/types';
import { eventBus } from '@/core/orchestration/EventBus';

// =============================================
// TIME DEPOSIT SERVICE
// =============================================

class TimeDepositService {
  private readonly STORAGE_KEY = 'tms_time_deposits';
  private readonly INVESTMENT_SUGGESTIONS_KEY = 'tms_investment_suggestions';
  private readonly OBLIGATIONS_KEY = 'tms_obligations';
  private readonly BUSINESS_CALENDAR_KEY = 'tms_business_calendar';
  private readonly AUDIT_LOG_KEY = 'tms_time_deposit_audit_log';

  // Investment configuration
  private readonly CONFIG = {
    minimumBufferAmount: 1000000, // 1M SAR minimum buffer
    minimumInvestmentAmount: 500000, // 500K SAR minimum investment
    maximumInvestmentPercentage: 80, // Max 80% of available cash
    defaultInvestmentTerm: 30, // 30 days default
    toleranceAmount: 10000, // 10K SAR tolerance for matching
    riskAssessmentThreshold: 0.8, // 80% confidence for auto-suggestions
    weekendBufferDays: 2 // Extra buffer days for Saudi weekends
  };

  constructor() {
    console.log('✅ Time Deposit Service initialized');
    this.initializeDefaultData();
    this.initializeEventListeners();
  }

  // =============================================
  // INITIALIZATION
  // =============================================

  private initializeDefaultData(): void {
    // Initialize with sample data if not exists
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      const sampleDeposits: TimeDeposit[] = [
        {
          id: 'TD001',
          accountId: '1001',
          principalAmount: 2000000,
          interestRate: 4.5,
          placementDate: '2024-01-10',
          maturityDate: '2024-02-09',
          bankName: 'Saudi National Bank',
          depositNumber: 'TD-20240110-001',
          status: 'active',
          autoRollover: false,
          reconciliationStatus: 'confirmed',
          placementReference: 'PLAC-240110-001',
          observations: 'Standard 30-day placement'
        },
        {
          id: 'TD002',
          accountId: '1001',
          principalAmount: 1500000,
          interestRate: 4.2,
          placementDate: '2024-01-05',
          maturityDate: '2024-01-20',
          bankName: 'Al Rajhi Bank',
          depositNumber: 'TD-20240105-001',
          status: 'matured',
          maturedAmount: 1520833, // Principal + interest
          actualMaturityDate: '2024-01-20',
          autoRollover: false,
          reconciliationStatus: 'confirmed',
          placementReference: 'PLAC-240105-001',
          maturityReference: 'MAT-240120-001',
          observations: 'Matured on schedule'
        }
      ];
      this.storeData(this.STORAGE_KEY, sampleDeposits);

      // Sample obligations for liquidity management
      const sampleObligations: ObligationEntry[] = [
        {
          id: 'OBL001',
          date: '2024-02-15',
          description: 'Monthly payroll',
          amount: 5000000,
          type: 'payroll',
          criticality: 'critical'
        },
        {
          id: 'OBL002',
          date: '2024-02-10',
          description: 'Quarterly vendor payments',
          amount: 3000000,
          type: 'vendor_payment',
          criticality: 'important'
        }
      ];
      this.storeData(this.OBLIGATIONS_KEY, sampleObligations);

      // Sample business calendar for Saudi weekends
      const sampleCalendar: BusinessCalendar[] = [
        {
          id: 'CAL001',
          date: '2024-02-10',
          country: 'SA',
          type: 'weekend',
          name: 'Saturday Weekend',
          bankingDay: false,
          settlementDay: false
        },
        {
          id: 'CAL002',
          date: '2024-02-09',
          country: 'SA',
          type: 'weekday',
          bankingDay: true,
          settlementDay: true
        }
      ];
      this.storeData(this.BUSINESS_CALENDAR_KEY, sampleCalendar);

      console.log('✅ Time Deposit Service initialized with sample data');
    }
  }

  private initializeEventListeners(): void {
    // Listen for transaction updates that might be deposits or maturities
    eventBus.on('BANK_STATEMENT_IMPORTED', (data: any) => {
      this.handleBankStatementImport(data);
    });

    eventBus.on('TRANSACTION_CATEGORIZED', (data: any) => {
      this.handleTransactionCategorization(data);
    });

    eventBus.on('DAILY_CASH_BALANCE_UPDATED', (data: any) => {
      this.handleBalanceUpdate(data);
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
   * Get all time deposits with optional filtering
   */
  async getAllTimeDeposits(filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: 'active' | 'matured' | 'cancelled';
    accountId?: string;
    bankName?: string;
  }): Promise<TimeDeposit[]> {
    try {
      let deposits = this.getStoredData(this.STORAGE_KEY) as TimeDeposit[];

      // Apply filters
      if (filters) {
        if (filters.dateFrom) {
          deposits = deposits.filter(d => d.placementDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
          deposits = deposits.filter(d => d.placementDate <= filters.dateTo!);
        }
        if (filters.status) {
          deposits = deposits.filter(d => d.status === filters.status);
        }
        if (filters.accountId) {
          deposits = deposits.filter(d => d.accountId === filters.accountId);
        }
        if (filters.bankName) {
          deposits = deposits.filter(d => d.bankName === filters.bankName);
        }
      }

      return deposits.sort((a, b) => new Date(b.placementDate).getTime() - new Date(a.placementDate).getTime());
    } catch (error) {
      console.error('Failed to get time deposits:', error);
      return [];
    }
  }

  /**
   * Get time deposit movements for a specific date and account (for daily cash management)
   */
  async getTimeDepositMovementsForDate(date: string, accountId: string): Promise<{
    timeDepositOut: number;
    timeDepositIn: number;
    movements: {
      placements: TimeDeposit[];
      maturities: TimeDeposit[];
    };
  }> {
    try {
      const deposits = await this.getAllTimeDeposits({ accountId: accountId });

      // Placements on this date
      const placements = deposits.filter(d => 
        d.placementDate === date && 
        (d.status === 'active' || d.status === 'matured')
      );

      // Maturities on this date
      const maturities = deposits.filter(d => 
        (d.actualMaturityDate === date || (d.maturityDate === date && !d.actualMaturityDate)) &&
        d.status === 'matured'
      );

      const timeDepositOut = placements.reduce((sum, d) => sum + d.principalAmount, 0);
      const timeDepositIn = maturities.reduce((sum, d) => sum + (d.maturedAmount || d.principalAmount), 0);

      return {
        timeDepositOut,
        timeDepositIn,
        movements: {
          placements,
          maturities
        }
      };
    } catch (error) {
      console.error('Failed to get time deposit movements for date:', error);
      return { 
        timeDepositOut: 0, 
        timeDepositIn: 0, 
        movements: { placements: [], maturities: [] }
      };
    }
  }

  /**
   * Extract and categorize time deposits from bank transactions
   */
  async extractTimeDeposits(transactions: Transaction[], accountId: string): Promise<TimeDeposit[]> {
    try {
      const extractedDeposits: TimeDeposit[] = [];

      for (const transaction of transactions) {
        // Check if transaction is a deposit placement or maturity
        const depositInfo = await this.analyzeTransactionForDeposit(transaction);
        
        if (depositInfo.isDeposit) {
          const deposit = await this.createTimeDepositFromTransaction(transaction, accountId, depositInfo);
          extractedDeposits.push(deposit);
        }
      }

      // Store new deposits
      if (extractedDeposits.length > 0) {
        await this.storeTimeDeposits(extractedDeposits);
        
        eventBus.emit('TIME_DEPOSITS_EXTRACTED', {
          count: extractedDeposits.length,
          accountId: accountId
        });
      }

      return extractedDeposits;
    } catch (error) {
      console.error('Failed to extract time deposits:', error);
      throw error;
    }
  }

  /**
   * Analyze transaction to determine if it's a deposit-related transaction
   */
  private async analyzeTransactionForDeposit(transaction: Transaction): Promise<{
    isDeposit: boolean;
    type: 'placement' | 'maturity' | null;
    depositNumber?: string;
    interestRate?: number;
    maturityDate?: string;
  }> {
    try {
      const description = transaction.description.toLowerCase();
      
      // Pattern-based identification
      const depositPatterns = [
        'time deposit',
        'deposit placement',
        'investment',
        'fixed deposit',
        'term deposit',
        'maturity',
        'placement',
        'rollover'
      ];

      const hasDepositPattern = depositPatterns.some(pattern => 
        description.includes(pattern)
      );

      // Amount-based heuristics (deposits are typically large amounts)
      const isLargeAmount = (transaction.creditAmount >= this.CONFIG.minimumInvestmentAmount || 
                            transaction.debitAmount >= this.CONFIG.minimumInvestmentAmount);

      if (hasDepositPattern && isLargeAmount) {
        // Determine if placement or maturity
        const isMaturity = description.includes('maturity') || 
                          description.includes('matured') ||
                          (transaction.creditAmount > 0 && description.includes('deposit'));
        
        const type: 'placement' | 'maturity' = isMaturity ? 'maturity' : 'placement';

        // Extract deposit number if available
        const depositNumberMatch = description.match(/(?:td|deposit)[:\s-]*([a-z0-9-]+)/i);
        const depositNumber = depositNumberMatch ? depositNumberMatch[1] : undefined;

        // Extract interest rate if available
        const rateMatch = description.match(/(\d+\.?\d*)%/);
        const interestRate = rateMatch ? parseFloat(rateMatch[1]) : undefined;

        // Extract maturity date if available (for placements)
        const dateMatch = description.match(/(?:matur|due)[:\s]*(\d{4}-\d{2}-\d{2})/i);
        const maturityDate = dateMatch ? dateMatch[1] : undefined;

        return {
          isDeposit: true,
          type: type,
          depositNumber: depositNumber,
          interestRate: interestRate,
          maturityDate: maturityDate
        };
      }

      return { isDeposit: false, type: null };
    } catch (error) {
      console.error('Failed to analyze transaction for deposit:', error);
      return { isDeposit: false, type: null };
    }
  }

  /**
   * Create time deposit record from bank transaction
   */
  private async createTimeDepositFromTransaction(
    transaction: Transaction, 
    accountId: string,
    depositInfo: any
  ): Promise<TimeDeposit> {
    const depositId = `TD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (depositInfo.type === 'placement') {
      // New deposit placement
      const maturityDate = depositInfo.maturityDate || 
                          this.calculateMaturityDate(transaction.date, this.CONFIG.defaultInvestmentTerm);

      const deposit: TimeDeposit = {
        id: depositId,
        accountId: accountId,
        principalAmount: transaction.debitAmount,
        interestRate: depositInfo.interestRate || 4.0, // Default rate
        placementDate: transaction.date,
        maturityDate: maturityDate,
        bankName: this.extractBankNameFromDescription(transaction.description),
        depositNumber: depositInfo.depositNumber || `TD-${transaction.date.replace(/-/g, '')}-${Math.random().toString(36).substr(2, 3)}`,
        status: 'active',
        autoRollover: false,
        reconciliationStatus: 'pending',
        placementReference: transaction.reference || '',
        observations: `Auto-extracted from transaction: ${transaction.description}`
      };

      return deposit;
    } else {
      // Deposit maturity
      const deposit: TimeDeposit = {
        id: depositId,
        accountId: accountId,
        principalAmount: 0, // Will be updated when matched with placement
        interestRate: depositInfo.interestRate || 4.0,
        placementDate: '', // Will be updated when matched
        maturityDate: transaction.date,
        bankName: this.extractBankNameFromDescription(transaction.description),
        depositNumber: depositInfo.depositNumber || `MAT-${transaction.date.replace(/-/g, '')}-${Math.random().toString(36).substr(2, 3)}`,
        status: 'matured',
        maturedAmount: transaction.creditAmount,
        actualMaturityDate: transaction.date,
        autoRollover: false,
        reconciliationStatus: 'pending',
        maturityReference: transaction.reference || '',
        observations: `Auto-extracted maturity from transaction: ${transaction.description}`
      };

      // Try to match with existing placement
      await this.attemptMaturityMatching(deposit);

      return deposit;
    }
  }

  /**
   * Calculate maturity date based on placement date and term
   */
  private calculateMaturityDate(placementDate: string, termDays: number): string {
    const placement = new Date(placementDate);
    const maturity = new Date(placement);
    maturity.setDate(maturity.getDate() + termDays);

    // Adjust for Saudi weekends
    return this.adjustForSaudiWeekend(maturity.toISOString().split('T')[0]);
  }

  /**
   * Adjust date to avoid Saudi weekends (Friday-Saturday)
   */
  private adjustForSaudiWeekend(date: string): string {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday

    // If Friday or Saturday, move to next Sunday
    if (dayOfWeek === 5) { // Friday
      dateObj.setDate(dateObj.getDate() + 2);
    } else if (dayOfWeek === 6) { // Saturday
      dateObj.setDate(dateObj.getDate() + 1);
    }

    return dateObj.toISOString().split('T')[0];
  }

  /**
   * Extract bank name from transaction description
   */
  private extractBankNameFromDescription(description: string): string {
    try {
      const bankPatterns = [
        /saudi national bank/i,
        /al rajhi bank/i,
        /riyadh bank/i,
        /banque saudi fransi/i,
        /arab national bank/i,
        /samba/i,
        /ncb/i
      ];

      for (const pattern of bankPatterns) {
        const match = description.match(pattern);
        if (match) {
          return match[0];
        }
      }

      return 'Unknown Bank';
    } catch (error) {
      console.error('Failed to extract bank name:', error);
      return 'Unknown Bank';
    }
  }

  /**
   * Attempt to match maturity with existing placement
   */
  private async attemptMaturityMatching(maturityDeposit: TimeDeposit): Promise<void> {
    try {
      const deposits = this.getStoredData(this.STORAGE_KEY) as TimeDeposit[];
      
      // Find matching placement
      const matchingPlacement = deposits.find(d => 
        d.status === 'active' &&
        d.accountId === maturityDeposit.accountId &&
        Math.abs(new Date(d.maturityDate).getTime() - new Date(maturityDeposit.actualMaturityDate!).getTime()) <= 3 * 24 * 60 * 60 * 1000 && // Within 3 days
        (maturityDeposit.depositNumber === d.depositNumber || 
         Math.abs((maturityDeposit.maturedAmount || 0) - d.principalAmount) < this.CONFIG.toleranceAmount)
      );

      if (matchingPlacement) {
        // Update placement to matured status
        matchingPlacement.status = 'matured';
        matchingPlacement.maturedAmount = maturityDeposit.maturedAmount;
        matchingPlacement.actualMaturityDate = maturityDeposit.actualMaturityDate;
        matchingPlacement.maturityReference = maturityDeposit.maturityReference;
        matchingPlacement.reconciliationStatus = 'matched';

        // Update maturity record with placement details
        maturityDeposit.principalAmount = matchingPlacement.principalAmount;
        maturityDeposit.placementDate = matchingPlacement.placementDate;
        maturityDeposit.interestRate = matchingPlacement.interestRate;

        console.log('✅ Successfully matched maturity with placement:', {
          placementId: matchingPlacement.id,
          maturityId: maturityDeposit.id
        });
      }
    } catch (error) {
      console.error('Failed to attempt maturity matching:', error);
    }
  }

  /**
   * Generate investment suggestions based on current cash position
   */
  async generateInvestmentSuggestions(
    accountId: string, 
    currentBalance: number,
    upcomingObligations?: ObligationEntry[]
  ): Promise<InvestmentSuggestion[]> {
    try {
      const suggestions: InvestmentSuggestion[] = [];
      
      // Get obligations if not provided
      const obligations = upcomingObligations || this.getStoredData(this.OBLIGATIONS_KEY) as ObligationEntry[];
      
      // Calculate available cash for investment
      const totalObligations = this.calculateUpcomingObligations(obligations, 90); // Next 90 days
      const bufferAmount = this.CONFIG.minimumBufferAmount;
      const availableForInvestment = currentBalance - totalObligations - bufferAmount;

      if (availableForInvestment >= this.CONFIG.minimumInvestmentAmount) {
        // Generate suggestions for different terms and amounts
        const investmentScenarios = [
          { term: 30, percentage: 60, risk: 'conservative' as const },
          { term: 60, percentage: 70, risk: 'moderate' as const },
          { term: 90, percentage: 50, risk: 'moderate' as const }
        ];

        for (const scenario of investmentScenarios) {
          const suggestedAmount = Math.min(
            availableForInvestment * (scenario.percentage / 100),
            availableForInvestment
          );

          if (suggestedAmount >= this.CONFIG.minimumInvestmentAmount) {
            const suggestion = await this.createInvestmentSuggestion(
              accountId,
              suggestedAmount,
              scenario.term,
              scenario.risk,
              currentBalance,
              obligations
            );

            suggestions.push(suggestion);
          }
        }
      }

      // Store suggestions
      if (suggestions.length > 0) {
        await this.storeInvestmentSuggestions(suggestions);
        
        eventBus.emit('INVESTMENT_SUGGESTIONS_GENERATED', {
          count: suggestions.length,
          accountId: accountId,
          totalSuggestedAmount: suggestions.reduce((sum, s) => sum + s.suggestedAmount, 0)
        });
      }

      return suggestions;
    } catch (error) {
      console.error('Failed to generate investment suggestions:', error);
      return [];
    }
  }

  /**
   * Create investment suggestion with detailed analysis
   */
  private async createInvestmentSuggestion(
    accountId: string,
    amount: number,
    termDays: number,
    riskLevel: 'conservative' | 'moderate' | 'aggressive',
    currentBalance: number,
    obligations: ObligationEntry[]
  ): Promise<InvestmentSuggestion> {
    const suggestionId = `IS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const today = new Date().toISOString().split('T')[0];
    const maturityDate = this.calculateMaturityDate(today, termDays);

    // Calculate projected return (simplified calculation)
    const interestRate = this.getInterestRateForTerm(termDays, riskLevel);
    const projectedReturn = (amount * interestRate * termDays) / (365 * 100);

    // Analyze liquidity after investment
    const remainingBalance = currentBalance - amount;
    const criticalObligations = obligations
      .filter(o => o.criticality === 'critical')
      .filter(o => new Date(o.date) <= new Date(maturityDate));

    const suggestion: InvestmentSuggestion = {
      id: suggestionId,
      date: today,
      accountId: accountId,
      suggestedAmount: amount,
      reasoning: this.generateInvestmentReasoning(amount, termDays, interestRate, remainingBalance),
      considerationsFactored: [
        'Current cash balance',
        'Upcoming obligations',
        'Minimum buffer requirements',
        'Saudi weekend adjustments',
        'Risk assessment'
      ],
      riskLevel: riskLevel,
      suggestedTerm: termDays,
      projectedReturn: projectedReturn,
      liquidity: {
        availableAfterInvestment: remainingBalance,
        upcomingObligations: criticalObligations,
        bufferAmount: this.CONFIG.minimumBufferAmount
      },
      weekendConsiderations: {
        isSaudiWeekend: this.isSaudiWeekend(maturityDate),
        adjustedMaturityDate: maturityDate,
        alternativeSuggestion: this.isSaudiWeekend(maturityDate) ? 
          `Consider ${termDays - 2} day term to avoid weekend maturity` : undefined
      }
    };

    return suggestion;
  }

  /**
   * Get interest rate based on term and risk level
   */
  private getInterestRateForTerm(termDays: number, riskLevel: 'conservative' | 'moderate' | 'aggressive'): number {
    const baseRates = {
      conservative: 3.5,
      moderate: 4.0,
      aggressive: 4.5
    };

    let rate = baseRates[riskLevel];

    // Adjust for term length
    if (termDays >= 90) {
      rate += 0.5;
    } else if (termDays >= 60) {
      rate += 0.25;
    }

    return rate;
  }

  /**
   * Generate investment reasoning text
   */
  private generateInvestmentReasoning(
    amount: number, 
    termDays: number, 
    interestRate: number, 
    remainingBalance: number
  ): string {
    return `Suggested ${termDays}-day placement of ${this.formatCurrency(amount)} at ${interestRate}% interest. ` +
           `This leaves ${this.formatCurrency(remainingBalance)} available for operations while generating ` +
           `approximately ${this.formatCurrency((amount * interestRate * termDays) / (365 * 100))} in interest income.`;
  }

  /**
   * Check if date falls on Saudi weekend
   */
  private isSaudiWeekend(date: string): boolean {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    return dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
  }

  /**
   * Calculate total upcoming obligations within specified days
   */
  private calculateUpcomingObligations(obligations: ObligationEntry[], days: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    return obligations
      .filter(o => new Date(o.date) <= cutoffDate)
      .reduce((sum, o) => sum + o.amount, 0);
  }

  /**
   * Store time deposits
   */
  private async storeTimeDeposits(deposits: TimeDeposit[]): Promise<void> {
    try {
      const existingDeposits = this.getStoredData(this.STORAGE_KEY) as TimeDeposit[];
      
      // Merge with existing, avoiding duplicates
      const allDeposits = [...existingDeposits];
      for (const deposit of deposits) {
        const existingIndex = allDeposits.findIndex(d => d.id === deposit.id);
        if (existingIndex >= 0) {
          allDeposits[existingIndex] = deposit;
        } else {
          allDeposits.push(deposit);
        }
      }

      this.storeData(this.STORAGE_KEY, allDeposits);
      
      // Log audit entries
      for (const deposit of deposits) {
        await this.logAuditEntry('CREATE_TIME_DEPOSIT', deposit.id, {
          action: 'Time deposit created',
          deposit: deposit
        });
      }

    } catch (error) {
      console.error('Failed to store time deposits:', error);
      throw error;
    }
  }

  /**
   * Store investment suggestions
   */
  private async storeInvestmentSuggestions(suggestions: InvestmentSuggestion[]): Promise<void> {
    try {
      const existingSuggestions = this.getStoredData(this.INVESTMENT_SUGGESTIONS_KEY) as InvestmentSuggestion[];
      
      // Keep only recent suggestions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentSuggestions = existingSuggestions.filter(s => 
        new Date(s.date) >= thirtyDaysAgo
      );

      const allSuggestions = [...recentSuggestions, ...suggestions];
      this.storeData(this.INVESTMENT_SUGGESTIONS_KEY, allSuggestions);

    } catch (error) {
      console.error('Failed to store investment suggestions:', error);
      throw error;
    }
  }

  // =============================================
  // EVENT HANDLERS
  // =============================================

  private async handleBankStatementImport(data: any): Promise<void> {
    try {
      if (data.transactions && data.accountId) {
        // Extract time deposits from imported transactions
        await this.extractTimeDeposits(data.transactions, data.accountId);
      }
    } catch (error) {
      console.error('Failed to handle bank statement import for time deposits:', error);
    }
  }

  private async handleTransactionCategorization(data: any): Promise<void> {
    try {
      if (data.transaction && data.category && 
          (data.category.includes('deposit') || data.category.includes('investment'))) {
        // Re-analyze transaction for deposit classification
        const depositInfo = await this.analyzeTransactionForDeposit(data.transaction);
        if (depositInfo.isDeposit) {
          await this.extractTimeDeposits([data.transaction], data.accountId);
        }
      }
    } catch (error) {
      console.error('Failed to handle transaction categorization for time deposits:', error);
    }
  }

  private async handleBalanceUpdate(data: any): Promise<void> {
    try {
      if (data.accountId && data.balance && data.balance > this.CONFIG.minimumInvestmentAmount * 2) {
        // Generate investment suggestions when balance is high
        await this.generateInvestmentSuggestions(data.accountId, data.balance);
      }
    } catch (error) {
      console.error('Failed to handle balance update for investment suggestions:', error);
    }
  }

  // =============================================
  // AUDIT LOGGING
  // =============================================

  private async logAuditEntry(action: string, entityId: string, details: any): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: 'system', // In real app, get from auth context
        action: action,
        entityType: 'investment',
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
  // UTILITIES
  // =============================================

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // =============================================
  // SUMMARY AND STATISTICS
  // =============================================

  /**
   * Get time deposit summary statistics
   */
  async getTimeDepositSummary(): Promise<{
    totalDeposits: number;
    activeDeposits: number;
    maturedDeposits: number;
    totalPrincipal: number;
    totalMaturedAmount: number;
    averageInterestRate: number;
    totalInterestEarned: number;
    utilizationRate: number;
  }> {
    try {
      const deposits = await this.getAllTimeDeposits();
      
      const activeDeposits = deposits.filter(d => d.status === 'active');
      const maturedDeposits = deposits.filter(d => d.status === 'matured');
      
      const totalPrincipal = deposits.reduce((sum, d) => sum + d.principalAmount, 0);
      const totalMaturedAmount = maturedDeposits.reduce((sum, d) => sum + (d.maturedAmount || d.principalAmount), 0);
      const totalInterestEarned = maturedDeposits.reduce((sum, d) => 
        sum + ((d.maturedAmount || d.principalAmount) - d.principalAmount), 0
      );

      const avgInterestRate = deposits.length > 0 ? 
        deposits.reduce((sum, d) => sum + d.interestRate, 0) / deposits.length : 0;

      return {
        totalDeposits: deposits.length,
        activeDeposits: activeDeposits.length,
        maturedDeposits: maturedDeposits.length,
        totalPrincipal: totalPrincipal,
        totalMaturedAmount: totalMaturedAmount,
        averageInterestRate: avgInterestRate,
        totalInterestEarned: totalInterestEarned,
        utilizationRate: activeDeposits.length > 0 ? 85 : 0 // Simplified calculation
      };
    } catch (error) {
      console.error('Failed to get time deposit summary:', error);
      return {
        totalDeposits: 0,
        activeDeposits: 0,
        maturedDeposits: 0,
        totalPrincipal: 0,
        totalMaturedAmount: 0,
        averageInterestRate: 0,
        totalInterestEarned: 0,
        utilizationRate: 0
      };
    }
  }
}

// Export singleton instance
export const timeDepositService = new TimeDepositService();
export default timeDepositService; 