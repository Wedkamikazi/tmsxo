import { systemIntegrityService } from './systemIntegrityService';
// import { performanceManager } from './performanceManager';
import { localStorageManager } from './localStorageManager';
import { isDebugMode } from '../utils/debugMode';

// LOCAL OLLAMA INTEGRATION SERVICE
// Handles communication with local Ollama server for enhanced NLP capabilities
// Ensures purely local operation with no external dependencies

export interface OllamaModelInfo {
  name: string;
  size: string;
  digest: string;
  modified_at: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaRequest {
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  context?: number[];
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaHealthStatus {
  isRunning: boolean;
  isReachable: boolean;
  availableModels: OllamaModelInfo[];
  preferredModel: string | null;
  lastCheck: string;
  errorMessage?: string;
  performance: {
    averageResponseTime: number;
    successfulRequests: number;
    failedRequests: number;
    totalRequests: number;
  };
}

export interface OllamaTransactionAnalysis {
  category: string;
  confidence: number;
  reasoning: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  entities: string[];
  suggestions: string[];
}

class LocalOllamaIntegration {
  private baseUrl = 'http://localhost:11434';
  private preferredModels = [
    'qwen2.5:32b',
    'qwen2.5:14b', 
    'qwen2.5:7b',
    'llama3.1:8b',
    'llama3.1:7b',
    'mistral:7b'
  ];
  
  // Configuration option to disable Ollama completely
  private ollamaEnabled = typeof window !== 'undefined' ? 
    localStorage.getItem('ollamaEnabled') !== 'false' : true;
  
  private currentModel: string | null = null;
  private isInitialized = false;
  private healthStatus: OllamaHealthStatus = {
    isRunning: false,
    isReachable: false,
    availableModels: [],
    preferredModel: null,
    lastCheck: new Date().toISOString(),
    performance: {
      averageResponseTime: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalRequests: 0
    }
  };

  private requestQueue: Array<{
    id: string;
    request: OllamaRequest;
    resolve: (response: OllamaResponse) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  private isProcessingQueue = false;
  private maxConcurrentRequests = 2;
  private requestTimeout = 30000; // 30 seconds

  constructor() {
    this.initializeOllamaIntegration();
  }

  // INITIALIZE OLLAMA INTEGRATION
  private async initializeOllamaIntegration(): Promise<void> {
    try {
      // Check if Ollama is disabled by user preference
      if (!this.ollamaEnabled) {
        console.info('ℹ️ Ollama integration disabled by user preference - TensorFlow.js only mode');
        this.isInitialized = false;
        return;
      }
      
      console.log('🦙 Checking for Local Ollama Integration (optional)...');
      
      // Check if Ollama server is running
      await this.checkOllamaHealth();
      
      if (this.healthStatus.isReachable) {
        // Get available models
        await this.loadAvailableModels();
        
        // Select best available model
        this.selectOptimalModel();
        
        // Load cached performance data
        this.loadPerformanceHistory();
        
        this.isInitialized = true;
        console.log(`✅ Ollama Integration Ready - Using model: ${this.currentModel}`);
      } else {
        console.info('ℹ️ Ollama not available - System will use TensorFlow.js only (this is normal)');
        this.isInitialized = false;
      }
      
    } catch (error) {
      this.logOllamaError('initializeOllamaIntegration', error, 'low'); // Reduced severity
      console.info('ℹ️ Ollama initialization skipped - TensorFlow.js fallback active');
      this.isInitialized = false;
    }
  }

  // CHECK OLLAMA SERVER HEALTH
  async checkOllamaHealth(): Promise<OllamaHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Suppress console errors for expected connection failures
      const originalError = console.error;
      console.error = () => {}; // Temporarily suppress console errors
      
      // Test basic connectivity with shorter timeout for faster fallback
      const response = await this.makeRequest('/api/tags', 'GET', null, 2000);
      
      // Restore console.error
      console.error = originalError;
      
      if (response.ok) {
        const data = await response.json();
        this.healthStatus = {
          isRunning: true,
          isReachable: true,
          availableModels: data.models || [],
          preferredModel: this.currentModel,
          lastCheck: new Date().toISOString(),
          performance: { ...this.healthStatus.performance }
        };
        console.log('🦙 Ollama server connected successfully');
      } else {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
    } catch (error) {
      // This is expected behavior when Ollama is not installed/running
      this.healthStatus = {
        isRunning: false,
        isReachable: false,
        availableModels: [],
        preferredModel: null,
        lastCheck: new Date().toISOString(),
        errorMessage: 'Ollama server not available (this is normal if not installed)',
        performance: { ...this.healthStatus.performance }
      };
      
      // Only log as info level - this is expected behavior
      console.info('ℹ️ Ollama server not available - using TensorFlow.js only mode (this is normal)');
    }
    
    const responseTime = Date.now() - startTime;
    this.updatePerformanceMetrics(responseTime, this.healthStatus.isReachable);
    
    return this.healthStatus;
  }

  // LOAD AVAILABLE MODELS
  private async loadAvailableModels(): Promise<void> {
    try {
      const response = await this.makeRequest('/api/tags', 'GET');
      
      if (response.ok) {
        const data = await response.json();
        this.healthStatus.availableModels = data.models || [];
        console.log(`📋 Found ${this.healthStatus.availableModels.length} available models`);
      }
    } catch (error) {
      this.logOllamaError('loadAvailableModels', error, 'medium');
    }
  }

  // SELECT OPTIMAL MODEL
  private selectOptimalModel(): void {
    const availableModelNames = this.healthStatus.availableModels.map(m => m.name);
    
    // Find the best available model from our preferred list
    for (const preferredModel of this.preferredModels) {
      if (availableModelNames.includes(preferredModel)) {
        this.currentModel = preferredModel;
        this.healthStatus.preferredModel = preferredModel;
        console.log(`🎯 Selected optimal model: ${preferredModel}`);
        return;
      }
    }
    
    // If no preferred model found, use the first available
    if (availableModelNames.length > 0) {
      this.currentModel = availableModelNames[0];
      this.healthStatus.preferredModel = availableModelNames[0];
      console.log(`📌 Using available model: ${availableModelNames[0]}`);
    }
  }

  // GENERATE TEXT WITH OLLAMA
  async generateText(prompt: string, options: Partial<OllamaRequest> = {}): Promise<OllamaResponse> {
    if (!this.isInitialized || !this.currentModel) {
      throw new Error('Ollama not initialized or no model available');
    }

    const request: OllamaRequest = {
      model: this.currentModel,
      prompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1000,
      system: options.system,
      stream: false,
      ...options
    };

    return this.queueRequest(request);
  }

  // ANALYZE TRANSACTION WITH OLLAMA
  async analyzeTransaction(description: string, amount: number, date: string): Promise<OllamaTransactionAnalysis> {
    const systemPrompt = `You are an expert financial transaction analyzer. Analyze transactions and provide categorization with high accuracy. 

Available categories: Office Supplies, Marketing, Travel, Utilities, Software, Professional Services, Banking Fees, Client Payments, Refunds, Transfers, Rent, Insurance, Tax Payments, Equipment, Maintenance, Consulting, Training, Subscriptions, Other.

Respond in JSON format only with these fields:
- category: string (one of the available categories)
- confidence: number (0.0 to 1.0)
- reasoning: string (brief explanation)
- sentiment: string ("positive", "neutral", or "negative")
- entities: array of strings (merchants, locations, etc.)
- suggestions: array of strings (improvement suggestions)`;

    const prompt = `Analyze this financial transaction:
Description: "${description}"
Amount: $${amount}
Date: ${date}

Provide detailed analysis in JSON format.`;

    try {
      const response = await this.generateText(prompt, {
        system: systemPrompt,
        temperature: 0.3, // Lower temperature for more consistent categorization
        max_tokens: 500
      });

      // Parse JSON response
      const analysisResult = JSON.parse(response.response);
      
      // Validate and normalize the response
      return {
        category: analysisResult.category || 'Other',
        confidence: Math.min(Math.max(analysisResult.confidence || 0.5, 0), 1),
        reasoning: analysisResult.reasoning || 'Analysis completed',
        sentiment: ['positive', 'neutral', 'negative'].includes(analysisResult.sentiment) 
          ? analysisResult.sentiment : 'neutral',
        entities: Array.isArray(analysisResult.entities) ? analysisResult.entities : [],
        suggestions: Array.isArray(analysisResult.suggestions) ? analysisResult.suggestions : []
      };
      
    } catch (error) {
      this.logOllamaError('analyzeTransaction', error, 'medium');
      
      // Return fallback analysis
      return {
        category: 'Other',
        confidence: 0.3,
        reasoning: 'Analysis failed, using fallback categorization',
        sentiment: 'neutral',
        entities: [],
        suggestions: ['Manual review recommended due to analysis error']
      };
    }
  }

  // BATCH ANALYZE TRANSACTIONS
  async batchAnalyzeTransactions(transactions: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
  }>): Promise<Array<{
    id: string;
    analysis: OllamaTransactionAnalysis;
    error?: string;
  }>> {
    const results: Array<{
      id: string;
      analysis: OllamaTransactionAnalysis;
      error?: string;
    }> = [];

    // Process in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (transaction) => {
        try {
          const analysis = await this.analyzeTransaction(
            transaction.description,
            transaction.amount,
            transaction.date
          );
          return { id: transaction.id, analysis };
        } catch (error) {
          return {
            id: transaction.id,
            analysis: {
              category: 'Other',
              confidence: 0.2,
              reasoning: 'Batch analysis failed',
              sentiment: 'neutral' as const,
              entities: [],
              suggestions: ['Manual review required']
            },
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // QUEUE MANAGEMENT FOR REQUESTS
  private async queueRequest(request: OllamaRequest): Promise<OllamaResponse> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      this.requestQueue.push({
        id: requestId,
        request,
        resolve,
        reject,
        timestamp: Date.now()
      });

      this.processQueue();
      
      // Set timeout for request
      setTimeout(() => {
        const queueIndex = this.requestQueue.findIndex(q => q.id === requestId);
        if (queueIndex !== -1) {
          this.requestQueue.splice(queueIndex, 1);
          reject(new Error('Request timeout'));
        }
      }, this.requestTimeout);
    });
  }

  // PROCESS REQUEST QUEUE
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.requestQueue.length > 0) {
        const batch = this.requestQueue.splice(0, this.maxConcurrentRequests);
        
        const promises = batch.map(async (queueItem) => {
          try {
            const response = await this.executeOllamaRequest(queueItem.request);
            queueItem.resolve(response);
          } catch (error) {
            queueItem.reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
        
        await Promise.all(promises);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // EXECUTE OLLAMA REQUEST
  private async executeOllamaRequest(request: OllamaRequest): Promise<OllamaResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest('/api/generate', 'POST', request);
      
      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime, true);
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime, false);
      throw error;
    }
  }

