// Test script to verify real data analysis works
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

async function testRealDataAnalysis() {
  console.log('🧪 Testing Real Data Analysis...\n');
  
  try {
    // Test the exact same file that's causing issues
    const testFilePath = path.resolve('./storage/files/3/1767348999987-8dc279683910ec34-financial_transactions.xlsx');
    
    console.log('1. Reading Excel file directly...');
    console.log('File path:', testFilePath);
    
    // Test buffer reading (same as our service)
    const buffer = fs.readFileSync(testFilePath);
    console.log('✅ Buffer read successfully, size:', buffer.length, 'bytes');
    
    // Parse workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log('✅ Workbook parsed successfully');
    console.log('   Sheets:', workbook.SheetNames.join(', '));
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    console.log('✅ Using sheet:', sheetName);
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('✅ JSON conversion successful');
    console.log('   Total rows:', jsonData.length);
    
    if (jsonData.length > 0) {
      const headers = jsonData[0];
      const dataRows = jsonData.slice(1).filter(row => row && row.some(cell => cell !== undefined && cell !== ''));
      
      console.log('\n2. Data Analysis:');
      console.log('   Headers:', headers.slice(0, 5).join(', '), '...');
      console.log('   Data rows:', dataRows.length);
      console.log('   Columns:', headers.length);
      
      // Sample data analysis
      console.log('\n3. Sample Data:');
      dataRows.slice(0, 3).forEach((row, index) => {
        console.log(`   Row ${index + 1}:`, row.slice(0, 3).join(' | '), '...');
      });
      
      // Analyze specific columns for chart data
      console.log('\n4. Chart Data Analysis:');
      
      // Look for categorical data (for pie charts)
      headers.forEach((header, index) => {
        if (typeof header === 'string') {
          const columnData = dataRows.map(row => row[index]).filter(val => val !== undefined && val !== '');
          const uniqueValues = [...new Set(columnData)];
          
          if (uniqueValues.length <= 10 && uniqueValues.length > 1) {
            console.log(`   📊 ${header}: ${uniqueValues.length} unique values - Good for pie chart`);
            
            // Count occurrences
            const counts = {};
            columnData.forEach(val => {
              counts[val] = (counts[val] || 0) + 1;
            });
            
            console.log('      Values:', Object.entries(counts).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(', '));
          }
          
          // Check for numeric data
          const numericData = columnData.filter(val => !isNaN(Number(val))).map(val => Number(val));
          if (numericData.length > columnData.length * 0.8 && numericData.length > 0) {
            const avg = numericData.reduce((a, b) => a + b, 0) / numericData.length;
            console.log(`   📈 ${header}: Numeric data, avg: ${avg.toFixed(2)} - Good for bar/line chart`);
          }
        }
      });
      
      console.log('\n🎉 Real data analysis test completed successfully!');
      console.log('💡 The system should be able to generate real charts from this data');
      
    } else {
      console.log('❌ No data found in Excel file');
    }
    
  } catch (error) {
    console.error('❌ Real data analysis test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRealDataAnalysis();