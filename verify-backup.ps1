# Treasury Management System - Backup Verification Script

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Treasury Management System - Backup Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackupPath)) {
    Write-Host "❌ ERROR: Backup path not found: $BackupPath" -ForegroundColor Red
    exit 1
}

Write-Host "Verifying backup at: $BackupPath" -ForegroundColor Yellow
Write-Host ""

# Define critical files and folders to check
$criticalItems = @{
    "package.json" = "Project configuration"
    "tsconfig.json" = "TypeScript configuration"
    "src" = "Source code directory"
    "src/components" = "React components"
    "src/services" = "Business logic services"
    "src/types" = "TypeScript definitions"
    "public" = "Public assets"
    "src/components/BankStatementImport.tsx" = "CSV import functionality"
    "src/components/DataHub.tsx" = "Main navigation hub"
    "src/components/SimpleDataCleanup.tsx" = "Data cleanup utility"
    "src/components/QwenIntegrationStatus.tsx" = "AI status monitoring"
    "src/services/fileStorageService.ts" = "File storage with deletion fix"
    "src/services/mlCategorizationService.ts" = "Qwen 2.5:32B AI integration"
    "src/services/transactionStorageService.ts" = "Transaction management"
}

$verificationResults = @()
$totalItems = $criticalItems.Count
$foundItems = 0

Write-Host "Checking critical files and folders..." -ForegroundColor Yellow
Write-Host ""

foreach ($item in $criticalItems.Keys) {
    $fullPath = Join-Path $BackupPath $item
    $description = $criticalItems[$item]
    
    if (Test-Path $fullPath) {
        Write-Host "✅ $item" -ForegroundColor Green -NoNewline
        Write-Host " - $description" -ForegroundColor Gray
        $foundItems++
        $verificationResults += [PSCustomObject]@{
            Item = $item
            Status = "Found"
            Description = $description
        }
    } else {
        Write-Host "❌ $item" -ForegroundColor Red -NoNewline
        Write-Host " - $description" -ForegroundColor Gray
        $verificationResults += [PSCustomObject]@{
            Item = $item
            Status = "Missing"
            Description = $description
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$successRate = [math]::Round(($foundItems / $totalItems) * 100, 1)

Write-Host "Items Found: $foundItems / $totalItems ($successRate%)" -ForegroundColor $(if ($successRate -eq 100) { "Green" } elseif ($successRate -ge 80) { "Yellow" } else { "Red" })

if ($successRate -eq 100) {
    Write-Host ""
    Write-Host "🎉 BACKUP VERIFICATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "All critical files and folders are present in the backup." -ForegroundColor Green
} elseif ($successRate -ge 80) {
    Write-Host ""
    Write-Host "⚠️  BACKUP VERIFICATION PARTIAL" -ForegroundColor Yellow
    Write-Host "Most critical files are present, but some items are missing." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ BACKUP VERIFICATION FAILED" -ForegroundColor Red
    Write-Host "Critical files are missing from the backup." -ForegroundColor Red
}

# Additional statistics
Write-Host ""
Write-Host "Additional Statistics:" -ForegroundColor Cyan

try {
    $srcPath = Join-Path $BackupPath "src"
    if (Test-Path $srcPath) {
        $tsxFiles = (Get-ChildItem -Path $srcPath -Recurse -Filter "*.tsx" -File).Count
        $tsFiles = (Get-ChildItem -Path $srcPath -Recurse -Filter "*.ts" -File).Count
        $cssFiles = (Get-ChildItem -Path $srcPath -Recurse -Filter "*.css" -File).Count
        $totalFiles = (Get-ChildItem -Path $BackupPath -Recurse -File).Count
        $totalSize = [math]::Round(((Get-ChildItem -Path $BackupPath -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
        
        Write-Host "- TypeScript React files: $tsxFiles" -ForegroundColor White
        Write-Host "- TypeScript files: $tsFiles" -ForegroundColor White
        Write-Host "- CSS files: $cssFiles" -ForegroundColor White
        Write-Host "- Total files: $totalFiles" -ForegroundColor White
        Write-Host "- Total size: $totalSize MB" -ForegroundColor White
    }
} catch {
    Write-Host "- Could not calculate detailed statistics" -ForegroundColor Yellow
}

# Create verification report
$reportPath = Join-Path $BackupPath "VERIFICATION_REPORT.txt"
$report = @"
Treasury Management System - Backup Verification Report
======================================================

Verification Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Backup Path: $BackupPath
Success Rate: $successRate% ($foundItems / $totalItems items found)

DETAILED RESULTS:
================
"@

foreach ($result in $verificationResults) {
    $status = if ($result.Status -eq "Found") { "✅" } else { "❌" }
    $report += "`n$status $($result.Item) - $($result.Description)"
}

$report += @"


RESTORATION INSTRUCTIONS:
=========================
1. Navigate to the backup directory
2. Run: npm install
3. Run: npm start
4. Install Ollama and run: ollama pull qwen2.5:32b

BACKUP QUALITY: $(if ($successRate -eq 100) { "EXCELLENT" } elseif ($successRate -ge 80) { "GOOD" } else { "NEEDS ATTENTION" })
"@

$report | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host ""
Write-Host "Verification report saved to: $reportPath" -ForegroundColor Cyan

if ($successRate -lt 100) {
    Write-Host ""
    Write-Host "Missing items:" -ForegroundColor Yellow
    $verificationResults | Where-Object { $_.Status -eq "Missing" } | ForEach-Object {
        Write-Host "- $($_.Item)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Green
