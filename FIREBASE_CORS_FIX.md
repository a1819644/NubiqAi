# Firebase Storage CORS Fix

## Problem
Frontend can't load images from Firebase Storage due to CORS error:
```
Access-Control-Allow-Origin' missing
```

## Solution: Configure CORS on Firebase Storage

### Method 1: Using Google Cloud Console (Easiest)

1. Go to **Google Cloud Console**: https://console.cloud.google.com
2. Select your project: **vectorlabsai**
3. Go to **Cloud Storage** → **Buckets**
4. Find your bucket: **vectorslabai.firebasestorage.app**
5. Click on the bucket name
6. Go to the **PERMISSIONS** tab
7. Click **ADD PRINCIPAL**
8. In the "New principals" field, enter: `allUsers`
9. In the "Select a role" dropdown, choose: **Storage Object Viewer**
10. Click **SAVE**

### Method 2: Using gsutil Command (If installed)

If you have Google Cloud SDK installed:

```bash
cd Server
gsutil cors set cors.json gs://vectorslabai.firebasestorage.app
```

The `cors.json` file has been created at `Server/cors.json`

### Method 3: Using Firebase Console

1. Go to https://console.firebase.google.com
2. Select your project
3. Go to **Storage** in the left menu
4. Click on **Rules** tab
5. Update rules to allow public read:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/chats/{chatId}/images/{imageId} {
      // Allow public read for all images
      allow read: if true;
      // Allow write only for authenticated users
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

6. Click **Publish**

## Verification

After applying CORS settings:

1. Wait 1-2 minutes for changes to propagate
2. Try loading an image URL in your browser:
   ```
   https://storage.googleapis.com/vectorslabai.firebasestorage.app/users/...
   ```
3. The image should load without CORS errors

## Alternative: Use Signed URLs

If you prefer private images with temporary access, modify `Server/services/firebaseStorageService.ts` to use signed URLs instead of public URLs. The service already has `uploadImageWithSignedUrl()` method available.

## Current Status

✅ CORS configuration file created: `Server/cors.json`
❌ CORS not yet applied to Firebase Storage bucket
⏳ Waiting for manual configuration via Google Cloud Console or gsutil

## Next Steps

1. Choose one of the methods above
2. Apply CORS configuration
3. Refresh your frontend
4. Images should load without errors
