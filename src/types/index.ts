// Bank Account Types
export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  currentBalance: number;
}

// Transaction Categorization Types
export interface TransactionCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  parentCategoryId?: string;
  color: string;
  icon?: string;
  isSystem: boolean;
  createdDate: string;
  modifiedDate: string;
}

export interface CategorizationRule {
  id: string;
  categoryId: string;
  description: string;
  amountMin?: number;
  amountMax?: number;
  priority: number;
  isActive: boolean;
  createdDate: string;
}

export interface MLCategorizationResult {
  categoryId: string;
  confidence: number;
  reasoning: string;
  alternativeCategories: Array<{
    categoryId: string;
    confidence: number;
  }>;
  metadata?: {
    sentiment?: string;
    sentimentConfidence?: number;
    isAnomaly?: boolean;
    anomalyScore?: number;
    pattern?: string;
    patternConfidence?: number;
    modelVersion?: string;
    predictionTimestamp?: string;
    tensorflowMemory?: any;
    processingTime?: number;
  };
}

export interface TransactionCategorization {
  transactionId: string;
  categoryId: string;
  method: 'manual' | 'ml' | 'rule';
  confidence?: number;
  reasoning?: string;
  createdDate: string;
  modifiedDate: string;
  userId?: string;
}

// Transaction Types
export interface Transaction {
  id: string;
  date: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  reference?: string;
  category?: string;
  postDate?: string;
  time?: string;
  valueDate?: string;
  categorization?: TransactionCategorization;
}

// ML Configuration Types
export interface MLCategorizationConfig {
  modelName: string;
  ollamaEndpoint: string; // Local Ollama server endpoint (e.g., http://localhost:11434)
  confidenceThreshold: number;
  maxRetries: number;
  timeout: number;
  batchSize: number;
  trainingDataPath?: string;
}

export interface TrainingData {
  transactions: Transaction[];
  categories: TransactionCategory[];
  lastTrainingDate: string;
  modelVersion: string;
  accuracy: number;
}

// CSV Import Types
export interface CSVRow {
  bankReference: string;
  narrative: string;
  customerReference: string;
  trnType: string;
  valueDate: string;
  creditAmount: string;
  debitAmount: string;
  time: string;
  postDate: string;
  balance: string;
}

// Validation Types
export interface ValidationRule {
  field: string;
  rule: 'required' | 'number' | 'date' | 'positive' | 'balance';
  message: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

// Import Processing Types
export interface ImportSummary {
  fileName: string;
  totalTransactions: number;
  totalDebitAmount: number;
  totalCreditAmount: number;
  closingBalance: number;
  openingBalance: number;
  dailyMovement: number;
  validationErrors: ValidationError[];
  transactions: Transaction[];
  dateRange: {
    from: string;
    to: string;
  };
}

export interface BankStatementImport {
  files: File[];
  selectedBankAccount?: BankAccount;
  importSummaries: ImportSummary[];
  isProcessing: boolean;
  step: 'upload' | 'selectBank' | 'review' | 'confirm';
}

// CSV Template Configuration
export interface CSVTemplate {
  headers: string[];
  validationRules: ValidationRule[];
  sampleData: Record<string, string>[];
}

// File Management Types
export interface UploadedFile {
  id: string;
  fileName: string;
  uploadDate: string;
  accountId: string;
  accountName: string;
  transactionCount: number;
  fileSize: number;
  checksum?: string;
}

// Credit Transaction Types
export interface CreditTransactionView {
  id: string;
  date: string;
  description: string;
  creditAmount: number;
  debitAmount: number;
  balance: number;
  accountId: string;
  accountName: string;
  reference?: string;
  postDate?: string;
  time?: string;
  categorization?: TransactionCategorization;
  amount: number;
  reconciliation?: any;
  arEntry?: any;
  forecastEntry?: any;
  matchConfidence?: number;
  reconciliationStatus: 'matched' | 'unmatched' | 'disputed' | 'manual';
  importDate: string;
  fileId?: string;
  postDateTime: string;
  categoryId?: string;
  manualCategoryId?: string;
}

// Collection Types
export interface CollectionType {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  color: string;
  isSystemType: boolean;
  createdDate: string;
}

// =============================================
// ENHANCED CASH MANAGEMENT WORKFLOW TYPES
// =============================================

// Credit Transaction Types
export interface CreditTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  accountId: string;
  accountName: string;
  extractionDate: string;
  categoryType: 'customer_payment' | 'refund' | 'interest' | 'investment_maturity' | 'intercompany_in' | 'other';
  reconciliationStatus: 'pending' | 'auto_matched' | 'manually_matched' | 'unknown_collection' | 'confirmed';
  confidenceRatio?: number;
  arAgingMatch?: ARAgingEntry;
  forecastMatch?: ForecastedCollection;
  verificationDate?: string;
  verifiedBy?: string;
  observations?: string;
}

