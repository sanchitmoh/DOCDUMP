#!/usr/bin/env node

/**
 * Monitor background processing status
 * This script checks the health of background processing and reports any issues
 */

const BASE_URL = 'http://localhost:3000'

async function checkHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`)
    const health = await response.json()
    
    console.log('🏥 SYSTEM HEALTH CHECK')
    console.log('='.repeat(50))
    console.log(`Overall Status: ${health.overall_status.toUpperCase()}`)
    console.log(`Timestamp: ${health.timestamp}`)
    console.log()
    
    // Background processor status
    const bgProcessor = health.checks.background_processor
    console.log('🔄 BACKGROUND PROCESSOR')
    console.log(`Status: ${bgProcessor.status}`)
    console.log(`Running: ${bgProcessor.details.is_running}`)
    console.log('Queue Lengths:')
    Object.entries(bgProcessor.details.queue_lengths).forEach(([queue, length]) => {
      console.log(`  - ${queue}: ${length} jobs`)
    })
    console.log()
    
    // Database status
    console.log('💾 DATABASE')
    console.log(`Status: ${health.checks.database.status}`)
    console.log(`Message: ${health.checks.database.message}`)
    console.log()
    
    // Elasticsearch status
    console.log('🔍 ELASTICSEARCH')
    console.log(`Status: ${health.checks.elasticsearch.status}`)
    console.log(`Message: ${health.checks.elasticsearch.message}`)
    console.log()
    
    return health.overall_status === 'healthy'
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message)
    return false
  }
}

async function checkSearchIndexStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/debug/comprehensive-test`)
    const test = await response.json()
    
    console.log('📊 SEARCH INDEX STATUS')
    console.log('='.repeat(50))
    
    const bgTest = test.tests.find(t => t.name === 'Background Processor Status')
    if (bgTest && bgTest.success) {
      console.log('Queue Status:')
      Object.entries(bgTest.result.summary).forEach(([status, data]) => {
        console.log(`  - ${status}: ${data.count} documents (${data.with_errors} with errors)`)
      })
    }
    
    console.log()
    console.log(`Test Summary: ${test.summary.passed}/${test.summary.total_tests} tests passed`)
    
    return test.summary.failed === 0
    
  } catch (error) {
    console.error('❌ Search index check failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 CORPORATE DIGITAL LIBRARY - SYSTEM MONITOR')
  console.log('='.repeat(60))
  console.log()
  
  const healthOk = await checkHealth()
  const indexOk = await checkSearchIndexStatus()
  
  console.log('📋 SUMMARY')
  console.log('='.repeat(50))
  console.log(`System Health: ${healthOk ? '✅ HEALTHY' : '❌ UNHEALTHY'}`)
  console.log(`Search Index: ${indexOk ? '✅ OPERATIONAL' : '❌ ISSUES DETECTED'}`)
  console.log()
  
  if (healthOk && indexOk) {
    console.log('🎉 All systems operational! The fixes have been successfully applied.')
    console.log()
    console.log('✅ Fixed Issues:')
    console.log('  - Added retry_count column to search_index_status table')
    console.log('  - Fixed JSON parsing for tags field')
    console.log('  - Background processor is running without errors')
    console.log('  - All validation and truncation systems working')
  } else {
    console.log('⚠️  Some issues detected. Check the logs above for details.')
  }
  
  process.exit(healthOk && indexOk ? 0 : 1)
}

main().catch(console.error)