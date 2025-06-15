import React, { useState, useEffect } from 'react';
import './OllamaControlWidget.css';

interface OllamaStatus {
  isRunning: boolean;
  isLoading: boolean;
  modelName?: string;
  memoryUsage?: string;
  error?: string;
}

const OllamaControlWidget: React.FC = () => {
  const [status, setStatus] = useState<OllamaStatus>({
    isRunning: false,
    isLoading: false
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'start' | 'stop' | null>(null);

  // Check Ollama status using process controller
  const checkStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/ollama/status');
      const data = await response.json();
      
      if (data.isRunning && data.models) {
        const qwenModel = data.models.find((m: any) => m.name.includes('qwen'));
        
        setStatus({
          isRunning: true,
          isLoading: false,
          modelName: qwenModel?.name || 'Unknown Model',
          memoryUsage: qwenModel?.size ? `${Math.round(qwenModel.size / 1024 / 1024 / 1024 * 100) / 100} GB` : undefined
        });
      } else {
        setStatus({
          isRunning: false,
          isLoading: false,
          error: data.error
        });
      }
    } catch (error) {
      setStatus({
        isRunning: false,
        isLoading: false,
        error: 'Process controller not available - Start the backend server'
      });
    }
  };

  // Check status only on mount - no more annoying 5-second polling
  useEffect(() => {
    checkStatus();
  }, []);

  const handleStartOllama = async () => {
    setStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch('http://localhost:3001/api/ollama/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Ollama started successfully:', result.message);
        // Wait a moment then check status
        setTimeout(() => {
          checkStatus();
        }, 2000);
      } else {
        setStatus(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: result.message 
        }));
      }
      
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to start Ollama - Is the process controller running?' 
      }));
    }
  };

  const handleStopOllama = async () => {
    setStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch('http://localhost:3001/api/ollama/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Ollama stopped successfully:', result.message);
        setStatus({
          isRunning: false,
          isLoading: false
        });
      } else {
        setStatus(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: result.message 
        }));
      }
      
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to stop Ollama - Is the process controller running?' 
      }));
    }
  };

  const handleActionClick = (action: 'start' | 'stop') => {
    setPendingAction(action);
    setShowConfirmDialog(true);
  };

  const confirmAction = async () => {
    setShowConfirmDialog(false);
    
    if (pendingAction === 'start') {
      await handleStartOllama();
    } else if (pendingAction === 'stop') {
      await handleStopOllama();
    }
    
    setPendingAction(null);
  };

  const cancelAction = () => {
    setShowConfirmDialog(false);
    setPendingAction(null);
  };

  return (
    <>
      <div className="ollama-control-widget">
        <div className="ai-status-bar">
          <div className="ai-status-left">
            <div className="ai-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 0-8-3-8-6s3-6 8-6c0-2 2-4 4-4s4 2 4 4c5 0 8 3 8 6s-3 6-8 6c0 2-2 4-4 4s-4-2-4-4z" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            </div>
            <div className="ai-status-info">
              <span className="ai-label">AI Engine</span>
              <div className="ai-status-badge">
                <div className={`status-dot ${status.isRunning ? 'active' : 'inactive'} ${status.isLoading ? 'loading' : ''}`}></div>
                <span className="status-text">
                  {status.isLoading ? 'Starting...' : status.isRunning ? 'Ready' : 'Offline'}
                </span>
                {status.modelName && status.isRunning && (
                  <span className="model-name">({status.modelName})</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="ai-controls">
            {status.isRunning ? (
              <button 
                className="ai-btn stop-btn"
                onClick={() => handleActionClick('stop')}
                disabled={status.isLoading}
                title="Stop AI Engine"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </button>
            ) : (
              <button 
                className="ai-btn start-btn"
                onClick={() => handleActionClick('start')}
                disabled={status.isLoading}
                title="Start AI Engine"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </button>
            )}
            
            <button 
              className="ai-btn refresh-btn"
              onClick={checkStatus}
              disabled={status.isLoading}
              title="Refresh Status"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10" />
                <polyline points="1,20 1,14 7,14" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64l-.85 1.92" />
                <path d="M3.51 15a9 9 0 0 0 14.85 3.36l.85-1.92" />
              </svg>
            </button>
          </div>
        </div>
        
        {status.error && (
          <div className="ai-error-notice">
            <div className="error-icon">⚠</div>
            <span className="error-text">{status.error}</span>
            <button 
              className="error-dismiss"
              onClick={() => setStatus(prev => ({ ...prev, error: undefined }))}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="confirmation-overlay">
          <div className="confirmation-dialog">
            <div className="dialog-header">
              <h3>Confirm Action</h3>
            </div>
            <div className="dialog-content">
              <p>
                {pendingAction === 'start' 
                  ? 'Start Ollama AI Engine? This will enable enhanced AI features for transaction categorization.'
                  : 'Stop Ollama AI Engine? The system will continue working with built-in TensorFlow.js models.'
                }
              </p>
              <div className="safety-notice">
                <span className="safety-icon">🛡️</span>
                Safety protocols will be enforced to prevent duplicate instances.
              </div>
            </div>
            <div className="dialog-actions">
              <button 
                className="dialog-button cancel-button"
                onClick={cancelAction}
              >
                Cancel
              </button>
              <button 
                className="dialog-button confirm-button"
                onClick={confirmAction}
              >
                {pendingAction === 'start' ? 'Start Ollama' : 'Stop Ollama'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OllamaControlWidget; 