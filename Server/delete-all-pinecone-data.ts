// delete-all-pinecone-data.ts
// Script to delete all vectors from Pinecone for a fresh start
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

dotenv.config();

async function deleteAllData() {
  console.log('🧹 Starting Pinecone data cleanup...\n');

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
    console.error('❌ Missing Pinecone credentials in .env file');
    console.log('\n💡 Make sure your Server/.env file has:');
    console.log('   PINECONE_API_KEY=your_api_key');
    console.log('   PINECONE_INDEX_NAME=nubiq-ai-memory');
    return;
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  const indexName = process.env.PINECONE_INDEX_NAME;
  console.log(`📊 Index: ${indexName}`);

  try {
    const index = pinecone.Index(indexName);
    
    // Get stats before deletion
    console.log('📈 Checking current data...');
    const statsBefore = await index.describeIndexStats();
    const totalVectors = statsBefore.totalRecordCount || 0;
    
    console.log(`\n📊 Found ${totalVectors} vector(s) in the index`);
    
    if (totalVectors === 0) {
      console.log('✨ Index is already empty! Nothing to delete.');
      console.log('\n🎉 You have a fresh start!\n');
      return;
    }

    // Show what we're about to delete
    console.log('\n⚠️  WARNING: This will delete ALL data including:');
    console.log('   - All user conversations');
    console.log('   - All user profiles');
    console.log('   - All chat history');
    console.log('   - All vector embeddings');
    
    console.log('\n🗑️  Deleting all vectors...');
    await index.namespace('').deleteAll();
    
    // Wait for deletion to propagate
    console.log('⏳ Waiting for deletion to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify deletion
    const statsAfter = await index.describeIndexStats();
    const remainingVectors = statsAfter.totalRecordCount || 0;
    
    console.log(`\n✅ Deletion complete!`);
    console.log(`📉 Deleted: ${totalVectors} vectors`);
    console.log(`📊 Remaining: ${remainingVectors} vectors`);
    
    if (remainingVectors === 0) {
      console.log('\n🎉 SUCCESS! Your Pinecone index is now completely clean!');
    } else {
      console.log('\n⚠️  Some vectors may still be processing deletion...');
      console.log('   Run this script again in a few seconds if needed.');
    }
    
    console.log('\n📝 Next steps:');
    console.log('1. Restart your backend server: cd Server && npm start');
    console.log('2. Open your app and sign in with Firebase');
    console.log('3. Create new chats - they will be saved with real Firebase UIDs');
    console.log('4. Test persistence by signing out and back in');
    console.log('5. Check that data loads correctly with proper authentication\n');
    
  } catch (error: any) {
    console.error('\n❌ Error during deletion:', error.message);
    
    if (error.message.includes('not found') || error.message.includes('does not exist')) {
      console.log('\n💡 Your Pinecone index does not exist yet.');
      console.log('\nTo create it:');
      console.log('1. Go to https://app.pinecone.io/');
      console.log(`2. Create a new index with name: ${indexName}`);
      console.log('3. Set dimensions: 768');
      console.log('4. Set metric: cosine');
      console.log('5. Click "Create Index"');
      console.log('\nThen run this script again.\n');
    } else if (error.message.includes('authentication') || error.message.includes('api key')) {
      console.log('\n💡 Authentication error. Check your PINECONE_API_KEY in Server/.env');
      console.log('   Make sure it starts with "pcsk_" and is valid.\n');
    } else {
      console.log('\n💡 Unexpected error. Please check:');
      console.log('   - Your internet connection');
      console.log('   - Pinecone API status');
      console.log('   - Your .env file configuration\n');
    }
  }
}

// Run the deletion
console.log('═══════════════════════════════════════════════════════');
console.log('     PINECONE DATA DELETION SCRIPT');
console.log('═══════════════════════════════════════════════════════\n');

deleteAllData()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('Script completed successfully');
    console.log('═══════════════════════════════════════════════════════\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
