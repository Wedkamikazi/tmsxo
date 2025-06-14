import * as tf from '@tensorflow/tfjs';
import { Transaction, TransactionCategory, MLCategorizationResult, MLCategorizationConfig, TrainingData } from '../types';
import { categorizationService } from './categorizationService';

interface LocalMLConfig extends MLCategorizationConfig {
  useLocalModel: boolean;
  localModelPath: string;
  featureVectorSize: number;
  hiddenLayers: number[];
  learningRate: number;
  epochs: number;
  batchSizeTraining: number;
}

class MLCategorizationService {
  private config: LocalMLConfig = {
    modelName: 'qwen3:32b',
    ollamaEndpoint: 'http://localhost:11434',
    confidenceThreshold: 0.7,
    maxRetries: 3,
    timeout: 30000,
    batchSize: 10,
    trainingDataPath: 'treasury_ml_training_data',
    // Local TensorFlow.js configuration
    useLocalModel: true,
    localModelPath: 'treasury_local_model',
    featureVectorSize: 128,
    hiddenLayers: [256, 128, 64],
    learningRate: 0.001,
    epochs: 50,
    batchSizeTraining: 32
  };

  private isOllamaAvailable = false;
  private modelLoaded = false;
  private localModel: tf.LayersModel | null = null;
  private isLocalModelLoaded = false;
  private vocabulary: Map<string, number> = new Map();
  private categoryMapping: Map<string, number> = new Map();
  private reverseCategoryMapping: Map<number, string> = new Map();

  constructor() {
    this.initializeLocalModel();
    this.checkOllamaAvailability();
  }

  // Initialize local TensorFlow.js model
  private async initializeLocalModel(): Promise<void> {
    try {
      // Try to load existing model
      const modelData = localStorage.getItem(this.config.localModelPath);
      if (modelData) {
        const modelJson = JSON.parse(modelData);
        this.localModel = await tf.loadLayersModel(tf.io.fromMemory(modelJson));
        this.isLocalModelLoaded = true;
        console.log('Local TensorFlow.js model loaded successfully');
      } else {
        // Create new model if none exists
        await this.createNewLocalModel();
      }

      // Load vocabulary and category mappings
      await this.loadVocabularyAndMappings();
    } catch (error) {
      console.warn('Failed to initialize local model:', error);
      await this.createNewLocalModel();
    }
  }

