"use strict";
/**
 * SINGLETON MANAGER INTEGRATION TEST
 * Tests that the singleton manager works with existing services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingletonIntegrationTester = exports.testSingletonIntegration = void 0;
const singletonManager_1 = require("./singletonManager");
class SingletonIntegrationTester {
    constructor() {
        this.results = [];
    }
    async runTests() {
        console.log('🧪 Starting Singleton Manager Integration Tests...');
        this.testBasicFunctionality();
        this.testSingletonPattern();
        this.testDisposal();
        this.testErrorHandling();
        await this.testExistingServiceRegistration();
        this.printResults();
        return this.results;
    }
    testBasicFunctionality() {
        try {
            // Register a test service
            (0, singletonManager_1.registerSingleton)('testBasicService', () => ({
                id: Math.random(),
                name: 'BasicTestService'
            }));
            // Get the service
            const service1 = (0, singletonManager_1.getSingleton)('testBasicService');
            const service2 = (0, singletonManager_1.getSingleton)('testBasicService');
            // Verify it's the same instance
            if (service1 === service2) {
                this.addResult('Basic Functionality', 'PASS', 'Same instance returned correctly');
            }
            else {
                this.addResult('Basic Functionality', 'FAIL', 'Different instances returned');
            }
            // Check stats
            const stats = singletonManager_1.singletonManager.getStats();
            if (stats.totalSingletons > 0) {
                this.addResult('Stats Tracking', 'PASS', `Tracking ${stats.totalSingletons} singletons`);
            }
            else {
                this.addResult('Stats Tracking', 'FAIL', 'No singletons tracked');
            }
        }
        catch (error) {
            this.addResult('Basic Functionality', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }
    testSingletonPattern() {
        try {
            let creationCount = 0;
            (0, singletonManager_1.registerSingleton)('testSingletonPattern', () => {
                creationCount++;
                return { creationCount };
            });
            // Get service multiple times
            (0, singletonManager_1.getSingleton)('testSingletonPattern');
            (0, singletonManager_1.getSingleton)('testSingletonPattern');
            (0, singletonManager_1.getSingleton)('testSingletonPattern');
            if (creationCount === 1) {
                this.addResult('Singleton Pattern', 'PASS', 'Service created only once');
            }
            else {
                this.addResult('Singleton Pattern', 'FAIL', `Service created ${creationCount} times`);
            }
        }
        catch (error) {
            this.addResult('Singleton Pattern', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }
    testDisposal() {
        try {
            let disposeCalled = false;
            (0, singletonManager_1.registerSingleton)('testDisposal', () => ({
                dispose: () => { disposeCalled = true; }
            }));
            // Create and dispose
            (0, singletonManager_1.getSingleton)('testDisposal');
            const disposed = singletonManager_1.singletonManager.dispose('testDisposal');
            if (disposed && disposeCalled) {
                this.addResult('Disposal', 'PASS', 'Service disposed correctly');
            }
            else {
                this.addResult('Disposal', 'FAIL', `Disposed: ${disposed}, Dispose called: ${disposeCalled}`);
            }
            // Try to get disposed service (should fail)
            try {
                (0, singletonManager_1.getSingleton)('testDisposal');
                this.addResult('Disposal Error Handling', 'FAIL', 'Should have thrown error for disposed service');
            }
            catch (_a) {
                this.addResult('Disposal Error Handling', 'PASS', 'Correctly threw error for disposed service');
            }
        }
        catch (error) {
            this.addResult('Disposal', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }
    testErrorHandling() {
        try {
            // Try to get non-existent service
            try {
                (0, singletonManager_1.getSingleton)('nonExistentService');
                this.addResult('Error Handling', 'FAIL', 'Should have thrown error for non-existent service');
            }
            catch (_a) {
                this.addResult('Error Handling', 'PASS', 'Correctly threw error for non-existent service');
            }
        }
        catch (error) {
            this.addResult('Error Handling', 'FAIL', `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }
    async testExistingServiceRegistration() {
        try {
            // Test that we can register existing services without breaking them
            (0, singletonManager_1.initializeSingletonManager)();
            const stats = singletonManager_1.singletonManager.getStats();
            if (stats.totalSingletons >= 21) { // We expect at least 21 services registered
                this.addResult('Existing Service Registration', 'PASS', `Registered ${stats.totalSingletons} existing services`);
            }
            else {
                this.addResult('Existing Service Registration', 'FAIL', `Only ${stats.totalSingletons} services registered, expected at least 21`);
            }
            // Test getting a few key services
            const services = ['eventBus', 'localStorageManager', 'unifiedDataService'];
            let successCount = 0;
            for (const serviceName of services) {
                try {
                    const service = (0, singletonManager_1.getSingleton)(serviceName);
                    if (service) {
                        successCount++;
                    }
                }
                catch (error) {
                    console.warn(`Failed to get ${serviceName}:`, error);
                }
            }
            if (successCount === services.length) {
                this.addResult('Core Service Access', 'PASS', 'All core services accessible');
            }
            else {
                this.addResult('Core Service Access', 'FAIL', `Only ${successCount}/${services.length} core services accessible`);
            }
        }
        catch (error) {
            this.addResult('Existing Service Registration', 'FAIL', `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
    }
    addResult(test, status, message) {
        this.results.push({ test, status, message });
        const icon = status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${test}: ${message}`);
    }
    printResults() {
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const total = this.results.length;
        console.log('\n📊 Test Results Summary:');
        console.log(`${passed}/${total} tests passed`);
        if (passed === total) {
            console.log('🎉 All tests passed! Singleton Manager is working correctly.');
        }
        else {
            console.log('⚠️ Some tests failed. Check implementation.');
            this.results.filter(r => r.status === 'FAIL').forEach(result => {
                console.log(`❌ ${result.test}: ${result.message}`);
            });
        }
    }
}
exports.SingletonIntegrationTester = SingletonIntegrationTester;
// Export test runner
const testSingletonIntegration = async () => {
    const tester = new SingletonIntegrationTester();
    return tester.runTests();
};
exports.testSingletonIntegration = testSingletonIntegration;
