import { Transaction, TransactionCategory, MLCategorizationResult, MLCategorizationConfig, TrainingData } from '../types';
import { categorizationService } from './categorizationService';

class MLCategorizationService {
  private config: MLCategorizationConfig = {
    modelName: 'qwen3:32b',
    ollamaEndpoint: 'http://localhost:11434',
    confidenceThreshold: 0.7,
    maxRetries: 3,
    timeout: 30000,
    batchSize: 10,
    trainingDataPath: 'treasury_ml_training_data'
  };

  private isOllamaAvailable = false;
  private modelLoaded = false;

  constructor() {
    this.checkOllamaAvailability();
  }

  // Check if Ollama is running and Qwen3:32b is available
  async checkOllamaAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.ollamaEndpoint}/api/tags`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        this.modelLoaded = models.some((model: Record<string, unknown>) => 
          model.name === this.config.modelName || 
          (model.name as string)?.startsWith('qwen3:32b')
        );
        this.isOllamaAvailable = true;
        
        if (!this.modelLoaded) {
          console.warn('Qwen3:32b model not found. Please run: ollama pull qwen3:32b');
        }
        
        return this.isOllamaAvailable && this.modelLoaded;
      }
    } catch (error) {
      console.warn('Ollama not available:', error);
      this.isOllamaAvailable = false;
      this.modelLoaded = false;
    }
    
    return false;
  }

  // Generate categorization prompt for the ML model
  private generateCategorizationPrompt(
    transaction: Transaction, 
    categories: TransactionCategory[]
  ): string {
    const amount = transaction.debitAmount ? `-${transaction.debitAmount}` : `+${transaction.creditAmount}`;
    const categoryList = categories.map(cat => 
      `${cat.id}: ${cat.name} - ${cat.description} (keywords: ${cat.keywords?.join(', ') || 'none'})`
    ).join('\n');

    return `You are a financial transaction categorization expert. Analyze the following transaction and categorize it.

Transaction Details:
- Description: "${transaction.description}"
- Amount: ${amount}
- Date: ${transaction.date}
- Reference: ${transaction.reference || 'N/A'}

Available Categories:
${categoryList}

Instructions:
1. Analyze the transaction description, amount, and context
2. Select the most appropriate category ID from the list above
3. Provide a confidence score between 0.0 and 1.0
4. Explain your reasoning in 1-2 sentences
5. Suggest up to 2 alternative categories if applicable

Respond in the following JSON format only:
{
  "categoryId": "selected_category_id",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category was chosen",
  "alternativeCategories": [
    {"categoryId": "alt_category_id", "confidence": 0.65}
  ]
}`;
  }

  // Call Ollama API for categorization
  private async callOllamaAPI(prompt: string): Promise<MLCategorizationResult | null> {
    if (!this.isOllamaAvailable || !this.modelLoaded) {
      await this.checkOllamaAvailability();
      if (!this.isOllamaAvailable || !this.modelLoaded) {
        throw new Error('Ollama service is not available or Qwen3:32b model is not loaded');
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelName,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent results
            top_k: 10,
            top_p: 0.9,
            num_predict: 500
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const responseText = data.response;

      // Parse JSON response from the model
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          // Validate the response structure
          if (result.categoryId && typeof result.confidence === 'number') {
            return {
              categoryId: result.categoryId,
              confidence: Math.max(0, Math.min(1, result.confidence)),
              reasoning: result.reasoning || 'No reasoning provided',
              alternativeCategories: result.alternativeCategories || []
            };
          }
        }
        throw new Error('Invalid response format from ML model');
      } catch (parseError) {
        console.error('Failed to parse ML response:', parseError);
        console.error('Raw response:', responseText);
        return null;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('ML categorization request timed out');
      }
      throw error;
    }
  }

  // Categorize a single transaction using ML
  async categorizeTransaction(transaction: Transaction): Promise<MLCategorizationResult | null> {
    try {
      const categories = categorizationService.getAllCategories();
      if (categories.length === 0) {
        throw new Error('No categories available for ML categorization');
      }

      const prompt = this.generateCategorizationPrompt(transaction, categories);
      const result = await this.callOllamaAPI(prompt);

      if (result) {
        // Validate that the returned category ID exists
        const categoryExists = categories.some(cat => cat.id === result.categoryId);
        if (!categoryExists) {
          console.warn(`ML model returned unknown category ID: ${result.categoryId}`);
          // Fallback to uncategorized
          result.categoryId = 'cat_uncategorized';
          result.confidence = 0.1;
          result.reasoning = 'ML model returned unknown category, defaulted to uncategorized';
        }

        // Apply categorization if confidence is above threshold
        if (result.confidence >= this.config.confidenceThreshold) {
          categorizationService.categorizeTransaction(
            transaction.id,
            result.categoryId,
            'ml',
            result.confidence,
            result.reasoning
          );
        }
      }

      return result;
    } catch (error) {
      console.error('ML categorization failed:', error);
      return null;
    }
  }

  // Categorize multiple transactions in batches
  async categorizeTransactionsBatch(transactions: Transaction[]): Promise<Array<{
    transaction: Transaction;
    result: MLCategorizationResult | null;
    error?: string;
  }>> {
    const results: Array<{
      transaction: Transaction;
      result: MLCategorizationResult | null;
      error?: string;
    }> = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < transactions.length; i += this.config.batchSize) {
      const batch = transactions.slice(i, i + this.config.batchSize);
      
      const batchPromises = batch.map(async (transaction) => {
        try {
          const result = await this.categorizeTransaction(transaction);
          return { transaction, result };
        } catch (error) {
          return { 
            transaction, 
            result: null, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming Ollama
      if (i + this.config.batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  // Train the model with historical data (prepare training data)
  async prepareTrainingData(): Promise<TrainingData | null> {
    try {
      // Get all categorized transactions for training
      categorizationService.getAllCategories();
      
      // This is a simplified training data preparation
      // In a full implementation, you might export this data for fine-tuning
      const trainingData: TrainingData = {
        id: 'training_' + Date.now(),
        description: 'Training data prepared for ML categorization',
        amount: 0,
        categoryId: 'training',
        features: [],
        createdDate: new Date().toISOString()
      };

      // Store training data for potential future use
      localStorage.setItem(this.config.trainingDataPath!, JSON.stringify(trainingData));
      
      return trainingData;
    } catch (error) {
      console.error('Failed to prepare training data:', error);
      return null;
    }
  }

  // Get model status and configuration
  getModelStatus(): {
    isAvailable: boolean;
    modelLoaded: boolean;
    config: MLCategorizationConfig;
    lastCheck: string;
  } {
    return {
      isAvailable: this.isOllamaAvailable,
      modelLoaded: this.modelLoaded,
      config: this.config,
      lastCheck: new Date().toISOString()
    };
  }

  // Update configuration
  updateConfig(updates: Partial<MLCategorizationConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Re-check availability if endpoint changed
    if (updates.ollamaEndpoint) {
      this.checkOllamaAvailability();
    }
  }

  // Test the ML categorization with a sample transaction
  async testCategorization(): Promise<{
    success: boolean;
    result?: MLCategorizationResult;
    error?: string;
    latency?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testTransaction: Transaction = {
        id: 'test_transaction',
        description: 'Monthly office rent payment',
        date: new Date().toISOString(),
        debitAmount: 2500.00,
        creditAmount: 0,
        balance: 10000.00
      };

      const result = await this.categorizeTransaction(testTransaction);
      const latency = Date.now() - startTime;

      return {
        success: true,
        result: result || undefined,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime
      };
    }
  }
}

export const mlCategorizationService = new MLCategorizationService(); 