@echo off
echo 🧹 Emergency Disk Cleanup for Elasticsearch Recovery
echo.
echo Current disk usage is critically low (5.73% free space)
echo Elasticsearch requires at least 10% free space to function properly
echo.

echo 1. Cleaning temporary files...
del /q /f /s %TEMP%\* 2>nul
del /q /f /s C:\Windows\Temp\* 2>nul

echo 2. Cleaning browser cache...
del /q /f /s "%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache\*" 2>nul
del /q /f /s "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\Cache\*" 2>nul

echo 3. Cleaning system logs...
for /f "tokens=*" %%G in ('wevtutil.exe el') DO (call :do_clear "%%G")
goto :end

:do_clear
wevtutil.exe cl %1 2>nul
goto :eof

:end
echo 4. Running disk cleanup...
cleanmgr /sagerun:1

echo.
echo ✅ Basic cleanup completed!
echo.
echo 📊 Checking disk space after cleanup...
powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.DeviceID -eq 'C:'} | Select-Object @{Name='FreeSpace(GB)';Expression={[math]::Round($_.FreeSpace/1GB,2)}}, @{Name='PercentFree';Expression={[math]::Round(($_.FreeSpace/$_.Size)*100,2)}}"

echo.
echo 🔧 Additional cleanup suggestions:
echo - Delete old downloads and documents
echo - Uninstall unused programs
echo - Move large files to external storage
echo - Clear node_modules folders in old projects
echo.
pause