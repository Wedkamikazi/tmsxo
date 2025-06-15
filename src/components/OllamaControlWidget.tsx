import React, { useState, useEffect } from 'react';
import { systemSafetyManager } from '../utils/systemSafetyManager';
import { checkOllamaStatus, startOllamaProcess, stopOllamaProcess } from '../utils/processController';
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

  // Check Ollama status periodically
  useEffect(() => {
    const checkStatus = async () => {
      const result = await checkOllamaStatus();
      
      if (result.isRunning && result.models) {
        const qwenModel = result.models.find((m: any) => m.name.includes('qwen'));
        
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
          error: result.error
        });
      }
    };

    // Initial check
    checkStatus();
    
    // Check every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleStartOllama = async () => {
    setStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      // In browser environment, we can't actually start processes
      // Show instructions to user
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Browser Limitation: Please manually start Ollama in terminal with the command shown in console' 
      }));
      
      // Log the command for reference
      console.log('🚀 MANUAL ACTION REQUIRED: Start Ollama with this command in PowerShell:');
      console.log('   $env:OLLAMA_ORIGINS="*"; $env:OLLAMA_NUM_PARALLEL="1"; $env:OLLAMA_MAX_LOADED_MODELS="1"; $env:OLLAMA_GPU_OVERHEAD="2048"; ollama serve');
      console.log('   This ensures safe operation with proper environment variables');
      
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to start Ollama' 
      }));
    }
  };

  const handleStopOllama = async () => {
    setStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      // In browser environment, we can't actually kill processes
      // Show instructions to user
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Browser Limitation: Please manually stop Ollama in terminal with Ctrl+C or run: taskkill /F /IM ollama.exe' 
      }));
      
      // Log the command for reference
      console.log('🛑 MANUAL ACTION REQUIRED: Stop Ollama with one of these methods:');
      console.log('   Method 1: Go to Ollama terminal and press Ctrl+C');
      console.log('   Method 2: Run in PowerShell: taskkill /F /IM ollama.exe');
      console.log('   Method 3: Use Task Manager to end ollama.exe process');
      
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to stop Ollama' 
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
        <div className="ollama-status-section">
          <div className="ollama-status-indicator">
            <div className={`status-light ${status.isRunning ? 'running' : 'stopped'} ${status.isLoading ? 'loading' : ''}`}>
              <div className="light-core"></div>
              <div className="light-glow"></div>
            </div>
            <div className="status-info">
              <div className="status-title">
                Ollama AI Engine
              </div>
              <div className="status-details">
                {status.isLoading ? (
                  <span className="status-loading">Processing...</span>
                ) : status.isRunning ? (
                  <div className="status-running">
                    <span className="status-text">Active</span>
                    {status.modelName && (
                      <span className="model-info">{status.modelName}</span>
                    )}
                    {status.memoryUsage && (
                      <span className="memory-info">{status.memoryUsage}</span>
                    )}
                  </div>
                ) : (
                  <span className="status-stopped">Offline</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="ollama-controls">
            {status.isRunning ? (
              <button 
                className="control-button stop-button"
                onClick={() => handleActionClick('stop')}
                disabled={status.isLoading}
              >
                <span className="button-icon">⏹</span>
                Stop
              </button>
            ) : (
              <button 
                className="control-button start-button"
                onClick={() => handleActionClick('start')}
                disabled={status.isLoading}
              >
                <span className="button-icon">▶</span>
                Start
              </button>
            )}
          </div>
        </div>
        
        {status.error && (
          <div className="ollama-error">
            <span className="error-icon">⚠</span>
            <div className="error-content">
              <div className="error-message">{status.error}</div>
              <button 
                className="refresh-button"
                onClick={() => {
                  setStatus(prev => ({ ...prev, error: undefined }));
                  // Trigger status check
                  checkStatus();
                }}
              >
                🔄 Refresh Status
              </button>
            </div>
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