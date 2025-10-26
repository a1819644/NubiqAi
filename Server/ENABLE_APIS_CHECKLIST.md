# ✅ API Activation Checklist for vectorslabai-16a5b

You need to enable **3 APIs** for your new Firebase project. Click each link below:

---

## 1️⃣ Vertex AI API (REQUIRED for AI)

**Status**: ❌ Disabled (causing the 403 error)

**Enable here**: https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=vectorslabai-16a5b

**Steps**:

1. Click the link above
2. Click the blue **"Enable"** button
3. Wait 1-2 minutes for activation

**What it does**: Powers all AI text generation and image generation through Google's Vertex AI

---

## 2️⃣ Cloud Firestore API (REQUIRED for chat storage)

**Status**: ❌ Disabled

**Enable here**: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=vectorslabai-16a5b

**Alternative** (easier): https://console.firebase.google.com/project/vectorslabai-16a5b/firestore

**Steps**:

1. Click the Firebase Console link
2. Click **"Create Database"**
3. Choose **"Start in test mode"** (for development)
4. Select location: **us-central** (or closest to you)
5. Click **"Enable"**

**What it does**: Stores chat history, user profiles, and session metadata

---

## 3️⃣ Firebase Storage (REQUIRED for image uploads)

**Status**: ❌ Not initialized

**Enable here**: https://console.firebase.google.com/project/vectorslabai-16a5b/storage

**Steps**:

1. Click the link above
2. Click **"Get Started"**
3. Accept default security rules (test mode)
4. Click **"Done"**

**What it does**: Stores generated images permanently with organized folder structure

---

## ✅ Quick Enable All (One Page)

Open these 3 tabs and enable everything:

1. **Vertex AI**: https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=vectorslabai-16a5b
2. **Firestore**: https://console.firebase.google.com/project/vectorslabai-16a5b/firestore
3. **Storage**: https://console.firebase.google.com/project/vectorslabai-16a5b/storage

---

## 🎯 After Enabling All APIs

The server will work perfectly! You'll see:

```
✅ Vertex AI client initialized. project=vectorslabai-16a5b, location=us-central1
✅ Firebase Storage Service initialized
📦 Using bucket: vectorslabai-16a5b.appspot.com
✅ FirestoreChatService initialized
🔥 Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS
```

And these features will work:

- ✅ AI chat responses (Vertex AI primary, Gemini fallback)
- ✅ Image generation with permanent storage
- ✅ Chat history persistence
- ✅ Cross-device sync
- ✅ Memory system (local + Pinecone)

---

## ⚡ Current Status

| API                   | Status            | Priority |
| --------------------- | ----------------- | -------- |
| Vertex AI             | ❌ **ENABLE NOW** | Critical |
| Firestore             | ❌ **ENABLE NOW** | High     |
| Firebase Storage      | ❌ **ENABLE NOW** | High     |
| Gemini API (fallback) | ✅ Working        | Backup   |
| Pinecone              | ✅ Working        | Memory   |

---

## 🔄 After Enabling

The server should auto-restart via nodemon, or just wait 2 minutes for the APIs to propagate.

**Currently**: Vertex AI fails → Falls back to Gemini API ✅ (so AI still works!)

**After enabling**: Vertex AI works → Faster, more scalable, better rate limits 🚀

---

## Need Help?

If any API shows an error after enabling, just let me know which one!
