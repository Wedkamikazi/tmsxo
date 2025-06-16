import React from 'react';

/**
 * COMPREHENSIVE INFINITE LOOP PROTECTION SYSTEM
 * Monitors React components for infinite re-render loops
 * Prevents browser crashes and system hangs
 * CRITICAL SAFETY FEATURE - DO NOT REMOVE
 */

import React from 'react';

interface ComponentRenderMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
  warningIssued: boolean;
  errorThrown: boolean;
}

interface InfiniteLoopAnalysis {
  component: string;
  renderCount: number;
  renderFrequency: number; // renders per second
  averageRenderTime: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timeWindow: number;
  lastAnalysisTime: number;
}

class InfiniteLoopProtectionSystem {
  private componentMetrics = new Map<string, ComponentRenderMetrics>();
  private analysisHistory: InfiniteLoopAnalysis[] = [];
  private isEnabled = true;
  private maxHistorySize = 100;
  
  // Thresholds for different severity levels
  private readonly THRESHOLDS = {
    WARNING_RENDERS: 25,      // Warning at 25 renders
    DANGER_RENDERS: 50,       // Danger at 50 renders  
    CRITICAL_RENDERS: 100,    // Critical at 100 renders
    EMERGENCY_RENDERS: 200,   // Emergency stop at 200 renders
    TIME_WINDOW: 5000,        // 5 second analysis window
    HIGH_FREQUENCY: 10,       // 10+ renders per second = high risk
    CRITICAL_FREQUENCY: 20    // 20+ renders per second = critical risk
  };

  /**
   * Track a component render and detect infinite loops
   */
  public trackComponentRender(componentName: string, renderStartTime?: number): void {
    if (!this.isEnabled) return;

    const now = Date.now();
    const startTime = renderStartTime || now;
    const renderTime = now - startTime;

    let metrics = this.componentMetrics.get(componentName);
    
    if (!metrics) {
      metrics = {
        renderCount: 0,
        lastRenderTime: now,
        averageRenderTime: 0,
        totalRenderTime: 0,
        warningIssued: false,
        errorThrown: false
      };
      this.componentMetrics.set(componentName, metrics);
    }

    // Update metrics
    metrics.renderCount++;
    metrics.lastRenderTime = now;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;

    // Analyze render patterns within time window
    const analysis = this.analyzeRenderPattern(componentName, metrics);
    
    // Take action based on analysis
    this.handleRenderAnalysis(componentName, metrics, analysis);

    // Clean up old metrics periodically
    this.cleanupOldMetrics();
  }

  /**
   * Analyze render patterns to detect infinite loops
   */
  private analyzeRenderPattern(componentName: string, metrics: ComponentRenderMetrics): InfiniteLoopAnalysis {
    const now = Date.now();
    const timeWindow = this.THRESHOLDS.TIME_WINDOW;
    
    // Calculate render frequency within the time window
    const recentRenders = this.countRecentRenders(componentName, timeWindow);
    const renderFrequency = (recentRenders / timeWindow) * 1000; // renders per second

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (renderFrequency >= this.THRESHOLDS.CRITICAL_FREQUENCY || metrics.renderCount >= this.THRESHOLDS.CRITICAL_RENDERS) {
      riskLevel = 'critical';
    } else if (renderFrequency >= this.THRESHOLDS.HIGH_FREQUENCY || metrics.renderCount >= this.THRESHOLDS.DANGER_RENDERS) {
      riskLevel = 'high';
    } else if (metrics.renderCount >= this.THRESHOLDS.WARNING_RENDERS) {
      riskLevel = 'medium';
    }

    const analysis: InfiniteLoopAnalysis = {
      component: componentName,
      renderCount: metrics.renderCount,
      renderFrequency,
      averageRenderTime: metrics.averageRenderTime,
      riskLevel,
      timeWindow,
      lastAnalysisTime: now
    };

    // Store analysis in history
    this.analysisHistory.push(analysis);
    if (this.analysisHistory.length > this.maxHistorySize) {
      this.analysisHistory.shift();
    }

    return analysis;
  }

  /**
   * Count renders within a specific time window
   */
  private countRecentRenders(componentName: string, timeWindow: number): number {
    const now = Date.now();
    const cutoffTime = now - timeWindow;
    
    return this.analysisHistory.filter(analysis => 
      analysis.component === componentName && 
      analysis.lastAnalysisTime >= cutoffTime
    ).length;
  }

