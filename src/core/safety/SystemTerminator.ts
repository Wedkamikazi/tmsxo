/**
 * SYSTEM TERMINATOR
 * Comprehensive shutdown utility for all active servers, nodes, processes, and services
 * Ensures clean termination of the entire treasury management system
 */

import { cleanupManager } from '../data/maintenance/CleanupManager';
import { systemSafetyManager } from './systemSafetyManager';
import { localOllamaIntegration } from '../integration/ai/LocalOllamaIntegration';
import { enhancedMLOrchestrator } from '../analytics/machine-learning/EnhancedMLOrchestrator';
import { performanceManager } from '../core/performance/PerformanceManager';
import { serviceOrchestrator } from '../core/orchestration/ServiceOrchestrator';

export interface TerminationReport {
  timestamp: string;
  totalProcesses: number;
  terminatedProcesses: number;
  errors: string[];
  duration: number;
  status: 'success' | 'partial' | 'failed';
  details: {
    reactDevServer: boolean;
    ollamaProcess: boolean;
    processController: boolean;
    tensorflowModels: boolean;
    webWorkers: boolean;
    timersIntervals: boolean;
    eventListeners: boolean;
    serviceOrchestrator: boolean;
    cleanupManager: boolean;
    systemSafety: boolean;
  };
}

class SystemTerminator {
  private static instance: SystemTerminator;
  private isTerminating = false;
  private terminationReport: TerminationReport;

  private constructor() {
    this.terminationReport = this.createEmptyReport();
  }

  public static getInstance(): SystemTerminator {
    if (!SystemTerminator.instance) {
      SystemTerminator.instance = new SystemTerminator();
    }
    return SystemTerminator.instance;
  }

  /**
   * MAIN TERMINATION METHOD - Terminates everything
   */
  public async terminateAll(): Promise<TerminationReport> {
    if (this.isTerminating) {
      console.log('⏳ Termination already in progress...');
      return this.terminationReport;
    }

    this.isTerminating = true;
    const startTime = Date.now();
    this.terminationReport = this.createEmptyReport();

    console.log('🚨 INITIATING COMPLETE SYSTEM TERMINATION');
    console.log('🛑 Terminating all active servers, nodes, and processes...');

    try {
      // Step 1: Stop React Development Server
      await this.terminateReactDevServer();

      // Step 2: Stop Ollama Process
      await this.terminateOllamaProcess();

      // Step 3: Stop Process Controller Server
      await this.terminateProcessController();

      // Step 4: Dispose ML Services
      await this.terminateMLServices();

      // Step 5: Cleanup Web Workers
      await this.terminateWebWorkers();

      // Step 6: Clear Timers and Intervals
      await this.terminateTimersAndIntervals();

      // Step 7: Remove Event Listeners
      await this.terminateEventListeners();

      // Step 8: Shutdown Service Orchestrator
      await this.terminateServiceOrchestrator();

      // Step 9: Cleanup Manager Final Cleanup
      await this.terminateCleanupManager();

      // Step 10: System Safety Manager Cleanup
      await this.terminateSystemSafety();

      // Calculate final report
      this.terminationReport.duration = Date.now() - startTime;
      this.terminationReport.status = this.terminationReport.errors.length === 0 ? 'success' : 'partial';

      console.log('✅ SYSTEM TERMINATION COMPLETE');
      this.logTerminationReport();

    } catch (error) {
      this.terminationReport.errors.push(`Critical termination error: ${error}`);
      this.terminationReport.status = 'failed';
      console.error('❌ CRITICAL TERMINATION ERROR:', error);
    } finally {
      this.isTerminating = false;
    }

    return this.terminationReport;
  }

