#!/usr/bin/env node

/**
 * Comprehensive Hybrid Storage Diagnostic Script
 * Tests all components: Redis, Elasticsearch, S3, Local Storage, and File Processing
 */

const mysql = require('mysql2/promise')
const { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { Client: ElasticsearchClient } = require('@elastic/elasticsearch')
const Redis = require('ioredis')
const fs = require('fs').promises
const path = require('path')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(80))
  log(title, 'bright')
  console.log('='.repeat(80))
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan')
}

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const results = {
  database: { status: 'unknown', details: {} },
  redis: { status: 'unknown', details: {} },
  elasticsearch: { status: 'unknown', details: {} },
  s3: { status: 'unknown', details: {} },
  localStorage: { status: 'unknown', details: {} },
  hybridStorage: { status: 'unknown', details: {} },
  environment: { status: 'unknown', details: {} }
}

/**
 * Test Database Connection
 */
async function testDatabase() {
  logSection('1. DATABASE CONNECTION TEST')
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL_MODE === 'REQUIRED' ? { rejectUnauthorized: false } : undefined
    })

    logInfo(`Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}`)
    
    const [rows] = await connection.execute('SELECT 1 as test')
    logSuccess('Database connection successful')
    
    // Check storage_configurations table
    const [configs] = await connection.execute('SELECT * FROM storage_configurations LIMIT 1')
    if (configs.length > 0) {
      logSuccess(`Storage configuration found: ${configs[0].storage_type} mode`)
      logInfo(`Primary storage: ${configs[0].hybrid_primary_storage || configs[0].storage_type}`)
      results.database.details.storageConfig = configs[0]
    } else {
      logWarning('No storage configuration found in database')
    }

    // Check file_storage_locations table
    const [locations] = await connection.execute('SELECT COUNT(*) as count FROM file_storage_locations')
    logInfo(`File storage locations: ${locations[0].count}`)

    await connection.end()
    results.database.status = 'healthy'
    
  } catch (error) {
    logError(`Database connection failed: ${error.message}`)
    results.database.status = 'unhealthy'
    results.database.details.error = error.message
  }
}

/**
 * Test Redis Connection
 */
async function testRedis() {
  logSection('2. REDIS CONNECTION TEST')
  
  let redis = null
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'corporate:',
      retryStrategy: (times) => {
        if (times > 3) return null
        return Math.min(times * 100, 2000)
      }
    }

    if (process.env.REDIS_TLS === 'true') {
      redisConfig.tls = { rejectUnauthorized: false }
    }

    logInfo(`Connecting to: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`)
    
    redis = new Redis(redisConfig)

    await new Promise((resolve, reject) => {
      redis.on('ready', resolve)
      redis.on('error', reject)
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    })

    logSuccess('Redis connection successful')

    // Test write/read
    const testKey = 'diagnostic:test'
    const testValue = JSON.stringify({ timestamp: Date.now(), test: 'hybrid-storage' })
    
    await redis.set(testKey, testValue, 'EX', 60)
    const retrieved = await redis.get(testKey)
    
    if (retrieved === testValue) {
      logSuccess('Redis read/write test passed')
    } else {
      logWarning('Redis read/write test failed')
    }

    // Check job queues
    const queueKeys = await redis.keys('*queue*')
    logInfo(`Active queue keys: ${queueKeys.length}`)

    // Check cache keys
    const cacheKeys = await redis.keys('*cache*')
    logInfo(`Cache keys: ${cacheKeys.length}`)

    results.redis.status = 'healthy'
    results.redis.details = {
      queueKeys: queueKeys.length,
      cacheKeys: cacheKeys.length
    }

  } catch (error) {
    logError(`Redis connection failed: ${error.message}`)
    results.redis.status = 'unhealthy'
    results.redis.details.error = error.message
  } finally {
    if (redis) {
      redis.disconnect()
    }
  }
}

