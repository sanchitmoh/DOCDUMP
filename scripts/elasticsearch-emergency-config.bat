@echo off
echo ⚠️  EMERGENCY: Temporarily adjusting Elasticsearch watermarks
echo.
echo WARNING: This is a temporary fix. You MUST free up disk space!
echo.

echo Setting emergency watermark thresholds...
curl -X PUT "localhost:9200/_cluster/settings" -H "Content-Type: application/json" -d "{\"persistent\": {\"cluster.routing.allocation.disk.watermark.low\": \"2gb\",\"cluster.routing.allocation.disk.watermark.high\": \"1gb\",\"cluster.routing.allocation.disk.watermark.flood_stage\": \"500mb\"}}"

echo.
echo Removing read-only block...
curl -X PUT "localhost:9200/corporate_documents/_settings" -H "Content-Type: application/json" -d "{\"index.blocks.read_only_allow_delete\": null}"

echo.
echo ✅ Emergency configuration applied!
echo.
echo 🚨 CRITICAL: This is temporary! You must:
echo 1. Free up at least 50GB of disk space
echo 2. Reset watermarks to safe defaults
echo 3. Monitor disk usage regularly
echo.
pause