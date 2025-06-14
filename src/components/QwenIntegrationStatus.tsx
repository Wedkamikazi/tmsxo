import React, { useState, useEffect, useCallback } from 'react';
import { mlCategorizationService } from '../services/mlCategorizationService';
import './QwenIntegrationStatus.css';

interface QwenStatus {
  available: boolean;
  modelLoaded: boolean;
  loading: boolean;
  error?: string;
}

interface QwenPerformanceStats {
  totalRequests: number;
  successfulRequests: number;
  errorRate: number;
  averageResponseTime: number;
  averageConfidence: number;
  lastUsed: Date | null;
  uptime: string;
}

const QwenIntegrationStatus: React.FC = () => {
  const [status, setStatus] = useState<QwenStatus>({
    available: false,
    modelLoaded: false,
    loading: true
  });
  const [stats, setStats] = useState<QwenPerformanceStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Check model status
      const modelStatus = mlCategorizationService.getModelStatus();
      const performanceStats = mlCategorizationService.getQwenPerformanceStats();
      
      setStatus({
        available: modelStatus.isAvailable,
        modelLoaded: modelStatus.modelLoaded,
        loading: false
      });
      
      setStats(performanceStats);
      
      // Also check Ollama directly
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
          const data = await response.json();
          console.log('Ollama models:', data.models);
        }
      } catch (error) {
        console.log('Ollama not accessible:', error);
      }
      
    } catch (error) {
      console.error('Failed to check Qwen status:', error);
      setStatus({
        available: false,
        modelLoaded: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const getStatusIcon = () => {
    if (status.loading) return '🔄';
    if (status.modelLoaded) return '✅';
    if (status.available) return '⏳';
    return '🔧';
  };

  const getStatusText = () => {
    if (status.loading) return 'Checking Qwen 2.5:32B status...';
    if (status.modelLoaded) return 'Qwen 2.5:32B Ready & Active';
    if (status.available) return 'Qwen 2.5:32B downloading... Using local model';
    return 'Qwen 2.5:32B offline - Using local TensorFlow.js model';
  };

  const getStatusClass = () => {
    if (status.loading) return 'status-loading';
    if (status.modelLoaded) return 'status-ready';
    if (status.available) return 'status-downloading';
    return 'status-offline';
  };

  return (
    <div className="qwen-integration-status">
      <div className="status-header">
        <div className="status-indicator">
          <span className="status-icon">{getStatusIcon()}</span>
          <span className={`status-text ${getStatusClass()}`}>
            {getStatusText()}
          </span>
        </div>
        <button 
          className="refresh-btn"
          onClick={checkStatus}
          disabled={refreshing}
          title="Refresh status"
        >
          {refreshing ? '🔄' : '🔄'}
        </button>
      </div>

      {status.error && (
        <div className="status-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{status.error}</span>
        </div>
      )}

      {stats && (
        <div className="performance-stats">
          <h4>Qwen 2.5:32B Performance</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.totalRequests}</span>
              <span className="stat-label">Total Requests</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.successfulRequests}</span>
              <span className="stat-label">Successful</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{(stats.errorRate * 100).toFixed(1)}%</span>
              <span className="stat-label">Error Rate</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.averageResponseTime}ms</span>
              <span className="stat-label">Avg Response</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{(stats.averageConfidence * 100).toFixed(1)}%</span>
              <span className="stat-label">Avg Confidence</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.uptime}</span>
              <span className="stat-label">Last Used</span>
            </div>
          </div>
        </div>
      )}

      <div className="integration-info">
        <h4>Integration Details</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Model:</span>
            <span className="info-value">Qwen 2.5:32B</span>
          </div>
          <div className="info-item">
            <span className="info-label">Endpoint:</span>
            <span className="info-value">http://localhost:11434</span>
          </div>
          <div className="info-item">
            <span className="info-label">Fallback:</span>
            <span className="info-value">Local TensorFlow.js</span>
          </div>
          <div className="info-item">
            <span className="info-label">Data Privacy:</span>
            <span className="info-value">100% Local</span>
          </div>
        </div>
      </div>

      <div className="integration-benefits">
        <h4>Enhanced Capabilities</h4>
        <ul>
          <li>🎯 Superior accuracy for complex transactions</li>
          <li>🌍 Better international transaction understanding</li>
          <li>🔍 Advanced risk factor identification</li>
          <li>📚 Intelligent keyword suggestions</li>
          <li>⚡ Hybrid processing (fast local + advanced AI)</li>
          <li>🔒 Complete data privacy (no external APIs)</li>
        </ul>
      </div>
    </div>
  );
};

export default QwenIntegrationStatus;
