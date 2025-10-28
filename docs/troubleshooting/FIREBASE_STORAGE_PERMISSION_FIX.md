# 🔐 Firebase Storage Permission Error - Fix Guide

## Problem Summary

**Error**: `firebase-adminsdk-fbsvc@vectorslabai.iam.gserviceaccount.com does not have storage.objects.create access`

**Root Cause**: Service account belongs to project `vectorslabai`, but storage bucket belongs to project `vectorslabai-16a5b`.

---

## 🔍 Diagnosis

### Current Configuration

**Service Account** (`Server/serviceAccountKey.json`):
```json
{
  "project_id": "vectorslabai",
  "client_email": "firebase-adminsdk-fbsvc@vectorslabai.iam.gserviceaccount.com"
}
```

**Storage Bucket** (`.env`):
```
FIREBASE_STORAGE_BUCKET=vectorslabai-16a5b.firebasestorage.app
```

**Mismatch**: Service account is from `vectorslabai`, trying to access `vectorslabai-16a5b` bucket.

---

## ✅ Solution 1: Use Correct Service Account (Recommended)

### Step 1: Go to Firebase Console

1. Visit: https://console.firebase.google.com/
2. Select the project: **`vectorslabai-16a5b`** (the one with the storage bucket)
3. Click ⚙️ **Project settings** → **Service accounts** tab

### Step 2: Generate New Service Account Key

```bash
# Navigate to Service Accounts tab
# Click "Generate new private key"
# Download the JSON file
# Save it as Server/serviceAccountKey.json (replace existing file)
```

### Step 3: Verify Project ID Matches

The new `serviceAccountKey.json` should have:
```json
{
  "project_id": "vectorslabai-16a5b",  // ✅ Should match storage bucket project
  "client_email": "firebase-adminsdk-XXXXX@vectorslabai-16a5b.iam.gserviceaccount.com"
}
```

### Step 4: Restart Server

```powershell
cd Server
npm start
```

---

## ✅ Solution 2: Grant Cross-Project Permissions (Alternative)

If you want to keep the current service account from `vectorslabai`, grant it permissions in `vectorslabai-16a5b`:

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Select project: **`vectorslabai-16a5b`**
3. Go to **IAM & Admin** → **IAM**

### Step 2: Add Service Account

```
1. Click "+ GRANT ACCESS"
2. New principals: firebase-adminsdk-fbsvc@vectorslabai.iam.gserviceaccount.com
3. Role: "Storage Object Creator" (roles/storage.objectCreator)
4. Click "SAVE"
```

### Alternative: Use "Storage Admin" (Full Access)

If you need read/write/delete:
```
Role: "Storage Admin" (roles/storage.admin)
```

---

## ✅ Solution 3: Use Same Project for Everything (Simplest)

Update your `.env` to use the storage bucket from the **original project**:

### Step 1: Check if `vectorslabai` has a storage bucket

```bash
# Go to Firebase Console → Storage
# Check if "vectorslabai" project has a storage bucket
# If yes, it will be: vectorslabai.appspot.com or vectorslabai.firebasestorage.app
```

### Step 2: Update `.env`

```properties
# OLD (mismatch)
FIREBASE_STORAGE_BUCKET=vectorslabai-16a5b.firebasestorage.app

# NEW (matches service account project)
FIREBASE_STORAGE_BUCKET=vectorslabai.appspot.com
```

### Step 3: Restart Server

```powershell
cd Server
npm start
```

---

## 🧪 Testing the Fix

After applying any solution, test image upload:

### Test 1: Generate an Image

```
1. Open NubiqAI frontend
2. Type: "generate an image of a sunset"
3. Wait for image to generate
4. Check backend logs - should see:
   ✅ Image uploaded to Firebase Storage: https://...
```

### Test 2: Check Backend Logs

```powershell
# Should see:
✅ Firebase Admin initialized from serviceAccountKey.json
📦 Using bucket: vectorslabai-16a5b (or vectorslabai)
📤 Uploading base64 image to Firebase Storage...
✅ Image uploaded successfully
```

### Test 3: Verify in Firebase Console

```
1. Go to Firebase Console → Storage
2. Check users/{userId}/chats/{chatId}/images/
3. Image files should be present
```

