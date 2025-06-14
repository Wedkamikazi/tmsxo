// Bank Account Types
export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  currentBalance: number;
}

// Transaction Category Types
export interface TransactionCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  parentCategoryId?: string;
  isSystem: boolean;
  createdDate: string;
  modifiedDate: string;
  keywords?: string[];
}

export interface CategoryRule {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  field: 'description' | 'amount' | 'reference';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'amount_range';
  value: string;
  priority: number;
  isActive: boolean;
  patterns: string[];
  conditions: {
    field: string;
    operator: string;
    value: string;
    caseSensitive: boolean;
  }[];
  amountRange?: {
    min: string;
    max: string;
  };
  createdDate?: string;
  amountMin?: number;
  amountMax?: number;
}

// Alias for backward compatibility
export type CategorizationRule = CategoryRule;

export interface MLCategorization {
  categoryId: string;
  confidence: number;
  algorithm: 'neural_network' | 'naive_bayes' | 'pattern_matching';
  features: string[];
  trainingDate: string;
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
  // Categorization fields
  categoryId?: string;
  manualCategoryId?: string;
  mlCategorization?: MLCategorization;
  categoryHistory?: {
    previousCategoryId?: string;
    changedDate: string;
    changedBy: 'manual' | 'ml' | 'rule';
  }[];
}

export interface StoredTransaction extends Transaction {
  accountId: string;
  importDate: string;
  postDateTime: string; // Combined Post date + Time for sorting
  fileId?: string; // CRITICAL FIX: Track which file imported this transaction
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

// ML Training Types
export interface TrainingData {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  features: number[];
  createdDate: string;
}

export interface MLModel {
  id: string;
  name: string;
  version: string;
  algorithm: 'neural_network' | 'naive_bayes' | 'pattern_matching';
  accuracy: number;
  trainingDate: string;
  trainingSize: number;
  isActive: boolean;
  modelData: string; // Serialized model
}

// Additional ML and categorization types
export interface TransactionCategorization {
  transactionId: string;
  categoryId: string;
  method: 'manual' | 'ml' | 'rule';
  confidence?: number;
  reasoning?: string;
  createdDate: string;
  modifiedDate: string;
}

export interface MLCategorizationResult {
  categoryId: string;
  confidence: number;
  reasoning: string;
  alternativeCategories?: Array<{
    categoryId: string;
    confidence: number;
  }>;
  riskFactors?: string[];
  suggestedKeywords?: string[];
  modelUsed?: 'local_tensorflow' | 'qwen3_32b' | 'hybrid';
  processingTime?: number;
}

export interface MLCategorizationConfig {
  modelName: string;
  ollamaEndpoint: string;
  confidenceThreshold: number;
  maxRetries: number;
  timeout: number;
  batchSize: number;
  trainingDataPath: string;
}

// Credit Transaction Types
export interface CreditTransactionView {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  postDateTime: string;
  accountId: string;
  arEntry?: unknown;
  forecastEntry?: unknown;
  matchConfidence?: number;
  reconciliationStatus: 'matched' | 'unmatched' | 'disputed' | 'manual';
  creditAmount: number;
  reference?: string;
  categoryId?: string;
  manualCategoryId?: string;
  reconciliation?: CreditTransactionReconciliation;
}

export interface CreditTransactionReconciliation {
  transactionId: string;
  arAgingId?: string;
  forecastingId?: string;
  matchStatus: 'auto_matched' | 'manual_matched' | 'disputed' | 'unmatched';
  confidenceScore: number;
  matchType?: 'ar_aging' | 'forecasting' | 'no_match';
  llmReasoning?: string;
  id?: string;
  createdDate?: string;
  modifiedDate?: string;
}

export interface LLMMatchingRequest {
  transaction: Transaction;
  arCandidates: unknown[];
  forecastCandidates: unknown[];
  context?: {
    previousMatches: unknown[];
    bankName: string;
    accountNumber: string;
  };
}

export interface CollectionType {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  color: string;
  isSystemType: boolean;
  createdDate: string;
}