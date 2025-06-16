"use strict";
// Debug Mode Configuration
// Dynamic debug mode detection based on environment and user preferences
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableDebugMode = exports.enableDebugMode = exports.toggleDebugMode = exports.DEBUG_MODE_ACTIVE = exports.isDebugMode = void 0;
// Function to detect debug mode from multiple sources
const detectDebugMode = () => {
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
    if (window.__TREASURY_DEBUG_MODE === true) {
        return true;
    }
    // Check if running in development mode
    if (process.env.NODE_ENV === 'development') {
        // In development, default to false unless explicitly enabled
        return false;
    }
    // Production default: false
    return false;
};
// Initialize debug mode and set up logging
const initializeDebugMode = () => {
    const isDebug = detectDebugMode();
    if (typeof window !== 'undefined') {
        // Set window flag for consistency
        window.__TREASURY_DEBUG_MODE = isDebug;
        // Update localStorage to match current state
        localStorage.setItem('debugMode', isDebug.toString());
        // Log debug mode status
        if (isDebug) {
            console.log('🔧 Treasury Debug Mode: ENABLED');
            console.log('📋 Debug Mode Sources Checked:');
            console.log('  • URL Parameter (?debug=true):', new URLSearchParams(window.location.search).get('debug') === 'true');
            console.log('  • LocalStorage (debugMode):', localStorage.getItem('debugMode') === 'true');
            console.log('  • Environment:', process.env.NODE_ENV);
        }
        else {
            console.log('🚀 Treasury Debug Mode: DISABLED - Full functionality enabled');
        }
    }
    return isDebug;
};
// Export function to check debug mode (dynamic)
const isDebugMode = () => {
    return detectDebugMode();
};
exports.isDebugMode = isDebugMode;
// Export debug mode flag as constant (evaluated once at module load)
exports.DEBUG_MODE_ACTIVE = initializeDebugMode();
// Export function to toggle debug mode programmatically
const toggleDebugMode = () => {
    if (typeof window === 'undefined') {
        return false;
    }
    const currentMode = detectDebugMode();
    const newMode = !currentMode;
    // Update localStorage
    localStorage.setItem('debugMode', newMode.toString());
    // Update window flag
    window.__TREASURY_DEBUG_MODE = newMode;
    console.log(`🔄 Debug Mode Toggled: ${newMode ? 'ENABLED' : 'DISABLED'}`);
    console.log('⚠️  Page refresh required for services to reinitialize');
    return newMode;
};
exports.toggleDebugMode = toggleDebugMode;
// Export function to enable debug mode
const enableDebugMode = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('debugMode', 'true');
        window.__TREASURY_DEBUG_MODE = true;
        console.log('🔧 Debug Mode: ENABLED');
        console.log('⚠️  Page refresh required for services to reinitialize');
    }
};
exports.enableDebugMode = enableDebugMode;
// Export function to disable debug mode  
const disableDebugMode = () => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('debugMode', 'false');
        window.__TREASURY_DEBUG_MODE = false;
        console.log('🚀 Debug Mode: DISABLED');
        console.log('⚠️  Page refresh required for services to reinitialize');
    }
};
exports.disableDebugMode = disableDebugMode;
