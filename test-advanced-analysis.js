// Test script for advanced data analysis system
const fetch = require('node-fetch');

async function testAdvancedAnalysis() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Advanced Data Analysis System...\n');
  
  try {
    // Test 1: AI Assistant Chat with file analysis
    console.log('1. Testing AI Assistant with file analysis...');
    const chatResponse = await fetch(`${baseUrl}/api/ai-assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Analyze this spreadsheet and create visualizations',
        userId: 1,
        orgId: 1,
        fileId: 14, // FSI-2023-DOWNLOAD.xlsx
        fileName: 'FSI-2023-DOWNLOAD.xlsx'
      })
    });
    
    const chatData = await chatResponse.json();
    console.log('✅ Chat Response:', chatData.success ? 'Success' : 'Failed');
    if (chatData.data) {
      console.log(`   - Charts generated: ${chatData.data.charts?.length || 0}`);
      console.log(`   - Insights: ${chatData.data.insights?.length || 0}`);
      console.log(`   - Has file context: ${chatData.data.metadata?.hasFileContext || false}`);
    }
    console.log();
    
    // Test 2: Direct data analysis
    console.log('2. Testing direct data analysis...');
    const analysisResponse = await fetch(`${baseUrl}/api/analyze-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: 14,
        analysisType: 'comprehensive'
      })
    });
    
    const analysisData = await analysisResponse.json();
    console.log('✅ Analysis Response:', analysisData.success ? 'Success' : 'Failed');
    if (analysisData.data?.analysis) {
      const analysis = analysisData.data.analysis;
      console.log(`   - Total records: ${analysis.summary?.totalRecords || 0}`);
      console.log(`   - Columns: ${analysis.summary?.columns?.length || 0}`);
      console.log(`   - Chart suggestions: ${analysis.chartSuggestions?.length || 0}`);
      console.log(`   - Insights: ${analysis.insights?.length || 0}`);
    }
    console.log();
    
    // Test 3: Chart generation
    console.log('3. Testing chart generation...');
    const chartsResponse = await fetch(`${baseUrl}/api/generate-charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: 14,
        chartTypes: ['bar', 'line', 'pie']
      })
    });
    
    const chartsData = await chartsResponse.json();
    console.log('✅ Charts Response:', chartsData.success ? 'Success' : 'Failed');
    if (chartsData.data) {
      console.log(`   - Charts generated: ${chartsData.data.totalCharts || 0}`);
      console.log(`   - Chart types: ${chartsData.data.summary?.chartTypes?.join(', ') || 'None'}`);
    }
    console.log();
    
    // Test 4: AI insights
    console.log('4. Testing AI insights generation...');
    const insightsResponse = await fetch(`${baseUrl}/api/data-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: 14,
        insightType: 'comprehensive',
        focusAreas: ['financial', 'trends']
      })
    });
    
    const insightsData = await insightsResponse.json();
    console.log('✅ Insights Response:', insightsData.success ? 'Success' : 'Failed');
    if (insightsData.data?.insights) {
      const insights = insightsData.data.insights;
      console.log(`   - Statistical insights: ${insights.statistical?.keyMetrics?.length || 0} metrics`);
      console.log(`   - AI insights: ${insights.ai?.businessInsights?.length || 0} business insights`);
      console.log(`   - Recommendations: ${insights.actionable?.length || 0}`);
      console.log(`   - Confidence: ${insightsData.data.confidence || 0}%`);
    }
    console.log();
    
    console.log('🎉 Advanced Analysis System Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the development server is running: npm run dev');
    }
  }
}

// Run the test
testAdvancedAnalysis();