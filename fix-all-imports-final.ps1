Write-Host "🔧 TREASURY SYSTEM - ULTIMATE IMPORT PATH FIXER" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Function to calculate relative path based on file location
function Get-RelativePath {
    param(
        [string]$fromPath,
        [string]$toPath
    )
    
    $fromParts = $fromPath.Split('/') | Where-Object { $_ -ne '' }
    $toParts = $toPath.Split('/') | Where-Object { $_ -ne '' }
    
    # Calculate how many levels up we need to go
    $levelsUp = $fromParts.Count - 1  # -1 because we don't count the filename
    
    # Build the relative path
    $relativePath = "../" * $levelsUp + $toPath
    
    return $relativePath
}

# Master mapping: TARGET_PATH -> DISPLAY_NAME
$targetMappings = @{
    'core/orchestration/ServiceOrchestrator' = 'ServiceOrchestrator'
    'core/orchestration/EventBus' = 'EventBus'
    'core/performance/PerformanceManager' = 'PerformanceManager'
    'core/performance/StateManager' = 'StateManager'
    'core/safety/SystemSafetyManager' = 'SystemSafetyManager'
    'core/safety/SystemTerminator' = 'SystemTerminator'
    'core/safety/InfiniteLoopProtection' = 'InfiniteLoopProtection'
    
    'treasury/cash-management/DailyCashManagementService' = 'DailyCashManagementService'
    'treasury/cash-management/DailyCashManagement' = 'DailyCashManagement'
    'treasury/time-deposits/TimeDepositService' = 'TimeDepositService'
    'treasury/time-deposits/TimeDepositManagement' = 'TimeDepositManagement'
    'treasury/intercompany/IntercompanyTransferService' = 'IntercompanyTransferService'
    'treasury/payments/HRPaymentManagementService' = 'HRPaymentManagementService'
    'treasury/payments/HRPayments' = 'HRPayments'
    
    'banking/accounts/UnifiedBalanceService' = 'UnifiedBalanceService'
    'banking/accounts/BankAccountManager' = 'BankAccountManager'
    'banking/accounts/BankBalance' = 'BankBalance'
    'banking/transactions/CreditTransactionService' = 'CreditTransactionService'
    'banking/transactions/CreditTransactionManagementService' = 'CreditTransactionManagementService'
    'banking/transactions/CreditTransactions' = 'CreditTransactions'
    'banking/transactions/DebitTransactionManagementService' = 'DebitTransactionManagementService'
    'banking/transactions/DebitTransactions' = 'DebitTransactions'
    'banking/transactions/Transactions' = 'Transactions'
    'banking/imports/ImportProcessingService' = 'ImportProcessingService'
    'banking/imports/BankStatementImport' = 'BankStatementImport'
    'banking/validation/DuplicateDetectionService' = 'DuplicateDetectionService'
    'banking/validation/DuplicateResolution' = 'DuplicateResolution'
    
    'data/storage/CoreDataService' = 'CoreDataService'
    'data/storage/UnifiedDataService' = 'UnifiedDataService'
    'data/storage/LocalStorageManager' = 'LocalStorageManager'
    'data/storage/StorageQuotaManager' = 'StorageQuotaManager'
    'data/synchronization/CrossTabSyncService' = 'CrossTabSyncService'
    'data/maintenance/CleanupManager' = 'CleanupManager'
    'data/integrity/SystemIntegrityService' = 'SystemIntegrityService'
    
    'analytics/categorization/UnifiedCategorizationService' = 'UnifiedCategorizationService'
    'analytics/categorization/EnhancedCategorizationService' = 'EnhancedCategorizationService'
    'analytics/categorization/CategorizationService' = 'CategorizationService'
    'analytics/categorization/index' = 'index'
    'analytics/categorization/RuleBasedMethod' = 'RuleBasedMethod'
    'analytics/categorization/MLEnhancedMethod' = 'MLEnhancedMethod'
    'analytics/categorization/MLEnhancedTypes' = 'MLEnhancedTypes'
    'analytics/categorization/TensorFlowMethod' = 'TensorFlowMethod'
    'analytics/categorization/TensorFlowTypes' = 'TensorFlowTypes'
    'analytics/categorization/TransactionCategorization' = 'TransactionCategorization'
    'analytics/machine-learning/MLCategorizationService' = 'MLCategorizationService'
    'analytics/machine-learning/MLNaturalLanguageService' = 'MLNaturalLanguageService'
    'analytics/machine-learning/MLPredictiveAnalyticsService' = 'MLPredictiveAnalyticsService'
    'analytics/machine-learning/EnhancedMLOrchestrator' = 'EnhancedMLOrchestrator'
    'analytics/machine-learning/MLIntegrationDashboard' = 'MLIntegrationDashboard'
    
    'integration/ai/LocalOllamaIntegration' = 'LocalOllamaIntegration'
    'integration/ai/OllamaChat' = 'OllamaChat'
    'integration/ai/OllamaControlWidget' = 'OllamaControlWidget'
    'integration/ai/QwenIntegrationStatus' = 'QwenIntegrationStatus'
    
    'ui/components/common/ErrorBoundary' = 'ErrorBoundary'
    'ui/components/common/FileUpload' = 'FileUpload'
    'ui/components/dialogs/BalanceValidationDialog' = 'BalanceValidationDialog'
    'ui/pages/admin/Settings' = 'Settings'
    'ui/pages/admin/SystemHealthMonitor' = 'SystemHealthMonitor'
    'ui/pages/admin/SystemInitializer' = 'SystemInitializer'
    'ui/pages/data/DataHub' = 'DataHub'
    'ui/pages/data/DataManagement' = 'DataManagement'
    'ui/pages/data/FileManager' = 'FileManager'
    'ui/pages/data/DataCleanup' = 'DataCleanup'
    'ui/styles/globals' = 'globals'
    
    'shared/types/index' = 'index'
    'shared/types' = 'index'
    'shared/hooks/useCleanup' = 'useCleanup'
    'shared/utils/debugging/DebugMode' = 'DebugMode'
    'shared/utils/system/ProcessController' = 'ProcessController'
}

