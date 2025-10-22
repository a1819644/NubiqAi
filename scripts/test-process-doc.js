// Quick test for /api/process-document
const fetch = require('node-fetch');

(async () => {
  const url = process.env.API_URL || 'http://localhost:8000/api/process-document';
  const text = 'Hello document processing! This is a tiny sample.';
  const base64 = Buffer.from(text, 'utf8').toString('base64');
  const body = {
    fileBase64: base64,
    mimeType: 'text/plain',
    prompt: 'Extract all text content.'
  };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    console.log('Status:', resp.status);
    console.log('Response:', data);
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  }
})();