  /**
   * Handle render analysis and take appropriate action
   */
  private handleRenderAnalysis(componentName: string, metrics: ComponentRenderMetrics, analysis: InfiniteLoopAnalysis): void {
    const { renderCount, riskLevel, renderFrequency } = analysis;

    switch (riskLevel) {
      case 'medium':
        if (!metrics.warningIssued) {
          console.warn(`⚠️ RENDER WARNING: Component "${componentName}" has rendered ${renderCount} times`);
          console.warn(`   Render frequency: ${renderFrequency.toFixed(2)} renders/second`);
          console.warn(`   Check useEffect dependency arrays and state updates`);
          metrics.warningIssued = true;
        }
        break;

      case 'high':
        console.error(`🚨 HIGH RISK: Component "${componentName}" showing infinite loop symptoms`);
        console.error(`   Renders: ${renderCount}, Frequency: ${renderFrequency.toFixed(2)}/second`);
        console.error(`   Average render time: ${metrics.averageRenderTime.toFixed(2)}ms`);
        console.error(`   IMMEDIATE ACTION REQUIRED - Check dependency arrays!`);
        this.logDiagnosticInfo(componentName, analysis);
        break;

      case 'critical':
        if (!metrics.errorThrown && renderCount >= this.THRESHOLDS.EMERGENCY_RENDERS) {
          console.error(`💥 EMERGENCY STOP: Component "${componentName}" infinite loop detected!`);
          console.error(`   Renders: ${renderCount}, Frequency: ${renderFrequency.toFixed(2)}/second`);
          console.error(`   STOPPING INFINITE LOOP TO PREVENT BROWSER CRASH`);
          
          this.logFullDiagnosticReport(componentName, analysis);
          metrics.errorThrown = true;
          
          // Force stop the infinite loop
          throw new Error(
            `INFINITE LOOP PREVENTED: Component "${componentName}" rendered ${renderCount} times ` +
            `at ${renderFrequency.toFixed(2)} renders/second. Browser crash prevented.`
          );
        }
        break;
    }
  }

  /**
   * Log diagnostic information for troubleshooting
   */
  private logDiagnosticInfo(componentName: string, analysis: InfiniteLoopAnalysis): void {
    console.group(`🔍 DIAGNOSTIC INFO: ${componentName}`);
    console.log(`Render Count: ${analysis.renderCount}`);
    console.log(`Render Frequency: ${analysis.renderFrequency.toFixed(2)} renders/second`);
    console.log(`Average Render Time: ${analysis.averageRenderTime.toFixed(2)}ms`);
    console.log(`Risk Level: ${analysis.riskLevel.toUpperCase()}`);
    console.log(`Time Window: ${analysis.timeWindow}ms`);
    
    console.log(`\n🛠️ COMMON INFINITE LOOP CAUSES:`);
    console.log(`1. Objects in useEffect dependency arrays that change every render`);
    console.log(`2. State updates inside useEffect without proper dependencies`);
    console.log(`3. Cleanup functions (timerCleanup, eventCleanup) in dependency arrays`);
    console.log(`4. Non-memoized objects passed as props`);
    console.log(`5. Functions created inside render without useCallback`);
    
    console.groupEnd();
  }

  /**
   * Log comprehensive diagnostic report
   */
  private logFullDiagnosticReport(componentName: string, analysis: InfiniteLoopAnalysis): void {
    console.group(`🚨 EMERGENCY DIAGNOSTIC REPORT: ${componentName}`);
    
    // Current analysis
    console.log(`CURRENT ANALYSIS:`, analysis);
    
    // Historical data
    const componentHistory = this.analysisHistory.filter(a => a.component === componentName);
    console.log(`RENDER HISTORY (last ${componentHistory.length} analyses):`, componentHistory);
    
    // System state
    console.log(`SYSTEM STATE:`);
    console.log(`- Total monitored components: ${this.componentMetrics.size}`);
    console.log(`- Analysis history size: ${this.analysisHistory.length}`);
    console.log(`- Protection system enabled: ${this.isEnabled}`);
    
    // Memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      console.log(`MEMORY USAGE:`);
      console.log(`- Used JS Heap: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Total JS Heap: ${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Heap Size Limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
    }
    
    console.groupEnd();
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const cleanupThreshold = 30000; // 30 seconds
    
    for (const [componentName, metrics] of this.componentMetrics.entries()) {
      if (now - metrics.lastRenderTime > cleanupThreshold) {
        this.componentMetrics.delete(componentName);
      }
    }
  }

  /**
   * Reset metrics for a specific component
   */
  public resetComponentMetrics(componentName: string): void {
    this.componentMetrics.delete(componentName);
    this.analysisHistory = this.analysisHistory.filter(a => a.component !== componentName);
    console.log(`🔄 Reset metrics for component: ${componentName}`);
  }

  /**
   * Get current metrics for all components
   */
  public getAllMetrics(): Map<string, ComponentRenderMetrics> {
    return new Map(this.componentMetrics);
  }

  /**
   * Get analysis history
   */
  public getAnalysisHistory(): InfiniteLoopAnalysis[] {
    return [...this.analysisHistory];
  }

  /**
   * Enable or disable the protection system
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🛡️ Infinite Loop Protection: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Get system status
   */
  public getSystemStatus() {
    return {
      enabled: this.isEnabled,
      monitoredComponents: this.componentMetrics.size,
      analysisHistorySize: this.analysisHistory.length,
      thresholds: this.THRESHOLDS
    };
  }
}

// Export singleton instance
export const infiniteLoopProtection = new InfiniteLoopProtectionSystem();

/**
 * React Hook for automatic infinite loop protection
 */
export function useInfiniteLoopProtection(componentName: string): void {
  const renderStartTime = Date.now();
  
  // Track this render
  infiniteLoopProtection.trackComponentRender(componentName, renderStartTime);
}

/**
 * HOC to automatically add infinite loop protection to any component
 */
export function withInfiniteLoopProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const ComponentWithProtection: React.FC<P> = (props) => {
    const name = componentName || WrappedComponent.displayName || WrappedComponent.name || 'UnknownComponent';
    
    useInfiniteLoopProtection(name);
    
    return React.createElement(WrappedComponent, props);
  };

  ComponentWithProtection.displayName = `withInfiniteLoopProtection(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;
  
  return ComponentWithProtection;
} 