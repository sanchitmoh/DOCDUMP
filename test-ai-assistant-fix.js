// Test the AI assistant with the fixed Excel reading
const https = require('https');
const http = require('http');

async function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(data))
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            json: () => Promise.resolve({ error: 'Invalid JSON response' })
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testAIAssistantFix() {
  console.log('🧪 Testing AI Assistant with Fixed Excel Reading...\n');
  
  try {
    const response = await makeRequest('http://localhost:3000/api/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Analyze this financial data and create beautiful charts with insights',
        userId: 1,
        orgId: 3,
        fileId: 14, // The problematic file ID
        fileName: 'financial_transactions.xlsx'
      })
    });
    
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Success:', data.success);
    
    if (data.success && data.data) {
      console.log('✅ AI Assistant Response Generated');
      console.log('Response Length:', data.data.response.length);
      console.log('Charts Generated:', data.data.charts?.length || 0);
      console.log('Insights Count:', data.data.insights?.length || 0);
      console.log('Has File Context:', data.data.metadata?.hasFileContext || false);
      
      if (data.data.charts && data.data.charts.length > 0) {
        console.log('\n📊 Generated Charts:');
        data.data.charts.forEach((chart, index) => {
          console.log(`  ${index + 1}. ${chart.type}: ${chart.title}`);
          console.log(`     Data points: ${chart.data?.length || 0}`);
        });
      }
      
      if (data.data.insights && data.data.insights.length > 0) {
        console.log('\n💡 Key Insights:');
        data.data.insights.slice(0, 3).forEach((insight, index) => {
          console.log(`  ${index + 1}. ${insight}`);
        });
      }
      
    } else {
      console.log('❌ AI Assistant Failed');
      console.log('Error:', data.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the development server is running: npm run dev');
    }
  }
}

testAIAssistantFix();