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
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          const qwenModel = data.models?.find((m: any) => m.name.includes('qwen'));
          
          setStatus({
            isRunning: true,
            isLoading: false,
            modelName: qwenModel?.name || 'Unknown Model',
            memoryUsage: qwenModel?.size ? `${Math.round(qwenModel.size / 1024 / 1024 / 1024 * 100) / 100} GB` : undefined
          });
        } else {
          setStatus({
            isRunning: false,
            isLoading: false
          });
        }
      } catch (error) {
        setStatus({
          isRunning: false,
          isLoading: false
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
      // Register with safety manager first
      const registered = await systemSafetyManager.registerProcess('ollama', 11434);
      
      if (!registered) {
        setStatus(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Safety violation: Ollama already running or port in use' 
        }));
        return;
      }

      // Note: In a real implementation, you'd execute this command:
      // $env:OLLAMA_ORIGINS="*"; $env:OLLAMA_NUM_PARALLEL="1"; $env:OLLAMA_MAX_LOADED_MODELS="1"; $env:OLLAMA_GPU_OVERHEAD="2048"; Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
      console.log('🚀 Starting Ollama with safety parameters...');
      
      // Simulate startup delay
      setTimeout(() => {
        setStatus({
          isRunning: true,
          isLoading: false,
          modelName: 'Starting...'
        });
      }, 2000);

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
      // Use safety manager to stop Ollama
      await systemSafetyManager.stopProcess('ollama');
      
      setStatus({
        isRunning: false,
        isLoading: false
      });
      
      console.log('🛑 Ollama stopped safely');
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
            {status.error}
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