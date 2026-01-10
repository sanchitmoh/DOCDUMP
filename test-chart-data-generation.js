// Test script to verify chart data generation
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
            json: () => Promise.resolve({ error: 'Invalid JSON response', raw: data })
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

async function testChartDataGeneration() {
  console.log('🧪 Testing Chart Data Generation...\n');
  
  try {
    console.log('1. Testing AI Assistant with chart request...');
    const response = await makeRequest('http://localhost:3000/api/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Create pie charts and bar charts from my financial data',
        userId: 1,
        orgId: 3,
        fileId: 14,
        fileName: 'financial_transactions.xlsx'
      })
    });
    
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('Success:', data.success);
    
    if (data.success && data.data) {
      console.log('\n2. Analyzing response data...');
      console.log('✅ Response generated');
      console.log('   Response length:', data.data.response?.length || 0);
      console.log('   Charts count:', data.data.charts?.length || 0);
      console.log('   Insights count:', data.data.insights?.length || 0);
      
      if (data.data.charts && data.data.charts.length > 0) {
        console.log('\n3. Chart data analysis:');
        data.data.charts.forEach((chart, index) => {
          console.log(`\n   Chart ${index + 1}:`);
          console.log(`   - Type: ${chart.type || 'undefined'}`);
          console.log(`   - Title: ${chart.title || 'No title'}`);
          console.log(`   - Data points: ${chart.data?.length || 0}`);
          console.log(`   - Config: ${JSON.stringify(chart.config || {})}`);
          
          if (chart.data && chart.data.length > 0) {
            console.log(`   - Sample data:`, chart.data.slice(0, 2));
            
            // Validate data structure for different chart types
            if (chart.type === 'pie') {
              const hasValidPieData = chart.data.every(item => 
                item && typeof item === 'object' && 
                ('name' in item || 'category' in item) && 
                ('value' in item || 'count' in item)
              );
              console.log(`   - Valid pie chart data: ${hasValidPieData}`);
            }
            
            if (chart.type === 'bar') {
              const hasValidBarData = chart.data.every(item => 
                item && typeof item === 'object' && 
                Object.keys(item).length >= 2
              );
              console.log(`   - Valid bar chart data: ${hasValidBarData}`);
            }
          } else {
            console.log(`   ❌ No data in chart ${index + 1}`);
          }
        });
        
        console.log('\n🎉 Chart data generation test completed!');
        
        // Check if we have valid chart data
        const validCharts = data.data.charts.filter(chart => 
          chart && chart.data && chart.data.length > 0
        );
        
        if (validCharts.length > 0) {
          console.log(`✅ ${validCharts.length} charts have valid data`);
        } else {
          console.log('❌ No charts have valid data - this explains why charts are empty');
        }
        
      } else {
        console.log('\n❌ No charts generated');
        console.log('   This explains why no charts are showing');
      }
      
    } else {
      console.log('❌ AI Assistant request failed');
      console.log('Error:', data.error || 'Unknown error');
      if (data.raw) {
        console.log('Raw response:', data.raw.substring(0, 500));
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the development server is running: npm run dev');
    }
  }
}

testChartDataGeneration();