// Setup validator - run after recreating your Pinecone index
require('dotenv').config();
import { getEmbeddingService } from './services/embeddingService';

async function validateSetup() {
  console.log('🔍 Validating Pinecone setup after index recreation...\n');

  try {
    const embeddingService = getEmbeddingService();
    
    // Step 1: Check index connectivity and dimensions
    console.log('1. Checking index connectivity...');
    await embeddingService.ensureIndexExists();
    
    const stats = await embeddingService.getMemoryStats();
    console.log(`📊 Index dimensions: ${stats.indexDimension}`);
    console.log(`📊 Total vectors: ${stats.totalVectors}\n`);

    // Step 2: Test embedding generation
    console.log('2. Testing embedding generation...');
    const testEmbedding = await embeddingService.generateEmbedding('This is a test');
    console.log(`✅ Generated embedding with ${testEmbedding.length} dimensions\n`);

    // Step 3: Verify dimensions match
    if (testEmbedding.length === stats.indexDimension) {
      console.log('🎉 SUCCESS! Embedding dimensions match index dimensions!');
      
      // Step 4: Test actual storage
      console.log('\n3. Testing memory storage...');
      const testMemory = {
        id: 'validation_test_' + Date.now(),
        content: 'This is a validation test memory',
        metadata: {
          timestamp: Date.now(),
          type: 'note' as const,
          userId: 'validation-test',
          tags: ['test', 'validation']
        }
      };

      await embeddingService.storeMemory(testMemory);
      console.log('✅ Memory storage successful!');

      // Test search
      console.log('\n4. Testing memory search...');
      const searchResults = await embeddingService.searchMemories('validation test', {
        topK: 1,
        threshold: 0.5,
        userId: 'validation-test'
      });

      if (searchResults.length > 0) {
        console.log('✅ Memory search successful!');
        console.log(`Found: "${searchResults[0].content}" (score: ${searchResults[0].score.toFixed(3)})`);
      }

      // Cleanup
      console.log('\n5. Cleaning up test data...');
      await embeddingService.deleteMemory(testMemory.id);
      console.log('✅ Cleanup completed!');

      console.log('\n🚀 Your Pinecone integration is now fully working!');
      console.log('You can now use the memory system in your application.');

    } else {
      console.log(`❌ DIMENSION MISMATCH STILL EXISTS:`);
      console.log(`   Embedding dimensions: ${testEmbedding.length}`);
      console.log(`   Index dimensions: ${stats.indexDimension}`);
      console.log('\n💡 Please recreate your Pinecone index with 768 dimensions.');
    }

  } catch (error: any) {
    console.error('❌ Validation failed:', error?.message || error);
    
    if (error?.message?.includes('does not exist')) {
      console.log('\n💡 Your index does not exist. Please create it in Pinecone console:');
      console.log('   - Name: nubiq-ai-memory');
      console.log('   - Dimensions: 768');
      console.log('   - Metric: cosine');
    }
  }
}

// Usage instructions
console.log('📋 SETUP INSTRUCTIONS:');
console.log('1. Go to Pinecone console: https://app.pinecone.io/');
console.log('2. Delete your current "nubiq-ai-memory" index');
console.log('3. Create new index with:');
console.log('   - Name: nubiq-ai-memory');
console.log('   - Dimensions: 768 (IMPORTANT!)');
console.log('   - Metric: cosine');
console.log('   - Pod type: starter');
console.log('4. Run this validator again\n');

// Run validation if this file is executed directly
if (require.main === module) {
  validateSetup();
}