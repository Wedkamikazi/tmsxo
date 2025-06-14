import React, { Component, ReactNode, ErrorInfo } from 'react';
import { eventBus } from '../services/eventBus';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * ERROR BOUNDARY COMPONENT
 * Catches JavaScript errors in component tree and prevents app crashes
 * Logs errors for debugging and provides user-friendly fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state to trigger fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Report error to event bus for potential logging/reporting
    eventBus.emit('DATA_CLEARED', {
      error: {
        message: error.message,
        stack: error.stack,
        component: this.props.componentName || 'Unknown',
        errorId: this.state.errorId,
        timestamp: new Date().toISOString()
      }
    }, 'ErrorBoundary');

    // In a production app, you might want to log this to an error reporting service
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Store error details in localStorage for debugging
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        component: this.props.componentName || 'Unknown',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        errorInfo: {
          componentStack: errorInfo.componentStack
        },
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      const existingLogs = JSON.parse(localStorage.getItem('tms_error_logs') || '[]');
      existingLogs.push(errorLog);
      
      // Keep only last 50 error logs
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      localStorage.setItem('tms_error_logs', JSON.stringify(existingLogs));
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  private handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  private handleReload = () => {
    // Reload the entire application
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            
            <h2>Something went wrong</h2>
            <p>
              We're sorry, but something unexpected happened. The error has been logged 
              and will be investigated.
            </p>
            
            {this.state.errorId && (
              <div className="error-id">
                <small>Error ID: {this.state.errorId}</small>
              </div>
            )}

            <div className="error-actions">
              <button onClick={this.handleRetry} className="retry-button">
                Try Again
              </button>
              <button onClick={this.handleReload} className="reload-button">
                Reload App
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <div className="error-stack">
                  <h4>Error Message:</h4>
                  <pre>{this.state.error.message}</pre>
                  
                  <h4>Stack Trace:</h4>
                  <pre>{this.state.error.stack}</pre>
                  
                  {this.state.errorInfo && (
                    <>
                      <h4>Component Stack:</h4>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>

          <style jsx>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 20px;
              background-color: #f8f9fa;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              margin: 20px 0;
            }

            .error-container {
              text-align: center;
              max-width: 500px;
            }

            .error-icon {
              color: #dc3545;
              margin-bottom: 20px;
            }

            .error-container h2 {
              color: #495057;
              margin-bottom: 15px;
              font-size: 1.5rem;
            }

            .error-container p {
              color: #6c757d;
              margin-bottom: 20px;
              line-height: 1.5;
            }

            .error-id {
              margin-bottom: 20px;
              padding: 8px 12px;
              background-color: #e9ecef;
              border-radius: 4px;
              font-family: monospace;
            }

            .error-actions {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin-bottom: 20px;
            }

            .retry-button, .reload-button {
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: background-color 0.2s;
            }

            .retry-button {
              background-color: #007bff;
              color: white;
            }

            .retry-button:hover {
              background-color: #0056b3;
            }

            .reload-button {
              background-color: #6c757d;
              color: white;
            }

            .reload-button:hover {
              background-color: #545b62;
            }

            .error-details {
              text-align: left;
              margin-top: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
            }

            .error-details summary {
              cursor: pointer;
              font-weight: 500;
              margin-bottom: 10px;
            }

            .error-stack h4 {
              margin: 15px 0 5px 0;
              font-size: 14px;
              color: #495057;
            }

            .error-stack pre {
              background-color: #ffffff;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 10px;
              font-size: 12px;
              overflow-x: auto;
              max-height: 200px;
              margin-bottom: 10px;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary componentName={componentName || Component.name}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manually reporting errors
export function useErrorReporter() {
  const reportError = (error: Error, context?: string) => {
    console.error('Manual error report:', error);
    
    // Report to event bus
    eventBus.emit('DATA_CLEARED', {
      manualError: {
        message: error.message,
        stack: error.stack,
        context: context || 'Manual Report',
        timestamp: new Date().toISOString()
      }
    }, 'ErrorReporter');
  };

  return { reportError };
} 