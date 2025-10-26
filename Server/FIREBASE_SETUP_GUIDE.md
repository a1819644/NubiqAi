# Firebase Admin Setup Guide

## Current Issue
The server is trying to initialize Firebase Admin SDK but can't find valid credentials. You have **3 options**:

---

## Option 1: Use the Same Credentials as Vertex AI (Simplest) ✅

Since you already have Vertex AI working with `C:\keys\vertex-app.json`, we can use the **same file** for Firebase Admin.

**The file is missing at:** `C:\keys\vertex-app.json`

### Steps:
1. Locate your Google Cloud service account key JSON file
2. Place it at: `C:\keys\vertex-app.json`
3. The server will automatically use it for both Vertex AI and Firebase Admin

---

## Option 2: Add Firebase Credentials to `.env` (Recommended for Production)

Add these variables to `Server/.env`:

```env
# Firebase Admin SDK Credentials
FIREBASE_PROJECT_ID=vectorslabai
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@vectorslabai.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### How to get these values:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`vectorslabai`)
3. Click **Settings** (⚙️) → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **"Generate New Private Key"**
6. Download the JSON file
7. Extract the values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep as single-line with `\n`)

---

## Option 3: Create `Server/serviceAccountKey.json` (Development Only)

1. Download your Firebase service account key (see Option 2 steps 1-6)
2. Save it as `Server/serviceAccountKey.json`
3. **⚠️ Add to `.gitignore`** (never commit this file!)

---

## Testing Firebase Setup

After setting up credentials, restart the server:
```powershell
cd Server
npm start
```

### Expected Success Output:
```
🔥 Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS
✅ Firebase Storage Service initialized
📦 Using bucket: vectorslabai.firebasestorage.app
✅ FirestoreChatService initialized
```

### Current Output (Not Working):
```
⚠️ GOOGLE_APPLICATION_CREDENTIALS path not found: C:\keys\vertex-app.json
❌ Firebase Admin initialization failed: No valid credentials found
⚠️ Firebase Storage Service running without storage
⚠️ FirestoreChatService running without Firestore
```

---

## Impact Without Firebase

Without Firebase Admin credentials, these features **won't work**:
- ❌ Chat persistence to Firestore
- ❌ Image uploads to Firebase Storage
- ❌ Chat history synchronization across devices

The app will still work for:
- ✅ AI chat responses (using local memory only)
- ✅ Image generation (base64 only, not persisted)
- ✅ Document RAG
- ✅ Pinecone long-term memory

---

## Quick Fix (If You Have the File)

If `C:\keys\vertex-app.json` exists but the path is wrong, update `Server/.env`:
```env
GOOGLE_APPLICATION_CREDENTIALS=D:\path\to\your\service-account.json
```

Or create the missing directory:
```powershell
mkdir C:\keys
# Then copy your service account JSON to C:\keys\vertex-app.json
```
