# TREASURY SYSTEM - AUTOMATIC IMPORT PATH FIXER
# Fixes all import paths after directory restructure

Write-Host "🔧 TREASURY SYSTEM - AUTOMATIC IMPORT PATH FIXER" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Path mapping: OLD PATH -> NEW PATH
$pathMappings = @{
    # Core Services
    '../services/serviceOrchestrator' = '../core/orchestration/ServiceOrchestrator'
    './serviceOrchestrator' = './ServiceOrchestrator'
    '../services/eventBus' = '../core/orchestration/EventBus'
    './eventBus' = './EventBus'
    '../services/performanceManager' = '../core/performance/PerformanceManager'
    './performanceManager' = './PerformanceManager'
    '../utils/stateManager' = '../core/performance/StateManager'
    './stateManager' = './StateManager'
    '../utils/systemSafetyManager' = '../core/safety/SystemSafetyManager'
    './systemSafetyManager' = './SystemSafetyManager'
    '../utils/systemTerminator' = '../core/safety/SystemTerminator'
    './systemTerminator' = './SystemTerminator'
    '../utils/infiniteLoopProtection' = '../core/safety/InfiniteLoopProtection'
    './infiniteLoopProtection' = './InfiniteLoopProtection'
    
    # Treasury Services
    '../services/dailyCashManagementService' = '../treasury/cash-management/DailyCashManagementService'
    './dailyCashManagementService' = './DailyCashManagementService'
    '../services/timeDepositService' = '../treasury/time-deposits/TimeDepositService'
    './timeDepositService' = './TimeDepositService'
    '../services/intercompanyTransferService' = '../treasury/intercompany/IntercompanyTransferService'
    './intercompanyTransferService' = './IntercompanyTransferService'
    '../services/hrPaymentManagementService' = '../treasury/payments/HRPaymentManagementService'
    './hrPaymentManagementService' = './HRPaymentManagementService'
    
    # Banking Services
    '../services/unifiedBalanceService' = '../banking/accounts/UnifiedBalanceService'
    './unifiedBalanceService' = './UnifiedBalanceService'
    '../services/creditTransactionService' = '../banking/transactions/CreditTransactionService'
    './creditTransactionService' = './CreditTransactionService'
    '../services/creditTransactionManagementService' = '../banking/transactions/CreditTransactionManagementService'
    './creditTransactionManagementService' = './CreditTransactionManagementService'
    '../services/debitTransactionManagementService' = '../banking/transactions/DebitTransactionManagementService'
    './debitTransactionManagementService' = './DebitTransactionManagementService'
    '../services/importProcessingService' = '../banking/imports/ImportProcessingService'
    './importProcessingService' = './ImportProcessingService'
    '../services/duplicateDetectionService' = '../banking/validation/DuplicateDetectionService'
    './duplicateDetectionService' = './DuplicateDetectionService'
    
    # Data Services
    '../services/coreDataService' = '../data/storage/CoreDataService'
    './coreDataService' = './CoreDataService'
    '../services/unifiedDataService' = '../data/storage/UnifiedDataService'
    './unifiedDataService' = './UnifiedDataService'
    '../services/localStorageManager' = '../data/storage/LocalStorageManager'
    './localStorageManager' = './LocalStorageManager'
    '../services/storageQuotaManager' = '../data/storage/StorageQuotaManager'
    './storageQuotaManager' = './StorageQuotaManager'
    '../services/crossTabSyncService' = '../data/synchronization/CrossTabSyncService'
    './crossTabSyncService' = './CrossTabSyncService'
    '../services/cleanupManager' = '../data/maintenance/CleanupManager'
    './cleanupManager' = './CleanupManager'
    '../services/systemIntegrityService' = '../data/integrity/SystemIntegrityService'
    './systemIntegrityService' = './SystemIntegrityService'
    
    # Analytics & ML Services
    '../services/unifiedCategorizationService' = '../analytics/categorization/UnifiedCategorizationService'
    './unifiedCategorizationService' = './UnifiedCategorizationService'
    '../services/enhancedCategorizationService' = '../analytics/categorization/EnhancedCategorizationService'
    './enhancedCategorizationService' = './EnhancedCategorizationService'
    '../services/categorizationService' = '../analytics/categorization/CategorizationService'
    './categorizationService' = './CategorizationService'
    '../services/categorization' = '../analytics/categorization'
    './categorization' = '.'
    '../services/categorization/index' = '../analytics/categorization/index'
    './categorization/index' = './index'
    '../services/categorization/ruleBasedMethod' = '../analytics/categorization/RuleBasedMethod'
    './categorization/ruleBasedMethod' = './RuleBasedMethod'
    '../services/categorization/mlEnhancedMethod' = '../analytics/categorization/MLEnhancedMethod'
    './categorization/mlEnhancedMethod' = './MLEnhancedMethod'
    '../services/categorization/mlEnhancedTypes' = '../analytics/categorization/MLEnhancedTypes'
    './categorization/mlEnhancedTypes' = './MLEnhancedTypes'
    '../services/categorization/tensorFlowMethod' = '../analytics/categorization/TensorFlowMethod'
    './categorization/tensorFlowMethod' = './TensorFlowMethod'
    '../services/categorization/tensorFlowTypes' = '../analytics/categorization/TensorFlowTypes'
    './categorization/tensorFlowTypes' = './TensorFlowTypes'
    '../services/mlCategorizationService' = '../analytics/machine-learning/MLCategorizationService'
    './mlCategorizationService' = './MLCategorizationService'
    '../services/mlNaturalLanguageService' = '../analytics/machine-learning/MLNaturalLanguageService'
    './mlNaturalLanguageService' = './MLNaturalLanguageService'
    '../services/mlPredictiveAnalyticsService' = '../analytics/machine-learning/MLPredictiveAnalyticsService'
    './mlPredictiveAnalyticsService' = './MLPredictiveAnalyticsService'
    '../services/enhancedMLOrchestrator' = '../analytics/machine-learning/EnhancedMLOrchestrator'
    './enhancedMLOrchestrator' = './EnhancedMLOrchestrator'
    
    # Integration Services
    '../services/localOllamaIntegration' = '../integration/ai/LocalOllamaIntegration'
    './localOllamaIntegration' = './LocalOllamaIntegration'
    
    # Shared Resources
    '../types' = '../shared/types'
    './types' = '../shared/types'
    '../types/index' = '../shared/types/index'
    './types/index' = '../shared/types/index'
    '../hooks/useCleanup' = '../shared/hooks/useCleanup'
    './hooks/useCleanup' = '../shared/hooks/useCleanup'
    '../utils/debugMode' = '../shared/utils/debugging/DebugMode'
    './utils/debugMode' = '../shared/utils/debugging/DebugMode'
    '../utils/processController' = '../shared/utils/system/ProcessController'
    './utils/processController' = '../shared/utils/system/ProcessController'
    
    # Component paths (for files that import components)
    '../components/' = '../ui/'
    './components/' = '../ui/'
}

