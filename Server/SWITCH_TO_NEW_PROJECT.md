# ✅ Setup Guide: Switch to New Firebase Project (vectorslabai-16a5b)

## Step 1: Download Service Account Key for New Project

1. **Open this link**: https://console.firebase.google.com/project/vectorslabai-16a5b/settings/serviceaccounts/adminsdk

2. **Click the "Generate New Private Key" button**
   - A dialog will appear warning you to keep it secure
   - Click "Generate Key"

3. **Save the downloaded JSON file**:
   - Rename it if needed
   - Copy it to: `C:\keys\vertex-app.json`
   - **Replace the old file** (or backup the old one first)

---

## Step 2: Update Backend Environment Variable

Open `Server/.env` and change:

```env
GOOGLE_CLOUD_PROJECT=vectorslabai-16a5b
```

(Change from `vectorlabsai` to `vectorslabai-16a5b`)

---

## Step 3: Enable Firebase Services

### Enable Firestore:
1. Visit: https://console.firebase.google.com/project/vectorslabai-16a5b/firestore
2. Click **"Create Database"**
3. Choose **"Start in test mode"** (for development)
4. Select a location (e.g., `us-central`)
5. Click **"Enable"**

### Enable Firebase Storage:
1. Visit: https://console.firebase.google.com/project/vectorslabai-16a5b/storage
2. Click **"Get Started"**
3. Accept default security rules
4. Click **"Done"**

---

## Step 4: Restart the Server

```powershell
cd Server
npm start
```

---

## ✅ Expected Success Output

You should see:
```
🔥 Firebase Admin initialized from GOOGLE_APPLICATION_CREDENTIALS
✅ Firebase Storage Service initialized
📦 Using bucket: vectorslabai-16a5b.appspot.com
✅ FirestoreChatService initialized
Vertex AI client initialized. project=vectorslabai-16a5b, location=us-central1
```

---

## 🎯 Once Complete, Everything Will Work:

- ✅ AI chat with memory
- ✅ Image generation with Firebase Storage persistence
- ✅ Chat history saved to Firestore
- ✅ Cross-device sync
- ✅ User authentication
- ✅ Document RAG

---

## Need Help?

If you get stuck at any step, just let me know which step and what error you see!
