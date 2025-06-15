# Treasury Management System - Termination Tools

This document describes the emergency termination tools available for completely shutting down all active servers, nodes, and processes related to the Treasury Management System.

## 🚨 Emergency Termination Scripts

### Windows PowerShell (Recommended)

```powershell
.\terminate-all.ps1
```

### Cross-Platform Node.js

```bash
node terminate-all.js
```

### Verification Script

```powershell
.\verify-termination.ps1
```

## 📋 What Gets Terminated

### Processes

- **Node.js processes** (`node.exe`, `npm.exe`)
- **React Development Server** (running on port 3000)
- **Ollama processes** (`ollama.exe`)
- **Process Controller Server** (running on port 3001)
- **React Scripts** and related build processes

### Ports Freed

- **Port 3000** - React Development Server
- **Port 3001** - Process Controller Server  
- **Port 11434** - Ollama API Server

### System Resources (Enhanced Cleanup System)

#### **🧹 Centralized Cleanup Manager** (`src/services/cleanupManager.ts`)

- **TensorFlow.js Models** - All registered ML models properly disposed
- **React Component Resources** - Component-scoped cleanup with priority management
- **Timers & Intervals** - All registered timers and intervals cleared
- **Event Listeners** - All registered DOM event listeners removed
- **Web Workers** - All registered background workers terminated
- **Custom Resources** - User-defined disposable resources cleaned up
- **Memory Pressure Management** - Emergency cleanup triggered at 90% memory usage
- **Resource Statistics** - Cleanup operation metrics and reporting

#### **⚛️ React Cleanup Hooks** (`src/hooks/useCleanup.ts`)

- **Component Lifecycle Management** - Automatic cleanup on component unmount
- **TensorFlow Model Cleanup** - Specialized hooks for ML model disposal
- **Timer Management** - Simplified timer and interval cleanup
- **Event Listener Cleanup** - Automated event listener registration and cleanup
- **Resource Registration** - Component-scoped resource tracking

#### **🧠 Enhanced ML Services**

- **ML Categorization Service** - All TensorFlow models and caches cleared
- **Enhanced ML Orchestrator** - Model registry and vocabulary mappings cleared
- **Performance Manager** - Model memory tracking and cleanup
- **Predictive Analytics** - All prediction models and caches disposed
- **Natural Language Service** - NLP models and embeddings cleared

#### **🛡️ System Safety Manager** (`src/utils/systemSafetyManager.ts`)

- **Process Registry** - All registered processes tracked and terminated
- **Memory Monitoring** - Real-time memory usage tracking stopped
- **Health Monitoring** - System health checks terminated
- **Emergency Handlers** - All emergency cleanup handlers executed
- **Duplicate Prevention** - Process duplication checks disabled

#### **🎯 Service Orchestrator**

- **Service Lifecycle** - All managed services gracefully shutdown
- **Event Bus** - All event subscriptions cleared
- **Cross-Tab Sync** - Inter-tab communication terminated
- **Data Synchronization** - All sync operations stopped

## 🛠️ Usage Instructions

### Quick Termination (Windows)

1. Open PowerShell in the project directory
2. Run: `.\terminate-all.ps1`
3. Wait for completion message
4. Optionally verify with: `.\verify-termination.ps1`

### Quick Termination (Cross-Platform)

1. Open terminal in the project directory
2. Run: `node terminate-all.js`
3. Wait for completion message

### From Within the Application

```typescript
import { terminateAllSystems } from './src/utils/systemTerminator';
import { cleanupManager } from './src/services/cleanupManager';

// Comprehensive system termination
const report = await terminateAllSystems();
console.log('Termination Report:', report);

// Emergency cleanup only
cleanupManager.performEmergencyCleanup();

// Component-specific cleanup
cleanupManager.cleanupComponent('ComponentName');
```

### Using React Cleanup Hooks

```typescript
import { useCleanup, useTensorFlowCleanup, useTimerCleanup } from './src/hooks/useCleanup';

function MyComponent() {
  // Automatic cleanup on unmount
  const cleanup = useCleanup({ componentName: 'MyComponent' });
  const tfCleanup = useTensorFlowCleanup('MyComponent');
  const timerCleanup = useTimerCleanup('MyComponent');
  
  // Register resources for automatic cleanup
  const handleCreateModel = () => {
    const model = createTensorFlowModel();
    tfCleanup.registerModel('my-model', model);
  };
  
  const handleCreateTimer = () => {
    timerCleanup.createTimer('my-timer', callback, 5000);
  };
  
  // Resources automatically cleaned up on unmount
}
```

## 📊 Enhanced Termination Report

The system provides a comprehensive termination report with detailed cleanup statistics:

```typescript
interface TerminationReport {
  timestamp: string;
  totalProcesses: number;
  terminatedProcesses: number;
  errors: string[];
  duration: number;
  status: 'success' | 'partial' | 'failed';
  details: {
    reactDevServer: boolean;
    ollamaProcess: boolean;
    processController: boolean;
    tensorflowModels: boolean;
    webWorkers: boolean;
    timersIntervals: boolean;
    eventListeners: boolean;
    serviceOrchestrator: boolean;
    cleanupManager: boolean;
    systemSafety: boolean;
  };
  // Enhanced cleanup statistics
  cleanupStats: {
    totalResourcesRegistered: number;
    resourcesDisposed: number;
    memoryFreed: number;
    componentsCleanedUp: number;
    emergencyCleanups: number;
    errors: number;
    lastCleanup: string;
    resourcesByType: {
      'tensorflow-model': number;
      'timer': number;
      'interval': number;
      'event-listener': number;
      'web-worker': number;
      'custom': number;
    };
    resourcesByComponent: Record<string, number>;
  };
}
```