  // Create a new neural network model for transaction categorization
  private async createNewLocalModel(): Promise<void> {
    try {
      const model = tf.sequential();

      // Input layer
      model.add(tf.layers.dense({
        inputShape: [this.config.featureVectorSize],
        units: this.config.hiddenLayers[0],
        activation: 'relu',
        kernelInitializer: 'heNormal'
      }));

      // Hidden layers with dropout for regularization
      for (let i = 1; i < this.config.hiddenLayers.length; i++) {
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({
          units: this.config.hiddenLayers[i],
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }));
      }

      // Output layer (will be dynamically sized based on categories)
      const categories = categorizationService.getAllCategories();
      model.add(tf.layers.dropout({ rate: 0.2 }));
      model.add(tf.layers.dense({
        units: Math.max(categories.length, 10), // Minimum 10 for future categories
        activation: 'softmax'
      }));

      // Compile model
      model.compile({
        optimizer: tf.train.adam(this.config.learningRate),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.localModel = model;
      this.isLocalModelLoaded = true;

      console.log('New local TensorFlow.js model created');
      console.log('Model summary:', model.summary());

      // Save the initial model
      await this.saveLocalModel();
    } catch (error) {
      console.error('Failed to create local model:', error);
      this.isLocalModelLoaded = false;
    }
  }

  // Save local model to localStorage
  private async saveLocalModel(): Promise<void> {
    if (!this.localModel) return;

    try {
      await this.localModel.save(tf.io.withSaveHandler(async (artifacts) => {
        const modelJson = {
          modelTopology: artifacts.modelTopology,
          weightSpecs: artifacts.weightSpecs,
          weightData: Array.from(new Uint8Array(artifacts.weightData as ArrayBuffer))
        };
        localStorage.setItem(this.config.localModelPath, JSON.stringify(modelJson));
        return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
      }));

      // Save vocabulary and mappings
      await this.saveVocabularyAndMappings();

      console.log('Local model saved successfully');
    } catch (error) {
      console.error('Failed to save local model:', error);
    }
  }

  // Load vocabulary and category mappings
  private async loadVocabularyAndMappings(): Promise<void> {
    try {
      const vocabData = localStorage.getItem(`${this.config.localModelPath}_vocabulary`);
      const categoryData = localStorage.getItem(`${this.config.localModelPath}_categories`);

      if (vocabData) {
        const vocabArray = JSON.parse(vocabData);
        this.vocabulary = new Map(vocabArray);
      }

      if (categoryData) {
        const categoryArray = JSON.parse(categoryData);
        this.categoryMapping = new Map(categoryArray);
        this.reverseCategoryMapping = new Map(categoryArray.map(([k, v]: [string, number]) => [v, k]));
      } else {
        // Initialize category mappings
        await this.updateCategoryMappings();
      }
    } catch (error) {
      console.warn('Failed to load vocabulary and mappings:', error);
      await this.buildVocabularyFromTransactions();
      await this.updateCategoryMappings();
    }
  }

  // Save vocabulary and category mappings
  private async saveVocabularyAndMappings(): Promise<void> {
    try {
      localStorage.setItem(`${this.config.localModelPath}_vocabulary`,
        JSON.stringify(Array.from(this.vocabulary.entries())));
      localStorage.setItem(`${this.config.localModelPath}_categories`,
        JSON.stringify(Array.from(this.categoryMapping.entries())));
    } catch (error) {
      console.error('Failed to save vocabulary and mappings:', error);
    }
  }

  // Update category mappings when categories change
  private async updateCategoryMappings(): Promise<void> {
    const categories = categorizationService.getAllCategories();
    this.categoryMapping.clear();
    this.reverseCategoryMapping.clear();

    categories.forEach((category, index) => {
      this.categoryMapping.set(category.id, index);
      this.reverseCategoryMapping.set(index, category.id);
    });

    await this.saveVocabularyAndMappings();
  }

  // Check if Ollama is running and Qwen3:32b is available (fallback option)
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

  // Extract features from transaction for local ML model
  private extractFeatures(transaction: Transaction): number[] {
    const features: number[] = new Array(this.config.featureVectorSize).fill(0);

    // Text features from description
    const textFeatures = this.extractTextFeatures(transaction.description);
    textFeatures.forEach((value, index) => {
      if (index < this.config.featureVectorSize - 10) { // Reserve last 10 for numerical features
        features[index] = value;
      }
    });

    // Numerical features
    const featureIndex = this.config.featureVectorSize - 10;

    // Amount features (normalized)
    const amount = transaction.debitAmount || transaction.creditAmount || 0;
    features[featureIndex] = Math.log10(Math.max(amount, 1)) / 10; // Log-normalized amount
    features[featureIndex + 1] = transaction.debitAmount > 0 ? 1 : 0; // Is debit
    features[featureIndex + 2] = transaction.creditAmount > 0 ? 1 : 0; // Is credit

    // Date features
    const date = new Date(transaction.date);
    features[featureIndex + 3] = date.getMonth() / 12; // Month normalized
    features[featureIndex + 4] = date.getDay() / 7; // Day of week normalized
    features[featureIndex + 5] = date.getHours() / 24; // Hour normalized (if available)

    // Balance features
    features[featureIndex + 6] = Math.log10(Math.max(Math.abs(transaction.balance), 1)) / 15; // Log-normalized balance
    features[featureIndex + 7] = transaction.balance > 0 ? 1 : 0; // Positive balance

    // Reference features
    features[featureIndex + 8] = transaction.reference ? 1 : 0; // Has reference
    features[featureIndex + 9] = this.calculateDescriptionComplexity(transaction.description); // Description complexity

    return features;
  }

  // Extract text features using TF-IDF-like approach
  private extractTextFeatures(text: string): number[] {
    const features: number[] = new Array(this.config.featureVectorSize - 10).fill(0);

    // Preprocess text
    const processedText = this.preprocessText(text);
    const words = processedText.split(' ').filter(word => word.length > 2);

    // Calculate word frequencies
    const wordFreq: Map<string, number> = new Map();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Convert to feature vector using vocabulary
    let featureIndex = 0;
    for (const [word, freq] of wordFreq.entries()) {
      const vocabIndex = this.vocabulary.get(word);
      if (vocabIndex !== undefined && vocabIndex < features.length) {
        features[vocabIndex] = Math.min(freq / words.length, 1); // Normalized frequency
      }

      // Add new words to vocabulary (up to limit)
      if (vocabIndex === undefined && this.vocabulary.size < this.config.featureVectorSize - 10) {
        this.vocabulary.set(word, this.vocabulary.size);
        features[this.vocabulary.size - 1] = Math.min(freq / words.length, 1);
      }

      featureIndex++;
      if (featureIndex >= features.length) break;
    }

    return features;
  }

  // Preprocess text for feature extraction
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\d+/g, 'NUM') // Replace numbers with NUM token
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Calculate description complexity score
  private calculateDescriptionComplexity(description: string): number {
    const words = description.split(/\s+/).filter(word => word.length > 0);
    const uniqueWords = new Set(words.map(word => word.toLowerCase()));
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    return Math.min((uniqueWords.size / words.length) * (avgWordLength / 10), 1);
  }

