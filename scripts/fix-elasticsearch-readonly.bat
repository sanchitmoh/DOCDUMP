@echo off
echo 🔧 Fixing Elasticsearch Read-Only Index Issue
echo.

echo Checking current disk space...
powershell -Command "Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.DeviceID -eq 'C:'} | Select-Object @{Name='PercentFree';Expression={[math]::Round(($_.FreeSpace/$_.Size)*100,2)}}"

echo.
echo 1. Removing read-only block from Elasticsearch index...
curl -X PUT "localhost:9200/corporate_documents/_settings" -H "Content-Type: application/json" -d "{\"index.blocks.read_only_allow_delete\": null}"

echo.
echo 2. Checking Elasticsearch cluster health...
curl -X GET "localhost:9200/_cluster/health?pretty"

echo.
echo 3. Checking index status...
curl -X GET "localhost:9200/corporate_documents/_settings?pretty"

echo.
echo ✅ Elasticsearch index should now be writable again!
echo.
pause