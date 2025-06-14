# Treasury Management System - Full Backup Script
# PowerShell Version

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Treasury Management System - Full Backup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get current date and time for backup folder name
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = "C:\TreasuryBackup_$timestamp"
$sourceDir = "C:\tmsft"

Write-Host "Creating backup directory: $backupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "BACKING UP PROJECT FILES" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Copy entire project directory
Write-Host "Copying project files..." -ForegroundColor Yellow
$projectBackupDir = Join-Path $backupDir "project"
Copy-Item -Path $sourceDir -Destination $projectBackupDir -Recurse -Force

# Create backup info file
Write-Host "Creating backup information file..." -ForegroundColor Yellow
$backupInfoPath = Join-Path $backupDir "BACKUP_INFO.txt"

$backupInfo = @"
Treasury Management System Backup
==================================

Backup Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Source Directory: $sourceDir
Backup Directory: $backupDir

FEATURES INCLUDED:
- Complete React TypeScript application
- Qwen 2.5:32B AI integration
- File deletion fix implementation
- Data cleanup utilities
- Professional UI components
- Local storage services
- ML categorization system
- Bank statement import functionality
- Transaction management system
- File management with deletion tracking

TECHNICAL STACK:
- React 18 with TypeScript
- TensorFlow.js for local ML
- Ollama integration for Qwen 2.5:32B
- CSS3 with professional styling
- Local file storage system
- CSV parsing and processing
- Real-time status monitoring

PROJECT STRUCTURE:
- /src/components - React components
- /src/services - Business logic services
- /src/types - TypeScript type definitions
- /public - Static assets
- /node_modules - Dependencies (excluded from backup)
- Package configuration files

RESTORATION INSTRUCTIONS:
1. Extract the backup to desired location
2. Navigate to the project folder
3. Run: npm install (to restore dependencies)
4. Run: npm start (to start development server)
5. Ensure Ollama is installed for AI features
6. Run: ollama pull qwen2.5:32b (for AI model)

BACKUP CONTENTS:
===============
"@

$backupInfo | Out-File -FilePath $backupInfoPath -Encoding UTF8

# Get directory information
Write-Host "Analyzing backup contents..." -ForegroundColor Yellow
$projectSize = (Get-ChildItem -Path $projectBackupDir -Recurse | Measure-Object -Property Length -Sum).Sum
$fileCounts = @{
    "TypeScript files" = (Get-ChildItem -Path $projectBackupDir -Recurse -Filter "*.ts" -File).Count
    "TypeScript React files" = (Get-ChildItem -Path $projectBackupDir -Recurse -Filter "*.tsx" -File).Count
    "CSS files" = (Get-ChildItem -Path $projectBackupDir -Recurse -Filter "*.css" -File).Count
    "JSON files" = (Get-ChildItem -Path $projectBackupDir -Recurse -Filter "*.json" -File).Count
    "JavaScript files" = (Get-ChildItem -Path $projectBackupDir -Recurse -Filter "*.js" -File).Count
    "Total files" = (Get-ChildItem -Path $projectBackupDir -Recurse -File).Count
}

# Append file statistics to backup info
$statistics = @"

BACKUP STATISTICS:
==================
Total Size: $([math]::Round($projectSize / 1MB, 2)) MB
"@

foreach ($fileType in $fileCounts.Keys) {
    $statistics += "`n$fileType`: $($fileCounts[$fileType])"
}

$statistics | Add-Content -Path $backupInfoPath

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "CREATING COMPRESSED ARCHIVE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Create compressed backup
Write-Host "Creating compressed archive..." -ForegroundColor Yellow
$zipPath = "$backupDir.zip"

try {
    Compress-Archive -Path $backupDir -DestinationPath $zipPath -Force
    $zipSize = (Get-Item $zipPath).Length
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "BACKUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backup Location: $backupDir" -ForegroundColor Cyan
    Write-Host "Compressed Archive: $zipPath" -ForegroundColor Cyan
    Write-Host "Archive Size: $([math]::Round($zipSize / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The backup includes:" -ForegroundColor Yellow
    Write-Host "- Complete source code" -ForegroundColor White
    Write-Host "- All configuration files" -ForegroundColor White
    Write-Host "- Package dependencies info" -ForegroundColor White
    Write-Host "- Documentation and README files" -ForegroundColor White
    Write-Host "- Git repository data" -ForegroundColor White
    Write-Host "- All custom components and services" -ForegroundColor White
    Write-Host ""
    Write-Host "You can restore this backup by:" -ForegroundColor Yellow
    Write-Host "1. Extract $zipPath" -ForegroundColor White
    Write-Host "2. Navigate to the extracted project folder" -ForegroundColor White
    Write-Host "3. Run: npm install" -ForegroundColor White
    Write-Host "4. Run: npm start" -ForegroundColor White
    Write-Host "5. Install Ollama and run: ollama pull qwen2.5:32b" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "BACKUP COMPLETED (NO COMPRESSION)" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Backup Location: $backupDir" -ForegroundColor Cyan
    Write-Host "Note: Compression failed, but full backup is available in the folder above." -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Create a quick restore script
$restoreScriptPath = Join-Path $backupDir "RESTORE.bat"
$restoreScript = @"
@echo off
echo ========================================
echo Treasury Management System - Restore
echo ========================================
echo.
echo This script will help you restore the Treasury Management System
echo.
echo Prerequisites:
echo - Node.js (v14 or higher)
echo - npm (comes with Node.js)
echo - Ollama (for AI features)
echo.
echo Steps to restore:
echo 1. Navigate to the project folder
echo 2. Run: npm install
echo 3. Run: npm start
echo 4. Install Ollama from: https://ollama.ai
echo 5. Run: ollama pull qwen2.5:32b
echo.
echo Press any key to open project folder...
pause >nul
explorer "project"
"@

$restoreScript | Out-File -FilePath $restoreScriptPath -Encoding ASCII

Write-Host "Opening backup location..." -ForegroundColor Yellow
Start-Process explorer.exe -ArgumentList $backupDir
