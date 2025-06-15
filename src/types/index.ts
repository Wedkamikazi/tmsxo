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
  balance: number;
  accountId: string;
  accountName: string;
  reference?: string;
  postDate?: string;
  time?: string;
  categorization?: TransactionCategorization;
}

// Collection Types
export type CollectionType = 'transactions' | 'accounts' | 'files' | 'categories' | 'categorizations'; 