import * as tf from '@tensorflow/tfjs';
import { Transaction } from '../../shared/types';
import { localStorageManager } from '../../data/storage/LocalStorageManager';

// ADVANCED NLP SERVICE FOR TRANSACTION ANALYSIS
// USES TENSORFLOW.JS FOR NATURAL LANGUAGE PROCESSING

export interface NLPAnalysisResult {
  entities: {
    merchants: string[];
    amounts: number[];
    dates: string[];
    locations: string[];
    paymentMethods: string[];
    references: string[];
  };
  sentiment: {
    score: number; // -1 to 1
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  intent: {
    type: 'payment' | 'transfer' | 'deposit' | 'withdrawal' | 'fee' | 'refund' | 'unknown';
    confidence: number;
  };
  topics: Array<{
    topic: string;
    relevance: number;
  }>;
  complexity: {
    score: number; // 0-1, higher = more complex
    factors: string[];
  };
  suggestions: {
    betterDescription?: string;
    missingInfo?: string[];
    category?: string;
  };
}

export interface TransactionSimilarity {
  transaction1: Transaction;
  transaction2: Transaction;
  similarity: number;
  similarityFactors: {
    semantic: number;
    structural: number;
    temporal: number;
    amount: number;
  };
  explanation: string;
}

export interface LanguagePattern {
  pattern: string;
  frequency: number;
  category: string;
  examples: string[];
  confidence: number;
}

class MLNaturalLanguageService {
  // TensorFlow.js Models for NLP
  private sentimentModel: tf.LayersModel | null = null;
  private intentClassificationModel: tf.LayersModel | null = null;

  private embeddingModel: tf.LayersModel | null = null;
  private topicModelingModel: tf.LayersModel | null = null;
  
  // Vocabulary and embeddings
  private vocabulary: Map<string, number> = new Map();
  private wordEmbeddings: Map<string, number[]> = new Map();
  private entityPatterns: Map<string, RegExp> = new Map();
  
  // Language patterns and rules
  private languagePatterns: LanguagePattern[] = [];
  private commonPhrases: Map<string, number> = new Map();
  
  private isInitialized = false;
  private modelConfig = {
    embeddingDim: 128,
    maxSequenceLength: 100,
    vocabularySize: 10000,
    entityTypes: ['MERCHANT', 'AMOUNT', 'DATE', 'LOCATION', 'PAYMENT_METHOD', 'REFERENCE'],
    intentTypes: ['PAYMENT', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'REFUND'],
    topicCount: 20
  };

  constructor() {
    this.initializeNLPModels();
  }

  // INITIALIZE ADVANCED NLP MODELS
  private async initializeNLPModels(): Promise<void> {
    try {
      console.log('🧠 Initializing Advanced NLP Models...');
      
      // Build vocabulary from historical data
      await this.buildVocabularyFromTransactions();
      
      // Initialize entity patterns
      this.initializeEntityPatterns();
      
      // Load or create models
      await this.loadOrCreateNLPModels();
      
      // Analyze existing patterns
      await this.analyzeLanguagePatterns();
      
      this.isInitialized = true;
      console.log('✅ Advanced NLP Models Ready');
    } catch (error) {
      console.error('❌ NLP Initialization Failed:', error);
      this.isInitialized = false;
    }
  }

  // BUILD VOCABULARY FROM TRANSACTION DATA
  private async buildVocabularyFromTransactions(): Promise<void> {
    console.log('📚 Building NLP vocabulary from transaction data...');
    
    const transactions = localStorageManager.getAllTransactions();
    const wordCounts: Map<string, number> = new Map();
    
    // Process all transaction descriptions
    transactions.forEach(transaction => {
      const tokens = this.tokenizeAdvanced(transaction.description);
      tokens.forEach(token => {
        const count = wordCounts.get(token) || 0;
        wordCounts.set(token, count + 1);
      });
    });
    
    // Build vocabulary from most common words
    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.modelConfig.vocabularySize);
    
    this.vocabulary.clear();
    sortedWords.forEach(([word], index) => {
      this.vocabulary.set(word, index + 1); // Reserve 0 for padding
    });
    
