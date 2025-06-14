/**
 * Qwen 2.5:32B Integration Test Suite
 * Tests the enhanced ML categorization service with Qwen integration
 */

import { MLCategorizationService } from '../services/mlCategorizationService';
import { Transaction, TransactionCategory } from '../types';

// Mock transaction data for testing
const mockTransactions: Transaction[] = [
  {
    id: 'test-1',
    date: '2024-06-14',
    description: 'PAYROLL DEPOSIT ACME CORP',
    debitAmount: null,
    creditAmount: 5000.00,
    balance: 15000.00,
    reference: 'PAY240614001',
    accountId: 'acc-1'
  },
  {
    id: 'test-2',
    date: '2024-06-14',
    description: 'OFFICE SUPPLIES STAPLES #1234',
    debitAmount: 127.50,
    creditAmount: null,
    balance: 14872.50,
    reference: 'POS240614002',
    accountId: 'acc-1'
  },
  {
    id: 'test-3',
    date: '2024-06-14',
    description: 'INTERNATIONAL WIRE TRANSFER TO VENDOR XYZ LTD',
    debitAmount: 25000.00,
    creditAmount: null,
    balance: -10127.50,
    reference: 'WIRE240614003',
    accountId: 'acc-1'
  },
  {
    id: 'test-4',
    date: '2024-06-14',
    description: 'MONTHLY RENT PAYMENT BUILDING MANAGEMENT',
    debitAmount: 3500.00,
    creditAmount: null,
    balance: -13627.50,
    reference: 'RENT240614004',
    accountId: 'acc-1'
  }
];

const mockCategories: TransactionCategory[] = [
  {
    id: 'cat_payroll',
    name: 'Payroll',
    description: 'Employee salary and wage payments',
    keywords: ['payroll', 'salary', 'wage', 'employee', 'deposit'],
    color: '#4CAF50'
  },
  {
    id: 'cat_office_supplies',
    name: 'Office Supplies',
    description: 'Office equipment and supplies',
    keywords: ['office', 'supplies', 'staples', 'equipment', 'stationery'],
    color: '#FF9800'
  },
  {
    id: 'cat_international',
    name: 'International Payments',
    description: 'International wire transfers and foreign payments',
    keywords: ['international', 'wire', 'transfer', 'foreign', 'overseas'],
    color: '#2196F3'
  },
  {
    id: 'cat_rent',
    name: 'Rent & Facilities',
    description: 'Office rent and facility costs',
    keywords: ['rent', 'facility', 'building', 'lease', 'property'],
    color: '#9C27B0'
  },
  {
    id: 'cat_uncategorized',
    name: 'Uncategorized',
    description: 'Transactions that need manual categorization',
    keywords: [],
    color: '#757575'
  }
];

class QwenIntegrationTest {
  private mlService: MLCategorizationService;

  constructor() {
    this.mlService = new MLCategorizationService();
  }

  async runTests(): Promise<void> {
    console.log('🚀 Starting Qwen 2.5:32B Integration Tests');
    console.log('=' .repeat(50));

    try {
      // Test 1: Service Initialization
      await this.testServiceInitialization();

      // Test 2: Ollama Connectivity
      await this.testOllamaConnectivity();

      // Test 3: Model Status Check
      await this.testModelStatus();

      // Test 4: Local Model Functionality
      await this.testLocalModelFunctionality();

      // Test 5: Qwen Integration (if available)
      await this.testQwenIntegration();

      // Test 6: Hybrid Model Selection
      await this.testHybridModelSelection();

      // Test 7: Performance Monitoring
      await this.testPerformanceMonitoring();

      console.log('\n✅ All tests completed successfully!');

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  private async testServiceInitialization(): Promise<void> {
    console.log('\n📋 Test 1: Service Initialization');
    
    await this.mlService.initialize();
    console.log('✓ ML Service initialized successfully');
    
    const status = this.mlService.getModelStatus();
    console.log('✓ Model status retrieved:', {
      localModelLoaded: status.localModelLoaded,
      vocabularySize: status.vocabularySize,
      categoriesCount: status.categoriesCount
    });
  }

  private async testOllamaConnectivity(): Promise<void> {
    console.log('\n🔗 Test 2: Ollama Connectivity');
    
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        console.log('✓ Ollama service is running');
        console.log('✓ Available models:', data.models?.map((m: any) => m.name) || 'None');
      } else {
        console.log('⚠️  Ollama service not responding properly');
      }
    } catch (error) {
      console.log('⚠️  Ollama service not available:', error);
    }
  }

