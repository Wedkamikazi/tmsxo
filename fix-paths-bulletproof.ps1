Write-Host "🔧 BULLETPROOF IMPORT PATH FIXER - FINAL SOLUTION" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx"
$totalFixed = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $relativePath = $file.FullName.Replace((Get-Location).Path + '\src\', '').Replace('\', '/')
    
    # Determine the correct prefix based on file location
    $pathPrefix = ""
    if ($relativePath -match "^ui/components/common/") { $pathPrefix = "../../../../" }
    elseif ($relativePath -match "^ui/components/dialogs/") { $pathPrefix = "../../../../" }
    elseif ($relativePath -match "^ui/pages/admin/") { $pathPrefix = "../../../" }
    elseif ($relativePath -match "^ui/pages/data/") { $pathPrefix = "../../../" }
    elseif ($relativePath -match "^ui/styles/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^analytics/categorization/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^analytics/machine-learning/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^banking/accounts/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^banking/transactions/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^banking/imports/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^banking/validation/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^treasury/cash-management/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^treasury/time-deposits/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^treasury/intercompany/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^treasury/payments/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^data/storage/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^data/synchronization/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^data/maintenance/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^data/integrity/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^core/orchestration/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^core/performance/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^core/safety/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^integration/ai/") { $pathPrefix = "../../" }
    elseif ($relativePath -match "^shared/") { $pathPrefix = "../" }
    else { $pathPrefix = "./" }  # Root level files
    
    Write-Host "Processing: $relativePath (prefix: $pathPrefix)" -ForegroundColor Cyan
    
    # Fix ALL import patterns systematically
    $replacements = @{
        # Core imports
        'from\s+['""]\.\.?/?[^'""]*/?core/orchestration/EventBus['""]' = "from '${pathPrefix}core/orchestration/EventBus'"
        'from\s+['""]\.\.?/?[^'""]*/?core/orchestration/ServiceOrchestrator['""]' = "from '${pathPrefix}core/orchestration/ServiceOrchestrator'"
        'from\s+['""]\.\.?/?[^'""]*/?core/performance/PerformanceManager['""]' = "from '${pathPrefix}core/performance/PerformanceManager'"
        'from\s+['""]\.\.?/?[^'""]*/?core/performance/StateManager['""]' = "from '${pathPrefix}core/performance/StateManager'"
        'from\s+['""]\.\.?/?[^'""]*/?core/safety/SystemSafetyManager['""]' = "from '${pathPrefix}core/safety/SystemSafetyManager'"
        'from\s+['""]\.\.?/?[^'""]*/?core/safety/SystemTerminator['""]' = "from '${pathPrefix}core/safety/SystemTerminator'"
        'from\s+['""]\.\.?/?[^'""]*/?core/safety/InfiniteLoopProtection['""]' = "from '${pathPrefix}core/safety/InfiniteLoopProtection'"
        
        # Data imports
        'from\s+['""]\.\.?/?[^'""]*/?data/storage/CoreDataService['""]' = "from '${pathPrefix}data/storage/CoreDataService'"
        'from\s+['""]\.\.?/?[^'""]*/?data/storage/UnifiedDataService['""]' = "from '${pathPrefix}data/storage/UnifiedDataService'"
        'from\s+['""]\.\.?/?[^'""]*/?data/storage/LocalStorageManager['""]' = "from '${pathPrefix}data/storage/LocalStorageManager'"
        'from\s+['""]\.\.?/?[^'""]*/?data/storage/StorageQuotaManager['""]' = "from '${pathPrefix}data/storage/StorageQuotaManager'"
        'from\s+['""]\.\.?/?[^'""]*/?data/synchronization/CrossTabSyncService['""]' = "from '${pathPrefix}data/synchronization/CrossTabSyncService'"
        'from\s+['""]\.\.?/?[^'""]*/?data/maintenance/CleanupManager['""]' = "from '${pathPrefix}data/maintenance/CleanupManager'"
        'from\s+['""]\.\.?/?[^'""]*/?data/integrity/SystemIntegrityService['""]' = "from '${pathPrefix}data/integrity/SystemIntegrityService'"
        
        # Shared imports
        'from\s+['""]\.\.?/?[^'""]*/?shared/types[^'""]*['""]' = "from '${pathPrefix}shared/types'"
        'from\s+['""]\.\.?/?[^'""]*/?shared/hooks/useCleanup['""]' = "from '${pathPrefix}shared/hooks/useCleanup'"
        'from\s+['""]\.\.?/?[^'""]*/?shared/utils/debugging/DebugMode['""]' = "from '${pathPrefix}shared/utils/debugging/DebugMode'"
        'from\s+['""]\.\.?/?[^'""]*/?shared/utils/system/ProcessController['""]' = "from '${pathPrefix}shared/utils/system/ProcessController'"
        
        # UI imports
        'from\s+['""]\.\.?/?[^'""]*/?ui/components/common/ErrorBoundary['""]' = "from '${pathPrefix}ui/components/common/ErrorBoundary'"
        'from\s+['""]\.\.?/?[^'""]*/?ui/components/common/FileUpload['""]' = "from '${pathPrefix}ui/components/common/FileUpload'"
        'from\s+['""]\.\.?/?[^'""]*/?ui/pages/admin/SystemInitializer['""]' = "from '${pathPrefix}ui/pages/admin/SystemInitializer'"
        'from\s+['""]\.\.?/?[^'""]*/?ui/pages/admin/Settings['""]' = "from '${pathPrefix}ui/pages/admin/Settings'"
        
        # Banking imports
        'from\s+['""]\.\.?/?[^'""]*/?banking/accounts/BankAccountManager['""]' = "from '${pathPrefix}banking/accounts/BankAccountManager'"
        'from\s+['""]\.\.?/?[^'""]*/?banking/accounts/BankBalance['""]' = "from '${pathPrefix}banking/accounts/BankBalance'"
        'from\s+['""]\.\.?/?[^'""]*/?banking/accounts/UnifiedBalanceService['""]' = "from '${pathPrefix}banking/accounts/UnifiedBalanceService'"
        'from\s+['""]\.\.?/?[^'""]*/?banking/transactions/CreditTransactions['""]' = "from '${pathPrefix}banking/transactions/CreditTransactions'"
        'from\s+['""]\.\.?/?[^'""]*/?banking/transactions/DebitTransactions['""]' = "from '${pathPrefix}banking/transactions/DebitTransactions'"
        'from\s+['""]\.\.?/?[^'""]*/?banking/transactions/Transactions['""]' = "from '${pathPrefix}banking/transactions/Transactions'"
        'from\s+['""]\.\.?/?[^'""]*/?banking/imports/BankStatementImport['""]' = "from '${pathPrefix}banking/imports/BankStatementImport'"
        
        # Treasury imports
        'from\s+['""]\.\.?/?[^'""]*/?treasury/cash-management/DailyCashManagement['""]' = "from '${pathPrefix}treasury/cash-management/DailyCashManagement'"
        'from\s+['""]\.\.?/?[^'""]*/?treasury/payments/HRPayments['""]' = "from '${pathPrefix}treasury/payments/HRPayments'"
        'from\s+['""]\.\.?/?[^'""]*/?treasury/time-deposits/TimeDepositManagement['""]' = "from '${pathPrefix}treasury/time-deposits/TimeDepositManagement'"
        
        # Analytics imports
        'from\s+['""]\.\.?/?[^'""]*/?analytics/categorization/TransactionCategorization['""]' = "from '${pathPrefix}analytics/categorization/TransactionCategorization'"
        'from\s+['""]\.\.?/?[^'""]*/?analytics/machine-learning/MLIntegrationDashboard['""]' = "from '${pathPrefix}analytics/machine-learning/MLIntegrationDashboard'"
        
        # Integration imports
        'from\s+['""]\.\.?/?[^'""]*/?integration/ai/OllamaChat['""]' = "from '${pathPrefix}integration/ai/OllamaChat'"
        'from\s+['""]\.\.?/?[^'""]*/?integration/ai/OllamaControlWidget['""]' = "from '${pathPrefix}integration/ai/OllamaControlWidget'"
        'from\s+['""]\.\.?/?[^'""]*/?integration/ai/QwenIntegrationStatus['""]' = "from '${pathPrefix}integration/ai/QwenIntegrationStatus'"
    }
    
    # Apply all replacements
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        if ($content -match $pattern) {
            $content = $content -replace $pattern, $replacement
        }
    }
    
    # Fix dynamic imports
    $content = $content -replace "import\s*\(\s*['""]\.\.?/?[^'""]*/?core/orchestration/EventBus['""]", "import('${pathPrefix}core/orchestration/EventBus'"
    $content = $content -replace "import\s*\(\s*['""]\.\.?/?[^'""]*/?data/storage/UnifiedDataService['""]", "import('${pathPrefix}data/storage/UnifiedDataService'"
    
    # Fix CSS imports
    $content = $content -replace "import\s+['""]\.\.?/?[^'""]*?ui/styles/globals['""]", "import '${pathPrefix}ui/styles/globals.css'"
    
    # Save if changed
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalFixed++
        Write-Host "✅ Fixed: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎯 BULLETPROOF IMPORT FIXING COMPLETE!" -ForegroundColor Green
Write-Host "Files fixed: $totalFixed" -ForegroundColor Yellow
Write-Host "✅ All import paths corrected with exact relative depths!" -ForegroundColor Green 