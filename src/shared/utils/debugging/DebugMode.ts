// Debug Mode Configuration
// Dynamic debug mode detection based on environment and user preferences

// Function to detect debug mode from multiple sources
const detectDebugMode = (): boolean => {
  // Skip detection if window is not available (SSR/Node.js environments)
  if (typeof window === 'undefined') {
    return false;
  }

  // Check URL parameter: ?debug=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug') === 'true') {
    return true;
  }

  // Check localStorage setting
  if (localStorage.getItem('debugMode') === 'true') {
    return true;
  }

  // Check global window flag (for programmatic control)
  if ((window as any).__TREASURY_DEBUG_MODE === true) {
    return true;
  }

  // Check if running in development mode
  if (process.env.NODE_ENV === 'development') {
    // In development, default to TRUE for faster startup (prevents TensorFlow hanging)
    return localStorage.getItem('debugMode') !== 'false'; // Only disable if explicitly set to false
  }

  // Production default: false
  return false;
};

// Initialize debug mode and set up logging
const initializeDebugMode = (): boolean => {
  const isDebug = detectDebugMode();
  
  if (typeof window !== 'undefined') {
    // Set window flag for consistency
    (window as any).__TREASURY_DEBUG_MODE = isDebug;
    
    // Update localStorage to match current state
    localStorage.setItem('debugMode', isDebug.toString());
    
    // Log debug mode status
    if (isDebug) {
      console.log('🔧 Treasury Debug Mode: ENABLED');
      console.log('📋 Debug Mode Sources Checked:');
      console.log('  • URL Parameter (?debug=true):', new URLSearchParams(window.location.search).get('debug') === 'true');
      console.log('  • LocalStorage (debugMode):', localStorage.getItem('debugMode') === 'true');
      console.log('  • Environment:', process.env.NODE_ENV);
    } else {
      console.log('🚀 Treasury Debug Mode: DISABLED - Full functionality enabled');
    }
  }
  
  return isDebug;
};

// Export function to check debug mode (dynamic)
export const isDebugMode = (): boolean => {
  return detectDebugMode();
};

// Export debug mode flag as constant (evaluated once at module load)
export const DEBUG_MODE_ACTIVE = initializeDebugMode();

// Export function to toggle debug mode programmatically
export const toggleDebugMode = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const currentMode = detectDebugMode();
  const newMode = !currentMode;
  
  // Update localStorage
  localStorage.setItem('debugMode', newMode.toString());
  
  // Update window flag
  (window as any).__TREASURY_DEBUG_MODE = newMode;
  
  console.log(`🔄 Debug Mode Toggled: ${newMode ? 'ENABLED' : 'DISABLED'}`);
  console.log('⚠️  Page refresh required for services to reinitialize');
  
  return newMode;
};

// Export function to enable debug mode
export const enableDebugMode = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('debugMode', 'true');
    (window as any).__TREASURY_DEBUG_MODE = true;
    console.log('🔧 Debug Mode: ENABLED');
    console.log('⚠️  Page refresh required for services to reinitialize');
  }
};

// Export function to disable debug mode  
export const disableDebugMode = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('debugMode', 'false');
    (window as any).__TREASURY_DEBUG_MODE = false;
    console.log('🚀 Debug Mode: DISABLED');
    console.log('⚠️  Page refresh required for services to reinitialize');
  }
}; 