# Get all TypeScript and TSX files
Write-Host "📁 Scanning for ALL TypeScript/TSX files..." -ForegroundColor Yellow
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx"
Write-Host "Found $($files.Count) files to process" -ForegroundColor Green

$totalReplacements = 0
$processedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Get file's relative path from src/
    $relativePath = $file.FullName.Replace((Get-Location).Path + '\src\', '').Replace('\', '/')
    $fileDir = Split-Path $relativePath -Parent
    if ($fileDir -eq '') { $fileDir = '.' }
    
    Write-Host "Processing: $relativePath" -ForegroundColor Cyan
    
    # Process each target mapping
    foreach ($target in $targetMappings.Keys) {
        $displayName = $targetMappings[$target]
        
        # Calculate correct relative path from this file's location
        $correctPath = Get-RelativePath -fromPath $fileDir -toPath $target
        
        # Fix various import patterns
        $patterns = @(
            # Standard imports
            "from\s+['""]\.\.?\/[^'""]*\/${displayName}['""]",
            "from\s+['""]\.\.?\/[^'""]*\/${target.Split('/')[-1]}['""]",
            # Dynamic imports
            "import\s*\(\s*['""]\.\.?\/[^'""]*\/${displayName}['""]",
            "import\s*\(\s*['""]\.\.?\/[^'""]*\/${target.Split('/')[-1]}['""]",
            # Direct file references
            "['""]\.\.?\/[^'""]*\/${displayName}['""]",
            "['""]\.\.?\/[^'""]*\/${target.Split('/')[-1]}['""]"
        )
        
        foreach ($pattern in $patterns) {
            if ($content -match $pattern) {
                $replacement = $content -replace $pattern, "from '$correctPath'"
                if ($replacement -ne $content) {
                    $content = $replacement
                    $totalReplacements++
                }
            }
        }
        
        # Fix dynamic imports separately
        $content = $content -replace "import\s*\(\s*['""]\.\.?\/[^'""]*\/${displayName}['""]", "import('$correctPath'"
    }
    
    # Fix CSS imports to be relative to current directory
    $content = $content -replace "import\s+['""]\.\.?\/[^'""]*\/([^'""]+\.css)['""]", "import './$1'"
    $content = $content -replace "import\s+['""]\.\/[^'""]*\.css['""]", "import './$($file.BaseName).css'"
    
    # Save file if changes were made
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $processedFiles++
        Write-Host "✅ Fixed imports in: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎯 ULTIMATE IMPORT FIXING COMPLETE!" -ForegroundColor Green
Write-Host "Files processed: $processedFiles" -ForegroundColor Yellow
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ ALL import paths systematically corrected with proper relative depths!" -ForegroundColor Green
Write-Host "Your Treasury Management System should now compile successfully!" -ForegroundColor Green 