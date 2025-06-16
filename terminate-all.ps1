# EMERGENCY SYSTEM TERMINATION SCRIPT (PowerShell)
# Terminates all active servers, nodes, and processes for the Treasury Management System
# 
# Usage: .\terminate-all.ps1

Write-Host "🚨 EMERGENCY SYSTEM TERMINATION INITIATED" -ForegroundColor Red
Write-Host "🛑 Terminating all Treasury Management System processes..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date

# List of processes to terminate
$processesToKill = @('node', 'npm', 'ollama', 'react-scripts')

# List of ports to free up
$portsToFree = @(3000, 3001, 11434)

function Kill-ProcessesByName {
    param([string]$ProcessName)
    
    Write-Host "🛑 Terminating $ProcessName..." -ForegroundColor Yellow
    
    try {
        $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if ($processes) {
            $processes | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-Host "   ✅ $ProcessName terminated successfully" -ForegroundColor Green
        } else {
            Write-Host "   ✅ No $ProcessName processes found" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "   ⚠️ $ProcessName`: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Kill-ProcessesByPort {
    param([int]$Port)
    
    Write-Host "🛑 Freeing port $Port..." -ForegroundColor Yellow
    
    try {
        $netstatOutput = netstat -ano | Select-String ":$Port "
        if ($netstatOutput) {
            $pids = @()
            foreach ($line in $netstatOutput) {
                $parts = $line.ToString().Trim() -split '\s+'
                $processId = $parts[-1]
                if ($processId -and $processId -ne '0') {
                    $pids += $processId
                }
            }
            
            if ($pids.Count -gt 0) {
                foreach ($pid in $pids) {
                    try {
                        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    }
                    catch {
                        # Ignore errors for processes that may have already terminated
                    }
                }
                Write-Host "   ✅ Port $Port freed successfully" -ForegroundColor Green
            } else {
                Write-Host "   ✅ Port $Port is already free" -ForegroundColor Green
            }
        } else {
            Write-Host "   ✅ Port $Port is already free" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "   ⚠️ Port $Port`: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

try {
    Write-Host "STEP 1: Terminating processes by name..." -ForegroundColor Cyan
    foreach ($processName in $processesToKill) {
        Kill-ProcessesByName -ProcessName $processName
    }
    
    Write-Host ""
    Write-Host "STEP 2: Freeing up ports..." -ForegroundColor Cyan
    foreach ($port in $portsToFree) {
        Kill-ProcessesByPort -Port $port
    }
    
    Write-Host ""
    Write-Host "STEP 3: Additional cleanup..." -ForegroundColor Cyan
    
    # Kill any remaining Node.js processes using WMI
    Write-Host "   🧹 Additional Node.js cleanup..." -ForegroundColor Yellow
    try {
        $nodeProcesses = Get-WmiObject Win32_Process | Where-Object { $_.Name -eq 'node.exe' }
        if ($nodeProcesses) {
            $nodeProcesses | ForEach-Object { $_.Terminate() }
            Write-Host "   ✅ Additional Node.js processes cleaned" -ForegroundColor Green
        } else {
            Write-Host "   ✅ No additional Node.js processes found" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "   ⚠️ Additional Node.js cleanup: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Clear npm cache
    Write-Host "   🧹 Clearing npm cache..." -ForegroundColor Yellow
    try {
        $null = npm cache clean --force 2>$null
        Write-Host "   ✅ npm cache cleared" -ForegroundColor Green
    }
    catch {
        Write-Host "   ⚠️ npm cache clean: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    # Kill any processes using our specific ports more aggressively
    Write-Host "   🧹 Final port cleanup..." -ForegroundColor Yellow
    foreach ($port in $portsToFree) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connections) {
                foreach ($conn in $connections) {
                    try {
                        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                    }
                    catch {
                        # Ignore errors
                    }
                }
            }
        }
        catch {
            # Ignore errors - port might already be free
        }
    }
    Write-Host "   ✅ Final port cleanup completed" -ForegroundColor Green
    
    $duration = (Get-Date) - $startTime
    
    Write-Host ""
    Write-Host "✅ SYSTEM TERMINATION COMPLETE" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════" -ForegroundColor White
    Write-Host "Duration: $($duration.TotalMilliseconds)ms" -ForegroundColor White
    Write-Host "All Treasury Management System processes terminated" -ForegroundColor White
    Write-Host "Ports 3000, 3001, and 11434 are now free" -ForegroundColor White
    Write-Host "System is ready for fresh restart" -ForegroundColor White
    Write-Host "═══════════════════════════════════════" -ForegroundColor White
    Write-Host ""
    
}
catch {
    Write-Host "❌ CRITICAL ERROR during termination: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
