/**
 * Shared Firebase Admin Initialization
 * 
 * Centralizes Firebase Admin SDK initialization to avoid duplicate initialization
 * and provide consistent error handling across all services.
 * 
 * Supports two initialization methods:
 * 1. Service Account JSON file (development)
 * 2. Environment variables (production/deployment)
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Only initializes once, subsequent calls return existing instance
 */
export function initializeFirebaseAdmin(): boolean {
  if (initialized) {
    return true;
  }

  if (admin.apps.length > 0) {
    initialized = true;
    console.log('✅ Firebase Admin already initialized');
    return true;
  }

  try {
    // Method 1: Try loading from serviceAccountKey.json (development)
    const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`
      });
      console.log('🔥 Firebase Admin initialized from serviceAccountKey.json');
      initialized = true;
      return true;
    }

    // Method 2: Try using environment variables (production)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n') // Handle escaped newlines
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`
      });
      console.log('🔥 Firebase Admin initialized from environment variables');
      initialized = true;
      return true;
    }

    // Method 3: Try using GOOGLE_APPLICATION_CREDENTIALS (Vertex AI path)
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath) {
      try {
        // Handle Windows paths with backslashes
        const normalizedPath = path.normalize(credentialsPath);
        if (fs.existsSync(normalizedPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`
          });
          console.log('🔥 Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS');
          initialized = true;
          return true;
        } else {
          console.warn(`⚠️ GOOGLE_APPLICATION_CREDENTIALS path not found: ${normalizedPath}`);
        }
      } catch (err) {
        console.error(`❌ Failed to load credentials from ${credentialsPath}:`, err);
      }
    }

    console.error('❌ Firebase Admin initialization failed: No valid credentials found');
    console.error('   Please provide one of:');
    console.error('   1. Server/serviceAccountKey.json file');
    console.error('   2. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
    console.error('   3. GOOGLE_APPLICATION_CREDENTIALS pointing to a valid JSON file');
    return false;

  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    return false;
  }
}

/**
 * Get Firestore instance (initializes if needed)
 */
export function getFirestore(): admin.firestore.Firestore | null {
  if (!initializeFirebaseAdmin()) {
    return null;
  }
  return admin.firestore();
}

/**
 * Get Storage bucket (initializes if needed)
 */
export function getStorageBucket(): admin.storage.Storage | null {
  if (!initializeFirebaseAdmin()) {
    return null;
  }
  try {
    return admin.storage();
  } catch (error) {
    console.error('❌ Failed to get Storage bucket:', error);
    return null;
  }
}

/**
 * Check if Firebase Admin is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}
