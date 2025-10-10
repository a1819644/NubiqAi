// Test script for Pinecone integration
// Run with: npx ts-node test-pinecone.ts

require('dotenv').config();
import { getEmbeddingService, MemoryItem } from './services/embeddingService';

async function testPineconeIntegration() {
  console.log('🚀 Testing Pinecone integration...\n');

  try {
    const embeddingService = getEmbeddingService();
    
    // Test 1: Check index connectivity
    console.log('1. Checking index connectivity...');
    await embeddingService.ensureIndexExists();
    console.log('✅ Index connection successful\n');

    // Test 2: Get initial stats
    console.log('2. Getting memory statistics...');
    const initialStats = await embeddingService.getMemoryStats();
    console.log(`📊 Initial stats: ${initialStats.totalVectors} vectors, ${initialStats.indexDimension} dimensions\n`);

    // Test 3: Store test memories
    console.log('3. Storing test memories...');
    const testMemories: MemoryItem[] = [
      {
        id: 'test_memory_1',
        content: 'The user prefers React with TypeScript for frontend development',
        metadata: {
          timestamp: Date.now(),
          type: 'note',
          userId: 'test_user',
          tags: ['preferences', 'development', 'frontend']
        }
      },
      {
        id: 'test_memory_2', 
        content: 'The user has experience with Node.js and Express for backend APIs',
        metadata: {
          timestamp: Date.now(),
          type: 'note',
          userId: 'test_user',
          tags: ['skills', 'backend']
        }
      },
      {
        id: 'test_memory_3',
        content: 'The user asked about implementing authentication with JWT tokens',
        metadata: {
          timestamp: Date.now(),
          type: 'conversation',
          userId: 'test_user',
          tags: ['authentication', 'security']
        }
      }
    ];

    await embeddingService.storeMemories(testMemories);
    console.log('✅ Test memories stored successfully\n');

    // Test 4: Search memories
    console.log('4. Searching for relevant memories...');
    const searchQueries = [
      'What does the user know about frontend development?',
      'Tell me about the user\'s backend experience',
      'Has the user asked about security features?'
    ];

    for (const query of searchQueries) {
      console.log(`\nQuery: "${query}"`);
      const results = await embeddingService.searchMemories(query, {
        topK: 2,
        threshold: 0.5,
        userId: 'test_user'
      });
      
      if (results.length > 0) {
        results.forEach((result, index) => {
          console.log(`  Result ${index + 1} (score: ${result.score.toFixed(3)}): ${result.content}`);
        });
      } else {
        console.log('  No relevant memories found');
      }
    }

    // Test 5: Get updated stats
    console.log('\n5. Getting updated statistics...');
    const updatedStats = await embeddingService.getMemoryStats();
    console.log(`📊 Updated stats: ${updatedStats.totalVectors} vectors (+${updatedStats.totalVectors - initialStats.totalVectors})\n`);

    // Test 6: Cleanup test memories
    console.log('6. Cleaning up test memories...');
    for (const memory of testMemories) {
      await embeddingService.deleteMemory(memory.id);
    }
    console.log('✅ Test memories cleaned up\n');

    console.log('🎉 All tests passed! Pinecone integration is working correctly.');

  } catch (error: any) {
    console.error('❌ Test failed:', error);
    
    if (error?.message?.includes('PINECONE_API_KEY')) {
      console.log('\n💡 Make sure to set up your .env file with:');
      console.log('   PINECONE_API_KEY=your_api_key');
      console.log('   PINECONE_INDEX_NAME=nubiq-ai-memory');
      console.log('   GEMINI_API_KEY=your_gemini_key');
    }
    
    if (error?.message?.includes('does not exist')) {
      console.log('\n💡 Create a Pinecone index with:');
      console.log('   Name: nubiq-ai-memory');
      console.log('   Dimensions: 768');
      console.log('   Metric: cosine');
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPineconeIntegration();
}