  // Build vocabulary from existing transactions
  private async buildVocabularyFromTransactions(): Promise<void> {
    try {
      // This would typically load from your transaction storage
      // For now, we'll build a basic vocabulary from common financial terms
      const commonFinancialTerms = [
        'payment', 'transfer', 'deposit', 'withdrawal', 'fee', 'charge', 'refund',
        'salary', 'wage', 'bonus', 'commission', 'dividend', 'interest', 'loan',
        'mortgage', 'rent', 'utilities', 'insurance', 'tax', 'invoice', 'bill',
        'purchase', 'sale', 'revenue', 'income', 'expense', 'cost', 'investment',
        'bank', 'atm', 'card', 'check', 'cheque', 'wire', 'ach', 'direct',
        'monthly', 'weekly', 'daily', 'annual', 'quarterly', 'recurring',
        'office', 'supplies', 'equipment', 'software', 'service', 'maintenance',
        'travel', 'meal', 'entertainment', 'fuel', 'parking', 'hotel', 'flight'
      ];

      commonFinancialTerms.forEach((term, index) => {
        this.vocabulary.set(term, index);
      });

      console.log(`Built vocabulary with ${this.vocabulary.size} terms`);
    } catch (error) {
      console.error('Failed to build vocabulary:', error);
    }
  }

  // Local ML categorization
  private async categorizeWithLocalModel(transaction: Transaction): Promise<MLCategorizationResult | null> {
    if (!this.isLocalModelLoaded || !this.localModel) {
      console.warn('Local model not available, falling back to Ollama');
      return null;
    }

    try {
      // Extract features
      const features = this.extractFeatures(transaction);
      const inputTensor = tf.tensor2d([features]);

      // Make prediction
      const prediction = this.localModel.predict(inputTensor) as tf.Tensor;
      const probabilities = await prediction.data();

      // Find best category
      let maxProb = 0;
      let bestCategoryIndex = 0;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          bestCategoryIndex = i;
        }
      }

      const categoryId = this.reverseCategoryMapping.get(bestCategoryIndex);

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      if (!categoryId) {
        return null;
      }

      // Generate alternative categories
      const alternatives: Array<{ categoryId: string; confidence: number }> = [];
      const sortedProbs = Array.from(probabilities)
        .map((prob, index) => ({ prob, index }))
        .sort((a, b) => b.prob - a.prob)
        .slice(1, 3); // Top 2 alternatives

      for (const { prob, index } of sortedProbs) {
        const altCategoryId = this.reverseCategoryMapping.get(index);
        if (altCategoryId && prob > 0.1) {
          alternatives.push({ categoryId: altCategoryId, confidence: prob });
        }
      }

