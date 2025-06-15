/**
 * Process Controller Utility
 * Handles safe starting and stopping of external processes like Ollama
 */

export interface ProcessResult {
  success: boolean;
  message: string;
  pid?: number;
}

/**
 * Start Ollama process with safety parameters
 * Note: This is a browser-safe implementation that logs commands
 * In a real Electron app, this would execute actual system commands
 */
export const startOllamaProcess = async (): Promise<ProcessResult> => {
  try {
    console.log('🚀 PROCESS CONTROLLER: Starting Ollama with safety parameters');
    console.log('   Command: $env:OLLAMA_ORIGINS="*"; $env:OLLAMA_NUM_PARALLEL="1"; $env:OLLAMA_MAX_LOADED_MODELS="1"; $env:OLLAMA_GPU_OVERHEAD="2048"; ollama serve');
    
    // In a browser environment, we can't actually start processes
    // This would be implemented in an Electron main process or backend service
    
    // Simulate process startup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: 'Ollama start command logged (browser environment)',
      pid: Date.now() // Mock PID
    };
  } catch (error) {
    console.error('❌ Failed to start Ollama:', error);
    return {
      success: false,
      message: `Failed to start Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Stop Ollama process safely
 */
export const stopOllamaProcess = async (): Promise<ProcessResult> => {
  try {
    console.log('🛑 PROCESS CONTROLLER: Stopping Ollama process');
    console.log('   Command: taskkill /F /IM ollama.exe');
    
    // In a browser environment, we can't actually kill processes
    // This would be implemented in an Electron main process or backend service
    
    // Simulate process stop
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      message: 'Ollama stop command logged (browser environment)'
    };
  } catch (error) {
    console.error('❌ Failed to stop Ollama:', error);
    return {
      success: false,
      message: `Failed to stop Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Check if Ollama is running by testing the API endpoint
 */
export const checkOllamaStatus = async (): Promise<{
  isRunning: boolean;
  models?: any[];
  error?: string;
}> => {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        isRunning: true,
        models: data.models || []
      };
    } else {
      return {
        isRunning: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      isRunning: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
};

/**
 * Get detailed model information from Ollama
 */
export const getOllamaModelInfo = async (modelName: string): Promise<{
  success: boolean;
  modelInfo?: any;
  error?: string;
}> => {
  try {
    const response = await fetch(`http://localhost:11434/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (response.ok) {
      const modelInfo = await response.json();
      return {
        success: true,
        modelInfo
      };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get model info'
    };
  }
}; 