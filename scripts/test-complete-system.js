#!/usr/bin/env node

/**
 * Comprehensive System Test Script
 * Tests all major functionality including upload, AI processing, tracking, and debugging
 */

const fs = require('fs')
const path = require('path')

// Test configuration
const BASE_URL = 'http://localhost:3000'
const TEST_FILE_PATH = path.join(__dirname, 'test-document.txt')

// Create a test document if it doesn't exist
function createTestDocument() {
  const testContent = `
Corporate Digital Library Test Document

This is a comprehensive test document for the corporate digital library system.

Key Features:
- Document management and storage
- AI-powered content analysis
- Advanced search capabilities
- User permission management
- Audit logging and tracking

Business Benefits:
- Improved document organization
- Enhanced searchability
- Automated content insights
- Secure access control
- Comprehensive analytics

Technical Implementation:
- Hybrid storage (local + S3)
- Elasticsearch integration
- OpenAI API integration
- Redis caching
- MySQL database

This document contains sufficient content for AI analysis and text extraction testing.
The system should be able to generate meaningful summaries, tags, and insights from this content.
`

  if (!fs.existsSync(TEST_FILE_PATH)) {
    fs.writeFileSync(TEST_FILE_PATH, testContent.trim())
    console.log('✅ Test document created:', TEST_FILE_PATH)
  }
}

// Test functions
async function testSystemHealth() {
  console.log('\n🔍 Testing System Health...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`)
    const data = await response.json()
    
    if (data.status === 'healthy') {
      console.log('✅ System health check passed')
      console.log('   Database:', data.checks.database ? '✅' : '❌')
      console.log('   Redis:', data.checks.redis ? '✅' : '❌')
      console.log('   Elasticsearch:', data.checks.elasticsearch ? '✅' : '❌')
      console.log('   Storage:', data.checks.storage ? '✅' : '❌')
      return true
    } else {
      console.log('❌ System health check failed:', data.message)
      return false
    }
  } catch (error) {
    console.log('❌ System health check error:', error.message)
    return false
  }
}

async function testElasticsearch() {
  console.log('\n🔍 Testing Elasticsearch...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/test/elasticsearch`)
    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Elasticsearch test passed')
      console.log('   Status:', data.elasticsearch.status)
      console.log('   Version:', data.elasticsearch.version)
      console.log('   Cluster:', data.elasticsearch.cluster_name)
      return true
    } else {
      console.log('❌ Elasticsearch test failed:', data.error)
      return false
    }
  } catch (error) {
    console.log('❌ Elasticsearch test error:', error.message)
    return false
  }
}

async function testFileUpload(authToken, folderId = 1) {
  console.log('\n📁 Testing File Upload...')
  
  try {
    if (!fs.existsSync(TEST_FILE_PATH)) {
      throw new Error('Test file not found')
    }

    const formData = new FormData()
    const fileBuffer = fs.readFileSync(TEST_FILE_PATH)
    const blob = new Blob([fileBuffer], { type: 'text/plain' })
    
    formData.append('file', blob, 'test-document.txt')
    formData.append('folderId', folderId.toString())
    formData.append('description', 'Test document for system validation')
    formData.append('tags', 'test,validation,system-check')
    formData.append('visibility', 'org')
    formData.append('department', 'IT')

    const response = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ File upload successful')
      console.log('   File ID:', data.file.id)
      console.log('   File Name:', data.file.name)
      console.log('   Processing Time:', data.processingTime + 'ms')
      console.log('   AI Processing:', data.file.upload_metadata.ai_processing_enabled ? '✅' : '❌')
      console.log('   Text Extraction:', data.file.upload_metadata.text_extraction_enabled ? '✅' : '❌')
      console.log('   Elasticsearch:', data.file.upload_metadata.elasticsearch_indexed ? '✅' : '❌')
      return data.file.id
    } else {
      console.log('❌ File upload failed:', data.error)
      return null
    }
  } catch (error) {
    console.log('❌ File upload error:', error.message)
    return null
  }
}

async function testUploadStatus(authToken, fileId) {
  console.log('\n🔍 Testing Upload Status...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/debug/upload-status?fileId=${fileId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ Upload status retrieved')
      console.log('   File Name:', data.file.name)
      console.log('   Text Extraction Status:', data.processing_status.text_extraction.status)
      console.log('   AI Processing Status:', data.processing_status.ai_processing.status)
      console.log('   Elasticsearch Status:', data.processing_status.elasticsearch.status)
      console.log('   View Count:', data.metadata.view_count)
      console.log('   Download Count:', data.metadata.download_count)
      return true
    } else {
      console.log('❌ Upload status failed:', data.error)
      return false
    }
  } catch (error) {
    console.log('❌ Upload status error:', error.message)
    return false
  }
}

