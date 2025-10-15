// Test script to set user profile
const https = require('http');

const data = JSON.stringify({
  userId: 'anoop123',
  name: 'Anoop Kumar',
  background: 'Works at Nubevest'
});

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/set-user-profile',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