// Debit Transaction Types
export interface DebitTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  accountId: string;
  accountName: string;
  extractionDate: string;
  categoryType: 'vendor_payment' | 'hr_payment' | 'fee' | 'tax' | 'intercompany_out' | 'time_deposit' | 'other';
  reconciliationStatus: 'pending' | 'auto_matched' | 'manually_matched' | 'confirmed';
  confidenceRatio?: number;
  apAgingMatch?: APAgingEntry;
  forecastMatch?: ForecastedPayment;
  verificationDate?: string;
  verifiedBy?: string;
  observations?: string;
}

// HR Payment Types
export interface HRPayment {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  paymentType: 'salary' | 'bonus' | 'overtime' | 'reimbursement' | 'final_settlement';
  reference: string;
  accountId: string;
  reconciliationStatus: 'pending' | 'auto_matched' | 'manually_matched' | 'confirmed';
  confidenceRatio?: number;
  payrollMatch?: PayrollEntry;
  verificationDate?: string;
  verifiedBy?: string;
  observations?: string;
}

// Intercompany Transfer Types
export interface IntercompanyTransfer {
  id: string;
  date: string;
  amount: number;
  direction: 'inbound' | 'outbound';
  counterpartyEntity: string;
  purpose: string;
  reference: string;
  accountId: string;
  reconciliationStatus: 'pending' | 'auto_matched' | 'manually_matched' | 'confirmed';
  confidenceRatio?: number;
  intercompanyMatch?: IntercompanyRecord;
  cashForecastMatch?: CashForecastEntry;
  verificationDate?: string;
  verifiedBy?: string;
  observations?: string;
}

// Time Deposit (Investment) Types
export interface TimeDeposit {
  id: string;
  accountId: string;
  principalAmount: number;
  interestRate: number;
  placementDate: string;
  maturityDate: string;
  bankName: string;
  depositNumber: string;
  status: 'active' | 'matured' | 'cancelled';
  maturedAmount?: number;
  actualMaturityDate?: string;
  autoRollover: boolean;
  reconciliationStatus?: 'pending' | 'matched' | 'confirmed';
  placementReference?: string;
  maturityReference?: string;
  observations?: string;
}

// Supporting Entity Types
export interface ARAgingEntry {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  dueDate: string;
  amount: number;
  agingDays: number;
  status: 'pending' | 'overdue' | 'collected';
}

export interface APAgingEntry {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  dueDate: string;
  amount: number;
  agingDays: number;
  status: 'pending' | 'overdue' | 'paid';
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string;
  grossAmount: number;
  netAmount: number;
  payDate: string;
  status: 'pending' | 'paid';
}

export interface IntercompanyRecord {
  id: string;
  counterpartyEntity: string;
  amount: number;
  dueDate: string;
  purpose: string;
  status: 'pending' | 'transferred';
}

