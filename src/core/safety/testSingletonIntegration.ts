/**
 * SINGLETON MANAGER INTEGRATION TEST
 * Tests that the singleton manager works with existing services
 */

import { singletonManager, registerSingleton, getSingleton, initializeSingletonManager } from './singletonManager';

// Test interface
interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
}

class SingletonIntegrationTester {
  private results: TestResult[] = [];

  async runTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Singleton Manager Integration Tests...');

    this.testBasicFunctionality();
    this.testSingletonPattern();
    this.testDisposal();
    this.testErrorHandling();
    await this.testExistingServiceRegistration();

    this.printResults();
    return this.results;
  }

  private testBasicFunctionality(): void {
    try {
      // Register a test service
      registerSingleton('testBasicService', () => ({
        id: Math.random(),
        name: 'BasicTestService'
      }));

      // Get the service
      const service1 = getSingleton('testBasicService');
      const service2 = getSingleton('testBasicService');

      // Verify it's the same instance
      if (service1 === service2) {
        this.addResult('Basic Functionality', 'PASS', 'Same instance returned correctly');
      } else {
        this.addResult('Basic Functionality', 'FAIL', 'Different instances returned');
      }

      // Check stats
      const stats = singletonManager.getStats();
      if (stats.totalSingletons > 0) {
        this.addResult('Stats Tracking', 'PASS', `Tracking ${stats.totalSingletons} singletons`);
      } else {
        this.addResult('Stats Tracking', 'FAIL', 'No singletons tracked');
      }

    } catch (error) {
      this.addResult('Basic Functionality', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private testSingletonPattern(): void {
    try {
      let creationCount = 0;
      
      registerSingleton('testSingletonPattern', () => {
        creationCount++;
        return { creationCount };
      });

      // Get service multiple times
      getSingleton('testSingletonPattern');
      getSingleton('testSingletonPattern');
      getSingleton('testSingletonPattern');

      if (creationCount === 1) {
        this.addResult('Singleton Pattern', 'PASS', 'Service created only once');
      } else {
        this.addResult('Singleton Pattern', 'FAIL', `Service created ${creationCount} times`);
      }

    } catch (error) {
      this.addResult('Singleton Pattern', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private testDisposal(): void {
    try {
      let disposeCalled = false;
      
      registerSingleton('testDisposal', () => ({
        dispose: () => { disposeCalled = true; }
      }));

      // Create and dispose
      getSingleton('testDisposal');
      const disposed = singletonManager.dispose('testDisposal');

      if (disposed && disposeCalled) {
        this.addResult('Disposal', 'PASS', 'Service disposed correctly');
      } else {
        this.addResult('Disposal', 'FAIL', `Disposed: ${disposed}, Dispose called: ${disposeCalled}`);
      }

      // Try to get disposed service (should fail)
      try {
        getSingleton('testDisposal');
        this.addResult('Disposal Error Handling', 'FAIL', 'Should have thrown error for disposed service');
      } catch {
        this.addResult('Disposal Error Handling', 'PASS', 'Correctly threw error for disposed service');
      }

    } catch (error) {
      this.addResult('Disposal', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private testErrorHandling(): void {
    try {
      // Try to get non-existent service
      try {
        getSingleton('nonExistentService');
        this.addResult('Error Handling', 'FAIL', 'Should have thrown error for non-existent service');
      } catch {
        this.addResult('Error Handling', 'PASS', 'Correctly threw error for non-existent service');
      }

    } catch (error) {
      this.addResult('Error Handling', 'FAIL', `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testExistingServiceRegistration(): Promise<void> {
    try {
      // Test that we can register existing services without breaking them
      initializeSingletonManager();
      
      const stats = singletonManager.getStats();
      if (stats.totalSingletons >= 21) { // We expect at least 21 services registered
        this.addResult('Existing Service Registration', 'PASS', `Registered ${stats.totalSingletons} existing services`);
      } else {
        this.addResult('Existing Service Registration', 'FAIL', `Only ${stats.totalSingletons} services registered, expected at least 21`);
      }

      // Test getting a few key services
      const services = ['eventBus', 'localStorageManager', 'unifiedDataService'];
      let successCount = 0;

      for (const serviceName of services) {
        try {
          const service = getSingleton(serviceName);
          if (service) {
            successCount++;
          }
        } catch (error) {
          console.warn(`Failed to get ${serviceName}:`, error);
        }
      }

      if (successCount === services.length) {
        this.addResult('Core Service Access', 'PASS', 'All core services accessible');
      } else {
        this.addResult('Core Service Access', 'FAIL', `Only ${successCount}/${services.length} core services accessible`);
      }

    } catch (error) {
      this.addResult('Existing Service Registration', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private addResult(test: string, status: 'PASS' | 'FAIL', message: string): void {
    this.results.push({ test, status, message });
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const total = this.results.length;
    
    console.log('\n📊 Test Results Summary:');
    console.log(`${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Singleton Manager is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check implementation.');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`❌ ${result.test}: ${result.message}`);
      });
    }
  }
}

// Export test runner
export const testSingletonIntegration = async (): Promise<TestResult[]> => {
  const tester = new SingletonIntegrationTester();
  return tester.runTests();
};

// Export for manual testing
export { SingletonIntegrationTester }; 