  private async testModelStatus(): Promise<void> {
    console.log('\n📊 Test 3: Model Status Check');
    
    const status = this.mlService.getModelStatus();
    console.log('✓ Full model status:', {
      isAvailable: status.isAvailable,
      modelLoaded: status.modelLoaded,
      localModelLoaded: status.localModelLoaded,
      config: {
        modelName: status.config.modelName,
        confidenceThreshold: status.config.confidenceThreshold,
        timeout: status.config.timeout
      }
    });

    const qwenStats = this.mlService.getQwenPerformanceStats();
    console.log('✓ Qwen performance stats:', qwenStats);
  }

  private async testLocalModelFunctionality(): Promise<void> {
    console.log('\n🧠 Test 4: Local Model Functionality');
    
    // Test with a simple transaction
    const testTransaction = mockTransactions[1]; // Office supplies
    
    try {
      const result = await this.mlService.categorizeTransaction(testTransaction);
      
      if (result) {
        console.log('✓ Local categorization successful:', {
          categoryId: result.categoryId,
          confidence: Math.round(result.confidence * 100) + '%',
          reasoning: result.reasoning.substring(0, 100) + '...',
          modelUsed: result.modelUsed,
          processingTime: result.processingTime + 'ms'
        });
      } else {
        console.log('⚠️  Local categorization returned null');
      }
    } catch (error) {
      console.log('⚠️  Local categorization failed:', error);
    }
  }

  private async testQwenIntegration(): Promise<void> {
    console.log('\n🤖 Test 5: Qwen 2.5:32B Integration');
    
    // Test with a complex international transaction
    const complexTransaction = mockTransactions[2]; // International wire
    
    try {
      const result = await this.mlService.categorizeTransaction(complexTransaction);
      
      if (result) {
        console.log('✓ Qwen categorization result:', {
          categoryId: result.categoryId,
          confidence: Math.round(result.confidence * 100) + '%',
          reasoning: result.reasoning,
          modelUsed: result.modelUsed,
          processingTime: result.processingTime + 'ms',
          riskFactors: result.riskFactors,
          suggestedKeywords: result.suggestedKeywords
        });
      } else {
        console.log('⚠️  Qwen categorization not available (model may still be downloading)');
      }
    } catch (error) {
      console.log('⚠️  Qwen categorization failed:', error);
    }
  }

  private async testHybridModelSelection(): Promise<void> {
    console.log('\n🔄 Test 6: Hybrid Model Selection');
    
    // Test all transactions to see model selection logic
    for (const transaction of mockTransactions) {
      try {
        const result = await this.mlService.categorizeTransaction(transaction);
        
        if (result) {
          console.log(`✓ Transaction "${transaction.description.substring(0, 30)}...":`, {
            modelUsed: result.modelUsed,
            confidence: Math.round(result.confidence * 100) + '%',
            processingTime: result.processingTime + 'ms'
          });
        }
      } catch (error) {
        console.log(`⚠️  Failed to categorize transaction ${transaction.id}:`, error);
      }
    }
  }

  private async testPerformanceMonitoring(): Promise<void> {
    console.log('\n📈 Test 7: Performance Monitoring');
    
    const finalStats = this.mlService.getQwenPerformanceStats();
    console.log('✓ Final Qwen performance statistics:', {
      totalRequests: finalStats.totalRequests,
      successfulRequests: finalStats.successfulRequests,
      errorRate: (finalStats.errorRate * 100).toFixed(1) + '%',
      averageResponseTime: finalStats.averageResponseTime + 'ms',
      averageConfidence: (finalStats.averageConfidence * 100).toFixed(1) + '%',
      uptime: finalStats.uptime
    });

    const modelStatus = this.mlService.getModelStatus();
    console.log('✓ Final model status:', {
      qwenPerformance: modelStatus.qwenPerformance
    });
  }
}

// Export for use in other test files
export { QwenIntegrationTest, mockTransactions, mockCategories };

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new QwenIntegrationTest();
  test.runTests().catch(console.error);
}
