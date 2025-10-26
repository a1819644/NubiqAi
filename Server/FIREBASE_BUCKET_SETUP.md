# ❌ Firebase Storage Bucket Does Not Exist

## Problem
The Firebase Storage bucket `vectorlabsai.appspot.com` (or `vectorlabsai.firebasestorage.app`) **doesn't exist yet** in your Firebase project.

## Solution: Create the Storage Bucket

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.com/project/vectorslabai
2. Sign in with your Google account

### Step 2: Enable Firebase Storage
1. In the left sidebar, click **"Build"** → **"Storage"**
2. Click **"Get Started"**
3. Accept the security rules (default rules are fine for now)
4. Click **"Done"**

Firebase will automatically create a bucket named `vectorslabsai.appspot.com`

### Step 3: Verify Bucket Exists
After creating, you should see:
- Bucket name: `vectorslabsai.appspot.com` OR `vectorslabsai.firebasestorage.app`
- Rules tab
- Files tab

### Step 4: Restart Server
The server will automatically detect the bucket:
```powershell
cd Server
# Nodemon should auto-restart, or press Ctrl+C and run:
npm start
```

---

## Alternative: Use the Exact Bucket Name from .env

Your `.env` file shows:
```
VITE_FIREBASE_STORAGE_BUCKET=vectorslabsai.firebasestorage.app
```

If that bucket exists, we can use it directly. Let me check which bucket naming convention your Firebase project uses.

### Option A: Modern Format (`.firebasestorage.app`)
If Firebase Console shows `vectorslabsai.firebasestorage.app`, then we need to keep that format in the code.

### Option B: Legacy Format (`.appspot.com`)
If Firebase Console shows `vectorslabsai.appspot.com`, then the current code fix should work.

---

## Quick Test After Creating Bucket

Try generating an image again. You should see:
```
✅ Image uploaded to Firebase Storage
🖼️ Firebase URL: https://firebasestorage.googleapis.com/v0/b/...
```

Instead of:
```
❌ The specified bucket does not exist
```

---

## Why This Happens

Firebase projects don't automatically create Storage buckets. You need to:
1. Enable Firebase Storage in Console (one-time setup)
2. This creates the default bucket
3. Then Admin SDK can upload files

---

## If Bucket Still Doesn't Work

Try explicitly setting the bucket in your `.env`:
```env
# Add to Server/.env
FIREBASE_STORAGE_BUCKET=vectorslabsai.appspot.com
# OR
FIREBASE_STORAGE_BUCKET=vectorslabsai.firebasestorage.app
```

Then update `firebaseAdmin.ts` to use this env var if available.