/**
 * Test Elasticsearch Connection
 */
async function testElasticsearch() {
  logSection('3. ELASTICSEARCH CONNECTION TEST')
  
  try {
    const esConfig = {
      node: process.env.ELASTICSEARCH_URL || process.env.BONSAI_URL,
      auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    }

    logInfo(`Connecting to: ${esConfig.node}`)
    
    const client = new ElasticsearchClient(esConfig)

    // Test connection
    const health = await client.cluster.health()
    logSuccess(`Elasticsearch connection successful`)
    logInfo(`Cluster status: ${health.status}`)
    logInfo(`Number of nodes: ${health.number_of_nodes}`)

    // Check indices
    const indices = await client.cat.indices({ format: 'json' })
    const corporateIndices = indices.filter(idx => idx.index.includes('corporate'))
    
    logInfo(`Total indices: ${indices.length}`)
    logInfo(`Corporate indices: ${corporateIndices.length}`)

    if (corporateIndices.length > 0) {
      corporateIndices.forEach(idx => {
        logInfo(`  - ${idx.index}: ${idx['docs.count']} documents`)
      })
    }

    // Test search
    try {
      const searchResult = await client.search({
        index: 'corporate-documents',
        body: {
          query: { match_all: {} },
          size: 1
        }
      })
      logSuccess(`Search test passed: ${searchResult.hits.total.value} documents indexed`)
    } catch (searchError) {
      logWarning(`Search test failed: ${searchError.message}`)
    }

    results.elasticsearch.status = 'healthy'
    results.elasticsearch.details = {
      clusterStatus: health.status,
      indices: corporateIndices.length,
      documents: corporateIndices.reduce((sum, idx) => sum + parseInt(idx['docs.count'] || 0), 0)
    }

  } catch (error) {
    logError(`Elasticsearch connection failed: ${error.message}`)
    results.elasticsearch.status = 'unhealthy'
    results.elasticsearch.details.error = error.message
  }
}

/**
 * Test S3 Connection
 */
async function testS3() {
  logSection('4. S3 STORAGE TEST')
  
  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    })

    logInfo(`Testing bucket: ${process.env.AWS_S3_BUCKET}`)
    logInfo(`Region: ${process.env.AWS_REGION}`)

    // Skip ListBuckets (requires special permission), go straight to upload test
    logInfo('Skipping ListBuckets (requires special IAM permission)')

    // Test write operation
    const testKey = `diagnostic/test-${Date.now()}.txt`
    const testContent = Buffer.from('Hybrid storage diagnostic test')
    
    const putCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
      ServerSideEncryption: 'AES256'
    })

    await s3Client.send(putCommand)
    logSuccess('S3 write test passed')

    // Test read operation
    const getCommand = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: testKey
    })

    const response = await s3Client.send(getCommand)
    const chunks = []
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    const retrieved = Buffer.concat(chunks)

    if (retrieved.equals(testContent)) {
      logSuccess('S3 read test passed')
    } else {
      logWarning('S3 read test failed - content mismatch')
    }

    results.s3.status = 'healthy'
    results.s3.details = {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      testKey
    }

  } catch (error) {
    logError(`S3 connection failed: ${error.message}`)
    results.s3.status = 'unhealthy'
    results.s3.details.error = error.message
  }
}

/**
 * Test Local Storage
 */
