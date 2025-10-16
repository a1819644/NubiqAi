# 🧪 Test Image Generation - Quick Diagnostic

## Quick Test Script

Run this in your backend terminal to test Gemini image generation directly:

```javascript
// test-image-gen.js
require('dotenv').config();
const { GoogleGenAI } = require('@google/generative-ai');

async function testImageGeneration() {
  console.log('🧪 Testing Gemini Image Generation...\n');
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env');
    return;
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    console.log('📸 Requesting image: "a simple red circle"...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: ['a simple red circle'],
    });
    
    console.log('✅ Response received!\n');
    
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    console.log(`📦 Number of parts: ${parts.length}\n`);
    
    parts.forEach((part, idx) => {
      console.log(`--- Part ${idx + 1} ---`);
      
      if (part.inlineData) {
        console.log(`  📸 Type: inlineData`);
        console.log(`  📝 MIME Type: ${part.inlineData.mimeType}`);
        console.log(`  📏 Data Length: ${part.inlineData.data?.length || 0} characters`);
        console.log(`  🔍 Data Preview: ${part.inlineData.data?.substring(0, 50)}...`);
        
        // Test if it's valid base64
        try {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          console.log(`  ✅ Valid base64 - decoded to ${buffer.length} bytes`);
        } catch (e) {
          console.log(`  ❌ Invalid base64!`);
        }
      }
      
      if (part.fileData) {
        console.log(`  📁 Type: fileData`);
        console.log(`  🔗 URI: ${part.fileData.fileUri}`);
      }
      
      if (part.text) {
        console.log(`  📝 Type: text`);
        console.log(`  💬 Content: ${part.text.substring(0, 100)}`);
      }
      
      console.log();
    });
    
    // Check if we got image data
    const hasImageData = parts.some(p => p.inlineData?.data || p.fileData?.fileUri);
    if (hasImageData) {
      console.log('✅ SUCCESS: Image data found!');
    } else {
      console.log('❌ FAILURE: No image data in response!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

testImageGeneration();
```

## How to Run

```powershell
# In Server directory
node test-image-gen.js
```

## Expected Output (Success)

```
🧪 Testing Gemini Image Generation...

📸 Requesting image: "a simple red circle"...
✅ Response received!

📦 Number of parts: 1

--- Part 1 ---
  📸 Type: inlineData
  📝 MIME Type: image/png
  📏 Data Length: 45231 characters
  🔍 Data Preview: iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAIAAADwf7zU...
  ✅ Valid base64 - decoded to 33923 bytes

✅ SUCCESS: Image data found!
```

## If You See Errors

### Error: "Model not found"
- Gemini image model might not be available in your region
- Try: `gemini-1.5-pro` instead

### Error: "Invalid API key"
- Check your .env file has correct GEMINI_API_KEY

### Error: "Quota exceeded"
- You've hit API limits
- Wait or upgrade plan

### Success but "No image data"
- Gemini response structure might have changed
- Check the raw response structure

## Alternative Models to Try

If `gemini-2.5-flash-image` doesn't work, try:

1. `imagen-3.0-generate-001` (if you have access)
2. `gemini-1.5-pro-vision` (older but stable)
3. `gemini-pro-vision` (deprecated but might work)

Update in `Server/index.ts`:
```typescript
const imageModel = model ?? 'imagen-3.0-generate-001'; // or other model
```