async function testAISummary(authToken, fileId) {
  console.log('\n🤖 Testing AI Summary Generation...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/files/${fileId}/ai-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ AI summary generated')
      console.log('   Summary Length:', data.summary.length, 'characters')
      console.log('   Summary Preview:', data.summary.substring(0, 100) + '...')
      return true
    } else {
      console.log('❌ AI summary failed:', data.error)
      return false
    }
  } catch (error) {
    console.log('❌ AI summary error:', error.message)
    return false
  }
}

async function testFileTracking(authToken, fileId) {
  console.log('\n📊 Testing File Tracking...')
  
  try {
    // Test view tracking
    const viewResponse = await fetch(`${BASE_URL}/api/files/${fileId}/track`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'view' })
    })

    const viewData = await viewResponse.json()
    
    if (viewData.success) {
      console.log('✅ View tracking successful')
      console.log('   View Count:', viewData.file.view_count)
    } else {
      console.log('❌ View tracking failed:', viewData.error)
      return false
    }

    // Test download tracking
    const downloadResponse = await fetch(`${BASE_URL}/api/files/${fileId}/track`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'download' })
    })

    const downloadData = await downloadResponse.json()
    
    if (downloadData.success) {
      console.log('✅ Download tracking successful')
      console.log('   Download Count:', downloadData.file.download_count)
      return true
    } else {
      console.log('❌ Download tracking failed:', downloadData.error)
      return false
    }
  } catch (error) {
    console.log('❌ File tracking error:', error.message)
    return false
  }
}

async function testSystemDebug(authToken) {
  console.log('\n🔧 Testing System Debug...')
  
  try {
    const response = await fetch(`${BASE_URL}/api/debug/system-health`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })

    const data = await response.json()
    
    if (data.success) {
      console.log('✅ System debug successful')
      console.log('   System Status:', data.system.status)
      console.log('   Database Status:', data.database.status)
      console.log('   Redis Status:', data.redis.status)
      console.log('   Elasticsearch Status:', data.elasticsearch.status)
      console.log('   Storage Status:', data.storage.status)
      console.log('   AI Service Status:', data.ai_service.status)
      return true
    } else {
      console.log('❌ System debug failed:', data.error)
      return false
    }
  } catch (error) {
    console.log('❌ System debug error:', error.message)
    return false
  }
}

// Main test runner
async function runCompleteSystemTest() {
  console.log('🚀 Starting Complete System Test')
  console.log('================================')
  
  // Create test document
  createTestDocument()
  
  // Test results
  const results = {
    systemHealth: false,
    elasticsearch: false,
    fileUpload: false,
    uploadStatus: false,
    aiSummary: false,
    fileTracking: false,
    systemDebug: false
  }
  
  // Note: This test requires authentication
  // In a real scenario, you would need to:
  // 1. Create a test user account
  // 2. Login to get an auth token
  // 3. Use that token for authenticated requests
  
  const authToken = 'YOUR_AUTH_TOKEN_HERE' // Replace with actual token
  
  if (authToken === 'YOUR_AUTH_TOKEN_HERE') {
    console.log('\n⚠️  Authentication token required')
    console.log('   Please update the authToken variable with a valid JWT token')
    console.log('   You can get one by logging into the system and checking the browser storage')
    return
  }
  
  // Run tests
  results.systemHealth = await testSystemHealth()
  results.elasticsearch = await testElasticsearch()
  
  if (results.systemHealth && results.elasticsearch) {
    const fileId = await testFileUpload(authToken)
    results.fileUpload = !!fileId
    
    if (fileId) {
      // Wait a bit for processing
      console.log('\n⏳ Waiting 10 seconds for processing...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      results.uploadStatus = await testUploadStatus(authToken, fileId)
      results.aiSummary = await testAISummary(authToken, fileId)
      results.fileTracking = await testFileTracking(authToken, fileId)
    }
  }
  
  results.systemDebug = await testSystemDebug(authToken)
  
  // Print summary
  console.log('\n📋 Test Results Summary')
  console.log('=======================')
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`)
  })
  
  const passedTests = Object.values(results).filter(Boolean).length
  const totalTests = Object.keys(results).length
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`)
  
  if (passedTests === totalTests) {
    console.log('🎉 All systems operational!')
  } else {
    console.log('⚠️  Some systems need attention')
  }
  
  // Cleanup
  if (fs.existsSync(TEST_FILE_PATH)) {
    fs.unlinkSync(TEST_FILE_PATH)
    console.log('🧹 Test file cleaned up')
  }
}

// Run the test
if (require.main === module) {
  runCompleteSystemTest().catch(console.error)
}

module.exports = {
  runCompleteSystemTest,
  testSystemHealth,
  testElasticsearch,
  testFileUpload,
  testUploadStatus,
  testAISummary,
  testFileTracking,
  testSystemDebug
}