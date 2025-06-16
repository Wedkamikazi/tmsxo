import React, { useState, useEffect } from 'react';
import { stateManager } from '../../../core/performance/StateManager';
import { isDebugMode, enableDebugMode, disableDebugMode } from '../../../shared/utils/debugging/DebugMode';
import './Settings.css';

export const Settings: React.FC = () => {
  const [currentDebugMode, setCurrentDebugMode] = useState(isDebugMode());
  const [appState, setAppState] = useState(stateManager.getState());
  const [showStateExport, setShowStateExport] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    // Update state display every few seconds
    const interval = setInterval(() => {
      setAppState(stateManager.getState());
      setCurrentDebugMode(isDebugMode());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleDebugMode = () => {
    if (currentDebugMode) {
      disableDebugMode();
      setCurrentDebugMode(false);
      // Force page reload to apply changes
      setTimeout(() => window.location.reload(), 500);
    } else {
      enableDebugMode();
      setCurrentDebugMode(true);
      // Force page reload to apply changes
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const handleEnableDebugModeURL = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('debug', 'true');
    window.location.href = currentUrl.toString();
  };

  const handleResetState = () => {
    if (confirmReset) {
      stateManager.clearState();
      alert('Application state cleared! The page will reload.');
      window.location.reload();
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 5000); // Reset confirmation after 5 seconds
    }
  };

  const handleEmergencyReset = () => {
    if (window.confirm('⚠️ EMERGENCY RESET: This will clear all application data and reload the page. Continue?')) {
      stateManager.emergencyReset();
    }
  };

  const handleExportState = () => {
    const stateData = stateManager.exportState();
    const stateString = JSON.stringify(stateData, null, 2);
    setShowStateExport(true);
    
    // Copy to clipboard
    navigator.clipboard.writeText(stateString).then(() => {
      alert('State data copied to clipboard!');
    }).catch(() => {
      console.log('Fallback: State data logged to console');
      console.log('Application State Export:', stateData);
    });
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  const getTimeSince = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s ago` : `${seconds}s ago`;
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>⚙️ Application Settings</h2>
        <p>Manage application state, debug mode, and system preferences</p>
      </div>

      <div className="settings-sections">
        {/* Debug Mode Section */}
        <div className="settings-section">
          <h3>🔧 Debug Mode Controls</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h4>Current Debug Mode Status</h4>
              <p>Debug mode {currentDebugMode ? 'enables' : 'disables'} mock services and development features</p>
              <div className={`status-badge ${currentDebugMode ? 'enabled' : 'disabled'}`}>
                {currentDebugMode ? '🔧 DEBUG ON' : '🚀 PRODUCTION'}
              </div>
            </div>
            <div className="setting-controls">
              <button 
                onClick={handleToggleDebugMode}
                className={`btn ${currentDebugMode ? 'btn-warning' : 'btn-primary'}`}
              >
                {currentDebugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}
              </button>
              <button 
                onClick={handleEnableDebugModeURL}
                className="btn btn-secondary"
              >
                Enable via URL Parameter
              </button>
            </div>
          </div>
        </div>

        {/* State Management Section */}
        <div className="settings-section">
          <h3>💾 State Management</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h4>Application State Cache</h4>
              <p>Manage persistent application state and performance cache</p>
              <div className="state-info">
                <div className="state-stat">
                  <span className="label">Services Initialized:</span>
                  <span className={`value ${appState.servicesInitialized ? 'success' : 'warning'}`}>
                    {appState.servicesInitialized ? '✅ Yes' : '⏳ No'}
                  </span>
                </div>
                <div className="state-stat">
                  <span className="label">Last Initialization:</span>
                  <span className="value">{formatTimestamp(appState.lastInitializationTime)}</span>
                </div>
                <div className="state-stat">
                  <span className="label">Time Since Init:</span>
                  <span className="value">{getTimeSince(appState.lastInitializationTime)}</span>
                </div>
                <div className="state-stat">
                  <span className="label">Active Tab:</span>
                  <span className="value">{appState.activeTab}</span>
                </div>
                <div className="state-stat">
                  <span className="label">Data Refresh Count:</span>
                  <span className="value">{appState.sessionData.dataRefreshTrigger}</span>
                </div>
              </div>
            </div>
            <div className="setting-controls">
              <button 
                onClick={handleResetState}
                className={`btn ${confirmReset ? 'btn-danger' : 'btn-warning'}`}
              >
                {confirmReset ? '⚠️ Confirm Reset State' : '🗑️ Reset State'}
              </button>
              <button 
                onClick={handleExportState}
                className="btn btn-info"
              >
                📋 Export State
              </button>
            </div>
          </div>
        </div>

        {/* Emergency Controls Section */}
        <div className="settings-section emergency">
          <h3>🚨 Emergency Controls</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h4>Emergency Reset</h4>
              <p className="warning-text">
                ⚠️ <strong>Use only if the application is unresponsive.</strong> This will clear all data and force reload.
              </p>
            </div>
            <div className="setting-controls">
              <button 
                onClick={handleEmergencyReset}
                className="btn btn-danger"
              >
                🚨 Emergency Reset
              </button>
            </div>
          </div>
        </div>

        {/* Performance Info Section */}
        <div className="settings-section">
          <h3>⚡ Performance Info</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h4>Cache Performance</h4>
              <div className="performance-info">
                <div className="performance-stat">
                  <span className="label">Cache Status:</span>
                  <span className={`value ${appState.servicesInitialized ? 'success' : 'warning'}`}>
                    {appState.servicesInitialized ? '🟢 Active' : '🟡 Inactive'}
                  </span>
                </div>
                <div className="performance-stat">
                  <span className="label">Auto Refresh:</span>
                  <span className={`value ${appState.userPreferences.autoRefresh ? 'success' : 'disabled'}`}>
                    {appState.userPreferences.autoRefresh ? '🟢 Enabled' : '🔴 Disabled'}
                  </span>
                </div>
                <div className="performance-stat">
                  <span className="label">Memory Usage:</span>
                  <span className="value">
                    {typeof (window.performance as any)?.memory !== 'undefined' 
                      ? `${Math.round((window.performance as any).memory.usedJSHeapSize / 1024 / 1024)}MB`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* State Export Modal */}
      {showStateExport && (
        <div className="modal-overlay" onClick={() => setShowStateExport(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Application State Export</h3>
              <button onClick={() => setShowStateExport(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p>State data has been copied to clipboard. You can also view it in the browser console.</p>
              <pre className="state-export">
                {JSON.stringify(stateManager.exportState(), null, 2)}
              </pre>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowStateExport(false)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 