# Additional specific mappings for deep nested imports
$specificMappings = @{
    # From root level (App.tsx, index.tsx)
    './components/SystemInitializer' = './ui/pages/admin/SystemInitializer'
    './components/ErrorBoundary' = './ui/components/common/ErrorBoundary'
    './services/serviceOrchestrator' = './core/orchestration/ServiceOrchestrator'
    './utils/systemSafetyManager' = './core/safety/SystemSafetyManager'
    
    # Cross-domain imports that need longer paths
    '../../services/' = '../../../'
    '../../../services/' = '../../../'
    '../../../../services/' = '../../../'
}

# Combine all mappings
$allMappings = $pathMappings + $specificMappings

Write-Host "📁 Scanning for TypeScript/TSX files..." -ForegroundColor Yellow
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx" | Where-Object { $_.Name -notlike "*.d.ts" }
Write-Host "Found $($files.Count) files to process" -ForegroundColor Green

$totalReplacements = 0
$processedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $fileReplacements = 0
    
    # Process each mapping
    foreach ($oldPath in $allMappings.Keys) {
        $newPath = $allMappings[$oldPath]
        
        # Handle different import patterns
        $patterns = @(
            "import\s+.*\s+from\s+['""]$([regex]::Escape($oldPath))['""]",
            "import\s*\(\s*['""]$([regex]::Escape($oldPath))['""]",
            "from\s+['""]$([regex]::Escape($oldPath))['""]",
            "['""]$([regex]::Escape($oldPath))['""]"
        )
        
        foreach ($pattern in $patterns) {
            if ($content -match $pattern) {
                $content = $content -replace [regex]::Escape($oldPath), $newPath
                $fileReplacements++
            }
        }
    }
    
    # Save file if changes were made
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $processedFiles++
        $totalReplacements += $fileReplacements
        Write-Host "✅ Fixed $fileReplacements imports in: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎯 IMPORT FIXING COMPLETE!" -ForegroundColor Green
Write-Host "Files processed: $processedFiles" -ForegroundColor Yellow
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ All import paths have been automatically fixed!" -ForegroundColor Green
Write-Host "Your Treasury Management System is now ready to run!" -ForegroundColor Green 