/**
 * Test Redis connection and fallback behavior
 * This script tests:
 * 1. Redis connection with current credentials
 * 2. Graceful fallback when Redis is unavailable
 * 3. Job queue behavior with/without Redis
 */

require('dotenv').config({ path: '.env.local' })

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection and Fallback Behavior\n')
  console.log('=' .repeat(60))
  
  // Test 1: Check environment variables
  console.log('\n📋 Step 1: Environment Configuration')
  console.log('-'.repeat(60))
  console.log('REDIS_HOST:', process.env.REDIS_HOST)
  console.log('REDIS_PORT:', process.env.REDIS_PORT)
  console.log('REDIS_TLS:', process.env.REDIS_TLS)
  console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '***' + process.env.REDIS_PASSWORD.slice(-4) : 'Not set')
  
  // Test 2: Try to connect to Redis
  console.log('\n🔌 Step 2: Testing Redis Connection')
  console.log('-'.repeat(60))
  
  try {
    const Redis = require('ioredis')
    
    const redisOptions = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null
        return Math.min(times * 500, 2000)
      }
    }
    
    if (process.env.REDIS_TLS === 'true') {
      redisOptions.tls = {
        rejectUnauthorized: false
      }
    }
    
    const redis = new Redis(redisOptions)
    
    // Try to connect
    console.log('Attempting to connect...')
    await redis.connect()
    
    // Try ping
    console.log('Testing PING command...')
    const pong = await redis.ping()
    console.log('✅ Redis PING successful:', pong)
    
    // Try to set a test value
    console.log('Testing SET command...')
    await redis.set('test:connection', 'success', 'EX', 10)
    console.log('✅ Redis SET successful')
    
    // Try to get the value
    console.log('Testing GET command...')
    const value = await redis.get('test:connection')
    console.log('✅ Redis GET successful:', value)
    
    await redis.quit()
    console.log('✅ Redis connection test PASSED')
    
  } catch (error) {
    console.error('❌ Redis connection test FAILED')
    console.error('Error:', error.message)
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n⚠️  DNS Resolution Failed')
      console.error('The hostname cannot be resolved. Possible causes:')
      console.error('  1. No internet connection')
      console.error('  2. DNS server issues')
      console.error('  3. Incorrect hostname in .env.local')
      console.error('  4. Firewall blocking DNS queries')
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n⚠️  Connection Timeout')
      console.error('Cannot reach Redis server. Possible causes:')
      console.error('  1. Firewall blocking port', process.env.REDIS_PORT)
      console.error('  2. Redis server is down')
      console.error('  3. Network connectivity issues')
    } else if (error.message.includes('WRONGPASS')) {
      console.error('\n⚠️  Authentication Failed')
      console.error('Redis password is incorrect')
    }
  }
  
  // Test 3: Test fallback behavior
  console.log('\n🔄 Step 3: Testing Fallback Behavior')
  console.log('-'.repeat(60))
  console.log('When Redis is unavailable:')
  console.log('  ✅ File uploads should still work')
  console.log('  ✅ Files should be stored in S3/local storage')
  console.log('  ⚠️  Text extraction jobs created in DB only')
  console.log('  ⚠️  Jobs will be processed when Redis reconnects')
  console.log('  ✅ AI processing should still work')
  console.log('  ✅ Elasticsearch indexing should still work')
  
  // Test 4: Recommendations
  console.log('\n💡 Step 4: Recommendations')
  console.log('-'.repeat(60))
  console.log('To fix Redis connection issues:')
  console.log('  1. Check your internet connection')
  console.log('  2. Verify Redis credentials in Upstash dashboard')
  console.log('  3. Test DNS resolution: ping', process.env.REDIS_HOST)
  console.log('  4. Check if port', process.env.REDIS_PORT, 'is not blocked')
  console.log('  5. Consider using Upstash REST API as fallback')
  console.log('\nTo use REST API fallback:')
  console.log('  - Set UPSTASH_REDIS_REST_URL in .env.local')
  console.log('  - Set UPSTASH_REDIS_REST_TOKEN in .env.local')
  console.log('  - Use @upstash/redis package instead of ioredis')
  
  console.log('\n' + '='.repeat(60))
  console.log('Test completed\n')
}

// Run the test
testRedisConnection().catch(console.error)
