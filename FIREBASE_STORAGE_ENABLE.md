# 🔥 Firebase Storage Setup - REQUIRED

## ⚠️ Issue: Storage Bucket Not Found

Error: `"The specified bucket does not exist."`

This means Firebase Storage hasn't been enabled for your project yet.

---

## 🚀 Quick Fix (5 minutes)

### Step 1: Enable Firebase Storage

1. **Open Firebase Console:**
   https://console.firebase.google.com/project/vectorslabai/storage

2. **Click "Get Started"** (if you see it)
   
3. **Choose Security Rules:**
   - Select: **"Start in test mode"** (for now)
   - Or: **"Start in production mode"** (more secure)

4. **Select Location:**
   - Recommended: `us-central1` (Iowa)
   - Or choose your preferred region

5. **Click "Done"**

### Step 2: Verify Bucket Created

You should see:
```
Default bucket: vectorslabai.appspot.com
```

### Step 3: Restart Server

The server will auto-detect the bucket:
```
🔥 Firebase Admin initialized
✅ Firebase Storage Service initialized
📦 Using bucket: vectorslabai.appspot.com
```

---

## 🔒 Security Rules (Optional)

### Test Mode (Easy - Good for Development):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;  // ⚠️ Open to all (testing only)
    }
  }
}
```

### Production Mode (Secure - Recommended):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only authenticated users can access their own folder
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## ✅ Testing

Once Storage is enabled:

1. **Generate an image:**
   ```
   "Generate an image of a sunset over the ocean"
   ```

2. **Check server logs:**
   ```
   📤 Uploading base64 image to Firebase Storage...
   ✅ Image uploaded to Firebase: https://storage.googleapis.com/...
   🖼️ [BACKGROUND] Stored image URL in conversation history
   ```

3. **Verify in Firebase Console:**
   - Go to: Storage tab
   - Look for: `users/{userId}/chats/{chatId}/images/*.png`

---

## 🆘 Troubleshooting

### Problem: "Bucket does not exist"
**Solution:** Enable Firebase Storage in console (see Step 1 above)

### Problem: "Permission denied"
**Solution:** Update security rules (see Security Rules section)

### Problem: "Service account lacks permissions"
**Solution:** 
1. Go to: https://console.firebase.google.com/project/vectorslabai/settings/serviceaccounts
2. Verify service account has "Firebase Admin SDK" role
3. If not, regenerate service account key

---

## 📞 Quick Links

- **Firebase Console:** https://console.firebase.google.com/project/vectorslabai
- **Storage Dashboard:** https://console.firebase.google.com/project/vectorslabai/storage
- **Service Accounts:** https://console.firebase.google.com/project/vectorslabai/settings/serviceaccounts
- **Firebase Storage Docs:** https://firebase.google.com/docs/storage

---

## 🎯 Expected Result

After setup:
```
Storage Structure:
└── users/
    └── {userId}/
        └── chats/
            └── {chatId}/
                └── images/
                    └── {uuid}.png

Public URLs:
https://storage.googleapis.com/vectorslabai.appspot.com/users/.../images/abc.png
```

---

**Once Storage is enabled, image uploads will work automatically!** 🚀
