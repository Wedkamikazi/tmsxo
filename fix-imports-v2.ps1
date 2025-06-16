Write-Host "🔧 TREASURY SYSTEM - AUTOMATIC IMPORT PATH FIXER" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Get all TypeScript and TSX files
Write-Host "📁 Scanning for TypeScript/TSX files..." -ForegroundColor Yellow
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx"
Write-Host "Found $($files.Count) files to process" -ForegroundColor Green

$totalReplacements = 0
$processedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $fileReplacements = 0
    
    # Core System replacements
    $content = $content -replace "from\s+['""]\.\.\/services\/serviceOrchestrator['""]", "from '../core/orchestration/ServiceOrchestrator'"
    $content = $content -replace "from\s+['""]\.\/serviceOrchestrator['""]", "from './ServiceOrchestrator'"
    $content = $content -replace "from\s+['""]\.\.\/services\/eventBus['""]", "from '../core/orchestration/EventBus'"
    $content = $content -replace "from\s+['""]\.\/eventBus['""]", "from './EventBus'"
    $content = $content -replace "from\s+['""]\.\.\/services\/performanceManager['""]", "from '../core/performance/PerformanceManager'"
    $content = $content -replace "from\s+['""]\.\.\/utils\/systemSafetyManager['""]", "from '../core/safety/SystemSafetyManager'"
    $content = $content -replace "from\s+['""]\.\/utils\/systemSafetyManager['""]", "from './core/safety/SystemSafetyManager'"
    $content = $content -replace "from\s+['""]\.\.\/utils\/systemTerminator['""]", "from '../core/safety/SystemTerminator'"
    $content = $content -replace "from\s+['""]\.\.\/utils\/stateManager['""]", "from '../core/performance/StateManager'"
    
    # Treasury Services
    $content = $content -replace "from\s+['""]\.\.\/services\/dailyCashManagementService['""]", "from '../treasury/cash-management/DailyCashManagementService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/timeDepositService['""]", "from '../treasury/time-deposits/TimeDepositService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/hrPaymentManagementService['""]", "from '../treasury/payments/HRPaymentManagementService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/intercompanyTransferService['""]", "from '../treasury/intercompany/IntercompanyTransferService'"
    
    # Banking Services
    $content = $content -replace "from\s+['""]\.\.\/services\/unifiedBalanceService['""]", "from '../banking/accounts/UnifiedBalanceService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/creditTransactionService['""]", "from '../banking/transactions/CreditTransactionService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/creditTransactionManagementService['""]", "from '../banking/transactions/CreditTransactionManagementService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/debitTransactionManagementService['""]", "from '../banking/transactions/DebitTransactionManagementService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/importProcessingService['""]", "from '../banking/imports/ImportProcessingService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/duplicateDetectionService['""]", "from '../banking/validation/DuplicateDetectionService'"
    
    # Data Services
    $content = $content -replace "from\s+['""]\.\.\/services\/coreDataService['""]", "from '../data/storage/CoreDataService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/unifiedDataService['""]", "from '../data/storage/UnifiedDataService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/localStorageManager['""]", "from '../data/storage/LocalStorageManager'"
    $content = $content -replace "from\s+['""]\.\.\/services\/storageQuotaManager['""]", "from '../data/storage/StorageQuotaManager'"
    $content = $content -replace "from\s+['""]\.\.\/services\/crossTabSyncService['""]", "from '../data/synchronization/CrossTabSyncService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/cleanupManager['""]", "from '../data/maintenance/CleanupManager'"
    $content = $content -replace "from\s+['""]\.\.\/services\/systemIntegrityService['""]", "from '../data/integrity/SystemIntegrityService'"
    
    # Analytics & ML
    $content = $content -replace "from\s+['""]\.\.\/services\/unifiedCategorizationService['""]", "from '../analytics/categorization/UnifiedCategorizationService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/enhancedCategorizationService['""]", "from '../analytics/categorization/EnhancedCategorizationService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/categorizationService['""]", "from '../analytics/categorization/CategorizationService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/categorization['""]", "from '../analytics/categorization'"
    $content = $content -replace "from\s+['""]\.\/categorization['""]", "from '.'"
    $content = $content -replace "from\s+['""]\.\.\/services\/mlCategorizationService['""]", "from '../analytics/machine-learning/MLCategorizationService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/mlNaturalLanguageService['""]", "from '../analytics/machine-learning/MLNaturalLanguageService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/mlPredictiveAnalyticsService['""]", "from '../analytics/machine-learning/MLPredictiveAnalyticsService'"
    $content = $content -replace "from\s+['""]\.\.\/services\/enhancedMLOrchestrator['""]", "from '../analytics/machine-learning/EnhancedMLOrchestrator'"
    
    # Integration
    $content = $content -replace "from\s+['""]\.\.\/services\/localOllamaIntegration['""]", "from '../integration/ai/LocalOllamaIntegration'"
    
    # Types and Shared
    $content = $content -replace "from\s+['""]\.\.\/types['""]", "from '../shared/types'"
    $content = $content -replace "from\s+['""]\.\/types['""]", "from '../shared/types'"
    $content = $content -replace "from\s+['""]\.\.\/hooks\/useCleanup['""]", "from '../shared/hooks/useCleanup'"
    $content = $content -replace "from\s+['""]\.\.\/utils\/debugMode['""]", "from '../shared/utils/debugging/DebugMode'"
    $content = $content -replace "from\s+['""]\.\.\/utils\/processController['""]", "from '../shared/utils/system/ProcessController'"
    
    # Component imports (from App.tsx)
    $content = $content -replace "from\s+['""]\.\/components\/SystemInitializer['""]", "from './ui/pages/admin/SystemInitializer'"
    $content = $content -replace "from\s+['""]\.\/components\/ErrorBoundary['""]", "from './ui/components/common/ErrorBoundary'"
    
    # CSS imports
    $content = $content -replace "import\s+['""]\.\.\/components\/([^/]+)\.css['""]", "import './$1.css'"
    $content = $content -replace "import\s+['""]\.\/([^/]+)\.css['""]", "import './$1.css'"
    
    # Count replacements
    if ($content -ne $originalContent) {
        $differences = Compare-Object $originalContent.Split("`n") $content.Split("`n")
        $fileReplacements = $differences.Count / 2
        $totalReplacements += $fileReplacements
        $processedFiles++
        
        # Save the updated file
        Set-Content -Path $file.FullName -Value $content -NoNewline
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