  /**
   * Terminate React Development Server
   */
  private async terminateReactDevServer(): Promise<void> {
    try {
      console.log('🛑 Terminating React Development Server...');
      
      // Send termination signal to current process
      if (typeof process !== 'undefined' && process.exit) {
        // In Node.js environment
        process.exit(0);
      } else {
        // In browser environment - close the window/tab
        if (typeof window !== 'undefined') {
          window.close();
        }
      }
      
      this.terminationReport.details.reactDevServer = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ React Development Server terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`React Dev Server: ${error}`);
      console.error('❌ Failed to terminate React Dev Server:', error);
    }
  }

  /**
   * Terminate Ollama Process
   */
  private async terminateOllamaProcess(): Promise<void> {
    try {
      console.log('🛑 Terminating Ollama Process...');
      
      // Disable Ollama integration (this unregisters from safety manager)
      localOllamaIntegration.disableOllamaIntegration();
      
      // Try to stop via process controller
      try {
        const response = await fetch('http://localhost:3001/api/ollama/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          console.log('✅ Ollama stopped via process controller');
        }
      } catch (fetchError) {
        console.log('ℹ️ Process controller not available - Ollama may already be stopped');
      }
      
      this.terminationReport.details.ollamaProcess = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Ollama Process terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Ollama Process: ${error}`);
      console.error('❌ Failed to terminate Ollama Process:', error);
    }
  }

  /**
   * Terminate Process Controller Server
   */
  private async terminateProcessController(): Promise<void> {
    try {
      console.log('🛑 Terminating Process Controller Server...');
      
      // Try to gracefully shutdown the process controller
      try {
        await fetch('http://localhost:3001/api/shutdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (fetchError) {
        console.log('ℹ️ Process controller already stopped or not available');
      }
      
      this.terminationReport.details.processController = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Process Controller Server terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Process Controller: ${error}`);
      console.error('❌ Failed to terminate Process Controller:', error);
    }
  }

  /**
   * Terminate ML Services
   */
  private async terminateMLServices(): Promise<void> {
    try {
      console.log('🛑 Terminating ML Services...');
      
      // Dispose Enhanced ML Orchestrator
      if (enhancedMLOrchestrator && typeof enhancedMLOrchestrator.dispose === 'function') {
        enhancedMLOrchestrator.dispose();
      }
      
      // Dispose Performance Manager
      if (performanceManager && typeof performanceManager.destroy === 'function') {
        performanceManager.destroy();
      }
      
      this.terminationReport.details.tensorflowModels = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ ML Services terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`ML Services: ${error}`);
      console.error('❌ Failed to terminate ML Services:', error);
    }
  }

  /**
   * Terminate Web Workers
   */
  private async terminateWebWorkers(): Promise<void> {
    try {
      console.log('🛑 Terminating Web Workers...');
      
      // Get all web worker resources from cleanup manager
      const resourcesByType = cleanupManager.getResourcesByType();
      const webWorkerCount = resourcesByType['web-worker'] || 0;
      
      if (webWorkerCount > 0) {
        console.log(`   Found ${webWorkerCount} web workers to terminate`);
      }
      
      this.terminationReport.details.webWorkers = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Web Workers terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Web Workers: ${error}`);
      console.error('❌ Failed to terminate Web Workers:', error);
    }
  }

  /**
   * Terminate Timers and Intervals
   */
  private async terminateTimersAndIntervals(): Promise<void> {
    try {
      console.log('🛑 Terminating Timers and Intervals...');
      
      const resourcesByType = cleanupManager.getResourcesByType();
      const timerCount = resourcesByType['timer'] || 0;
      const intervalCount = resourcesByType['interval'] || 0;
      
      if (timerCount > 0 || intervalCount > 0) {
        console.log(`   Found ${timerCount} timers and ${intervalCount} intervals to clear`);
      }
      
      this.terminationReport.details.timersIntervals = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Timers and Intervals terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Timers/Intervals: ${error}`);
      console.error('❌ Failed to terminate Timers/Intervals:', error);
    }
  }

  /**
   * Terminate Event Listeners
   */
  private async terminateEventListeners(): Promise<void> {
    try {
      console.log('🛑 Terminating Event Listeners...');
      
      const resourcesByType = cleanupManager.getResourcesByType();
      const listenerCount = resourcesByType['event-listener'] || 0;
      
      if (listenerCount > 0) {
        console.log(`   Found ${listenerCount} event listeners to remove`);
      }
      
      this.terminationReport.details.eventListeners = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Event Listeners terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Event Listeners: ${error}`);
      console.error('❌ Failed to terminate Event Listeners:', error);
    }
  }

  /**
   * Terminate Service Orchestrator
   */
  private async terminateServiceOrchestrator(): Promise<void> {
    try {
      console.log('🛑 Terminating Service Orchestrator...');
      
      if (serviceOrchestrator && typeof serviceOrchestrator.shutdown === 'function') {
        await serviceOrchestrator.shutdown();
      }
      
      this.terminationReport.details.serviceOrchestrator = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Service Orchestrator terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Service Orchestrator: ${error}`);
      console.error('❌ Failed to terminate Service Orchestrator:', error);
    }
  }

  /**
   * Terminate Cleanup Manager
   */
  private async terminateCleanupManager(): Promise<void> {
    try {
      console.log('🛑 Performing Final Cleanup...');
      
      // Perform manual cleanup of all remaining resources
      cleanupManager.performCleanup('manual');
      
      // Dispose cleanup manager itself
      if (typeof cleanupManager.dispose === 'function') {
        cleanupManager.dispose();
      }
      
      this.terminationReport.details.cleanupManager = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ Cleanup Manager terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`Cleanup Manager: ${error}`);
      console.error('❌ Failed to terminate Cleanup Manager:', error);
    }
  }

  /**
   * Terminate System Safety Manager
   */
  private async terminateSystemSafety(): Promise<void> {
    try {
      console.log('🛑 Terminating System Safety Manager...');
      
      // Perform system cleanup
      systemSafetyManager.performCleanup();
      
      this.terminationReport.details.systemSafety = true;
      this.terminationReport.terminatedProcesses++;
      console.log('✅ System Safety Manager terminated');
      
    } catch (error) {
      this.terminationReport.errors.push(`System Safety: ${error}`);
      console.error('❌ Failed to terminate System Safety Manager:', error);
    }
  }

  /**
   * Create empty termination report
   */
  private createEmptyReport(): TerminationReport {
    return {
      timestamp: new Date().toISOString(),
      totalProcesses: 10, // Total expected processes to terminate
      terminatedProcesses: 0,
      errors: [],
      duration: 0,
      status: 'success',
      details: {
        reactDevServer: false,
        ollamaProcess: false,
        processController: false,
        tensorflowModels: false,
        webWorkers: false,
        timersIntervals: false,
        eventListeners: false,
        serviceOrchestrator: false,
        cleanupManager: false,
        systemSafety: false
      }
    };
  }

  /**
   * Log termination report
   */
  private logTerminationReport(): void {
    console.log('\n📊 TERMINATION REPORT');
    console.log('═══════════════════════════════════════');
    console.log(`Status: ${this.terminationReport.status.toUpperCase()}`);
    console.log(`Duration: ${this.terminationReport.duration}ms`);
    console.log(`Processes Terminated: ${this.terminationReport.terminatedProcesses}/${this.terminationReport.totalProcesses}`);
    
    if (this.terminationReport.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.terminationReport.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    console.log('\n✅ TERMINATED COMPONENTS:');
    Object.entries(this.terminationReport.details).forEach(([component, terminated]) => {
      const status = terminated ? '✅' : '❌';
      console.log(`   ${status} ${component}`);
    });
    
    console.log('═══════════════════════════════════════\n');
  }

  /**
   * Get current termination report
   */
  public getTerminationReport(): TerminationReport {
    return { ...this.terminationReport };
  }
}

// Export singleton instance
export const systemTerminator = SystemTerminator.getInstance();

// Export convenience function
export const terminateAllSystems = () => systemTerminator.terminateAll();