      return {
        categoryId,
        confidence: maxProb,
        reasoning: `Local ML model prediction based on transaction features (${Math.round(maxProb * 100)}% confidence)`,
        alternativeCategories: alternatives
      };
    } catch (error) {
      console.error('Local ML categorization failed:', error);
      return null;
    }
  }

  // Generate categorization prompt for the Ollama model (fallback)
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

  // Categorize a single transaction using ML (local first, then Ollama fallback)
  async categorizeTransaction(transaction: Transaction): Promise<MLCategorizationResult | null> {
    try {
      const categories = categorizationService.getAllCategories();
      if (categories.length === 0) {
        throw new Error('No categories available for ML categorization');
      }

      let result: MLCategorizationResult | null = null;

      // Try local model first if enabled and available
      if (this.config.useLocalModel && this.isLocalModelLoaded) {
        result = await this.categorizeWithLocalModel(transaction);

        if (result && result.confidence >= this.config.confidenceThreshold) {
          console.log(`Local ML categorization successful: ${result.categoryId} (${Math.round(result.confidence * 100)}%)`);
        } else if (result) {
          console.log(`Local ML categorization low confidence: ${result.categoryId} (${Math.round(result.confidence * 100)}%)`);
        }
      }

      // Fallback to Ollama if local model failed or confidence is low
      if (!result || (result.confidence < this.config.confidenceThreshold && this.isOllamaAvailable)) {
        console.log('Falling back to Ollama for high-quality categorization');
        try {
          const prompt = this.generateCategorizationPrompt(transaction, categories);
          const ollamaResult = await this.callOllamaAPI(prompt);

          if (ollamaResult && ollamaResult.confidence > (result?.confidence || 0)) {
            result = ollamaResult;
            console.log(`Ollama categorization successful: ${result.categoryId} (${Math.round(result.confidence * 100)}%)`);
          }
        } catch (ollamaError) {
          console.warn('Ollama categorization failed, using local result:', ollamaError);
        }
      }

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

          // Use this transaction for improving local model
          await this.addTrainingExample(transaction, result.categoryId);
        }
      }

      return result;
    } catch (error) {
      console.error('ML categorization failed:', error);
      return null;
    }
  }

  // Add training example to improve local model
  private async addTrainingExample(transaction: Transaction, categoryId: string): Promise<void> {
    try {
      const trainingData = {
        transaction,
        categoryId,
        features: this.extractFeatures(transaction),
        timestamp: Date.now()
      };

      // Store training example for batch training later
      const existingData = localStorage.getItem(`${this.config.localModelPath}_training`);
      const trainingExamples = existingData ? JSON.parse(existingData) : [];
      trainingExamples.push(trainingData);

      // Keep only recent examples (last 1000)
      if (trainingExamples.length > 1000) {
        trainingExamples.splice(0, trainingExamples.length - 1000);
      }

      localStorage.setItem(`${this.config.localModelPath}_training`, JSON.stringify(trainingExamples));

      // Trigger retraining if we have enough new examples
      if (trainingExamples.length % 50 === 0) {
        console.log(`Collected ${trainingExamples.length} training examples, considering model retraining`);
        // Note: Actual retraining would be triggered by user action or scheduled task
      }
    } catch (error) {
      console.error('Failed to add training example:', error);
    }
  }

  // Train local model with collected examples
  async trainLocalModel(): Promise<{ success: boolean; accuracy?: number; error?: string }> {
    if (!this.isLocalModelLoaded || !this.localModel) {
      return { success: false, error: 'Local model not available' };
    }

    try {
      const trainingData = localStorage.getItem(`${this.config.localModelPath}_training`);
      if (!trainingData) {
        return { success: false, error: 'No training data available' };
      }

      const examples = JSON.parse(trainingData);
      if (examples.length < 10) {
        return { success: false, error: 'Insufficient training data (minimum 10 examples required)' };
      }

      console.log(`Training local model with ${examples.length} examples`);

      // Prepare training data
      const features: number[][] = [];
      const labels: number[][] = [];

      for (const example of examples) {
        features.push(example.features);

        // Create one-hot encoded label
        const categoryIndex = this.categoryMapping.get(example.categoryId) || 0;
        const oneHot = new Array(this.categoryMapping.size).fill(0);
        oneHot[categoryIndex] = 1;
        labels.push(oneHot);
      }

      // Convert to tensors
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels);

      // Train model
      const history = await this.localModel.fit(xs, ys, {
        epochs: Math.min(this.config.epochs, 20), // Limit epochs for incremental training
        batchSize: this.config.batchSizeTraining,
        validationSplit: 0.2,
        shuffle: true,
        verbose: 1
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      // Save updated model
      await this.saveLocalModel();

      const finalAccuracy = history.history.acc ?
        history.history.acc[history.history.acc.length - 1] as number : 0;

      console.log(`Model training completed with accuracy: ${Math.round(finalAccuracy * 100)}%`);

      return { success: true, accuracy: finalAccuracy };
    } catch (error) {
      console.error('Model training failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
    localModelLoaded: boolean;
    vocabularySize: number;
    categoriesCount: number;
    config: LocalMLConfig;
    lastCheck: string;
  } {
    return {
      isAvailable: this.isOllamaAvailable,
      modelLoaded: this.modelLoaded,
      localModelLoaded: this.isLocalModelLoaded,
      vocabularySize: this.vocabulary.size,
      categoriesCount: this.categoryMapping.size,
      config: this.config,
      lastCheck: new Date().toISOString()
    };
  }

  // Update configuration
  updateConfig(updates: Partial<LocalMLConfig>): void {
    this.config = { ...this.config, ...updates };

    // Re-check availability if endpoint changed
    if (updates.ollamaEndpoint) {
      this.checkOllamaAvailability();
    }

    // Reinitialize local model if local settings changed
    if (updates.useLocalModel !== undefined || updates.localModelPath || updates.featureVectorSize) {
      this.initializeLocalModel();
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