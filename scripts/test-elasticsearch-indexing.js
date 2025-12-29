const { default: fetch } = require('node-fetch');

async function testElasticsearchIndexing() {
  try {
    console.log('Testing Elasticsearch indexing...\n');

    // Test current status
    const response = await fetch('http://localhost:3000/api/test/elasticsearch-indexing');
    const result = await response.json();

    console.log('=== ELASTICSEARCH INDEXING STATUS ===');
    console.log(`Elasticsearch Health: ${result.tests.elasticsearch_health.status}`);
    console.log(`Index Exists: ${result.tests.index_exists}`);
    console.log(`Documents in Index: ${result.tests.index_stats?.total_docs || 0}`);
    console.log(`Files in Database: ${result.tests.files_in_database.total}`);
    console.log(`Search Working: ${result.summary.search_working}`);

    console.log('\n=== FILES IN DATABASE ===');
    result.tests.files_in_database.files.forEach(file => {
      console.log(`- File ID: ${file.id}, Name: ${file.name}`);
      console.log(`  Type: ${file.file_type}, Text Length: ${file.text_length || 0}`);
      console.log(`  Index Status: ${file.index_status || 'not indexed'}`);
      if (file.indexed_at) {
        console.log(`  Indexed At: ${file.indexed_at}`);
      }
      if (file.error_message) {
        console.log(`  Error: ${file.error_message}`);
      }
      console.log('---');
    });

    console.log('\n=== INDEX STATUS STATS ===');
    if (result.tests.index_status_stats.length > 0) {
      result.tests.index_status_stats.forEach(stat => {
        console.log(`- ${stat.index_status}: ${stat.count} files`);
      });
    } else {
      console.log('No index status records found');
    }

    console.log('\n=== SEARCH TEST ===');
    if (result.tests.search_test?.error) {
      console.log(`Search Error: ${result.tests.search_test.error}`);
    } else if (result.tests.search_test?.documents) {
      console.log(`Search Results: ${result.tests.search_test.documents.length} documents found`);
    } else {
      console.log('No search results');
    }

    // If index doesn't exist, try to reindex all files
    if (!result.tests.index_exists) {
      console.log('\n=== REINDEXING ALL FILES ===');
      console.log('Index does not exist. Attempting to reindex all files...');

      const reindexResponse = await fetch('http://localhost:3000/api/test/elasticsearch-indexing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'reindex-all' })
      });

      const reindexResult = await reindexResponse.json();
      console.log('Reindex Result:', reindexResult);

      if (reindexResult.success) {
        console.log(`✅ Reindexing completed:`);
        console.log(`   - Total files: ${reindexResult.results.total_files}`);
        console.log(`   - Successfully indexed: ${reindexResult.results.indexed}`);
        console.log(`   - Errors: ${reindexResult.results.errors}`);

        // Test again after reindexing
        console.log('\n=== TESTING AFTER REINDEXING ===');
        const retestResponse = await fetch('http://localhost:3000/api/test/elasticsearch-indexing');
        const retestResult = await retestResponse.json();

        console.log(`Index Exists: ${retestResult.tests.index_exists}`);
        console.log(`Documents in Index: ${retestResult.tests.index_stats?.total_docs || 0}`);
        
        if (retestResult.tests.search_test?.documents) {
          console.log(`Search Results: ${retestResult.tests.search_test.documents.length} documents found`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testElasticsearchIndexing();