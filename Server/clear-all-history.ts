// clear-all-history.ts
// Complete cleanup script: Deletes ALL local storage, Firebase data, and Pinecone vectors

import { Pinecone } from '@pinecone-database/pinecone';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const RESET_CONFIRMATION = process.argv.includes('--confirm');

async function clearPineconeData() {
  console.log('\n🧹 === PINECONE CLEANUP ===\n');

  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
    console.log('⚠️  Skipping Pinecone (credentials not found)');
    return;
  }

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME;
    const index = pinecone.Index(indexName);

    // Get stats
    const stats = await index.describeIndexStats();
    const totalVectors = stats.totalRecordCount || 0;

    console.log(`📊 Found ${totalVectors} vector(s) in Pinecone index: ${indexName}`);

    if (totalVectors > 0) {
      console.log('🗑️  Deleting all Pinecone vectors...');
      await index.namespace('').deleteAll();
      console.log('✅ Pinecone data deleted!');
    } else {
      console.log('✨ Pinecone is already empty');
    }
  } catch (error) {
    console.error('❌ Pinecone cleanup failed:', error);
  }
}

async function deleteCollection(
  collectionRef: FirebaseFirestore.CollectionReference,
  description: string,
  batchSize = 500
) {
  const db = collectionRef.firestore;
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
  }

  if (deleted > 0) {
    console.log(`✅ ${description}: deleted ${deleted}`);
  } else {
    console.log(`   No ${description} found`);
  }
}

async function clearFirebaseData() {
  console.log('\n🧹 === FIREBASE CLEANUP ===\n');

  if (!fs.existsSync('./serviceAccountKey.json')) {
    console.log('⚠️  Skipping Firebase (serviceAccountKey.json not found)');
    return;
  }

  try {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(
        fs.readFileSync('./serviceAccountKey.json', 'utf8')
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    const db = admin.firestore();

    // Legacy cleanup (pre-Firestore migration)
    console.log('🗑️  Deleting legacy chat histories (chatHistories collection)...');
    await deleteCollection(db.collection('chatHistories'), 'legacy chat record(s)');

    console.log('🗑️  Deleting legacy user profiles (userProfiles collection)...');
    await deleteCollection(db.collection('userProfiles'), 'legacy profile(s)');

    // Current schema cleanup
    console.log('🗑️  Deleting user chat sessions (users/*/activeChats)...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`   Found ${usersSnapshot.size} user document(s)`);

    for (const userDoc of usersSnapshot.docs) {
      console.log(`   ➤ Clearing data for user: ${userDoc.id}`);
      const subCollections = await userDoc.ref.listCollections();

      for (const subCol of subCollections) {
        await deleteCollection(
          subCol,
          `${subCol.id} record(s) for ${userDoc.id}`
        );
      }

      await userDoc.ref.delete();
      console.log(`   ✅ User document removed: ${userDoc.id}`);
    }

    if (usersSnapshot.empty) {
      console.log('   No user chat documents found');
    }

    // Note: Firebase Storage images would need separate cleanup
    console.log('ℹ️  Note: Firebase Storage images not deleted (manual cleanup if needed)');

  } catch (error) {
    console.error('❌ Firebase cleanup failed:', error);
  }
}

async function showLocalStorageCleanupInstructions() {
  console.log('\n🧹 === LOCAL STORAGE CLEANUP ===\n');
  console.log('⚠️  Cannot automatically clear browser localStorage from server.');
  console.log('\n📋 To clear local browser data, run this in your browser console:');
  console.log('\n---');
  console.log('// Clear all local data');
  console.log('localStorage.clear();');
  console.log('sessionStorage.clear();');
  console.log('indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));');
  console.log('console.log("✅ Local storage cleared! Refresh the page.");');
  console.log('---\n');
  console.log('Or simply open DevTools (F12) → Application → Clear site data\n');
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  🗑️  COMPLETE HISTORY CLEANUP SCRIPT  🗑️        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('⚠️  WARNING: This will delete ALL data:');
  console.log('   ❌ All Pinecone vectors (conversations, profiles)');
  console.log('   ❌ All Firebase chat histories');
  console.log('   ❌ All Firebase user profiles');
  console.log('   ⚠️  Local browser storage (manual step)\n');

  if (!RESET_CONFIRMATION) {
    console.log('❌ Safety check: Add --confirm flag to proceed\n');
    console.log('Usage: npm run clear-history -- --confirm\n');
    console.log('Or:    npx ts-node clear-all-history.ts --confirm\n');
    return;
  }

  console.log('🚀 Starting cleanup...\n');

  // Clear Pinecone
  await clearPineconeData();

  // Clear Firebase
  await clearFirebaseData();

  // Show local storage instructions
  await showLocalStorageCleanupInstructions();

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  ✅ SERVER-SIDE CLEANUP COMPLETE!              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log('📝 Next steps:');
  console.log('   1. Clear browser localStorage (see instructions above)');
  console.log('   2. Refresh your app');
  console.log('   3. Start fresh! 🎉\n');
}

main()
  .then(() => {
    console.log('✅ Script completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