  // MAKE HTTP REQUEST TO OLLAMA SERVER
  private async makeRequest(
    endpoint: string, 
    method: 'GET' | 'POST' = 'GET', 
    body?: any,
    timeout: number = this.requestTimeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // PERFORMANCE TRACKING
  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    const perf = this.healthStatus.performance;
    
    perf.totalRequests++;
    if (success) {
      perf.successfulRequests++;
      perf.averageResponseTime = (
        (perf.averageResponseTime * (perf.successfulRequests - 1) + responseTime) / 
        perf.successfulRequests
      );
    } else {
      perf.failedRequests++;
    }
    
    // Save performance history
    this.savePerformanceHistory();
  }

  // UTILITY METHODS
  private generateRequestId(): string {
    return `ollama_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadPerformanceHistory(): void {
    try {
      const saved = localStorageManager.getItem('ollama-performance-history');
      if (saved) {
        this.healthStatus.performance = { ...this.healthStatus.performance, ...saved };
      }
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  private savePerformanceHistory(): void {
    try {
      localStorageManager.setItem('ollama-performance-history', this.healthStatus.performance);
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  private logOllamaError(operation: string, error: unknown, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    systemIntegrityService.logServiceError(
      'LocalOllamaIntegration',
      operation,
      error instanceof Error ? error : new Error(String(error)),
      severity,
      { component: 'ollamaIntegration', timestamp: new Date().toISOString() }
    );
  }

  private logOllamaStatus(message: string, severity: 'low' | 'medium'): void {
    systemIntegrityService.logServiceError(
      'LocalOllamaIntegration',
      'status',
      new Error(message),
      severity,
      { component: 'ollamaStatus', timestamp: new Date().toISOString() }
    );
  }

  // PUBLIC API METHODS
  getHealthStatus(): OllamaHealthStatus {
    return { ...this.healthStatus };
  }

  isAvailable(): boolean {
    return this.isInitialized && this.healthStatus.isReachable && this.currentModel !== null;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  // Enable/disable Ollama integration
  enableOllamaIntegration(): void {
    this.ollamaEnabled = true;
    localStorage.setItem('ollamaEnabled', 'true');
    console.info('✅ Ollama integration enabled - will attempt connection on next initialization');
  }

  disableOllamaIntegration(): void {
    this.ollamaEnabled = false;
    localStorage.setItem('ollamaEnabled', 'false');
    this.isInitialized = false;
    console.info('❌ Ollama integration disabled - TensorFlow.js only mode');
  }

  isOllamaEnabled(): boolean {
    return this.ollamaEnabled;
  }

  async switchModel(modelName: string): Promise<boolean> {
    if (!this.healthStatus.availableModels.find(m => m.name === modelName)) {
      return false;
    }
    
    try {
      // Test the model with a simple request
      await this.generateText('Hello', { model: modelName, max_tokens: 10 });
      this.currentModel = modelName;
      this.healthStatus.preferredModel = modelName;
      return true;
    } catch (error) {
      this.logOllamaError('switchModel', error, 'medium');
      return false;
    }
  }

  async refreshHealth(): Promise<OllamaHealthStatus> {
    await this.checkOllamaHealth();
    return this.healthStatus;
  }

  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeOllamaIntegration();
    }
  }

  dispose(): void {
    this.requestQueue.length = 0;
    this.isProcessingQueue = false;
    this.isInitialized = false;
  }
}

// Check for debug mode  
const debugModeActive = isDebugMode();

// Export singleton instance (skip in debug mode)
let localOllamaIntegration: LocalOllamaIntegration;

if (debugModeActive) {
  console.log('🔧 LocalOllamaIntegration: Debug mode detected - creating mock instance');
  localOllamaIntegration = {
    ensureInitialized: () => Promise.resolve(),
    analyzeTransaction: () => Promise.resolve({ category: 'Other', confidence: 0.5, reasoning: 'Debug mode' }),
    generateInsights: () => Promise.resolve([]),
    dispose: () => Promise.resolve(),
    getHealthStatus: () => ({
      isRunning: false,
      isReachable: false,
      availableModels: [],
      preferredModel: null,
      lastCheck: new Date().toISOString(),
      errorMessage: 'Debug mode - mock service',
      performance: {
        averageResponseTime: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRequests: 0
      }
    }),
    getCurrentModel: () => null,
    isAvailable: () => false,
    switchModel: () => Promise.resolve(false),
    refreshHealth: () => Promise.resolve({
      isRunning: false,
      isReachable: false,
      availableModels: [],
      preferredModel: null,
      lastCheck: new Date().toISOString(),
      errorMessage: 'Debug mode - mock service',
      performance: {
        averageResponseTime: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRequests: 0
      }
    }),
    generateText: () => Promise.resolve({
      model: 'mock',
      created_at: new Date().toISOString(),
      response: 'Mock response',
      done: true
    }),
    checkOllamaHealth: () => Promise.resolve({
      isRunning: false,
      isReachable: false,
      availableModels: [],
      preferredModel: null,
      lastCheck: new Date().toISOString(),
      errorMessage: 'Debug mode - mock service',
      performance: {
        averageResponseTime: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalRequests: 0
      }
    }),
    batchAnalyzeTransactions: () => Promise.resolve([])
  } as any;
} else {
  localOllamaIntegration = new LocalOllamaIntegration();
}

export { localOllamaIntegration }; 