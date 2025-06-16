import React from 'react';
import { unifiedCategorizationService } from '../../analytics/categorization/UnifiedCategorizationService';
import { TensorFlowMethod } from '../../analytics/categorization/tensorFlowMethod';
import './QwenIntegrationStatus.css';

const QwenIntegrationStatus: React.FC = () => {
  const [status, setStatus] = React.useState({
    isAvailable: true,
    modelLoaded: true,
    localModelLoaded: true,
    vocabularySize: 0,
    categoriesCount: 0,
    lastCheck: new Date().toISOString()
  });

  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    result?: any;
    error?: string;
    latency?: number;
  } | null>(null);

  React.useEffect(() => {
    // Get local model status from TensorFlow method
    const getModelStatus = async () => {
      try {
        const tfMethod = new TensorFlowMethod();
        const modelStatus = tfMethod.getModelStatus();
        setStatus(modelStatus);
      } catch (error) {
        console.error('Failed to get model status:', error);
        setStatus({
          isAvailable: false,
          modelLoaded: false,
          localModelLoaded: false,
          vocabularySize: 0,
          categoriesCount: 0,
          lastCheck: new Date().toISOString()
        });
      }
    };
    
    getModelStatus();
  }, []);

  const handleTestCategorization = async () => {
    try {
      // Create test transaction for categorization
      const testTransaction = {
        id: 'test-transaction',
        date: new Date().toISOString(),
        description: 'Test payment to grocery store',
        debitAmount: 45.67,
        creditAmount: 0,
        balance: 1000,
        reference: 'TEST'
      };

      const startTime = performance.now();
      const result = await unifiedCategorizationService.categorizeTransaction(testTransaction);
      const endTime = performance.now();

      setTestResult({
        success: true,
        result: {
          categoryId: result.categoryId,
          confidence: result.confidence,
          reasoning: result.reasoning,
          method: result.method
        },
        latency: Math.round(endTime - startTime)
      });
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <div className="qwen-integration-status">
      <div className="status-header">
        <h2>Local ML Categorization Status</h2>
        <p>Rule-based transaction categorization system - fully local, no external dependencies</p>
      </div>

      <div className="status-grid">
        <div className="status-card">
          <div className="status-card-header">
            <h3>System Status</h3>
            <div className={`status-indicator ${status.isAvailable ? 'active' : 'inactive'}`}>
              {status.isAvailable ? 'Active' : 'Inactive'}
            </div>
          </div>
          
          <div className="status-details">
            <div className="status-row">
              <span className="status-label">Model Type:</span>
              <span className="status-value">Local Rule-Based</span>
            </div>
            <div className="status-row">
              <span className="status-label">Status:</span>
              <span className={`status-value ${status.modelLoaded ? 'success' : 'error'}`}>
                {status.modelLoaded ? 'Operational' : 'Error'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Categories:</span>
              <span className="status-value">{status.categoriesCount}</span>
            </div>
            <div className="status-row">
              <span className="status-label">Last Check:</span>
              <span className="status-value">{new Date(status.lastCheck).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="status-card">
          <div className="status-card-header">
            <h3>Categorization Engine</h3>
          </div>
          
          <div className="status-details">
            <div className="status-row">
              <span className="status-label">Engine Type:</span>
              <span className="status-value">Keyword + Pattern Matching</span>
            </div>
            <div className="status-row">
              <span className="status-label">Processing:</span>
              <span className="status-value success">Real-time</span>
            </div>
            <div className="status-row">
              <span className="status-label">Storage:</span>
              <span className="status-value success">Local Browser Storage</span>
            </div>
            <div className="status-row">
              <span className="status-label">External Connections:</span>
              <span className="status-value success">None (Offline)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="test-section">
        <div className="test-header">
          <h3>Test Categorization</h3>
          <button 
            className="test-button"
            onClick={handleTestCategorization}
          >
            Run Test
          </button>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <div className="test-result-header">
              <span className="test-status">
                {testResult.success ? '✅ Test Passed' : '❌ Test Failed'}
              </span>
              {testResult.latency && (
                <span className="test-latency">
                  {testResult.latency}ms
                </span>
              )}
            </div>
            
            {testResult.success && testResult.result ? (
              <div className="test-details">
                <div className="test-row">
                  <span className="test-label">Category:</span>
                  <span className="test-value">{testResult.result.categoryId}</span>
                </div>
                <div className="test-row">
                  <span className="test-label">Confidence:</span>
                  <span className="test-value">{Math.round(testResult.result.confidence * 100)}%</span>
                </div>
                <div className="test-row">
                  <span className="test-label">Reasoning:</span>
                  <span className="test-value">{testResult.result.reasoning}</span>
                </div>
              </div>
            ) : testResult.error && (
              <div className="test-error">
                <strong>Error:</strong> {testResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="info-section">
        <h3>Local Processing Benefits</h3>
        <ul className="benefits-list">
          <li>🔒 Complete data privacy - no external API calls</li>
          <li>⚡ Instant processing - no network latency</li>
          <li>💾 No data transmission - everything stays local</li>
          <li>🚀 Always available - no service dependencies</li>
          <li>🔧 Customizable rules - adapt to your business</li>
        </ul>
      </div>
    </div>
  );
};

export default QwenIntegrationStatus;