async function testLocalStorage() {
  logSection('5. LOCAL STORAGE TEST')
  
  try {
    const storagePath = process.env.LOCAL_STORAGE_PATH || './storage/files'
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    
    logInfo(`Storage path: ${storagePath}`)
    logInfo(`Environment: ${isServerless ? 'Serverless' : 'Traditional'}`)
    
    if (isServerless) {
      logWarning('⚠️  SERVERLESS ENVIRONMENT DETECTED!')
      logWarning('Local storage will NOT work in serverless environments')
      logWarning('Reason: Cannot write to filesystem outside /tmp directory')
      logWarning('Solution: Use S3 as primary storage in hybrid mode')
      
      results.localStorage.status = 'incompatible'
      results.localStorage.details = {
        environment: 'serverless',
        recommendation: 'Use S3 as primary storage'
      }
      return
    }

    // Test directory creation
    const testDir = path.join(storagePath, 'diagnostic')
    await fs.mkdir(testDir, { recursive: true })
    logSuccess('Directory creation successful')

    // Test file write
    const testFile = path.join(testDir, `test-${Date.now()}.txt`)
    const testContent = 'Local storage diagnostic test'
    await fs.writeFile(testFile, testContent)
    logSuccess('File write test passed')

    // Test file read
    const retrieved = await fs.readFile(testFile, 'utf-8')
    if (retrieved === testContent) {
      logSuccess('File read test passed')
    } else {
      logWarning('File read test failed - content mismatch')
    }

    // Test file permissions
    await fs.chmod(testFile, 0o600)
    logSuccess('File permissions test passed')

    // Cleanup
    await fs.unlink(testFile)
    await fs.rmdir(testDir)

    results.localStorage.status = 'healthy'
    results.localStorage.details = {
      path: storagePath,
      writable: true
    }

  } catch (error) {
    logError(`Local storage test failed: ${error.message}`)
    
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      logWarning('This is likely a serverless environment issue')
      logWarning('Local storage requires writable filesystem')
    }
    
    results.localStorage.status = 'unhealthy'
    results.localStorage.details.error = error.message
  }
}

/**
 * Test Hybrid Storage Configuration
 */
async function testHybridStorage() {
  logSection('6. HYBRID STORAGE CONFIGURATION TEST')
  
  try {
    const storageMode = process.env.STORAGE_MODE || 'hybrid'
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    
    logInfo(`Storage mode: ${storageMode}`)
    logInfo(`Environment: ${isServerless ? 'Serverless' : 'Traditional'}`)

    if (storageMode === 'hybrid') {
      logInfo('Hybrid storage configuration detected')
      
      if (isServerless) {
        logError('❌ CRITICAL ISSUE: Hybrid storage with local component will FAIL in serverless')
        logError('The error you\'re seeing is because:')
        logError('  1. Hybrid mode tries to write to local filesystem')
        logError('  2. Serverless environments (Vercel/Lambda) only allow writes to /tmp')
        logError('  3. Your LOCAL_STORAGE_PATH is set to ./storage/files')
        logError('  4. This path doesn\'t exist and can\'t be created in /var/task')
        
        logInfo('\n🔧 SOLUTIONS:')
        logInfo('  Option 1: Change STORAGE_MODE=s3 (recommended for production)')
        logInfo('  Option 2: Update hybrid-storage.ts to skip local storage in serverless')
        logInfo('  Option 3: Change LOCAL_STORAGE_PATH=/tmp/storage (temporary, lost on restart)')
        
        results.hybridStorage.status = 'misconfigured'
        results.hybridStorage.details = {
          issue: 'Hybrid storage incompatible with serverless',
          currentMode: storageMode,
          environment: 'serverless',
          recommendation: 'Change to STORAGE_MODE=s3'
        }
      } else {
        logSuccess('Hybrid storage configuration is compatible with environment')
        results.hybridStorage.status = 'healthy'
      }
    } else if (storageMode === 's3') {
      logSuccess('S3-only storage mode - compatible with all environments')
      results.hybridStorage.status = 'healthy'
    } else if (storageMode === 'local') {
      if (isServerless) {
        logError('Local-only storage will NOT work in serverless environments')
        results.hybridStorage.status = 'incompatible'
      } else {
        logSuccess('Local storage mode - compatible with traditional environments')
        results.hybridStorage.status = 'healthy'
      }
    }

  } catch (error) {
    logError(`Hybrid storage test failed: ${error.message}`)
    results.hybridStorage.status = 'error'
    results.hybridStorage.details.error = error.message
  }
}

