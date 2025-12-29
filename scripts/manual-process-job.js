const { default: fetch } = require('node-fetch');

async function processJob() {
  try {
    const response = await fetch('http://localhost:3000/api/test/process-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jobId: 3 })
    });

    const result = await response.json();
    console.log('Response:', result);

  } catch (error) {
    console.error('Error:', error);
  }
}

processJob();