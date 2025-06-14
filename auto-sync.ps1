# Treasury Management System - Auto Sync Script
# This script automatically syncs changes between local and GitHub

Write-Host "🔄 Starting auto-sync for Treasury Management System..." -ForegroundColor Cyan

# Pull any remote changes first
Write-Host "📥 Checking for remote changes..." -ForegroundColor Yellow
try {
    git fetch origin main
    $behind = git rev-list HEAD..origin/main --count
    if ($behind -gt 0) {
        Write-Host "📥 Pulling $behind new changes from GitHub..." -ForegroundColor Green
        git pull origin main --no-edit
    } else {
        Write-Host "✅ Local repository is up to date" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not fetch remote changes: $($_.Exception.Message)" -ForegroundColor Red
}

# Check for local changes
$status = git status --porcelain
if ($status) {
    Write-Host "📤 Found local changes, syncing to GitHub..." -ForegroundColor Yellow
    
    # Add all changes
    git add .
    
    # Create commit with timestamp
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto-sync: Treasury Management System updates - $timestamp"
    
    # Push to GitHub
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Blue
    git push origin main
    
    Write-Host "✅ Successfully synced to GitHub!" -ForegroundColor Green
} else {
    Write-Host "✅ No local changes to sync" -ForegroundColor Green
}

Write-Host "🎯 Auto-sync complete!" -ForegroundColor Cyan 