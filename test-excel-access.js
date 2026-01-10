// Test script to verify Excel file access
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

async function testExcelAccess() {
  console.log('🧪 Testing Excel File Access...\n');
  
  // Test file path (update this to match your actual file)
  const testFilePath = path.resolve('./storage/files/3/1767348999987-8dc279683910ec34-financial_transactions.xlsx');
  
  console.log('Testing file path:', testFilePath);
  
  try {
    // Test 1: Check if file exists
    console.log('1. Checking file existence...');
    if (fs.existsSync(testFilePath)) {
      console.log('✅ File exists');
      
      // Get file stats
      const stats = fs.statSync(testFilePath);
      console.log(`   - Size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   - Modified: ${stats.mtime}`);
    } else {
      console.log('❌ File does not exist');
      return;
    }
    
    // Test 2: Read file as buffer
    console.log('\n2. Reading file as buffer...');
    const buffer = fs.readFileSync(testFilePath);
    console.log('✅ Buffer read successfully');
    console.log(`   - Buffer size: ${buffer.length} bytes`);
    
    // Test 3: Parse with XLSX
    console.log('\n3. Parsing with XLSX library...');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log('✅ XLSX parsing successful');
    console.log(`   - Sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Test 4: Extract data from first sheet
    console.log('\n4. Extracting data from first sheet...');
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    console.log('✅ Data extraction successful');
    console.log(`   - Rows: ${jsonData.length}`);
    console.log(`   - Columns: ${jsonData[0] ? jsonData[0].length : 0}`);
    
    if (jsonData.length > 0) {
      console.log(`   - Headers: ${jsonData[0].slice(0, 5).join(', ')}${jsonData[0].length > 5 ? '...' : ''}`);
    }
    
    // Test 5: Sample data
    if (jsonData.length > 1) {
      console.log('\n5. Sample data (first few rows):');
      jsonData.slice(0, 3).forEach((row, index) => {
        console.log(`   Row ${index}: ${row.slice(0, 3).join(' | ')}${row.length > 3 ? '...' : ''}`);
      });
    }
    
    console.log('\n🎉 Excel file access test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Excel access test failed:', error.message);
    
    if (error.code === 'ENOENT') {
      console.log('💡 File not found. Check the file path.');
    } else if (error.code === 'EACCES') {
      console.log('💡 Permission denied. Check file permissions.');
    } else if (error.message.includes('Unsupported file')) {
      console.log('💡 File format not supported. Ensure it\'s a valid Excel file.');
    } else {
      console.log('💡 Unexpected error. Check file integrity and format.');
    }
  }
}

// Run the test
testExcelAccess();