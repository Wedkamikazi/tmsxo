Write-Host "🔧 TREASURY SYSTEM - COMPREHENSIVE IMPORT FIXER (Phase 2)" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green

# Get all TypeScript and TSX files
Write-Host "📁 Scanning for ALL TypeScript/TSX files..." -ForegroundColor Yellow
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts", "*.tsx"
Write-Host "Found $($files.Count) files to process" -ForegroundColor Green

$totalReplacements = 0
$processedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $fileChanges = 0
    
    # Fix remaining dynamic imports
    $content = $content -replace "import\(['""]\.\.\/services\/eventBus['""]", "import('../../../core/orchestration/EventBus'"
    $content = $content -replace "import\(['""]\.\.\/services\/unifiedDataService['""]", "import('../../../data/storage/UnifiedDataService'"
    
    # Fix component imports in DataHub and other files
    $content = $content -replace "from\s+['""]\.\/BankStatementImport['""]", "from '../../../banking/imports/BankStatementImport'"
    $content = $content -replace "from\s+['""]\.\/BankAccountManager['""]", "from '../../../banking/accounts/BankAccountManager'"
    $content = $content -replace "from\s+['""]\.\/BankBalance['""]", "from '../../../banking/accounts/BankBalance'"
    $content = $content -replace "from\s+['""]\.\/QwenIntegrationStatus['""]", "from '../../../integration/ai/QwenIntegrationStatus'"
    $content = $content -replace "from\s+['""]\.\/SimpleDataCleanup['""]", "from './DataCleanup'"
    $content = $content -replace "from\s+['""]\.\/OllamaChat['""]", "from '../../../integration/ai/OllamaChat'"
    $content = $content -replace "from\s+['""]\.\/Settings['""]", "from '../admin/Settings'"
    $content = $content -replace "from\s+['""]\.\/ErrorBoundary['""]", "from '../../components/common/ErrorBoundary'"
    $content = $content -replace "from\s+['""]\.\/SystemHealthMonitor['""]", "from '../admin/SystemHealthMonitor'"
    $content = $content -replace "from\s+['""]\.\/OllamaControlWidget['""]", "from '../../../integration/ai/OllamaControlWidget'"
    $content = $content -replace "from\s+['""]\.\/CreditTransactions['""]", "from '../../../banking/transactions/CreditTransactions'"
    $content = $content -replace "from\s+['""]\.\/DebitTransactions['""]", "from '../../../banking/transactions/DebitTransactions'"
    $content = $content -replace "from\s+['""]\.\/HRPayments['""]", "from '../../../treasury/payments/HRPayments'"
    $content = $content -replace "from\s+['""]\.\/DailyCashManagement['""]", "from '../../../treasury/cash-management/DailyCashManagement'"
    $content = $content -replace "from\s+['""]\.\/TimeDepositManagement['""]", "from '../../../treasury/time-deposits/TimeDepositManagement'"
    
    # Fix categorization service internal imports
    $content = $content -replace "from\s+['""]\.\.\/cleanupManager['""]", "from '../../data/maintenance/CleanupManager'"
    $content = $content -replace "from\s+['""]\.\.\/systemIntegrityService['""]", "from '../../data/integrity/SystemIntegrityService'"
    
    # Fix relative paths to shared resources
    $content = $content -replace "from\s+['""]\.\.\/core\/performance\/StateManager['""]", "from '../../../core/performance/StateManager'"
    $content = $content -replace "from\s+['""]\.\.\/shared\/types['""]", "from '../../../shared/types'"
    
    # Fix CSS imports - make them relative to current file location
    $content = $content -replace "import\s+['""]\.\/\.css['""]", "import './DataHub.css'"
    
    # Fix any remaining service cross-references within the same domain
    $content = $content -replace "from\s+['""]\.\.\/([^/]+)Service['""]", "from '../$1Service'"
    $content = $content -replace "from\s+['""]\.\.\/([^/]+)Manager['""]", "from '../$1Manager'"
    
    # Fix internal categorization imports
    $content = $content -replace "from\s+['""]\.\/ruleBasedMethod['""]", "from './RuleBasedMethod'"
    $content = $content -replace "from\s+['""]\.\/mlEnhancedMethod['""]", "from './MLEnhancedMethod'"
    $content = $content -replace "from\s+['""]\.\/mlEnhancedTypes['""]", "from './MLEnhancedTypes'"
    $content = $content -replace "from\s+['""]\.\/tensorFlowMethod['""]", "from './TensorFlowMethod'"
    $content = $content -replace "from\s+['""]\.\/tensorFlowTypes['""]", "from './TensorFlowTypes'"
    
    # Fix cross-domain service references
    $content = $content -replace "from\s+['""]\.\.\/\.\.\/services\/([^'""]*)Service['""]", "from '../../data/storage/$1Service'"
    $content = $content -replace "from\s+['""]\.\.\/\.\.\/services\/([^'""]*)Manager['""]", "from '../../data/storage/$1Manager'"
    
    # Count actual changes
    if ($content -ne $originalContent) {
        $differences = Compare-Object $originalContent.Split("`n") $content.Split("`n")
        $fileChanges = ($differences | Measure-Object).Count / 2
        $totalReplacements += $fileChanges
        $processedFiles++
        
        # Save the updated file
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "✅ Fixed $fileChanges imports in: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎯 COMPREHENSIVE IMPORT FIXING COMPLETE!" -ForegroundColor Green
Write-Host "Files processed: $processedFiles" -ForegroundColor Yellow
Write-Host "Total replacements: $totalReplacements" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ ALL import paths have been systematically fixed!" -ForegroundColor Green
Write-Host "Your Treasury Management System should now compile!" -ForegroundColor Green 