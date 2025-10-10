// Dimension checker utility
require('dotenv').config();
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';

async function checkDimensions() {
  console.log('🔍 Checking embedding and index dimensions...\n');

  try {
    // Check Pinecone index dimensions
    console.log('1. Checking Pinecone index dimensions...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    
    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();
    
    console.log(`📊 Pinecone index "${indexName}" dimension: ${stats.dimension}`);

    // Check Google embedding dimensions
    console.log('\n2. Checking Google embedding dimensions...');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const testText = "This is a test to check embedding dimensions";
    
    const models = [
      'text-embedding-004',
      'embedding-001',
      'models/embedding-001'
    ];

    for (const model of models) {
      try {
        console.log(`\nTesting model: ${model}`);
        const response = await ai.models.embedContent({
          model,
          contents: [{ parts: [{ text: testText }] }]
        });

        if (response.embeddings?.[0]?.values) {
          const dimension = response.embeddings[0].values.length;
          console.log(`✅ ${model}: ${dimension} dimensions`);
          
          if (dimension === stats.dimension) {
            console.log(`🎉 MATCH! ${model} produces ${dimension} dimensions, matching your index!`);
          }
        }
      } catch (err: any) {
        console.log(`❌ ${model}: ${err.message}`);
      }
    }

    // Provide recommendations
    console.log('\n📝 Recommendations:');
    
    if (stats.dimension === 768) {
      console.log('✅ Your index is correctly configured for text-embedding-004 (768 dimensions)');
    } else if (stats.dimension === 1024) {
      console.log('⚠️  Your index has 1024 dimensions. Options:');
      console.log('   1. Recreate your Pinecone index with 768 dimensions for text-embedding-004');
      console.log('   2. Or use a different embedding model that produces 1024 dimensions');
    } else {
      console.log(`⚠️  Your index has ${stats.dimension} dimensions. You need to find a compatible embedding model.`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error?.message || error);
    
    if (error?.message?.includes('PINECONE_API_KEY')) {
      console.log('\n💡 Make sure PINECONE_API_KEY is set in your .env file');
    }
    if (error?.message?.includes('GEMINI_API_KEY')) {
      console.log('\n💡 Make sure GEMINI_API_KEY is set in your .env file');
    }
  }
}

// Instructions for fixing dimension mismatch
console.log('🔧 How to fix dimension mismatch:\n');
console.log('Option 1 - Recreate Pinecone index (RECOMMENDED):');
console.log('1. Go to Pinecone console');
console.log('2. Delete your current index');
console.log('3. Create new index:');
console.log('   - Name: nubiq-ai-memory');
console.log('   - Dimensions: 768');
console.log('   - Metric: cosine');
console.log('   - Pod type: starter\n');

console.log('Option 2 - Use different embedding model:');
console.log('- Find a model that produces 1024 dimensions');
console.log('- Update embeddingService.ts to use that model\n');

// Run the check if this file is executed directly
if (require.main === module) {
  checkDimensions();
}