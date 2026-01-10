// Diagnostic script for the specific file issue
const fs = require('fs');
const path = require('path');

async function diagnoseFileIssue() {
  console.log('🔍 Diagnosing File Access Issue...\n');
  
  // The problematic file path from the error
  const problematicPath = 'C:\\class project\\coprate digital library\\corporate-digital-library-yv\\storage\\files\\3\\1767348999987-8dc279683910ec34-financial_transactions.xlsx';
  
  console.log('Problematic path:', problematicPath);
  console.log('Path length:', problematicPath.length);
  console.log('Contains spaces:', problematicPath.includes(' '));
  
  // Test different path representations
  const pathVariations = [
    problematicPath,
    path.normalize(problematicPath),
    path.resolve(problematicPath),
    `"${problematicPath}"`, // Quoted version
  ];
  
  console.log('\n📁 Testing path variations:');
  
  for (let i = 0; i < pathVariations.length; i++) {
    const testPath = pathVariations[i];
    console.log(`\n${i + 1}. Testing: ${testPath}`);
    
    try {
      if (fs.existsSync(testPath)) {
        console.log('   ✅ Path exists');
        
        const stats = fs.statSync(testPath);
        console.log(`   📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   📅 Modified: ${stats.mtime.toISOString()}`);
        console.log(`   🔒 Readable: ${fs.constants.R_OK & fs.accessSync(testPath, fs.constants.R_OK) || 'Yes'}`);
        
        // Try to read a small portion
        try {
          const buffer = fs.readFileSync(testPath, { start: 0, end: 100 });
          console.log(`   📖 First 100 bytes readable: Yes (${buffer.length} bytes)`);
        } catch (readError) {
          console.log(`   📖 Read test failed: ${readError.message}`);
        }
        
      } else {
        console.log('   ❌ Path does not exist');
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Check parent directories
  console.log('\n📂 Checking parent directories:');
  const parentDir = path.dirname(problematicPath);
  console.log(`Parent directory: ${parentDir}`);
  
  try {
    if (fs.existsSync(parentDir)) {
      console.log('✅ Parent directory exists');
      
      const files = fs.readdirSync(parentDir);
      console.log(`📁 Files in directory (${files.length}):`);
      files.slice(0, 5).forEach(file => {
        console.log(`   - ${file}`);
      });
      if (files.length > 5) {
        console.log(`   ... and ${files.length - 5} more files`);
      }
      
      // Check if our specific file is in the list
      const fileName = path.basename(problematicPath);
      if (files.includes(fileName)) {
        console.log(`✅ Target file "${fileName}" found in directory`);
      } else {
        console.log(`❌ Target file "${fileName}" NOT found in directory`);
        console.log('🔍 Similar files:');
        const similarFiles = files.filter(f => f.includes('financial') || f.includes('transaction'));
        similarFiles.forEach(file => console.log(`   - ${file}`));
      }
      
    } else {
      console.log('❌ Parent directory does not exist');
    }
  } catch (error) {
    console.log(`❌ Error checking parent directory: ${error.message}`);
  }
  
  // Check current working directory and relative paths
  console.log('\n🏠 Current working directory:', process.cwd());
  
  // Try relative path from current directory
  const relativePath = path.relative(process.cwd(), problematicPath);
  console.log(`📍 Relative path: ${relativePath}`);
  
  if (fs.existsSync(relativePath)) {
    console.log('✅ Relative path works');
  } else {
    console.log('❌ Relative path does not work');
  }
  
  console.log('\n🎯 Recommendations:');
  console.log('1. Check if the file was moved or deleted');
  console.log('2. Verify file permissions');
  console.log('3. Try using short path names (8.3 format) if on Windows');
  console.log('4. Consider moving files to paths without spaces');
  console.log('5. Check if antivirus is blocking file access');
}

// Run the diagnostic
diagnoseFileIssue().catch(console.error);