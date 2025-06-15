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

### System Resources

- **TensorFlow.js Models** - All ML models disposed
- **Web Workers** - All background workers terminated
- **Timers & Intervals** - All scheduled tasks cleared
- **Event Listeners** - All DOM event listeners removed
- **Service Orchestrator** - All managed services shutdown
- **Cleanup Manager** - Final resource cleanup performed
- **System Safety Manager** - Process registry cleared

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

// Terminate everything programmatically
const report = await terminateAllSystems();
console.log('Termination Report:', report);
```

## 📊 Termination Report

The system provides a detailed termination report showing:

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
}
```

## 🔧 Troubleshooting

### If Processes Won't Terminate

1. Run the script with administrator privileges
2. Use Task Manager to manually kill stubborn processes
3. Restart your computer as a last resort

### If Ports Remain Occupied

1. Check what's using the port: `netstat -ano | findstr :3000`
2. Kill the process by PID: `taskkill /F /PID <pid>`
3. Wait a few seconds and try again

### If Ollama Won't Stop

1. Check if Ollama service is running: `sc query ollama`
2. Stop the service: `sc stop ollama`
3. Or use the process controller: `POST http://localhost:3001/api/ollama/stop`

## ⚠️ Safety Features

- **No Data Loss** - Only terminates processes, doesn't delete files
- **Graceful Shutdown** - Attempts clean disposal before force termination
- **Error Handling** - Continues termination even if some steps fail
- **Verification** - Provides confirmation of successful termination
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

## 📝 Files Created

- `terminate-all.ps1` - PowerShell termination script
- `terminate-all.js` - Node.js termination script  
- `verify-termination.ps1` - Verification script
- `src/utils/systemTerminator.ts` - Programmatic termination utility

## 🚨 When to Use

Use these termination tools when:

- Development server becomes unresponsive
- Ports are occupied by zombie processes
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
| `npm start` | Restart development server |
| `netstat -ano \| findstr :3000` | Check port 3000 usage |

---

**⚠️ Important**: These tools are designed for development environments. Use with caution in production settings.
