// Diagnostic script to check Vertex AI setup
// Run: npx ts-node Server/check-vertex-setup.ts

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 Vertex AI Configuration Check\n');

// Check 1: Environment variables
console.log('1️⃣ Environment Variables:');
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const location = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_REGION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log(`   GOOGLE_CLOUD_PROJECT: ${projectId || '❌ NOT SET'}`);
console.log(`   VERTEX_LOCATION: ${location}`);
console.log(`   GOOGLE_APPLICATION_CREDENTIALS: ${credPath || '❌ NOT SET'}\n`);

// Check 2: Credentials file
if (credPath) {
  console.log('2️⃣ Credentials File Check:');
  if (fs.existsSync(credPath)) {
    console.log(`   ✅ File exists at: ${credPath}`);
    try {
      const content = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      console.log(`   Project ID in creds: ${content.project_id || 'N/A'}`);
      console.log(`   Type: ${content.type || 'N/A'}`);
      console.log(`   Client Email: ${content.client_email || 'N/A'}\n`);
    } catch (err) {
      console.log(`   ⚠️ Failed to parse credentials file: ${err}\n`);
    }
  } else {
    console.log(`   ❌ File NOT FOUND at: ${credPath}\n`);
  }
} else {
  console.log('2️⃣ Credentials File: ❌ GOOGLE_APPLICATION_CREDENTIALS not set\n');
}

// Check 3: Internet connectivity test
console.log('3️⃣ Internet Connectivity Test:');
try {
  const https = require('https');
  const req = https.get('https://www.googleapis.com', (res: any) => {
    console.log(`   ✅ Can reach googleapis.com (status: ${res.statusCode})\n`);
    
    // Check 4: Try to initialize Vertex AI
    console.log('4️⃣ Vertex AI Initialization:');
    if (!projectId) {
      console.log('   ❌ Cannot initialize - GOOGLE_CLOUD_PROJECT not set');
      console.log('\n📋 To fix:');
      console.log('   1. Add to Server/.env:');
      console.log('      GOOGLE_CLOUD_PROJECT=your-project-id');
      console.log('      GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json');
      console.log('   2. Restart the server\n');
      process.exit(1);
    }
    
    try {
      const { VertexAI } = require('@google-cloud/vertexai');
      const vertex = new VertexAI({ project: projectId, location });
      console.log(`   ✅ Vertex AI client created successfully`);
      console.log(`   Project: ${projectId}`);
      console.log(`   Location: ${location}\n`);
      
      console.log('5️⃣ Testing API Calls (gemini-2.5-pro, fallback to flash-lite):');

      async function tryModel(modelName: string) {
        console.log(`   → Trying model: ${modelName}`);
        const gm = vertex.getGenerativeModel({ model: modelName });
        const resp = await gm.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'Say hi in 3 words' }] }],
        });
        const text = resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text';
        console.log(`     ✅ Success: ${text}\n`);
      }

      (async () => {
        try {
          await tryModel('gemini-2.5-pro');
          console.log('   ✅ gemini-2.5-pro works\n');
        } catch (err: any) {
          console.log(`     ❌ gemini-2.5-pro failed: ${err?.message || err}`);
          if (err?.code === 404 || /not found|No such model/i.test(err?.message)) {
            console.log('     ℹ️ Model not found in this region or project. Ensure the model is enabled in Vertex AI and region supports it.');
          } else if (err?.code === 403 || /permission/i.test(err?.message)) {
            console.log('     � Permission issue. Ensure service account has roles/aiplatform.user and project billing is enabled.');
          }
          console.log('     → Falling back to gemini-2.0-flash-lite-001');
          try {
            await tryModel('gemini-2.0-flash-lite-001');
            console.log('   ✅ Flash-lite fallback works\n');
          } catch (err2: any) {
            console.log(`     ❌ Fallback also failed: ${err2?.message || err2}`);
            console.log('     Full error:', JSON.stringify(err2, null, 2));
            process.exit(1);
          }
        }
        console.log('✅ Vertex AI test complete.');
      })();
      
    } catch (err: any) {
      console.log(`   ❌ Failed to initialize: ${err.message}\n`);
      process.exit(1);
    }
  });
  
  req.on('error', (err: any) => {
    console.log(`   ❌ Cannot reach googleapis.com: ${err.message}`);
    console.log(`   💡 Vertex AI REQUIRES internet access to work.\n`);
    console.log('📋 Without internet:');
    console.log('   - Vertex AI will NOT work (needs cloud APIs)');
    console.log('   - System will fallback to GEMINI_API_KEY (Google AI Studio)');
    console.log('   - Google AI Studio also requires internet\n');
    process.exit(1);
  });
  
  req.setTimeout(5000, () => {
    console.log(`   ⚠️ Connection timeout (5s) - slow or no internet\n`);
    req.destroy();
  });
  
} catch (err: any) {
  console.log(`   ❌ Error testing connectivity: ${err.message}\n`);
}
