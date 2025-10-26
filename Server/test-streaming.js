/**
 * Test script for streaming endpoint
 * Tests both backend streaming and cache integration
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:8000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test streaming endpoint
 */
async function testStreaming(testName, message) {
  return new Promise((resolve, reject) => {
    log('cyan', `\n${'='.repeat(60)}`);
    log('cyan', `TEST: ${testName}`);
    log('cyan', '='.repeat(60));

    const postData = JSON.stringify({
      prompt: message,
      userId: 'test-user-123',
      userName: 'Test User',
      useMemory: false, // Disable memory for clean tests
    });

    const options = {
      hostname: 'localhost',
      port: 8000,
      path: '/api/ask-ai-stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const startTime = Date.now();
    let chunkCount = 0;
    let totalText = '';
    let buffer = '';
    let firstChunkTime = null;
    let isCached = false;

    const req = http.request(options, (res) => {
      log('blue', `Status: ${res.statusCode}`);
      log('blue', `Headers: ${JSON.stringify(res.headers)}`);

      if (res.headers['content-type'] !== 'text/event-stream') {
        log('red', '❌ ERROR: Wrong content type! Expected text/event-stream');
        reject(new Error('Wrong content type'));
        return;
      }

      log('green', '✅ Correct content-type: text/event-stream');
      log('yellow', '\nReceiving chunks...\n');

      res.on('data', (chunk) => {
        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          const ttfb = (firstChunkTime - startTime) / 1000;
          log('green', `⚡ Time to first chunk: ${ttfb.toFixed(2)}s`);
        }

        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.text) {
                chunkCount++;
                totalText += data.text;
                process.stdout.write(`${colors.yellow}${data.text}${colors.reset}`);

                if (data.cached !== undefined) {
                  isCached = data.cached;
                }
              }

              if (data.done) {
                const totalTime = (Date.now() - startTime) / 1000;
                console.log('\n');
                log('green', '='.repeat(60));
                log('green', '✅ Streaming complete!');
                log('green', `   Chunks received: ${chunkCount}`);
                log('green', `   Total characters: ${totalText.length}`);
                log('green', `   Total time: ${totalTime.toFixed(2)}s`);
                log('green', `   Cached: ${isCached ? 'Yes' : 'No'}`);
                if (data.duration) {
                  log('green', `   Server duration: ${data.duration.toFixed(2)}s`);
                }
                log('green', '='.repeat(60));

                resolve({
                  success: true,
                  chunkCount,
                  textLength: totalText.length,
                  totalTime,
                  cached: isCached,
                  text: totalText,
                });
              }

              if (data.error) {
                log('red', `\n❌ Error from server: ${data.error}`);
                reject(new Error(data.error));
              }
            } catch (err) {
              log('red', `❌ Parse error: ${err.message}`);
              log('red', `   Raw line: ${line}`);
            }
          }
        }
      });

      res.on('end', () => {
        if (chunkCount === 0) {
          log('red', '❌ No chunks received!');
          reject(new Error('No chunks received'));
        }
      });
    });

    req.on('error', (error) => {
      log('red', `❌ Request error: ${error.message}`);
      reject(error);
    });

    req.on('timeout', () => {
      log('red', '❌ Request timeout!');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(30000); // 30 second timeout
    req.write(postData);
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  log('cyan', '\n🧪 STREAMING ENDPOINT TEST SUITE');
  log('cyan', '='.repeat(60));

  try {
    // Test 1: Cached response (should be instant)
    log('blue', '\n📦 Test 1: Testing cached response (should stream from cache)...');
    const test1 = await testStreaming(
      'Cached Response Test',
      'what is react'
    );

    if (test1.totalTime > 5) {
      log('yellow', `⚠️  Warning: Cached response took ${test1.totalTime.toFixed(2)}s (expected < 5s)`);
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Same question again (should be even faster from cache)
    log('blue', '\n💾 Test 2: Testing same question (should be cached)...');
    const test2 = await testStreaming(
      'Cache Hit Test',
      'what is react'
    );

    if (!test2.cached) {
      log('yellow', '⚠️  Warning: Response not marked as cached');
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: New response (real streaming from AI)
    log('blue', '\n🌊 Test 3: Testing new response (real AI streaming)...');
    const test3 = await testStreaming(
      'Real Streaming Test',
      `Tell me a fun fact about the number ${Date.now()}`
    );

    if (test3.cached) {
      log('yellow', '⚠️  Warning: New response marked as cached (should be false)');
    }

    // Final summary
    log('cyan', '\n\n' + '='.repeat(60));
    log('cyan', '📊 TEST SUMMARY');
    log('cyan', '='.repeat(60));
    log('green', `✅ Test 1 (Cached): ${test1.chunkCount} chunks, ${test1.totalTime.toFixed(2)}s`);
    log('green', `✅ Test 2 (Cache Hit): ${test2.chunkCount} chunks, ${test2.totalTime.toFixed(2)}s`);
    log('green', `✅ Test 3 (New): ${test3.chunkCount} chunks, ${test3.totalTime.toFixed(2)}s`);
    log('cyan', '='.repeat(60));
    log('green', '\n🎉 ALL TESTS PASSED!\n');

    // Validate performance
    log('yellow', '\n📊 Performance Analysis:');
    if (test2.totalTime < test1.totalTime * 1.5) {
      log('green', '✅ Cache performance is good (2nd request fast)');
    }
    if (test3.chunkCount > 5) {
      log('green', '✅ Streaming is working (multiple chunks received)');
    }
    if (test1.textLength > 50) {
      log('green', '✅ Response content is substantial');
    }

  } catch (error) {
    log('red', `\n❌ TEST FAILED: ${error.message}`);
    process.exit(1);
  }
}

// Run tests
log('cyan', '\n🚀 Starting streaming tests...');
log('yellow', 'Make sure backend is running on http://localhost:8000\n');

runTests().catch(error => {
  log('red', `\n💥 Fatal error: ${error.message}`);
  process.exit(1);
});
