/**
 * Quick Qwen Integration Test Runner
 * Tests the current ML categorization service integration
 */

// Mock the required modules for testing
const mockCategorizationService = {
  getAllCategories: () => [
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
      id: 'cat_uncategorized',
      name: 'Uncategorized',
      description: 'Transactions that need manual categorization',
      keywords: [],
      color: '#757575'
    }
  ]
};

// Test Ollama connectivity
async function testOllamaConnectivity() {
  console.log('🔗 Testing Ollama Connectivity...');
  
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Ollama is running');
      console.log('📋 Available models:', data.models?.map(m => m.name) || 'None');
      return true;
    } else {
      console.log('❌ Ollama responded with error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Ollama not accessible:', error.message);
    return false;
  }
}

// Test Qwen 2.5:32B model availability
async function testQwenModel() {
  console.log('\n🤖 Testing Qwen 2.5:32B Model...');
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5:32b',
        prompt: 'Test prompt for model availability',
        stream: false,
        options: {
          num_predict: 10
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Qwen 2.5:32B model is available and responding');
      console.log('📝 Test response:', data.response?.substring(0, 100) + '...');
      return true;
    } else {
      const errorText = await response.text();
      console.log('❌ Qwen 2.5:32B model not available:', errorText);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to test Qwen model:', error.message);
    return false;
  }
}

// Test transaction categorization with Qwen
async function testTransactionCategorization() {
  console.log('\n💰 Testing Transaction Categorization...');
  
  const testTransaction = {
    id: 'test-1',
    date: '2024-06-14',
    description: 'INTERNATIONAL WIRE TRANSFER TO VENDOR ABC CORP LONDON',
    debitAmount: 15000.00,
    creditAmount: null,
    balance: 85000.00,
    reference: 'WIRE240614001',
    accountId: 'acc-1'
  };

  const categories = mockCategorizationService.getAllCategories();
  const categoryList = categories.map(cat => 
    `${cat.id}: ${cat.name} - ${cat.description} (keywords: ${cat.keywords?.join(', ') || 'none'})`
  ).join('\n');

  const prompt = `You are an expert financial transaction categorization AI with deep knowledge of treasury management.

TRANSACTION TO CATEGORIZE:
Description: "${testTransaction.description}"
Amount: -${testTransaction.debitAmount}
Date: ${testTransaction.date}
Reference: ${testTransaction.reference}
Balance After: ${testTransaction.balance}

AVAILABLE CATEGORIES:
${categoryList}

CATEGORIZATION GUIDELINES:
1. Prioritize exact keyword matches in transaction description
2. Consider transaction amount patterns (large international transfer)
3. Apply treasury management best practices
4. Factor in business context and compliance requirements

RESPONSE FORMAT (JSON only, no additional text):
{
  "categoryId": "selected_category_id",
  "confidence": 0.85,
  "reasoning": "Detailed explanation including keyword matches and business context",
  "alternativeCategories": [
    {"categoryId": "alt_category_id", "confidence": 0.65}
  ],
  "riskFactors": ["any potential misclassification risks"],
  "suggestedKeywords": ["additional keywords to improve future categorization"]
}`;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5:32b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.05,
          top_k: 5,
          top_p: 0.85,
          num_predict: 800,
          repeat_penalty: 1.1,
          num_ctx: 4096,
          num_thread: 8,
          stop: ["\n\n", "Human:", "Assistant:", "```"],
          system: "You are a specialized financial AI focused on accurate transaction categorization for treasury management systems."
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Qwen categorization successful');
      
      // Parse the JSON response
      try {
        const cleanedResponse = data.response
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();

        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          console.log('📊 Categorization Result:', {
            categoryId: result.categoryId,
            confidence: Math.round(result.confidence * 100) + '%',
            reasoning: result.reasoning,
            riskFactors: result.riskFactors,
            suggestedKeywords: result.suggestedKeywords
          });
          return true;
        } else {
          console.log('⚠️  Could not parse JSON from response:', cleanedResponse);
          return false;
        }
      } catch (parseError) {
        console.log('❌ Failed to parse categorization result:', parseError.message);
        console.log('📝 Raw response:', data.response);
        return false;
      }
    } else {
      console.log('❌ Categorization request failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Categorization test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runIntegrationTests() {
  console.log('🚀 Qwen 2.5:32B Integration Test Suite');
  console.log('=' .repeat(50));

  const results = {
    ollama: false,
    qwen: false,
    categorization: false
  };

  // Test 1: Ollama connectivity
  results.ollama = await testOllamaConnectivity();

  // Test 2: Qwen model availability (only if Ollama is running)
  if (results.ollama) {
    results.qwen = await testQwenModel();
  }

  // Test 3: Transaction categorization (only if Qwen is available)
  if (results.qwen) {
    results.categorization = await testTransactionCategorization();
  }

  // Summary
  console.log('\n📋 Test Results Summary:');
  console.log('=' .repeat(30));
  console.log(`Ollama Service: ${results.ollama ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Qwen 2.5:32B Model: ${results.qwen ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Transaction Categorization: ${results.categorization ? '✅ PASS' : '❌ FAIL'}`);

  if (results.categorization) {
    console.log('\n🎉 All tests passed! Qwen 2.5:32B integration is working correctly.');
  } else if (results.qwen) {
    console.log('\n⚠️  Qwen model is available but categorization needs debugging.');
  } else if (results.ollama) {
    console.log('\n⚠️  Ollama is running but Qwen 2.5:32B model is not available.');
    console.log('💡 The model may still be downloading. Check with: ollama list');
  } else {
    console.log('\n❌ Ollama service is not running. Start it with: ollama serve');
  }

  return results;
}

// Run the tests
if (typeof window === 'undefined') {
  // Node.js environment
  const fetch = require('node-fetch');
  runIntegrationTests().catch(console.error);
} else {
  // Browser environment
  window.runQwenTests = runIntegrationTests;
  console.log('🌐 Tests available in browser. Run: runQwenTests()');
}
