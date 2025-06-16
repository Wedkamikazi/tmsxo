import React, { useState, useEffect } from 'react';
import { performanceManager, PerformanceMetrics, MemoryStats } from '../core/performance/PerformanceManager';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

interface SystemHealthProps {
  refreshInterval?: number;
}

/**
 * SYSTEM HEALTH MONITOR
 * Production-ready component for monitoring system performance
 * Shows memory usage, performance metrics, and optimization recommendations
 */
export const SystemHealthMonitor: React.FC<SystemHealthProps> = ({ 
  refreshInterval = 5000 
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const report = performanceManager.getPerformanceReport();
        setMetrics(report.metrics);
        setMemoryStats(report.memoryStats);
        setRecommendations(report.recommendations);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to update system metrics:', error);
      }
    };

    // Initial load
    updateMetrics();

    // Set up interval
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleClearCache = () => {
    performanceManager.clearCache();
    // Force immediate update
    const report = performanceManager.getPerformanceReport();
    setMetrics(report.metrics);
    setMemoryStats(report.memoryStats);
    setRecommendations(report.recommendations);
  };

  const getMemoryStatusColor = (percentage: number): string => {
    if (percentage < 50) return '#28a745'; // Green
    if (percentage < 75) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
  };

  const getPerformanceStatusColor = (avgTime: number): string => {
    if (avgTime < 100) return '#28a745'; // Green
    if (avgTime < 500) return '#ffc107'; // Yellow
    return '#dc3545'; // Red
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (!metrics || !memoryStats) {
    return (
      <div className="system-health-loading">
        <div className="loading-spinner"></div>
        <span>Loading system metrics...</span>
      </div>
    );
  }

  return (
    <div className="system-health-monitor">
      <div className="health-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="health-title">
          <div className="health-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <span>System Health</span>
        </div>
        
        <div className="health-summary">
          <div className="metric-badge">
            <span className="metric-label">Memory</span>
            <span 
              className="metric-value"
              style={{ color: getMemoryStatusColor(memoryStats.percentage) }}
            >
              {memoryStats.percentage.toFixed(1)}%
            </span>
          </div>
          
          <div className="metric-badge">
            <span className="metric-label">Avg Response</span>
            <span 
              className="metric-value"
              style={{ color: getPerformanceStatusColor(metrics.averageResponseTime) }}
            >
              {formatDuration(metrics.averageResponseTime)}
            </span>
          </div>
          
          <div className="expand-icon">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6,9 12,15 18,9"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="health-details">
          <div className="metrics-grid">
            {/* Memory Usage */}
            <div className="metric-card">
              <h4>Memory Usage</h4>
              <div className="metric-content">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${memoryStats.percentage}%`,
                      backgroundColor: getMemoryStatusColor(memoryStats.percentage)
                    }}
                  ></div>
                </div>
                <div className="metric-details">
                  <span>{formatBytes(memoryStats.used)} / {formatBytes(memoryStats.total)}</span>
                  <span className="percentage">{memoryStats.percentage.toFixed(1)}%</span>
                </div>
                {memoryStats.usedJSHeapSize && (
                  <div className="js-heap-info">
                    <small>JS Heap: {formatBytes(memoryStats.usedJSHeapSize)}</small>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="metric-card">
              <h4>Performance</h4>
              <div className="metric-content">
                <div className="performance-stats">
                  <div className="stat">
                    <span className="stat-label">Operations</span>
                    <span className="stat-value">{metrics.operationCount.toLocaleString()}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Avg Response</span>
                    <span 
                      className="stat-value"
                      style={{ color: getPerformanceStatusColor(metrics.averageResponseTime) }}
                    >
                      {formatDuration(metrics.averageResponseTime)}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Errors</span>
                    <span className="stat-value error">{metrics.errorCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cache Status */}
            <div className="metric-card">
              <h4>Cache Status</h4>
              <div className="metric-content">
                <div className="cache-stats">
                  <div className="stat">
                    <span className="stat-label">Size</span>
                    <span className="stat-value">{metrics.cacheSize}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Last Cleanup</span>
                    <span className="stat-value">
                      {metrics.lastCleanup.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <button 
                  className="clear-cache-btn"
                  onClick={handleClearCache}
                  title="Clear performance cache"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul className="recommendation-list">
                {recommendations.map((rec, index) => (
                  <li key={index} className="recommendation-item">
                    <div className="recommendation-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    </div>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="last-updated">
              <small>Last updated: {lastUpdated.toLocaleTimeString()}</small>
            </div>
          )}
        </div>
      )}

      <style>{`
        .system-health-monitor {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          margin: 10px 0;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .system-health-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px;
          color: #6c757d;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e9ecef;
          border-top: 2px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .health-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #ffffff;
          border-bottom: 1px solid #dee2e6;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .health-header:hover {
          background: #f8f9fa;
        }

        .health-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #495057;
        }

        .health-icon {
          color: #007bff;
        }

        .health-summary {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .metric-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .metric-label {
          font-size: 11px;
          color: #6c757d;
          text-transform: uppercase;
          font-weight: 500;
        }

        .metric-value {
          font-size: 14px;
          font-weight: 600;
        }

        .expand-icon {
          transition: transform 0.2s;
          color: #6c757d;
        }

        .health-details {
          padding: 16px;
          background: #ffffff;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .metric-card {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          padding: 12px;
        }

        .metric-card h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background-color: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .metric-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: #6c757d;
        }

        .percentage {
          font-weight: 600;
        }

        .js-heap-info {
          margin-top: 4px;
          color: #6c757d;
        }

        .performance-stats, .cache-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
        }

        .stat-value {
          font-size: 12px;
          font-weight: 600;
          color: #495057;
        }

        .stat-value.error {
          color: #dc3545;
        }

        .clear-cache-btn {
          margin-top: 8px;
          padding: 4px 8px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .clear-cache-btn:hover {
          background: #0056b3;
        }

        .recommendations {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e9ecef;
        }

        .recommendations h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
        }

        .recommendation-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 6px 0;
          font-size: 13px;
          color: #495057;
        }

        .recommendation-icon {
          color: #ffc107;
          margin-top: 2px;
        }

        .last-updated {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e9ecef;
          text-align: center;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};

// Wrap with error boundary for production safety
export default function WrappedSystemHealthMonitor(props: SystemHealthProps) {
  return (
    <ErrorBoundary componentName="SystemHealthMonitor">
      <SystemHealthMonitor {...props} />
    </ErrorBoundary>
  );
} 