    console.log(`📊 Vocabulary built: ${this.vocabulary.size} tokens`);
  }

  // ADVANCED TOKENIZATION WITH NLP PREPROCESSING
  private tokenizeAdvanced(text: string): string[] {
    // Convert to lowercase and normalize
    let processed = text.toLowerCase()
      .replace(/[^\w\s\-.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Handle special patterns
    processed = processed
      .replace(/\d+\.\d+/g, '<AMOUNT>') // Replace amounts with token
      .replace(/\d{4}-\d{2}-\d{2}/g, '<DATE>') // Replace dates
      .replace(/\d{2}\/\d{2}\/\d{4}/g, '<DATE>')
      .replace(/\b[A-Z]{2,}\b/g, (match) => `<ABBREV_${match}>`) // Abbreviations
      .replace(/\b\d+\b/g, '<NUMBER>'); // Replace numbers
    
    // Split into tokens
    const tokens = processed.split(' ').filter(token => token.length > 1);
    
    // Add n-grams for better context
    const nGrams: string[] = [];
    
    // Bigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      nGrams.push(`${tokens[i]}_${tokens[i + 1]}`);
    }
    
    // Trigrams for important phrases
    for (let i = 0; i < tokens.length - 2; i++) {
      nGrams.push(`${tokens[i]}_${tokens[i + 1]}_${tokens[i + 2]}`);
    }
    
    return [...tokens, ...nGrams.slice(0, 10)]; // Limit n-grams to avoid explosion
  }

  // INITIALIZE ENTITY EXTRACTION PATTERNS
  private initializeEntityPatterns(): void {
    this.entityPatterns.set('MERCHANT', /\b([A-Z][A-Z\s&.]{2,})\b/g);
    this.entityPatterns.set('AMOUNT', /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
    this.entityPatterns.set('DATE', /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/g);
    this.entityPatterns.set('LOCATION', /\b(ST|AVE|BLVD|RD|DR|LN|CT)\b|\b[A-Z]{2}\s*\d{5}\b/g);
    this.entityPatterns.set('PAYMENT_METHOD', /\b(VISA|MASTERCARD|AMEX|DEBIT|CREDIT|ACH|WIRE|CHECK|CASH)\b/gi);
    this.entityPatterns.set('REFERENCE', /\b(REF|TXN|CONF|ID)[:\s]*([A-Z0-9]{4,})\b/gi);
  }

  // CREATE ADVANCED NLP MODELS
  private async loadOrCreateNLPModels(): Promise<void> {
    try {
      await this.loadModelsFromStorage();
    } catch (error) {
      console.log('📦 Creating new NLP models...');
      await this.createNLPModels();
    }
  }

  // CREATE TENSORFLOW NLP MODELS
  private async createNLPModels(): Promise<void> {
    const vocabSize = this.modelConfig.vocabularySize;
    const embeddingDim = this.modelConfig.embeddingDim;
    const maxSeqLength = this.modelConfig.maxSequenceLength;

    // SENTIMENT ANALYSIS MODEL
    this.sentimentModel = tf.sequential({
      name: 'TransactionSentiment',
      layers: [
        tf.layers.embedding({
          inputDim: vocabSize,
          outputDim: embeddingDim,
          inputLength: maxSeqLength,
          maskZero: true
        }),
        tf.layers.bidirectional({
          layer: tf.layers.gru({
            units: 64,
            returnSequences: true,
            dropout: 0.3
          })
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({ 
          units: 96, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({ 
          units: 48, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 3, activation: 'softmax' }) // negative, neutral, positive
      ]
    });

    this.sentimentModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'] // Removed unsupported precision/recall metrics for TensorFlow.js compatibility
    });

    // INTENT CLASSIFICATION MODEL
    this.intentClassificationModel = tf.sequential({
      name: 'TransactionIntent',
      layers: [
        tf.layers.embedding({
          inputDim: vocabSize,
          outputDim: embeddingDim,
          inputLength: maxSeqLength,
          maskZero: true
        }),
        tf.layers.conv1d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.conv1d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({ 
          units: 128, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: this.modelConfig.intentTypes.length, activation: 'softmax' })
      ]
    });

    this.intentClassificationModel.compile({
      optimizer: tf.train.adamax(0.002),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // EMBEDDING MODEL FOR SEMANTIC SIMILARITY
    this.embeddingModel = tf.sequential({
      name: 'TransactionEmbedding',
      layers: [
        tf.layers.embedding({
          inputDim: vocabSize,
          outputDim: embeddingDim,
          inputLength: maxSeqLength,
          maskZero: true
        }),
        tf.layers.bidirectional({
          layer: tf.layers.lstm({
            units: 128,
            dropout: 0.3
          })
        }),
        tf.layers.dense({ 
          units: embeddingDim, 
          activation: 'tanh',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization() // Normalize for better training
      ]
    });

    this.embeddingModel.compile({
      optimizer: 'adam',
      loss: 'cosineProximity'
    });

    // TOPIC MODELING MODEL
    this.topicModelingModel = tf.sequential({
      name: 'TransactionTopics',
      layers: [
        tf.layers.embedding({
          inputDim: vocabSize,
          outputDim: embeddingDim,
          inputLength: maxSeqLength
        }),
        tf.layers.globalAveragePooling1d(),
        tf.layers.dense({ 
          units: 128, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu',
          kernelInitializer: 'glorotUniform'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: this.modelConfig.topicCount, activation: 'softmax' })
      ]
    });

    this.topicModelingModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    console.log('✅ Advanced NLP Models Created');
  }

  // COMPREHENSIVE NLP ANALYSIS
  async analyzeTransaction(transaction: Transaction): Promise<NLPAnalysisResult> {
    if (!this.isInitialized) {
      await this.initializeNLPModels();
    }

    try {
      const description = transaction.description;
      
      // Prepare input for neural networks
      const tokenizedInput = this.prepareModelInput(description);
      
      // Run all analyses in parallel
      const [
        entities,
        sentiment,
        intent,
        topics,
        complexity
      ] = await Promise.all([
        this.extractEntities(description),
        this.analyzeSentiment(tokenizedInput),
        this.classifyIntent(tokenizedInput),
        this.extractTopics(tokenizedInput),
        this.analyzeComplexity(description)
      ]);

      // Generate suggestions
      const suggestions = this.generateSuggestions(description, entities, sentiment, intent);

      return {
        entities,
        sentiment,
        intent,
        topics,
        complexity,
        suggestions
      };
    } catch (error) {
      console.error('❌ NLP Analysis failed:', error);
      return this.getFallbackAnalysis(transaction.description);
    }
  }

  // ENTITY EXTRACTION
  private async extractEntities(description: string): Promise<NLPAnalysisResult['entities']> {
    const entities: NLPAnalysisResult['entities'] = {
      merchants: [],
      amounts: [],
      dates: [],
      locations: [],
      paymentMethods: [],
      references: []
    };

    // Use regex patterns for entity extraction
    const merchantMatches = description.match(this.entityPatterns.get('MERCHANT')!) || [];
    entities.merchants = merchantMatches.map(match => match.trim()).filter(Boolean);

    const amountMatches = description.match(this.entityPatterns.get('AMOUNT')!) || [];
    entities.amounts = amountMatches.map(match => parseFloat(match.replace(/[$,]/g, ''))).filter(amt => !isNaN(amt));

    const dateMatches = description.match(this.entityPatterns.get('DATE')!) || [];
    entities.dates = dateMatches;

    const locationMatches = description.match(this.entityPatterns.get('LOCATION')!) || [];
    entities.locations = locationMatches;

    const paymentMatches = description.match(this.entityPatterns.get('PAYMENT_METHOD')!) || [];
    entities.paymentMethods = paymentMatches.map(match => match.toUpperCase());

    const referenceMatches = description.match(this.entityPatterns.get('REFERENCE')!) || [];
    entities.references = referenceMatches;

    return entities;
  }

  // SENTIMENT ANALYSIS USING NEURAL NETWORK
  private async analyzeSentiment(inputTensor: tf.Tensor): Promise<NLPAnalysisResult['sentiment']> {
    if (!this.sentimentModel) {
      return { score: 0, label: 'neutral', confidence: 0.5 };
    }

    const prediction = this.sentimentModel.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();
    
    const sentimentLabels = ['negative', 'neutral', 'positive'] as const;
    let maxIndex = 0;
    let maxProb = probabilities[0];
    
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        maxIndex = i;
      }
    }
    
    // Convert to -1 to 1 scale
    const score = (maxIndex - 1) * maxProb; // -1 for negative, 0 for neutral, 1 for positive
    
    prediction.dispose();
    
    return {
      score,
      label: sentimentLabels[maxIndex],
      confidence: maxProb
    };
  }

  // INTENT CLASSIFICATION
  private async classifyIntent(inputTensor: tf.Tensor): Promise<NLPAnalysisResult['intent']> {
    if (!this.intentClassificationModel) {
      return { type: 'unknown', confidence: 0.5 };
    }

    const prediction = this.intentClassificationModel.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();
    
    let maxIndex = 0;
    let maxProb = probabilities[0];
    
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i];
        maxIndex = i;
      }
    }
    
    const intentTypes = ['payment', 'transfer', 'deposit', 'withdrawal', 'fee', 'refund'] as const;
    const intentType = intentTypes[maxIndex] || 'unknown';
    
    prediction.dispose();
    
    return {
      type: intentType,
      confidence: maxProb
    };
  }

  // TOPIC EXTRACTION
  private async extractTopics(inputTensor: tf.Tensor): Promise<Array<{ topic: string; relevance: number }>> {
    if (!this.topicModelingModel) {
      return [];
    }

    const prediction = this.topicModelingModel.predict(inputTensor) as tf.Tensor;
    const topicProbabilities = await prediction.data();
    
    const topics = [
      'retail', 'restaurant', 'gas_station', 'grocery', 'healthcare',
      'entertainment', 'travel', 'utilities', 'insurance', 'investment',
      'banking_fees', 'payroll', 'rent', 'mortgage', 'education',
      'charity', 'government', 'online_services', 'subscription', 'other'
    ];
    
    const topicResults = Array.from(topicProbabilities)
      .map((relevance, index) => ({
        topic: topics[index] || `topic_${index}`,
        relevance
      }))
      .filter(t => t.relevance > 0.1)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
    
    prediction.dispose();
    
    return topicResults;
  }

  // COMPLEXITY ANALYSIS
  private analyzeComplexity(description: string): { score: number; factors: string[] } {
    const factors: string[] = [];
    let complexityScore = 0;
    
    // Length factor
    if (description.length > 100) {
      complexityScore += 0.2;
      factors.push('Long description');
    }
    
    // Technical terms
    const technicalTerms = /\b(ACH|WIRE|SWIFT|API|POS|ATM|PIN|CVV|EMV)\b/gi;
    const techMatches = description.match(technicalTerms) || [];
    if (techMatches.length > 0) {
      complexityScore += 0.3;
      factors.push('Technical terminology');
    }
    
    // Multiple entities
    const entityCount = (description.match(/\b[A-Z]{2,}\b/g) || []).length;
    if (entityCount > 3) {
      complexityScore += 0.2;
      factors.push('Multiple entities');
    }
    
    // Numbers and amounts
    const numberCount = (description.match(/\d+/g) || []).length;
    if (numberCount > 2) {
      complexityScore += 0.15;
      factors.push('Multiple numbers');
    }
    
    // Special characters
    const specialChars = description.match(/[#@%&*]/g) || [];
    if (specialChars.length > 0) {
      complexityScore += 0.1;
      factors.push('Special characters');
    }
    
    // Abbreviations
    const abbreviations = description.match(/\b[A-Z]{2,5}\b/g) || [];
    if (abbreviations.length > 2) {
      complexityScore += 0.05;
      factors.push('Multiple abbreviations');
    }
    
    return {
      score: Math.min(1, complexityScore),
      factors
    };
  }

  // GENERATE IMPROVEMENT SUGGESTIONS
  private generateSuggestions(
    description: string,
    entities: NLPAnalysisResult['entities'],
    sentiment: NLPAnalysisResult['sentiment'],
    intent: NLPAnalysisResult['intent']
  ): NLPAnalysisResult['suggestions'] {
    const suggestions: NLPAnalysisResult['suggestions'] = {
      missingInfo: []
    };

    // Check for missing merchant information
    if (entities.merchants.length === 0 && intent.type === 'payment') {
      suggestions.missingInfo!.push('Merchant name');
    }

    // Check for missing amount information
    if (entities.amounts.length === 0) {
      suggestions.missingInfo!.push('Transaction amount');
    }

    // Check for missing reference
    if (entities.references.length === 0 && intent.type !== 'deposit') {
      suggestions.missingInfo!.push('Reference number');
    }

    // Suggest better description for unclear transactions
    if (sentiment.confidence < 0.6 || description.length < 10) {
      suggestions.betterDescription = this.generateBetterDescription(description, entities, intent);
    }

    // Suggest category based on intent and entities
    if (intent.confidence > 0.7) {
      suggestions.category = this.suggestCategory(intent, entities);
    }

    return suggestions;
  }

  // GENERATE BETTER DESCRIPTION
  private generateBetterDescription(
    originalDescription: string,
    entities: NLPAnalysisResult['entities'],
    intent: NLPAnalysisResult['intent']
  ): string {
    let improved = originalDescription;

    // Add missing components
    if (entities.merchants.length > 0) {
      improved = `${intent.type.toUpperCase()} - ${entities.merchants[0]} - ${improved}`;
    }

    if (entities.amounts.length > 0) {
      improved += ` ($${entities.amounts[0].toFixed(2)})`;
    }

    if (entities.references.length > 0) {
      improved += ` [${entities.references[0]}]`;
    }

    return improved.length > originalDescription.length ? improved : originalDescription;
  }

  // SUGGEST CATEGORY BASED ON NLP ANALYSIS
  private suggestCategory(
    intent: NLPAnalysisResult['intent'],
    entities: NLPAnalysisResult['entities']
  ): string {
    // Map intents to categories
    const intentCategoryMap: { [key: string]: string } = {
      'payment': 'cat_business_expense',
      'transfer': 'cat_transfer',
      'deposit': 'cat_income',
      'withdrawal': 'cat_cash_withdrawal',
      'fee': 'cat_bank_fee',
      'refund': 'cat_refund'
    };

    // Check for specific merchant categories
    if (entities.merchants.length > 0) {
      const merchant = entities.merchants[0].toLowerCase();
      
      if (merchant.includes('gas') || merchant.includes('fuel')) {
        return 'cat_fuel';
      }
      if (merchant.includes('restaurant') || merchant.includes('cafe')) {
        return 'cat_meals';
      }
      if (merchant.includes('hotel') || merchant.includes('airline')) {
        return 'cat_travel';
      }
    }

    return intentCategoryMap[intent.type] || 'cat_uncategorized';
  }

  // SEMANTIC SIMILARITY ANALYSIS
  async calculateSemanticSimilarity(transaction1: Transaction, transaction2: Transaction): Promise<TransactionSimilarity> {
    if (!this.embeddingModel) {
      return this.calculateBasicSimilarity(transaction1, transaction2);
    }

    try {
      // Get embeddings for both transactions
      const embedding1 = await this.getTransactionEmbedding(transaction1.description);
      const embedding2 = await this.getTransactionEmbedding(transaction2.description);
      
      // Calculate cosine similarity
      const semantic = this.calculateCosineSimilarity(embedding1, embedding2);
      
      // Calculate other similarity factors
      const structural = this.calculateStructuralSimilarity(transaction1.description, transaction2.description);
      const temporal = this.calculateTemporalSimilarity(transaction1.date, transaction2.date);
      const amount = this.calculateAmountSimilarity(transaction1, transaction2);
      
      // Combined similarity score
      const similarity = (semantic * 0.4 + structural * 0.3 + temporal * 0.2 + amount * 0.1);
      
      const explanation = this.generateSimilarityExplanation(semantic, structural, temporal, amount);
      
      return {
        transaction1,
        transaction2,
        similarity,
        similarityFactors: {
          semantic,
          structural,
          temporal,
          amount
        },
        explanation
      };
    } catch (error) {
      console.error('❌ Semantic similarity calculation failed:', error);
      return this.calculateBasicSimilarity(transaction1, transaction2);
    }
  }

  // GET TRANSACTION EMBEDDING
  private async getTransactionEmbedding(description: string): Promise<number[]> {
    if (!this.embeddingModel) {
      throw new Error('Embedding model not available');
    }

    const inputTensor = this.prepareModelInput(description);
    const embedding = this.embeddingModel.predict(inputTensor) as tf.Tensor;
    const embeddingData = await embedding.data();
    
    inputTensor.dispose();
    embedding.dispose();
    
    return Array.from(embeddingData);
  }

  // CALCULATE COSINE SIMILARITY
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }

  // ANALYZE LANGUAGE PATTERNS
  private async analyzeLanguagePatterns(): Promise<void> {
    console.log('🔍 Analyzing language patterns...');
    
    const transactions = localStorageManager.getAllTransactions();
    const patterns: Map<string, { count: number; examples: string[] }> = new Map();
    
    transactions.forEach(transaction => {
      const description = transaction.description;
      
      // Extract common patterns (simplified)
      const words = this.tokenizeAdvanced(description);
      
      words.forEach(word => {
        if (word.length > 3) { // Skip short words
          const existing = patterns.get(word) || { count: 0, examples: [] };
          existing.count++;
          if (existing.examples.length < 5) {
            existing.examples.push(description.substring(0, 50));
          }
          patterns.set(word, existing);
        }
      });
    });
    
    // Convert to language patterns
    this.languagePatterns = Array.from(patterns.entries())
      .filter(([, data]) => data.count >= 3) // Minimum frequency
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        category: this.classifyPatternCategory(pattern),
        examples: data.examples,
        confidence: Math.min(1, data.count / transactions.length)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 100); // Keep top 100 patterns
    
    console.log(`📊 Identified ${this.languagePatterns.length} language patterns`);
  }

  // CLASSIFY PATTERN CATEGORY
  private classifyPatternCategory(pattern: string): string {
    if (pattern.includes('payment') || pattern.includes('pay')) return 'payment';
    if (pattern.includes('transfer') || pattern.includes('wire')) return 'transfer';
    if (pattern.includes('deposit')) return 'deposit';
    if (pattern.includes('withdrawal') || pattern.includes('atm')) return 'withdrawal';
    if (pattern.includes('fee') || pattern.includes('charge')) return 'fee';
    if (pattern.includes('refund') || pattern.includes('return')) return 'refund';
    return 'general';
  }

  // UTILITY METHODS

  private prepareModelInput(description: string): tf.Tensor {
    const tokens = this.tokenizeAdvanced(description);
    const sequence = new Array(this.modelConfig.maxSequenceLength).fill(0);
    
    tokens.slice(0, this.modelConfig.maxSequenceLength).forEach((token, index) => {
      const tokenIndex = this.vocabulary.get(token);
      if (tokenIndex !== undefined) {
        sequence[index] = tokenIndex;
      }
    });
    
    return tf.tensor2d([sequence], [1, this.modelConfig.maxSequenceLength]);
  }

  private calculateBasicSimilarity(transaction1: Transaction, transaction2: Transaction): TransactionSimilarity {
    const structural = this.calculateStructuralSimilarity(transaction1.description, transaction2.description);
    const temporal = this.calculateTemporalSimilarity(transaction1.date, transaction2.date);
    const amount = this.calculateAmountSimilarity(transaction1, transaction2);
    
    const similarity = (structural * 0.5 + temporal * 0.3 + amount * 0.2);
    
    return {
      transaction1,
      transaction2,
      similarity,
      similarityFactors: {
        semantic: 0,
        structural,
        temporal,
        amount
      },
      explanation: 'Basic similarity calculation (semantic analysis unavailable)'
    };
  }

  private calculateStructuralSimilarity(desc1: string, desc2: string): number {
    const tokens1 = new Set(this.tokenizeAdvanced(desc1));
    const tokens2 = new Set(this.tokenizeAdvanced(desc2));
    
    const intersection = new Set([...tokens1].filter(token => tokens2.has(token)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private calculateTemporalSimilarity(date1: string, date2: string): number {
    const daysDiff = Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysDiff / 30); // Exponential decay over 30 days
  }

  private calculateAmountSimilarity(transaction1: Transaction, transaction2: Transaction): number {
    const amount1 = Math.abs(transaction1.debitAmount || transaction1.creditAmount || 0);
    const amount2 = Math.abs(transaction2.debitAmount || transaction2.creditAmount || 0);
    
    if (amount1 === 0 && amount2 === 0) return 1;
    if (amount1 === 0 || amount2 === 0) return 0;
    
    const ratio = Math.min(amount1, amount2) / Math.max(amount1, amount2);
    return ratio;
  }

  private generateSimilarityExplanation(semantic: number, structural: number, temporal: number, amount: number): string {
    const factors = [];
    
    if (semantic > 0.8) factors.push('very similar meaning');
    else if (semantic > 0.6) factors.push('similar meaning');
    else if (semantic > 0.4) factors.push('somewhat similar meaning');
    
    if (structural > 0.7) factors.push('similar structure');
    if (temporal > 0.8) factors.push('close in time');
    if (amount > 0.9) factors.push('similar amounts');
    
    return factors.length > 0 ? `Similar due to: ${factors.join(', ')}` : 'Low similarity across all factors';
  }

  private getFallbackAnalysis(_description: string): NLPAnalysisResult {
    return {
      entities: {
        merchants: [],
        amounts: [],
        dates: [],
        locations: [],
        paymentMethods: [],
        references: []
      },
      sentiment: { score: 0, label: 'neutral', confidence: 0.5 },
      intent: { type: 'unknown', confidence: 0.3 },
      topics: [],
      complexity: { score: 0.5, factors: ['Analysis unavailable'] },
      suggestions: {
        missingInfo: ['Complete NLP analysis unavailable']
      }
    };
  }

  // SAVE/LOAD MODELS

  private async loadModelsFromStorage(): Promise<void> {
    this.sentimentModel = await tf.loadLayersModel('localstorage://tms-nlp-sentiment-model');
    this.intentClassificationModel = await tf.loadLayersModel('localstorage://tms-nlp-intent-model');
    this.embeddingModel = await tf.loadLayersModel('localstorage://tms-nlp-embedding-model');
    this.topicModelingModel = await tf.loadLayersModel('localstorage://tms-nlp-topic-model');
    console.log('📂 NLP models loaded from localStorage');
  }

  // GET SERVICE STATUS
  getServiceStatus(): {
    isInitialized: boolean;
    modelsLoaded: {
      sentiment: boolean;
      intent: boolean;
      embedding: boolean;
      topicModeling: boolean;
    };
    vocabularySize: number;
    languagePatterns: number;
    modelConfig: any;
    tfMemory: any;
  } {
    return {
      isInitialized: this.isInitialized,
      modelsLoaded: {
        sentiment: this.sentimentModel !== null,
        intent: this.intentClassificationModel !== null,
        embedding: this.embeddingModel !== null,
        topicModeling: this.topicModelingModel !== null
      },
      vocabularySize: this.vocabulary.size,
      languagePatterns: this.languagePatterns.length,
      modelConfig: { ...this.modelConfig },
      tfMemory: tf.memory()
    };
  }

  // CLEANUP
  dispose(): void {
    console.log('🧹 Cleaning up NLP resources...');
    
    if (this.sentimentModel) this.sentimentModel.dispose();
    if (this.intentClassificationModel) this.intentClassificationModel.dispose();
    if (this.embeddingModel) this.embeddingModel.dispose();
    if (this.topicModelingModel) this.topicModelingModel.dispose();
    
    this.vocabulary.clear();
    this.wordEmbeddings.clear();
    this.entityPatterns.clear();
    this.languagePatterns = [];
    this.commonPhrases.clear();
    
    console.log('✅ NLP resources cleaned up');
  }

  // PUBLIC METHOD FOR SERVICE ORCHESTRATOR
  async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }
    
    // Wait for initialization to complete if in progress
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (!this.isInitialized && attempts < maxAttempts) {
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (!this.isInitialized) {
      throw new Error('ML Natural Language Service failed to initialize within timeout');
    }
  }
}

export const mlNaturalLanguageService = new MLNaturalLanguageService(); 