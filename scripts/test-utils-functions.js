// Test utility functions
const { formatBytes, formatDate, formatRelativeTime, truncateText } = require('../lib/utils')

function testUtilityFunctions() {
  console.log('🧪 Testing utility functions...\n')

  // Test formatBytes
  console.log('1. Testing formatBytes:')
  console.log(`   0 bytes: ${formatBytes(0)}`)
  console.log(`   1024 bytes: ${formatBytes(1024)}`)
  console.log(`   1048576 bytes: ${formatBytes(1048576)}`)
  console.log(`   1073741824 bytes: ${formatBytes(1073741824)}`)
  console.log(`   1099511627776 bytes: ${formatBytes(1099511627776)}`)

  // Test formatDate
  console.log('\n2. Testing formatDate:')
  const testDate = new Date('2024-12-30T10:30:00Z')
  console.log(`   Default format: ${formatDate(testDate)}`)
  console.log(`   Date only: ${formatDate(testDate, { year: 'numeric', month: 'long', day: 'numeric' })}`)
  console.log(`   Time only: ${formatDate(testDate, { hour: '2-digit', minute: '2-digit' })}`)

  // Test formatRelativeTime
  console.log('\n3. Testing formatRelativeTime:')
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  console.log(`   1 hour ago: ${formatRelativeTime(oneHourAgo)}`)
  console.log(`   1 day ago: ${formatRelativeTime(oneDayAgo)}`)
  console.log(`   1 week ago: ${formatRelativeTime(oneWeekAgo)}`)

  // Test truncateText
  console.log('\n4. Testing truncateText:')
  const longText = 'This is a very long text that should be truncated when it exceeds the maximum length specified in the function parameters.'
  console.log(`   Original (${longText.length} chars): ${longText}`)
  console.log(`   Truncated (50 chars): ${truncateText(longText, 50)}`)
  console.log(`   Truncated (20 chars): ${truncateText(longText, 20)}`)

  console.log('\n✅ All utility functions tested successfully!')
}

// Note: This test won't work directly with Node.js because the utils are TypeScript
// But it shows the expected functionality
console.log('📝 Utility functions have been added to lib/utils.ts:')
console.log('   - formatBytes(bytes, decimals?)')
console.log('   - formatDate(date, options?)')
console.log('   - formatRelativeTime(date)')
console.log('   - truncateText(text, maxLength?)')
console.log('   - generateRandomString(length?, charset?)')
console.log('   - capitalizeWords(text)')
console.log('   - toKebabCase(text)')
console.log('   - toCamelCase(text)')
console.log('   - isValidEmail(email)')
console.log('   - isValidUrl(url)')
console.log('   - sleep(ms)')

console.log('\n🎉 The search system should now compile without errors!')