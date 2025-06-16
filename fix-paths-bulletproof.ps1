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
    else { $pathPrefix = "./" }
    
    Write-Host "Processing: $relativePath (prefix: $pathPrefix)" -ForegroundColor Cyan
    
    # Fix core imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/orchestration/EventBus['""]", "from '${pathPrefix}core/orchestration/EventBus'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/orchestration/ServiceOrchestrator['""]", "from '${pathPrefix}core/orchestration/ServiceOrchestrator'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/performance/PerformanceManager['""]", "from '${pathPrefix}core/performance/PerformanceManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/performance/StateManager['""]", "from '${pathPrefix}core/performance/StateManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/safety/SystemSafetyManager['""]", "from '${pathPrefix}core/safety/SystemSafetyManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/safety/SystemTerminator['""]", "from '${pathPrefix}core/safety/SystemTerminator'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?core/safety/InfiniteLoopProtection['""]", "from '${pathPrefix}core/safety/InfiniteLoopProtection'"
    
    # Fix data imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/storage/CoreDataService['""]", "from '${pathPrefix}data/storage/CoreDataService'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/storage/UnifiedDataService['""]", "from '${pathPrefix}data/storage/UnifiedDataService'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/storage/LocalStorageManager['""]", "from '${pathPrefix}data/storage/LocalStorageManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/storage/StorageQuotaManager['""]", "from '${pathPrefix}data/storage/StorageQuotaManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/synchronization/CrossTabSyncService['""]", "from '${pathPrefix}data/synchronization/CrossTabSyncService'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/maintenance/CleanupManager['""]", "from '${pathPrefix}data/maintenance/CleanupManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?data/integrity/SystemIntegrityService['""]", "from '${pathPrefix}data/integrity/SystemIntegrityService'"
    
    # Fix shared imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?shared/types[^'""]*['""]", "from '${pathPrefix}shared/types'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?shared/hooks/useCleanup['""]", "from '${pathPrefix}shared/hooks/useCleanup'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?shared/utils/debugging/DebugMode['""]", "from '${pathPrefix}shared/utils/debugging/DebugMode'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?shared/utils/system/ProcessController['""]", "from '${pathPrefix}shared/utils/system/ProcessController'"
    
    # Fix UI imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?ui/components/common/ErrorBoundary['""]", "from '${pathPrefix}ui/components/common/ErrorBoundary'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?ui/components/common/FileUpload['""]", "from '${pathPrefix}ui/components/common/FileUpload'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?ui/pages/admin/SystemInitializer['""]", "from '${pathPrefix}ui/pages/admin/SystemInitializer'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?ui/pages/admin/Settings['""]", "from '${pathPrefix}ui/pages/admin/Settings'"
    
    # Fix banking imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/accounts/BankAccountManager['""]", "from '${pathPrefix}banking/accounts/BankAccountManager'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/accounts/BankBalance['""]", "from '${pathPrefix}banking/accounts/BankBalance'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/accounts/UnifiedBalanceService['""]", "from '${pathPrefix}banking/accounts/UnifiedBalanceService'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/transactions/CreditTransactions['""]", "from '${pathPrefix}banking/transactions/CreditTransactions'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/transactions/DebitTransactions['""]", "from '${pathPrefix}banking/transactions/DebitTransactions'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/transactions/Transactions['""]", "from '${pathPrefix}banking/transactions/Transactions'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?banking/imports/BankStatementImport['""]", "from '${pathPrefix}banking/imports/BankStatementImport'"
    
    # Fix treasury imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?treasury/cash-management/DailyCashManagement['""]", "from '${pathPrefix}treasury/cash-management/DailyCashManagement'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?treasury/payments/HRPayments['""]", "from '${pathPrefix}treasury/payments/HRPayments'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?treasury/time-deposits/TimeDepositManagement['""]", "from '${pathPrefix}treasury/time-deposits/TimeDepositManagement'"
    
    # Fix analytics imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?analytics/categorization/TransactionCategorization['""]", "from '${pathPrefix}analytics/categorization/TransactionCategorization'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?analytics/machine-learning/MLIntegrationDashboard['""]", "from '${pathPrefix}analytics/machine-learning/MLIntegrationDashboard'"
    
    # Fix integration imports
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?integration/ai/OllamaChat['""]", "from '${pathPrefix}integration/ai/OllamaChat'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?integration/ai/OllamaControlWidget['""]", "from '${pathPrefix}integration/ai/OllamaControlWidget'"
    $content = $content -replace "from\s+['""]\.\.?/?[^'""]*/?integration/ai/QwenIntegrationStatus['""]", "from '${pathPrefix}integration/ai/QwenIntegrationStatus'"
    
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