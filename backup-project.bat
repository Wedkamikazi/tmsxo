@echo off
echo ========================================
echo Treasury Management System - Full Backup
echo ========================================
echo.

:: Get current date and time for backup folder name
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "datestamp=%YYYY%-%MM%-%DD%_%HH%-%Min%-%Sec%"

:: Set backup directory
set "BACKUP_DIR=C:\TreasuryBackup_%datestamp%"
set "SOURCE_DIR=C:\tmsft"

echo Creating backup directory: %BACKUP_DIR%
mkdir "%BACKUP_DIR%"

echo.
echo ========================================
echo BACKING UP PROJECT FILES
echo ========================================

:: Copy entire project directory
echo Copying project files...
xcopy "%SOURCE_DIR%" "%BACKUP_DIR%\project" /E /I /H /Y /Q

:: Create backup info file
echo Creating backup information file...
echo Treasury Management System Backup > "%BACKUP_DIR%\BACKUP_INFO.txt"
echo ================================== >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Backup Date: %YYYY%-%MM%-%DD% %HH%:%Min%:%Sec% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Source Directory: %SOURCE_DIR% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Backup Directory: %BACKUP_DIR% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo FEATURES INCLUDED: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Complete React TypeScript application >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Qwen 2.5:32B AI integration >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - File deletion fix implementation >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Data cleanup utilities >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Professional UI components >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Local storage services >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - ML categorization system >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Bank statement import functionality >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - Transaction management system >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - File management with deletion tracking >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"

:: Get directory sizes
echo BACKUP CONTENTS: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo =============== >> "%BACKUP_DIR%\BACKUP_INFO.txt"
dir "%BACKUP_DIR%\project" /s /-c >> "%BACKUP_DIR%\BACKUP_INFO.txt"

echo.
echo ========================================
echo CREATING COMPRESSED ARCHIVE
echo ========================================

:: Create compressed backup using PowerShell
echo Creating compressed archive...
powershell -command "Compress-Archive -Path '%BACKUP_DIR%' -DestinationPath '%BACKUP_DIR%.zip' -Force"

if exist "%BACKUP_DIR%.zip" (
    echo.
    echo ========================================
    echo BACKUP COMPLETED SUCCESSFULLY!
    echo ========================================
    echo.
    echo Backup Location: %BACKUP_DIR%
    echo Compressed Archive: %BACKUP_DIR%.zip
    echo.
    echo The backup includes:
    echo - Complete source code
    echo - All configuration files
    echo - Package dependencies info
    echo - Documentation and README files
    echo - Git repository data
    echo - All custom components and services
    echo.
    echo You can restore this backup by:
    echo 1. Extract %BACKUP_DIR%.zip
    echo 2. Navigate to the extracted project folder
    echo 3. Run: npm install
    echo 4. Run: npm start
    echo.
) else (
    echo.
    echo ========================================
    echo BACKUP COMPLETED (NO COMPRESSION)
    echo ========================================
    echo.
    echo Backup Location: %BACKUP_DIR%
    echo Note: Compression failed, but full backup is available in the folder above.
    echo.
)

echo Press any key to open backup location...
pause >nul
explorer "%BACKUP_DIR%"