/**
 * Check Environment Configuration
 */
async function checkEnvironment() {
  logSection('7. ENVIRONMENT CONFIGURATION CHECK')
  
  const requiredVars = [
    'DATABASE_URL',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET',
    'REDIS_HOST',
    'ELASTICSEARCH_URL'
  ]

  const missingVars = requiredVars.filter(v => !process.env[v])
  
  if (missingVars.length > 0) {
    logError(`Missing environment variables: ${missingVars.join(', ')}`)
    results.environment.status = 'incomplete'
    results.environment.details.missing = missingVars
  } else {
    logSuccess('All required environment variables are set')
    results.environment.status = 'complete'
  }

  // Check for serverless indicators
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT)
  
  if (isServerless) {
    logWarning('Serverless environment detected')
    logInfo(`Platform: ${process.env.VERCEL ? 'Vercel' : 'AWS Lambda'}`)
    results.environment.details.serverless = true
    results.environment.details.platform = process.env.VERCEL ? 'Vercel' : 'AWS Lambda'
  } else {
    logInfo('Traditional server environment')
    results.environment.details.serverless = false
  }
}

/**
 * Generate Summary Report
 */
function generateSummary() {
  logSection('DIAGNOSTIC SUMMARY')
  
  const components = [
    { name: 'Database', result: results.database },
    { name: 'Redis', result: results.redis },
    { name: 'Elasticsearch', result: results.elasticsearch },
    { name: 'S3 Storage', result: results.s3 },
    { name: 'Local Storage', result: results.localStorage },
    { name: 'Hybrid Storage Config', result: results.hybridStorage },
    { name: 'Environment', result: results.environment }
  ]

  components.forEach(({ name, result }) => {
    const status = result.status
    const icon = status === 'healthy' || status === 'complete' ? '✅' : 
                 status === 'incompatible' || status === 'misconfigured' ? '⚠️' : '❌'
    
    console.log(`${icon} ${name}: ${status.toUpperCase()}`)
    
    if (result.details.error) {
      logError(`   Error: ${result.details.error}`)
    }
    if (result.details.recommendation) {
      logInfo(`   Recommendation: ${result.details.recommendation}`)
    }
  })

  // Overall assessment
  console.log('\n' + '='.repeat(80))
  
  const criticalIssues = components.filter(c => 
    c.result.status === 'unhealthy' || c.result.status === 'misconfigured'
  )

  if (criticalIssues.length > 0) {
    logError(`\n🚨 CRITICAL ISSUES FOUND: ${criticalIssues.length}`)
    logError('Your upload failures are caused by:')
    criticalIssues.forEach(({ name, result }) => {
      logError(`  - ${name}: ${result.details.error || result.details.recommendation}`)
    })
  } else {
    logSuccess('\n✅ All systems operational!')
  }

  // Save results to file
  const reportPath = path.join(process.cwd(), 'diagnostic-report.json')
  fs.writeFile(reportPath, JSON.stringify(results, null, 2))
    .then(() => logInfo(`\nDetailed report saved to: ${reportPath}`))
    .catch(err => logWarning(`Could not save report: ${err.message}`))
}

/**
 * Main execution
 */
async function main() {
  console.clear()
  log('╔═══════════════════════════════════════════════════════════════════════════════╗', 'bright')
  log('║         HYBRID STORAGE DIAGNOSTIC TOOL - Corporate Digital Library           ║', 'bright')
  log('╚═══════════════════════════════════════════════════════════════════════════════╝', 'bright')
  
  await checkEnvironment()
  await testDatabase()
  await testRedis()
  await testElasticsearch()
  await testS3()
  await testLocalStorage()
  await testHybridStorage()
  
  generateSummary()
  
  console.log('\n')
}

main().catch(error => {
  logError(`Fatal error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
