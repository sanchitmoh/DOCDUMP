
// Test Upload Script - Run in browser console or as Node.js script

async function testUpload() {
  const formData = new FormData();
  
  // Create a test file
  const testFile = new File(['
# Corporate Digital Library Test Document

## Executive Summary
This is a comprehensive test document designed to evaluate the AI-powered document processing capabilities of our Corporate Digital Library system.

## Key Features Being Tested
1. **Text Extraction**: Verify that content is properly extracted from uploaded documents
2. **AI Description Generation**: Test automatic description creation using OpenAI
3. **Smart Tag Generation**: Evaluate intelligent tag suggestions based on content
4. **Document Analysis**: Assess quality scoring and classification
5. **Search Indexing**: Confirm Elasticsearch integration works correctly

## Department Information
- **Department**: Information Technology
- **Classification**: Internal Documentation
- **Priority**: High
- **Audience**: Development Team

## Technical Specifications
- File processing pipeline integration
- Hybrid storage implementation (S3 + Local)
- Real-time search capabilities
- AI-enhanced metadata generation
- Comprehensive audit logging

## Expected Outcomes
The system should automatically:
- Extract this text content
- Generate a professional description
- Suggest relevant tags like: documentation, testing, IT, development, AI, search
- Classify this as a technical document
- Index all content for search functionality
- Track all processing steps with detailed logging

## Quality Metrics
- Processing time should be under 30 seconds
- AI confidence scores should be above 0.8
- All services (DB, ES, Redis, OpenAI) should respond successfully
- Complete audit trail should be maintained

This document serves as a comprehensive test case for validating the entire upload and processing workflow.
'], 'test-document.txt', {
    type: 'text/plain'
  });
  
  formData.append('file', testFile);
  formData.append('folderId', '1'); // Adjust folder ID as needed
  formData.append('description', 'Test document for debugging upload process');
  formData.append('tags', 'test,debug,documentation');
  formData.append('visibility', 'org');
  formData.append('department', 'IT');
  
  try {
    console.log('🚀 Starting upload test...');
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('📊 Upload Result:', result);
    
    if (result.success) {
      console.log('✅ Upload successful!');
      console.log('📁 File ID:', result.file.id);
      console.log('⏱️ Processing Time:', result.processingTime + 'ms');
      
      // Test debug status endpoint
      setTimeout(async () => {
        console.log('🔍 Checking processing status...');
        const statusResponse = await fetch(`/api/debug/upload-status?fileId=${result.file.id}`);
        const statusResult = await statusResponse.json();
        console.log('📈 Processing Status:', statusResult);
      }, 2000);
      
    } else {
      console.error('❌ Upload failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Upload error:', error);
  }
}

// Run the test
testUpload();
