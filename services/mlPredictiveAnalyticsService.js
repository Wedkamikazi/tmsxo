"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlPredictiveAnalyticsService = void 0;
const tf = require("@tensorflow/tfjs");
const localStorageManager_1 = require("./localStorageManager");
const systemIntegrityService_1 = require("./systemIntegrityService");
class MLPredictiveAnalyticsService {
    constructor() {
        // Advanced Models
        this.cashFlowModel = null;
        this.spendingPatternModel = null;
        this.seasonalityModel = null;
        this.riskAssessmentModel = null;
        // Model Configuration
        this.modelConfig = {
            lookbackPeriod: 90,
            forecastHorizon: 30,
            confidenceThreshold: 0.7,
            anomalyThreshold: 2.5,
            seasonalityMinPeriod: 7,
            seasonalityMaxPeriod: 365 // Maximum days for seasonal pattern
        };
        this.isInitialized = false;
        this.predictionCache = new Map();
        this.initializeAdvancedModels();
    }
    // INITIALIZE ADVANCED PREDICTIVE MODELS
    async initializeAdvancedModels() {
        try {
            console.log('🔮 Initializing Predictive Analytics Models...');
            await this.loadOrCreatePredictiveModels();
            this.isInitialized = true;
            console.log('✅ Predictive Analytics Models Ready');
        }
        catch (error) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('MLPredictiveAnalyticsService', 'initializeAdvancedModels', error instanceof Error ? error : new Error(String(error)), 'critical', { component: 'initialization', stage: 'modelCreation' });
            this.isInitialized = false;
        }
    }
    // CREATE ADVANCED PREDICTIVE MODELS
    async loadOrCreatePredictiveModels() {
        try {
            // Try loading existing models
            await this.loadModelsFromStorage();
        }
        catch (error) {
            console.log('📦 Creating new predictive models...');
            await this.createPredictiveModels();
        }
    }
    // CREATE PREDICTIVE TENSORFLOW MODELS
    async createPredictiveModels() {
        // CASH FLOW FORECASTING MODEL
        this.cashFlowModel = tf.sequential({
            name: 'CashFlowForecast',
            layers: [
                tf.layers.lstm({
                    units: 128,
                    returnSequences: true,
                    inputShape: [this.modelConfig.lookbackPeriod, 5],
                    dropout: 0.2,
                    recurrentDropout: 0.2
                }),
                tf.layers.lstm({
                    units: 64,
                    returnSequences: true,
                    dropout: 0.2
                }),
                tf.layers.lstm({
                    units: 32,
                    dropout: 0.2
                }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.dense({ units: this.modelConfig.forecastHorizon * 3 }) // inflow, outflow, balance for each day
            ]
        });
        this.cashFlowModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['mse'] // Using only mse metric for TensorFlow.js compatibility
        });
        // SPENDING PATTERN ANALYSIS MODEL
        this.spendingPatternModel = tf.sequential({
            name: 'SpendingPatterns',
            layers: [
                tf.layers.conv1d({
                    filters: 64,
                    kernelSize: 5,
                    activation: 'relu',
                    inputShape: [this.modelConfig.lookbackPeriod, 3]
                }),
                tf.layers.conv1d({
                    filters: 32,
                    kernelSize: 3,
                    activation: 'relu'
                }),
                tf.layers.globalMaxPooling1d(),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 96,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.batchNormalization(),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 48,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.dense({ units: 8, activation: 'sigmoid' }) // Pattern classification
            ]
        });
        this.spendingPatternModel.compile({
            optimizer: tf.train.adamax(0.002),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy'] // Removed unsupported precision/recall metrics for TensorFlow.js compatibility
        });
        // SEASONALITY DETECTION MODEL
        this.seasonalityModel = tf.sequential({
            name: 'SeasonalityDetection',
            layers: [
                tf.layers.dense({
                    units: 128,
                    activation: 'relu',
                    inputShape: [this.modelConfig.seasonalityMaxPeriod],
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.batchNormalization(),
                tf.layers.dropout({ rate: 0.4 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.batchNormalization(),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.dense({ units: 12, activation: 'softmax' }) // Monthly seasonality patterns
            ]
        });
        this.seasonalityModel.compile({
            optimizer: tf.train.rmsprop(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        // RISK ASSESSMENT MODEL
        this.riskAssessmentModel = tf.sequential({
            name: 'RiskAssessment',
            layers: [
                tf.layers.dense({
                    units: 96,
                    activation: 'relu',
                    inputShape: [15],
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.batchNormalization(),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 48,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.batchNormalization(),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 24,
                    activation: 'relu',
                    kernelInitializer: 'glorotUniform'
                }),
                tf.layers.dense({ units: 4, activation: 'softmax' }) // Low, Medium, High, Critical risk
            ]
        });
        this.riskAssessmentModel.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy'] // Removed unsupported precision metric for TensorFlow.js compatibility
        });
        console.log('✅ Advanced Predictive Models Created');
    }
    // COMPREHENSIVE FINANCIAL ANALYSIS
    async generateComprehensiveInsights(accountId) {
        if (!this.isInitialized) {
            await this.initializeAdvancedModels();
        }
        const cacheKey = `insights_${accountId || 'all'}_${Date.now()}`;
        const cached = this.predictionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
            return cached.result;
        }
        try {
            const insights = [];
            // Generate multiple types of insights
            const [cashFlowInsights, spendingInsights, riskInsights, seasonalInsights] = await Promise.all([
                this.generateCashFlowInsights(accountId),
                this.generateSpendingPatternInsights(accountId),
                this.generateRiskAssessmentInsights(accountId),
                this.generateSeasonalityInsights(accountId)
            ]);
            insights.push(...cashFlowInsights, ...spendingInsights, ...riskInsights, ...seasonalInsights);
            // Cache results
            this.predictionCache.set(cacheKey, {
                result: insights,
                timestamp: Date.now()
            });
            return insights;
        }
        catch (error) {
            systemIntegrityService_1.systemIntegrityService.logServiceError('MLPredictiveAnalyticsService', 'generateComprehensiveInsights', error instanceof Error ? error : new Error(String(error)), 'high', { accountId, cacheKey });
            return [];
        }
    }
    // CASH FLOW FORECASTING
    async generateCashFlowInsights(accountId) {
        if (!this.cashFlowModel)
            return [];
        const transactions = accountId
            ? localStorageManager_1.localStorageManager.getTransactionsByAccount(accountId)
            : localStorageManager_1.localStorageManager.getAllTransactions();
        if (transactions.length < this.modelConfig.lookbackPeriod) {
            return [{
                    type: 'cash_flow',
                    prediction: 'Insufficient data for cash flow forecasting',
                    confidence: 0.1,
                    timeframe: '30_days',
                    impact: 'low',
                    recommendations: ['Import more historical transaction data for better predictions'],
                    supportingData: { requiredDays: this.modelConfig.lookbackPeriod, availableDays: transactions.length }
                }];
        }
        // Prepare time series data
        const timeSeriesData = this.prepareTimeSeriesData(transactions);
        const inputTensor = tf.tensor3d([timeSeriesData], [1, timeSeriesData.length, 5]);
        // Generate forecast
        const prediction = this.cashFlowModel.predict(inputTensor);
        const forecastData = await prediction.data();
        // Process forecast results
        const forecast = this.processCashFlowForecast(forecastData);
        // Cleanup tensors
        inputTensor.dispose();
        prediction.dispose();
        const insights = [];
        // Analyze forecast for insights
        const totalPredictedInflow = forecast.reduce((sum, day) => sum + day.predictedInflow, 0);
        const totalPredictedOutflow = forecast.reduce((sum, day) => sum + day.predictedOutflow, 0);
        const netCashFlow = totalPredictedInflow - totalPredictedOutflow;
        const avgConfidence = forecast.reduce((sum, day) => sum + day.confidence, 0) / forecast.length;
        if (netCashFlow < 0) {
            insights.push({
                type: 'cash_flow',
                prediction: `Negative cash flow predicted: ${this.formatCurrency(netCashFlow)} over next 30 days`,
                confidence: avgConfidence,
                timeframe: '30_days',
                impact: Math.abs(netCashFlow) > 50000 ? 'critical' : 'high',
                recommendations: [
                    'Consider accelerating receivables collection',
                    'Review and optimize large expenditures',
                    'Explore short-term financing options if needed'
                ],
                supportingData: { forecast, netCashFlow, totalInflow: totalPredictedInflow, totalOutflow: totalPredictedOutflow }
            });
        }
        else {
            insights.push({
                type: 'cash_flow',
                prediction: `Positive cash flow predicted: ${this.formatCurrency(netCashFlow)} over next 30 days`,
                confidence: avgConfidence,
                timeframe: '30_days',
                impact: 'low',
                recommendations: [
                    'Consider investment opportunities for excess cash',
                    'Review cash management strategies'
                ],
                supportingData: { forecast, netCashFlow, totalInflow: totalPredictedInflow, totalOutflow: totalPredictedOutflow }
            });
        }
        return insights;
    }
    // SPENDING PATTERN ANALYSIS
    async generateSpendingPatternInsights(accountId) {
        if (!this.spendingPatternModel)
            return [];
        const transactions = accountId
            ? localStorageManager_1.localStorageManager.getTransactionsByAccount(accountId)
            : localStorageManager_1.localStorageManager.getAllTransactions();
        const spendingData = this.analyzeSpendingPatterns(transactions);
        const insights = [];
        // Prepare input for spending pattern model
        const patternFeatures = this.extractSpendingFeatures(transactions);
        const inputTensor = tf.tensor3d([patternFeatures], [1, patternFeatures.length, 3]);
        const prediction = this.spendingPatternModel.predict(inputTensor);
        const patternProbabilities = await prediction.data();
        // Process pattern analysis
        const patterns = this.processSpendingPatterns(patternProbabilities, spendingData);
        // Cleanup
        inputTensor.dispose();
        prediction.dispose();
        // Generate insights based on patterns
        patterns.forEach(pattern => {
            if (pattern.currentTrend === 'increasing' && Math.abs(pattern.predictedChange) > 0.2) {
                insights.push({
                    type: 'spending_pattern',
                    prediction: `${pattern.category} spending increasing by ${(pattern.predictedChange * 100).toFixed(1)}%`,
                    confidence: 0.8,
                    timeframe: '30_days',
                    impact: pattern.predictedChange > 0.5 ? 'high' : 'medium',
                    recommendations: [
                        `Monitor ${pattern.category} expenses closely`,
                        'Consider implementing budget controls for this category',
                        'Review necessity of expenses in this category'
                    ],
                    supportingData: pattern
                });
            }
        });
        return insights;
    }
    // RISK ASSESSMENT INSIGHTS
    async generateRiskAssessmentInsights(accountId) {
        if (!this.riskAssessmentModel)
            return [];
        const riskFactors = this.calculateRiskFactors(accountId);
        const inputTensor = tf.tensor2d([riskFactors], [1, 15]);
        const prediction = this.riskAssessmentModel.predict(inputTensor);
        const riskProbabilities = await prediction.data();
        // Find highest risk category
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        let maxRiskIndex = 0;
        let maxRiskProb = riskProbabilities[0];
        for (let i = 1; i < riskProbabilities.length; i++) {
            if (riskProbabilities[i] > maxRiskProb) {
                maxRiskProb = riskProbabilities[i];
                maxRiskIndex = i;
            }
        }
        const riskLevel = riskLevels[maxRiskIndex];
        const confidence = maxRiskProb;
        // Cleanup
        inputTensor.dispose();
        prediction.dispose();
        const insights = [];
        if (riskLevel === 'high' || riskLevel === 'critical') {
            insights.push({
                type: 'anomaly_risk',
                prediction: `${riskLevel.toUpperCase()} financial risk detected`,
                confidence,
                timeframe: '7_days',
                impact: riskLevel,
                recommendations: [
                    'Review recent large transactions',
                    'Implement additional monitoring controls',
                    'Consider diversifying financial exposure'
                ],
                supportingData: { riskFactors, riskProbabilities: Array.from(riskProbabilities) }
            });
        }
        return insights;
    }
    // SEASONALITY ANALYSIS
    async generateSeasonalityInsights(accountId) {
        if (!this.seasonalityModel)
            return [];
        const transactions = accountId
            ? localStorageManager_1.localStorageManager.getTransactionsByAccount(accountId)
            : localStorageManager_1.localStorageManager.getAllTransactions();
        const seasonalData = this.extractSeasonalFeatures(transactions);
        const inputTensor = tf.tensor2d([seasonalData], [1, this.modelConfig.seasonalityMaxPeriod]);
        const prediction = this.seasonalityModel.predict(inputTensor);
        const seasonalProbabilities = await prediction.data();
        // Process seasonality results
        const seasonalInsights = this.processSeasonalityResults(seasonalProbabilities);
        // Cleanup
        inputTensor.dispose();
        prediction.dispose();
        return seasonalInsights;
    }
    // UTILITY METHODS FOR DATA PROCESSING
    prepareTimeSeriesData(transactions) {
        // Sort transactions by date
        const sorted = transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Group by day and calculate daily features
        const dailyData = {};
        sorted.forEach(transaction => {
            const date = transaction.date.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    inflow: 0,
                    outflow: 0,
                    transactionCount: 0,
                    avgAmount: 0,
                    balance: transaction.balance
                };
            }
            if (transaction.creditAmount > 0) {
                dailyData[date].inflow += transaction.creditAmount;
            }
            else {
                dailyData[date].outflow += Math.abs(transaction.debitAmount || 0);
            }
            dailyData[date].transactionCount++;
            dailyData[date].balance = transaction.balance;
        });
        // Convert to array format for ML model
        const timeSeriesArray = [];
        const dates = Object.keys(dailyData).sort();
        dates.slice(-this.modelConfig.lookbackPeriod).forEach(date => {
            const day = dailyData[date];
            timeSeriesArray.push([
                day.inflow,
                day.outflow,
                day.transactionCount,
                day.balance,
                new Date(date).getDay() // Day of week feature
            ]);
        });
        return timeSeriesArray;
    }
    processCashFlowForecast(forecastData) {
        const forecast = [];
        const dataArray = Array.from(forecastData);
        for (let i = 0; i < this.modelConfig.forecastHorizon; i++) {
            const baseIndex = i * 3;
            const date = new Date();
            date.setDate(date.getDate() + i + 1);
            forecast.push({
                date: date.toISOString().split('T')[0],
                predictedInflow: Math.max(0, dataArray[baseIndex] || 0),
                predictedOutflow: Math.max(0, dataArray[baseIndex + 1] || 0),
                predictedBalance: dataArray[baseIndex + 2] || 0,
                confidence: Math.min(1, Math.max(0.1, 0.8 - (i * 0.02))),
                factors: ['Historical patterns', 'Seasonal trends', 'Transaction frequency']
            });
        }
        return forecast;
    }
    analyzeSpendingPatterns(transactions) {
        // Group transactions by category
        const categoryGroups = {};
        transactions.forEach(transaction => {
            var _a;
            const category = ((_a = transaction.categorization) === null || _a === void 0 ? void 0 : _a.categoryId) || 'uncategorized';
            if (!categoryGroups[category]) {
                categoryGroups[category] = [];
            }
            categoryGroups[category].push(transaction);
        });
        return Object.keys(categoryGroups).map(category => {
            const categoryTransactions = categoryGroups[category];
            return {
                category,
                currentTrend: this.calculateTrend(categoryTransactions),
                predictedChange: this.calculatePredictedChange(categoryTransactions),
                seasonality: this.detectSeasonality(categoryTransactions),
                anomalies: this.detectAnomalies(categoryTransactions)
            };
        });
    }
    calculateTrend(transactions) {
        if (transactions.length < 6)
            return 'stable';
        const recent = transactions.slice(-30); // Last 30 transactions
        const older = transactions.slice(-60, -30); // Previous 30 transactions
        const recentAvg = recent.reduce((sum, t) => sum + Math.abs(t.debitAmount || t.creditAmount || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, t) => sum + Math.abs(t.debitAmount || t.creditAmount || 0), 0) / older.length;
        const change = (recentAvg - olderAvg) / olderAvg;
        if (change > 0.1)
            return 'increasing';
        if (change < -0.1)
            return 'decreasing';
        return 'stable';
    }
    calculatePredictedChange(transactions) {
        // Simple linear regression for trend prediction
        if (transactions.length < 10)
            return 0;
        const amounts = transactions.map(t => Math.abs(t.debitAmount || t.creditAmount || 0));
        const n = amounts.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = amounts.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * amounts[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const avgAmount = sumY / n;
        return slope / avgAmount; // Relative change rate
    }
    detectSeasonality(transactions) {
        // Simplified seasonality detection based on monthly patterns
        const monthlyAmounts = {};
        transactions.forEach(transaction => {
            const month = new Date(transaction.date).getMonth();
            if (!monthlyAmounts[month])
                monthlyAmounts[month] = [];
            monthlyAmounts[month].push(Math.abs(transaction.debitAmount || transaction.creditAmount || 0));
        });
        const monthlyAvgs = Object.keys(monthlyAmounts).map(month => {
            const amounts = monthlyAmounts[parseInt(month)];
            return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        });
        const overallAvg = monthlyAvgs.reduce((sum, avg) => sum + avg, 0) / monthlyAvgs.length;
        const variance = monthlyAvgs.reduce((sum, avg) => sum + Math.pow(avg - overallAvg, 2), 0) / monthlyAvgs.length;
        const coefficient = Math.sqrt(variance) / overallAvg;
        return {
            isDetected: coefficient > 0.3,
            pattern: coefficient > 0.5 ? 'strong_seasonal' : coefficient > 0.3 ? 'moderate_seasonal' : 'no_pattern',
            strength: coefficient
        };
    }
    detectAnomalies(transactions) {
        const amounts = transactions.map(t => Math.abs(t.debitAmount || t.creditAmount || 0));
        const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / amounts.length);
        const anomalies = [];
        transactions.forEach(transaction => {
            const amount = Math.abs(transaction.debitAmount || transaction.creditAmount || 0);
            const deviation = Math.abs(amount - mean) / stdDev;
            if (deviation > this.modelConfig.anomalyThreshold) {
                anomalies.push({
                    date: transaction.date,
                    amount,
                    deviation
                });
            }
        });
        return anomalies.slice(0, 10); // Return top 10 anomalies
    }
    extractSpendingFeatures(transactions) {
        // Extract features for spending pattern analysis
        const features = [];
        const lookbackDays = this.modelConfig.lookbackPeriod;
        for (let i = 0; i < lookbackDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (lookbackDays - i));
            const dateStr = date.toISOString().split('T')[0];
            const dayTransactions = transactions.filter(t => t.date.startsWith(dateStr));
            const totalAmount = dayTransactions.reduce((sum, t) => sum + Math.abs(t.debitAmount || t.creditAmount || 0), 0);
            const transactionCount = dayTransactions.length;
            const avgAmount = transactionCount > 0 ? totalAmount / transactionCount : 0;
            features.push([totalAmount, transactionCount, avgAmount]);
        }
        return features;
    }
    processSpendingPatterns(probabilities, spendingData) {
        // Process the neural network output and combine with traditional analysis
        const probabilityArray = Array.from(probabilities);
        return spendingData.map((pattern, index) => {
            // Use ML probabilities to enhance pattern detection
            const mlConfidence = probabilityArray[index % probabilityArray.length] || 0.5;
            return {
                ...pattern,
                mlEnhanced: {
                    confidence: mlConfidence,
                    patternStrength: mlConfidence * pattern.seasonality.strength
                }
            };
        });
    }
    calculateRiskFactors(accountId) {
        const transactions = accountId
            ? localStorageManager_1.localStorageManager.getTransactionsByAccount(accountId)
            : localStorageManager_1.localStorageManager.getAllTransactions();
        if (transactions.length === 0) {
            return new Array(15).fill(0);
        }
        const amounts = transactions.map(t => Math.abs(t.debitAmount || t.creditAmount || 0));
        const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length);
        const balances = transactions.map(t => t.balance);
        const minBalance = Math.min(...balances);
        const maxBalance = Math.max(...balances);
        const balanceVolatility = (maxBalance - minBalance) / maxBalance;
        // Recent transaction frequency
        const recentTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return transactionDate >= thirtyDaysAgo;
        });
        const frequencyRisk = recentTransactions.length / 30; // Transactions per day
        return [
            mean / 10000,
            stdDev / mean || 0,
            balanceVolatility,
            frequencyRisk,
            amounts.filter(amt => amt > mean + 2 * stdDev).length / amounts.length,
            recentTransactions.length / transactions.length,
            Math.min(1, transactions.length / 365),
            balances.filter(bal => bal < 0).length / balances.length,
            new Date().getDay() / 7,
            new Date().getMonth() / 12,
            Math.random() * 0.1,
            transactions.filter(t => !t.reference).length / transactions.length,
            transactions.filter(t => t.description.length < 10).length / transactions.length,
            Math.min(1, Math.abs(balances[balances.length - 1] - balances[0]) / Math.abs(balances[0])),
            amounts.filter(amt => amt % 1 !== 0).length / amounts.length // Decimal amount ratio
        ];
    }
    extractSeasonalFeatures(transactions) {
        const features = new Array(this.modelConfig.seasonalityMaxPeriod).fill(0);
        // Create a time series of daily amounts for the last year
        const dailyAmounts = {};
        transactions.forEach(transaction => {
            const date = transaction.date.split('T')[0];
            if (!dailyAmounts[date])
                dailyAmounts[date] = 0;
            dailyAmounts[date] += Math.abs(transaction.debitAmount || transaction.creditAmount || 0);
        });
        // Fill features array with daily amounts
        const sortedDates = Object.keys(dailyAmounts).sort().slice(-this.modelConfig.seasonalityMaxPeriod);
        sortedDates.forEach((date, index) => {
            features[index] = dailyAmounts[date] / 1000; // Normalize
        });
        return features;
    }
    processSeasonalityResults(probabilities) {
        const probabilityArray = Array.from(probabilities);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let maxProb = 0;
        let peakMonth = 0;
        probabilityArray.forEach((prob, index) => {
            if (prob > maxProb) {
                maxProb = prob;
                peakMonth = index;
            }
        });
        const insight = {
            type: 'seasonal_trend',
            prediction: `Peak activity expected in ${months[peakMonth]}`,
            confidence: maxProb,
            timeframe: '12_months',
            impact: maxProb > 0.7 ? 'medium' : 'low',
            recommendations: [
                `Prepare for increased activity in ${months[peakMonth]}`,
                'Adjust cash flow planning for seasonal patterns',
                'Consider seasonal budgeting strategies'
            ],
            supportingData: {
                monthlyProbabilities: probabilityArray.map((prob, index) => ({
                    month: months[index],
                    probability: prob
                }))
            }
        };
        return [insight];
    }
    // UTILITY METHODS
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    // SAVE/LOAD MODELS
    async loadModelsFromStorage() {
        this.cashFlowModel = await tf.loadLayersModel('localstorage://tms-cashflow-model');
        this.spendingPatternModel = await tf.loadLayersModel('localstorage://tms-spending-model');
        this.seasonalityModel = await tf.loadLayersModel('localstorage://tms-seasonality-model');
        this.riskAssessmentModel = await tf.loadLayersModel('localstorage://tms-risk-model');
        console.log('📂 Predictive models loaded from localStorage');
    }
    // GET SERVICE STATUS
    getServiceStatus() {
        return {
            isInitialized: this.isInitialized,
            modelsLoaded: {
                cashFlow: this.cashFlowModel !== null,
                spendingPattern: this.spendingPatternModel !== null,
                seasonality: this.seasonalityModel !== null,
                riskAssessment: this.riskAssessmentModel !== null
            },
            modelConfig: { ...this.modelConfig },
            cacheSize: this.predictionCache.size,
            tfMemory: tf.memory()
        };
    }
    // CLEANUP
    dispose() {
        console.log('🧹 Cleaning up Predictive Analytics resources...');
        if (this.cashFlowModel)
            this.cashFlowModel.dispose();
        if (this.spendingPatternModel)
            this.spendingPatternModel.dispose();
        if (this.seasonalityModel)
            this.seasonalityModel.dispose();
        if (this.riskAssessmentModel)
            this.riskAssessmentModel.dispose();
        this.predictionCache.clear();
        console.log('✅ Predictive Analytics resources cleaned up');
    }
    // PUBLIC METHOD FOR SERVICE ORCHESTRATOR
    async ensureInitialized() {
        if (this.isInitialized) {
            return; // Already initialized
        }
        // Wait for initialization to complete if in progress
        let attempts = 0;
        const maxAttempts = 45; // 45 seconds max wait for predictive analytics
        while (!this.isInitialized && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        if (!this.isInitialized) {
            throw new Error('ML Predictive Analytics Service failed to initialize within timeout');
        }
    }
}
exports.mlPredictiveAnalyticsService = new MLPredictiveAnalyticsService();
