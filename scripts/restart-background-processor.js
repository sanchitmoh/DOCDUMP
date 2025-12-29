const { default: fetch } = require('node-fetch');

async function restartProcessor() {
  try {
    console.log('Stopping background processor...');
    let response = await fetch('http://localhost:3000/api/system/background-jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'stop' })
    });

    let result = await response.json();
    console.log('Stop response:', result);

    console.log('Starting background processor...');
    response = await fetch('http://localhost:3000/api/system/background-jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'start' })
    });

    result = await response.json();
    console.log('Start response:', result);

    // Check status
    console.log('Checking status...');
    response = await fetch('http://localhost:3000/api/system/background-jobs');
    result = await response.json();
    console.log('Status:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

restartProcessor();