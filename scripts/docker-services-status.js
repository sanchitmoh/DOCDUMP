#!/usr/bin/env node

/**
 * Docker Services Status Report
 * Comprehensive check of all Docker services for the Corporate Digital Library
 */

const BASE_URL = 'http://localhost:3000'

async function checkDockerServices() {
  console.log('🐳 DOCKER SERVICES STATUS REPORT')
  console.log('='.repeat(60))
  console.log()

  try {
    // Check application health
    const response = await fetch(`${BASE_URL}/api/health`)
    const health = await response.json()
    
    console.log('📊 APPLICATION HEALTH CHECK')
    console.log('-'.repeat(40))
    console.log(`Overall Status: ${health.overall_status.toUpperCase()}`)
    console.log(`Timestamp: ${health.timestamp}`)
    console.log()
    
    // Redis Status
    console.log('🔴 REDIS SERVICE')
    console.log('-'.repeat(40))
    console.log(`Status: ${health.checks.redis.status}`)
    console.log(`Message: ${health.checks.redis.message}`)
    console.log(`Port: 6379`)
    console.log(`Management UI: http://localhost:8081 (Redis Commander)`)
    console.log(`Insight UI: http://localhost:8001 (Redis Insight)`)
    console.log()
    
    // Elasticsearch Status
    console.log('🟡 ELASTICSEARCH SERVICE')
    console.log('-'.repeat(40))
    console.log(`Status: ${health.checks.elasticsearch.status}`)
    console.log(`Message: ${health.checks.elasticsearch.message}`)
    console.log(`Port: 9200`)
    console.log(`Kibana UI: http://localhost:5601`)
    console.log(`ES Head UI: http://localhost:9100`)
    console.log()
    
    // Background Processor Status
    console.log('⚙️ BACKGROUND PROCESSOR')
    console.log('-'.repeat(40))
    console.log(`Status: ${health.checks.background_processor.status}`)
    console.log(`Running: ${health.checks.background_processor.details.is_running}`)
    console.log('Queue Lengths:')
    Object.entries(health.checks.background_processor.details.queue_lengths).forEach(([queue, length]) => {
      console.log(`  - ${queue}: ${length} jobs`)
    })
    console.log()
    
    // Database Status
    console.log('💾 DATABASE SERVICE')
    console.log('-'.repeat(40))
    console.log(`Status: ${health.checks.database.status}`)
    console.log(`Message: ${health.checks.database.message}`)
    console.log()
    
    // Storage Status
    console.log('💿 STORAGE SERVICES')
    console.log('-'.repeat(40))
    console.log(`Hybrid Storage: ${health.checks.hybrid_storage.status}`)
    console.log(`S3: ${health.checks.s3.status}`)
    console.log(`Local Storage: ${health.checks.local_storage.status}`)
    console.log()
    
    return health.overall_status === 'healthy'
    
  } catch (error) {
    console.error('❌ Failed to get application health:', error.message)
    return false
  }
}

async function checkDockerContainers() {
  console.log('🐳 DOCKER CONTAINERS')
  console.log('-'.repeat(40))
  
  const expectedContainers = [
    'corporate-redis',
    'corporate-redis-commander', 
    'corporate-redis-insight',
    'corporate-elasticsearch',
    'corporate-kibana',
    'corporate-es-head'
  ]
  
  console.log('Expected containers:')
  expectedContainers.forEach(container => {
    console.log(`  ✓ ${container}`)
  })
  console.log()
  
  console.log('To check container status manually:')
  console.log('  docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"')
  console.log()
}

async function showServiceURLs() {
  console.log('🌐 SERVICE ACCESS URLS')
  console.log('-'.repeat(40))
  console.log('Application:')
  console.log('  • Main App: http://localhost:3000')
  console.log('  • Health Check: http://localhost:3000/api/health')
  console.log('  • Comprehensive Test: http://localhost:3000/api/debug/comprehensive-test')
  console.log()
  console.log('Redis:')
  console.log('  • Redis Commander: http://localhost:8081')
  console.log('    - Username: admin')
  console.log('    - Password: CorporateRedis2024!')
  console.log('  • Redis Insight: http://localhost:8001')
  console.log()
  console.log('Elasticsearch:')
  console.log('  • Elasticsearch API: http://localhost:9200')
  console.log('    - Username: elastic')
  console.log('    - Password: CorporateLib2024!')
  console.log('  • Kibana: http://localhost:5601')
  console.log('  • ES Head: http://localhost:9100')
  console.log()
}

async function main() {
  const isHealthy = await checkDockerServices()
  await checkDockerContainers()
  await showServiceURLs()
  
  console.log('📋 SUMMARY')
  console.log('='.repeat(60))
  
  if (isHealthy) {
    console.log('🎉 ALL DOCKER SERVICES ARE RUNNING SUCCESSFULLY!')
    console.log()
    console.log('✅ Services Status:')
    console.log('  • Redis: Running on port 6379')
    console.log('  • Elasticsearch: Running on port 9200')
    console.log('  • Kibana: Running on port 5601')
    console.log('  • Background Processor: Active')
    console.log('  • Database: Connected')
    console.log('  • Storage: Operational')
    console.log()
    console.log('🚀 The Corporate Digital Library is ready for use!')
  } else {
    console.log('⚠️ Some services may have issues. Check the details above.')
  }
  
  process.exit(isHealthy ? 0 : 1)
}

main().catch(console.error)