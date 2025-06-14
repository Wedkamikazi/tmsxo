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
    modelName: 'qwen2.5:32b', // Qwen 2.5:32B model name
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

  // Performance monitoring for Qwen 2.5:32B
  private qwenPerformanceStats = {
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
    averageConfidence: 0,
    lastUsed: null as Date | null,
    errorCount: 0
  };

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
          (model.name as string)?.startsWith('qwen2.5:32b')
        );
        this.isOllamaAvailable = true;
        
        if (!this.modelLoaded) {
          console.warn('Qwen 2.5:32b model not found. Please run: ollama pull qwen2.5:32b');
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

  // Generate enhanced categorization prompt for Qwen 3:32B
  private generateCategorizationPrompt(
    transaction: Transaction,
    categories: TransactionCategory[]
  ): string {
    const amount = transaction.debitAmount ? `-${transaction.debitAmount}` : `+${transaction.creditAmount}`;
    const categoryList = categories.map(cat =>
      `${cat.id}: ${cat.name} - ${cat.description} (keywords: ${cat.keywords?.join(', ') || 'none'})`
    ).join('\n');

    // Get historical context for better categorization
    const historicalContext = this.getHistoricalContext(transaction);

    return `You are an expert financial transaction categorization AI with deep knowledge of treasury management, accounting principles, and business operations.

TRANSACTION TO CATEGORIZE:
Description: "${transaction.description}"
Amount: ${amount}
Date: ${transaction.date}
Reference: ${transaction.reference || 'N/A'}
Balance After: ${transaction.balance}
${transaction.postDate ? `Post Date: ${transaction.postDate}` : ''}
${transaction.time ? `Time: ${transaction.time}` : ''}

AVAILABLE CATEGORIES:
${categoryList}

HISTORICAL CONTEXT:
${historicalContext}

CATEGORIZATION GUIDELINES:
1. Prioritize exact keyword matches in transaction description
2. Consider transaction amount patterns (recurring vs one-time)
3. Analyze temporal patterns (payroll dates, monthly bills, etc.)
4. Apply treasury management best practices
5. Consider regulatory compliance requirements
6. Factor in business context and industry standards

CONFIDENCE SCORING:
- 0.9-1.0: Exact keyword match + amount pattern + temporal consistency
- 0.8-0.89: Strong keyword match + either amount or temporal pattern
- 0.7-0.79: Good keyword match or strong contextual evidence
- 0.6-0.69: Moderate match with some uncertainty
- Below 0.6: Low confidence, requires manual review

RESPONSE FORMAT (JSON only, no additional text):
{
  "categoryId": "selected_category_id",
  "confidence": 0.85,
  "reasoning": "Detailed explanation including keyword matches, patterns, and business context",
  "alternativeCategories": [
    {"categoryId": "alt_category_id", "confidence": 0.65}
  ],
  "riskFactors": ["any potential misclassification risks"],
  "suggestedKeywords": ["additional keywords to improve future categorization"]
}`;
  }

  // Get historical context for better categorization
  private getHistoricalContext(transaction: Transaction): string {
    // This would analyze similar transactions, patterns, etc.
    // For now, provide basic context
    const amount = transaction.debitAmount || transaction.creditAmount || 0;
    const isLargeAmount = amount > 10000;
    const isSmallAmount = amount < 100;
    const isRoundAmount = amount % 100 === 0;

    const context = [];
    if (isLargeAmount) context.push("Large transaction - likely significant business expense or revenue");
    if (isSmallAmount) context.push("Small transaction - likely office supplies, fees, or miscellaneous");
    if (isRoundAmount) context.push("Round amount - likely planned payment or transfer");

    const dayOfWeek = new Date(transaction.date).getDay();
    if (dayOfWeek === 1) context.push("Monday transaction - often weekly recurring payments");
    if (dayOfWeek === 5) context.push("Friday transaction - often payroll or end-of-week settlements");

    return context.length > 0 ? context.join('; ') : "No specific patterns identified";
  }

  // Call Ollama API for categorization with performance tracking
  private async callOllamaAPI(prompt: string): Promise<MLCategorizationResult | null> {
    const requestStart = Date.now();
    this.qwenPerformanceStats.totalRequests++;

    if (!this.isOllamaAvailable || !this.modelLoaded) {
      await this.checkOllamaAvailability();
      if (!this.isOllamaAvailable || !this.modelLoaded) {
        this.qwenPerformanceStats.errorCount++;
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
            temperature: 0.05, // Very low temperature for maximum consistency
            top_k: 5, // Reduced for more focused responses
            top_p: 0.85, // Slightly reduced for better precision
            num_predict: 800, // Increased for detailed reasoning
            repeat_penalty: 1.1, // Prevent repetitive responses
            num_ctx: 4096, // Increased context window for Qwen 3:32B
            num_thread: 8, // Optimize for performance
            // Qwen 3:32B specific optimizations
            stop: ["\n\n", "Human:", "Assistant:", "```"], // Stop tokens
            system: "You are a specialized financial AI focused on accurate transaction categorization for treasury management systems."
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

      // Enhanced JSON response parsing for Qwen 3:32B
      try {
        // Clean the response text
        const cleanedResponse = responseText
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .replace(/^\s*[\r\n]+/gm, '')
          .trim();

        // Multiple JSON extraction strategies
        let jsonResult: any = null;

        // Strategy 1: Direct JSON parse
        try {
          jsonResult = JSON.parse(cleanedResponse);
        } catch {
          // Strategy 2: Extract JSON block
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonResult = JSON.parse(jsonMatch[0]);
          } else {
            // Strategy 3: Extract from markdown code blocks
            const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (codeBlockMatch) {
              jsonResult = JSON.parse(codeBlockMatch[1]);
            }
          }
        }

        if (jsonResult && jsonResult.categoryId && typeof jsonResult.confidence === 'number') {
          // Enhanced validation and processing
          const confidence = Math.max(0, Math.min(1, jsonResult.confidence));
          const reasoning = jsonResult.reasoning || 'No reasoning provided';
          const alternatives = Array.isArray(jsonResult.alternativeCategories)
            ? jsonResult.alternativeCategories.slice(0, 3) // Limit to top 3
            : [];

          // Validate category exists
          const categories = categorizationService.getAllCategories();
          const categoryExists = categories.some(cat => cat.id === jsonResult.categoryId);

          if (!categoryExists) {
            console.warn(`Qwen 3:32B returned unknown category: ${jsonResult.categoryId}`);
            return {
              categoryId: 'cat_uncategorized',
              confidence: Math.max(0.1, confidence - 0.3), // Reduce confidence for unknown category
              reasoning: `${reasoning} (Note: Original category '${jsonResult.categoryId}' not found, defaulted to uncategorized)`,
              alternativeCategories: alternatives,
              riskFactors: jsonResult.riskFactors || [],
              suggestedKeywords: jsonResult.suggestedKeywords || []
            };
          }

          // Update performance stats
          const responseTime = Date.now() - requestStart;
          this.qwenPerformanceStats.successfulRequests++;
          this.qwenPerformanceStats.averageResponseTime =
            (this.qwenPerformanceStats.averageResponseTime * (this.qwenPerformanceStats.successfulRequests - 1) + responseTime) /
            this.qwenPerformanceStats.successfulRequests;
          this.qwenPerformanceStats.averageConfidence =
            (this.qwenPerformanceStats.averageConfidence * (this.qwenPerformanceStats.successfulRequests - 1) + confidence) /
            this.qwenPerformanceStats.successfulRequests;
          this.qwenPerformanceStats.lastUsed = new Date();

          return {
            categoryId: jsonResult.categoryId,
            confidence,
            reasoning,
            alternativeCategories: alternatives,
            riskFactors: jsonResult.riskFactors || [],
            suggestedKeywords: jsonResult.suggestedKeywords || []
          };
        }

        throw new Error('Invalid response structure from Qwen 3:32B');
      } catch (parseError) {
        console.error('Failed to parse Qwen 3:32B response:', parseError);
        console.error('Raw response:', responseText);
        console.error('Cleaned response:', responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
        this.qwenPerformanceStats.errorCount++;
        return null;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      this.qwenPerformanceStats.errorCount++;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('ML categorization request timed out');
      }
      throw error;
    }
  }

  // Intelligent model selection for optimal categorization
  private shouldUseQwen3First(transaction: Transaction): boolean {
    // Use Qwen 3:32B first for complex transactions
    const complexityFactors = [
      transaction.description.length > 50, // Long descriptions
      /[A-Z]{3,}/.test(transaction.description), // Contains acronyms
      /\d{4,}/.test(transaction.description), // Contains long numbers (account numbers, etc.)
      (transaction.debitAmount || transaction.creditAmount || 0) > 50000, // Large amounts
      transaction.reference && transaction.reference.length > 10, // Complex references
      /international|foreign|fx|currency/.test(transaction.description.toLowerCase()) // International transactions
    ];

    const complexityScore = complexityFactors.filter(Boolean).length;
    return complexityScore >= 2 || !this.isLocalModelLoaded;
  }

  // Enhanced categorization with intelligent model selection
  async categorizeTransaction(transaction: Transaction): Promise<MLCategorizationResult | null> {
    const startTime = Date.now();

    try {
      const categories = categorizationService.getAllCategories();
      if (categories.length === 0) {
        throw new Error('No categories available for ML categorization');
      }

      let result: MLCategorizationResult | null = null;
      let modelUsed: 'local_tensorflow' | 'qwen3_32b' | 'hybrid' = 'local_tensorflow';

      // Intelligent model selection
      const useQwenFirst = this.shouldUseQwen3First(transaction);

      if (useQwenFirst && this.isOllamaAvailable && this.modelLoaded) {
        // Use Qwen 3:32B for complex transactions
        console.log('Using Qwen 3:32B for complex transaction categorization');
        try {
          const prompt = this.generateCategorizationPrompt(transaction, categories);
          result = await this.callOllamaAPI(prompt);
          modelUsed = 'qwen3_32b';

          if (result) {
            console.log(`Qwen 3:32B categorization: ${result.categoryId} (${Math.round(result.confidence * 100)}%)`);
          }
        } catch (qwenError) {
          console.warn('Qwen 3:32B categorization failed, falling back to local model:', qwenError);
        }
      }

      // Use local model if Qwen failed or for simple transactions
      if (!result && this.config.useLocalModel && this.isLocalModelLoaded) {
        result = await this.categorizeWithLocalModel(transaction);

        if (result) {
          if (modelUsed === 'qwen3_32b') {
            modelUsed = 'hybrid';
          }
          console.log(`Local ML categorization: ${result.categoryId} (${Math.round(result.confidence * 100)}%)`);
        }
      }

      // Final fallback to Qwen 3:32B if local model confidence is low
      if (result && result.confidence < this.config.confidenceThreshold &&
          this.isOllamaAvailable && this.modelLoaded && modelUsed !== 'qwen3_32b') {
        console.log('Local confidence low, enhancing with Qwen 3:32B');
        try {
          const prompt = this.generateCategorizationPrompt(transaction, categories);
          const qwenResult = await this.callOllamaAPI(prompt);

          if (qwenResult && qwenResult.confidence > result.confidence) {
            result = qwenResult;
            modelUsed = 'hybrid';
            console.log(`Enhanced with Qwen 3:32B: ${result.categoryId} (${Math.round(result.confidence * 100)}%)`);
          }
        } catch (qwenError) {
          console.warn('Qwen 3:32B enhancement failed:', qwenError);
        }
      }

      if (result) {
        // Add metadata to result
        result.modelUsed = modelUsed;
        result.processingTime = Date.now() - startTime;

        // Validate that the returned category ID exists
        const categoryExists = categories.some(cat => cat.id === result!.categoryId);
        if (!categoryExists) {
          console.warn(`ML model returned unknown category ID: ${result.categoryId}`);
          // Fallback to uncategorized
          result.categoryId = 'cat_uncategorized';
          result.confidence = Math.max(0.1, result.confidence - 0.3);
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
    qwenPerformance: {
      totalRequests: number;
      successfulRequests: number;
      averageResponseTime: number;
      averageConfidence: number;
      lastUsed: Date | null;
      errorCount: number;
    };
  } {
    return {
      isAvailable: this.isOllamaAvailable,
      modelLoaded: this.modelLoaded,
      localModelLoaded: this.isLocalModelLoaded,
      vocabularySize: this.vocabulary.size,
      categoriesCount: this.categoryMapping.size,
      config: this.config,
      lastCheck: new Date().toISOString(),
      qwenPerformance: { ...this.qwenPerformanceStats }
    };
  }

  // Get Qwen 3:32B performance statistics
  getQwenPerformanceStats(): {
    totalRequests: number;
    successfulRequests: number;
    errorRate: number;
    averageResponseTime: number;
    averageConfidence: number;
    lastUsed: Date | null;
    uptime: string;
  } {
    const errorRate = this.qwenPerformanceStats.totalRequests > 0
      ? this.qwenPerformanceStats.errorCount / this.qwenPerformanceStats.totalRequests
      : 0;

    const uptime = this.qwenPerformanceStats.lastUsed
      ? `${Math.round((Date.now() - this.qwenPerformanceStats.lastUsed.getTime()) / 1000 / 60)} minutes ago`
      : 'Never used';

    return {
      totalRequests: this.qwenPerformanceStats.totalRequests,
      successfulRequests: this.qwenPerformanceStats.successfulRequests,
      errorRate: Math.round(errorRate * 100) / 100,
      averageResponseTime: Math.round(this.qwenPerformanceStats.averageResponseTime),
      averageConfidence: Math.round(this.qwenPerformanceStats.averageConfidence * 100) / 100,
      lastUsed: this.qwenPerformanceStats.lastUsed,
      uptime
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