---

## 🔒 Security Recommendations

### 1. Rotate Old Service Account Key (After Fix)

```
1. Firebase Console → Project settings → Service accounts
2. Find the OLD key (not the new one)
3. Click "..." → "Delete key"
4. Confirm deletion
```

### 2. Set Minimum Permissions

**Current service account likely has**: `Firebase Admin SDK Administrator Service Agent`

**Recommended**: Create a custom service account with only:
- `Storage Object Creator` (for uploads)
- `Storage Object Viewer` (for downloads)
- `Firestore User` (for database)

### 3. Add Storage Security Rules

In Firebase Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only allow authenticated users to upload to their own folder
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admins can read all (for debugging)
    match /{allPaths=**} {
      allow read: if request.auth.token.admin == true;
    }
  }
}
```

---

## 🐛 Troubleshooting

### Issue 1: "Bucket not found"

**Error**: `The bucket 'vectorslabai-16a5b.firebasestorage.app' does not exist`

**Solution**:
```
1. Firebase Console → Storage
2. Click "Get started" to initialize storage
3. Choose location (us-central1 recommended)
4. Accept default security rules
5. Wait for bucket creation
6. Restart server
```

### Issue 2: "Service account still unauthorized"

**Possible causes**:
- IAM changes take 1-2 minutes to propagate
- Wrong service account email in IAM
- Project ID mismatch in code

**Solution**:
```
1. Wait 2 minutes after IAM change
2. Verify email exactly matches: firebase-adminsdk-fbsvc@vectorslabai.iam.gserviceaccount.com
3. Check server logs for actual project_id being used
4. Clear node_modules/.cache and restart
```

### Issue 3: "Credential not found"

**Error**: `Failed to initialize Firebase Admin: No valid credentials found`

**Solution**:
```
1. Verify Server/serviceAccountKey.json exists
2. Check JSON is valid (use jsonlint.com)
3. Verify .env has FIREBASE_STORAGE_BUCKET
4. Check file permissions (should be readable)
```

---

## 📊 Quick Decision Matrix

| Scenario | Recommended Solution | Time to Fix |
|----------|---------------------|-------------|
| **Development (local)** | Solution 1: New service account key | 2 minutes |
| **Production (deployed)** | Solution 2: Grant IAM permissions | 5 minutes |
| **Fresh project** | Solution 3: Use same project | 1 minute |
| **Multiple projects** | Solution 2 + Secure IAM policies | 10 minutes |

---

## 🎯 Recommended Action Plan (Fastest)

### For Your Specific Case:

Since you're using **development environment** with `serviceAccountKey.json`:

1. **Download new service account key** from `vectorslabai-16a5b` project
   - Firebase Console → vectorslabai-16a5b → Settings → Service accounts
   - Generate new private key → Download JSON
   
2. **Replace** `Server/serviceAccountKey.json` with downloaded file

3. **Verify** project_id matches:
   ```json
   {
     "project_id": "vectorslabai-16a5b",  // Should match!
     "client_email": "firebase-adminsdk-XXXXX@vectorslabai-16a5b.iam.gserviceaccount.com"
   }
   ```

4. **Restart server**:
   ```powershell
   cd Server
   npm start
   ```

5. **Test image generation** - should work now!

---

## 📝 Code Changes (None Required)

The existing code in `Server/services/firebaseAdmin.ts` already handles this correctly:

```typescript
// This will use the project_id from serviceAccountKey.json
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 
                 `${serviceAccount.project_id}.firebasestorage.app`
});
```

**No code changes needed** - just update the service account key file!

---

## 🔗 Useful Links

- **Firebase Console**: https://console.firebase.google.com/
- **Google Cloud IAM**: https://console.cloud.google.com/iam-admin/iam
- **Storage Permissions Doc**: https://firebase.google.com/docs/storage/security
- **Service Account Doc**: https://firebase.google.com/docs/admin/setup#initialize-sdk

---

**Status**: ⚠️ Needs manual fix (download new service account key)  
**Priority**: High (blocks image storage feature)  
**Estimated Fix Time**: 2 minutes  
**Breaking**: No (just credential update)
