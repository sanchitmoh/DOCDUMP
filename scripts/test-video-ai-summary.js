// Test script to check if AI summary works for video files
const fetch = require('node-fetch');

async function testVideoAISummary() {
  try {
    console.log('🎬 Testing AI Summary for Video File (ID: 13)...');
    
    const response = await fetch('http://localhost:3000/api/files/13/ai-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication headers if needed
        'Cookie': 'your-session-cookie-here' // Replace with actual session
      }
    });

    const result = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ AI Summary Generated Successfully!');
      console.log('📝 Summary:', result.summary);
    } else {
      console.log('❌ AI Summary Failed:', result.error);
    }
    
  } catch (error) {
    console.error('🚨 Test Error:', error.message);
  }
}

testVideoAISummary();