## 🔧 Troubleshooting

### If Processes Won't Terminate

1. **Use Emergency Cleanup**: `cleanupManager.performEmergencyCleanup()`
2. Run the script with administrator privileges
3. Check System Safety Manager: `systemSafetyManager.performCleanup()`
4. Use Task Manager to manually kill stubborn processes
5. Restart your computer as a last resort

### If Memory Leaks Persist

1. **Check Cleanup Stats**: `cleanupManager.getCleanupStats()`
2. **Component Analysis**: `cleanupManager.getResourcesByComponent()`
3. **Resource Type Analysis**: `cleanupManager.getResourcesByType()`
4. **Force Manual Cleanup**: `cleanupManager.performCleanup('manual')`
5. **Monitor Memory**: Browser DevTools → Memory tab

### If Ports Remain Occupied

1. Check what's using the port: `netstat -ano | findstr :3000`
2. Kill the process by PID: `taskkill /F /PID <pid>`
3. Wait a few seconds and try again

### If TensorFlow Models Won't Dispose

1. **Check Registered Models**: `cleanupManager.getResourcesByType()['tensorflow-model']`
2. **Force Model Cleanup**: Individual model disposal through cleanup manager
3. **Emergency TensorFlow Cleanup**: Aggressive cleanup mode
4. **Browser Garbage Collection**: Force GC if available

### If Ollama Won't Stop

1. Check if Ollama service is running: `sc query ollama`
2. Stop the service: `sc stop ollama`
3. Or use the process controller: `POST http://localhost:3001/api/ollama/stop`
4. Use System Safety Manager: `systemSafetyManager.unregisterProcess('ollama')`

## ⚠️ Safety Features

- **No Data Loss** - Only terminates processes, doesn't delete files
- **Graceful Shutdown** - Attempts clean disposal before force termination
- **Priority-Based Cleanup** - High-priority resources preserved during emergency cleanup
- **Component Isolation** - Component-scoped cleanup prevents interference
- **Error Handling** - Continues termination even if some steps fail
- **Verification** - Provides detailed confirmation of successful termination
- **Memory Monitoring** - Automatic cleanup triggered by memory pressure
- **Resource Tracking** - Comprehensive statistics and monitoring
- **Rollback Safe** - Can restart the system normally after termination

## 🔄 Restarting After Termination

After successful termination, you can restart the system normally:

```bash
# Start the development server
npm start

# Or start with the process controller
cd server
node processController.js
```

The cleanup system will automatically reinitialize:
- Cleanup Manager will restart with fresh state
- System Safety Manager will register new processes
- React components will register resources using cleanup hooks
- TensorFlow models will be registered for proper disposal

## 📝 Files Created/Updated

### Core Termination System

- `terminate-all.ps1` - PowerShell termination script
- `terminate-all.js` - Node.js termination script  
- `verify-termination.ps1` - Verification script
- `src/utils/systemTerminator.ts` - Programmatic termination utility

### Enhanced Cleanup System (New in Task 1.2)

- `src/services/cleanupManager.ts` - **Centralized cleanup management**
- `src/hooks/useCleanup.ts` - **React cleanup hooks**
- `src/utils/systemSafetyManager.ts` - Enhanced with cleanup integration
- Enhanced ML services with cleanup integration:
  - `src/services/mlCategorizationService.ts`
  - `src/services/enhancedMLOrchestrator.ts`
- Updated React components with cleanup hooks:
  - `src/components/TransactionCategorization.tsx`
  - `src/components/MLIntegrationDashboard.tsx`

## 🚨 When to Use

Use these termination tools when:

- Development server becomes unresponsive
- Ports are occupied by zombie processes
- **Memory leaks detected in TensorFlow models**
- **React components not cleaning up properly**
- **Resource exhaustion (50+ registered resources)**
- **Memory usage exceeds 90% (emergency cleanup)**
- System resources are not being freed properly
- You need a clean slate for debugging
- Preparing for system maintenance
- Emergency shutdown is required

## ⚡ Quick Reference

| Command | Purpose |
|---------|---------|
| `.\terminate-all.ps1` | Complete system termination (Windows) |
| `node terminate-all.js` | Complete system termination (Cross-platform) |
| `.\verify-termination.ps1` | Verify termination success |
| `cleanupManager.performEmergencyCleanup()` | **Emergency resource cleanup** |
| `cleanupManager.getCleanupStats()` | **View cleanup statistics** |
| `cleanupManager.cleanupComponent('Name')` | **Component-specific cleanup** |
| `systemSafetyManager.performCleanup()` | **Safety manager cleanup** |
| `npm start` | Restart development server |
| `netstat -ano \| findstr :3000` | Check port 3000 usage |

## 📊 Monitoring Commands

| Command | Purpose |
|---------|---------|
| `cleanupManager.getResourcesByType()` | **View resources by type** |
| `cleanupManager.getResourcesByComponent()` | **View resources by component** |
| `cleanupManager.markResourceAccessed('id')` | **Update resource access time** |
| `systemSafetyManager.getSystemHealth()` | **Check system health** |
| `systemSafetyManager.getRunningProcesses()` | **View registered processes** |

---

**⚠️ Important**: These tools are designed for development environments. The enhanced cleanup system provides comprehensive resource management and should prevent most termination issues. Use emergency termination with caution in production settings.

**✅ Recent Enhancement**: Task 1.2 implementation provides automatic resource cleanup, memory leak prevention, and component-scoped resource management, significantly reducing the need for emergency termination.
