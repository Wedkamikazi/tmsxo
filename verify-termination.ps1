# SYSTEM TERMINATION VERIFICATION SCRIPT
# Verifies that all Treasury Management System processes have been terminated
# 
# Usage: .\verify-termination.ps1

Write-Host "🔍 VERIFYING SYSTEM TERMINATION STATUS" -ForegroundColor Cyan
Write-Host "Checking for any remaining Treasury Management System processes..." -ForegroundColor White
Write-Host ""

$allClear = $true

# Check for processes
$processesToCheck = @('node', 'npm', 'ollama', 'react-scripts')
Write-Host "STEP 1: Checking for active processes..." -ForegroundColor Yellow

foreach ($processName in $processesToCheck) {
    $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "   ❌ Found active $processName processes:" -ForegroundColor Red
        $processes | ForEach-Object { Write-Host "      PID: $($_.Id) - $($_.ProcessName)" -ForegroundColor Red }
        $allClear = $false
    } else {
        Write-Host "   ✅ No $processName processes found" -ForegroundColor Green
    }
}

# Check for ports
$portsToCheck = @(3000, 3001, 11434)
Write-Host ""
Write-Host "STEP 2: Checking port availability..." -ForegroundColor Yellow

foreach ($port in $portsToCheck) {
    $netstatOutput = netstat -ano | Select-String ":$port "
    if ($netstatOutput) {
        Write-Host "   ❌ Port $port is still in use:" -ForegroundColor Red
        $netstatOutput | ForEach-Object { Write-Host "      $($_.ToString().Trim())" -ForegroundColor Red }
        $allClear = $false
    } else {
        Write-Host "   ✅ Port $port is free" -ForegroundColor Green
    }
}

# Check for specific Treasury Management processes
Write-Host ""
Write-Host "STEP 3: Checking for Treasury-specific processes..." -ForegroundColor Yellow

try {
    $treasuryProcesses = Get-WmiObject Win32_Process | Where-Object { 
        $_.CommandLine -like "*treasury*" -or 
        $_.CommandLine -like "*react-scripts*" -or
        $_.CommandLine -like "*npm start*" -or
        ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*3000*")
    }
    
    if ($treasuryProcesses) {
        Write-Host "   ❌ Found Treasury-related processes:" -ForegroundColor Red
        $treasuryProcesses | ForEach-Object { 
            Write-Host "      PID: $($_.ProcessId) - $($_.Name) - $($_.CommandLine)" -ForegroundColor Red 
        }
        $allClear = $false
    } else {
        Write-Host "   ✅ No Treasury-specific processes found" -ForegroundColor Green
    }
}
catch {
    Write-Host "   ⚠️ Could not check Treasury-specific processes: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Final status
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor White

if ($allClear) {
    Write-Host "✅ SYSTEM TERMINATION VERIFIED" -ForegroundColor Green
    Write-Host "All Treasury Management System processes have been successfully terminated" -ForegroundColor Green
    Write-Host "All required ports (3000, 3001, 11434) are free" -ForegroundColor Green
    Write-Host "System is ready for fresh restart" -ForegroundColor Green
} else {
    Write-Host "⚠️ INCOMPLETE TERMINATION DETECTED" -ForegroundColor Yellow
    Write-Host "Some processes or ports are still active" -ForegroundColor Yellow
    Write-Host "You may need to run the termination script again" -ForegroundColor Yellow
    Write-Host "Or manually terminate the remaining processes" -ForegroundColor Yellow
}

Write-Host "═══════════════════════════════════════" -ForegroundColor White
Write-Host ""

if (-not $allClear) {
    Write-Host "Would you like to run the termination script again? (Y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    if ($response -eq 'Y' -or $response -eq 'y') {
        Write-Host "Running termination script..." -ForegroundColor Yellow
        & .\terminate-all.ps1
    }
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
