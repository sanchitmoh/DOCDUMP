// Test the API search endpoint
const fetch = require('node-fetch')

async function testAPISearch() {
  try {
    console.log('🔍 Testing API search endpoint...\n')

    // Test 1: Basic search
    console.log('1. Testing basic search...')
    const response1 = await fetch('http://localhost:3000/api/files?search=doc')
    
    if (response1.ok) {
      const data1 = await response1.json()
      console.log(`✅ Basic search works: ${data1.files?.length || 0} files found`)
      
      if (data1.files && data1.files.length > 0) {
        console.log('Sample results:')
        data1.files.slice(0, 3).forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.name} (${file.file_type})`)
        })
      }
    } else {
      console.log(`❌ Basic search failed: ${response1.status} ${response1.statusText}`)
    }

    // Test 2: Search with no results
    console.log('\n2. Testing search with no results...')
    const response2 = await fetch('http://localhost:3000/api/files?search=nonexistentfile')
    
    if (response2.ok) {
      const data2 = await response2.json()
      console.log(`✅ No results search works: ${data2.files?.length || 0} files found`)
    } else {
      console.log(`❌ No results search failed: ${response2.status} ${response2.statusText}`)
    }

    // Test 3: Empty search
    console.log('\n3. Testing empty search...')
    const response3 = await fetch('http://localhost:3000/api/files?search=')
    
    if (response3.ok) {
      const data3 = await response3.json()
      console.log(`✅ Empty search works: ${data3.files?.length || 0} files found`)
    } else {
      console.log(`❌ Empty search failed: ${response3.status} ${response3.statusText}`)
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message)
  }
}

testAPISearch()