export interface ForecastedCollection {
  id: string;
  customerId: string;
  expectedDate: string;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface ForecastedPayment {
  id: string;
  vendorId: string;
  expectedDate: string;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface CashForecastEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  confidence: 'high' | 'medium' | 'low';
  category: string;
}

// Daily Cash Management Table Types
export interface DailyCashEntry {
  id: string;
  date: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  openingBalance: number;
  cashIn: number; // AR + Other credits
  cashOut: number; // AP + HR + Other debits
  intercoIn: number;
  intercoOut: number;
  timeDepositOut: number;
  timeDepositIn: number; // Matured deposits (principal + profit)
  closingBalanceActual: number;
  closingBalanceProjected: number;
  discrepancy: number;
  notes?: string;
  observations?: string;
  isVerified: boolean;
  verifiedDate?: string;
  verifiedBy?: string;
}

// Reconciliation Types
export interface ReconciliationMatch {
  id: string;
  transactionId: string;
  matchedEntityId: string;
  matchedEntityType: 'ar_aging' | 'ap_aging' | 'payroll' | 'intercompany' | 'forecast';
  matchType: 'auto' | 'manual';
  confidenceScore: number;
  matchDate: string;
  verifiedDate?: string;
  verifiedBy?: string;
  notes?: string;
}

// Investment Logic Types
export interface InvestmentSuggestion {
  id: string;
  date: string;
  accountId: string;
  suggestedAmount: number;
  reasoning: string;
  considerationsFactored: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  suggestedTerm: number; // days
  projectedReturn: number;
  liquidity: {
    availableAfterInvestment: number;
    upcomingObligations: ObligationEntry[];
    bufferAmount: number;
  };
  weekendConsiderations?: {
    isSaudiWeekend: boolean;
    adjustedMaturityDate?: string;
    alternativeSuggestion?: string;
  };
}

export interface ObligationEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'payroll' | 'vendor_payment' | 'tax' | 'loan_payment' | 'other';
  criticality: 'critical' | 'important' | 'routine';
}

// Audit and Verification Types
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  entityType: 'credit' | 'debit' | 'hr' | 'intercompany' | 'investment' | 'daily_cash';
  entityId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  notes?: string;
  ipAddress?: string;
}

export interface DiscrepancyAlert {
  id: string;
  date: string;
  accountId: string;
  type: 'balance_mismatch' | 'unmatched_transaction' | 'missing_maturity' | 'liquidity_shortfall';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  amount?: number;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedDate?: string;
  resolution?: string;
}

// Dashboard and Analytics Types
export interface CashFlowAnalytics {
  accountId: string;
  period: string;
  totalInflows: number;
  totalOutflows: number;
  netCashFlow: number;
  averageDailyBalance: number;
  peakBalance: number;
  lowBalance: number;
  investmentUtilization: number;
  reconciliationAccuracy: number;
  discrepancyCount: number;
  trends: {
    inflowTrend: 'increasing' | 'decreasing' | 'stable';
    outflowTrend: 'increasing' | 'decreasing' | 'stable';
    balanceTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

// Weekend and Holiday Awareness Types
export interface BusinessCalendar {
  id: string;
  date: string;
  country: string;
  type: 'weekday' | 'weekend' | 'holiday';
  name?: string; // Holiday name
  bankingDay: boolean;
  settlementDay: boolean;
}

// Configuration Types
export interface CashManagementConfig {
  minimumBufferAmount: number;
  investmentThresholds: {
    minimum: number;
    recommended: number;
    maximum: number;
  };
  reconciliationTolerances: {
    amount: number;
    percentage: number;
  };
  alertThresholds: {
    discrepancy: number;
    liquidity: number;
    unmatchedCount: number;
  };
  businessRules: {
    autoInvestEnabled: boolean;
    weekendMaturityAvoidance: boolean;
    payrollDayProtection: boolean;
    minimumLiquidityDays: number;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    dashboardAlerts: boolean;
  };
} 