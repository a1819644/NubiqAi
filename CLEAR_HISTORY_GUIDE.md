# 🗑️ Clear All History - Complete Guide

## 🎯 Quick Start

### **Option 1: Clear Everything (Recommended)**

```bash
cd Server
npm run clear-history -- --confirm
```

This will delete:
- ✅ All Pinecone vectors (conversations, profiles)
- ✅ All Firebase chat histories
- ✅ All Firebase user profiles

---

### **Option 2: Clear Only Pinecone**

```bash
cd Server
npm run clear-pinecone
```

Follow the prompts to confirm deletion.

---

### **Option 3: Clear Browser Local Data**

**Method A - Using the HTML page:**
1. Open: `http://localhost:3000/clear-local-data.html`
2. Click "Clear All Local Data"
3. Wait for confirmation
4. Page will auto-refresh

**Method B - Browser DevTools:**
1. Press `F12` to open DevTools
2. Go to **Application** tab
3. Click **"Clear site data"**
4. Refresh the page

**Method C - Browser Console:**
```javascript
// Run this in browser console (F12)
localStorage.clear();
sessionStorage.clear();
indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
console.log("✅ Local storage cleared! Refresh the page.");
```

---

## 📊 What Gets Deleted

### **Server-Side Data:**

| Data Type | Location | Cleared By |
|-----------|----------|------------|
| Chat conversations | Pinecone vectors | `clear-history` |
| User profiles | Pinecone vectors | `clear-history` |
| Chat histories | Firebase Firestore | `clear-history` |
| User settings | Firebase Firestore | `clear-history` |

### **Client-Side Data:**

| Data Type | Location | Cleared By |
|-----------|----------|------------|
| Chat histories | localStorage | Browser clear |
| User preferences | localStorage | Browser clear |
| Cached images | IndexedDB | Browser clear |
| Session data | sessionStorage | Browser clear |

---

## 🔧 Scripts Explained

### `clear-all-history.ts`
**Complete cleanup script** that:
1. Deletes all Pinecone vectors (memory, profiles)
2. Deletes all Firebase chat histories
3. Deletes all Firebase user profiles
4. Shows instructions for clearing browser data

**Usage:**
```bash
npm run clear-history -- --confirm
```

**Safety Feature:**
- Requires `--confirm` flag to prevent accidental deletion
- Shows what will be deleted before proceeding
- Provides detailed logs

---

### `delete-all-pinecone-data.ts`
**Pinecone-only cleanup** that:
1. Deletes all vectors from Pinecone index
2. Shows stats before/after deletion
3. Interactive confirmation

**Usage:**
```bash
npm run clear-pinecone
```

---

### `clear-local-data.html`
**Browser-based cleanup page** that:
1. Clears localStorage
2. Clears sessionStorage
3. Deletes all IndexedDB databases
4. Clears cookies
5. Auto-refreshes after completion

**Access:**
```
http://localhost:3000/clear-local-data.html
```

---

## 📝 Step-by-Step Guide

### **Complete Fresh Start (Delete Everything):**

```bash
# Step 1: Clear server-side data
cd Server
npm run clear-history -- --confirm

# Output:
# 🧹 === PINECONE CLEANUP ===
# 📊 Found 150 vector(s) in Pinecone index: nubiq-ai-memory
# 🗑️  Deleting all Pinecone vectors...
# ✅ Pinecone data deleted!
#
# 🧹 === FIREBASE CLEANUP ===
# 🗑️  Deleting chat histories...
#    Found 25 chat(s)
# ✅ Chat histories deleted!
# 🗑️  Deleting user profiles...
#    Found 3 profile(s)
# ✅ User profiles deleted!
```

```bash
# Step 2: Clear browser data
# Open: http://localhost:3000/clear-local-data.html
# Click "Clear All Local Data"
# Wait for auto-refresh
```

```bash
# Step 3: Restart your app
npm start
```

**Result:** Fresh installation state! 🎉

---

## ⚠️ Important Notes

### **What is NOT Deleted:**

❌ **Firebase Storage Images**
- Uploaded images in Firebase Storage are NOT automatically deleted
- To delete: Go to Firebase Console → Storage → Delete manually

❌ **User Authentication**
- Firebase Auth users remain (they can still sign in)
- To delete: Firebase Console → Authentication → Delete users

❌ **Environment Variables**
- `.env` files are not touched
- API keys remain safe

---

## 🔍 Verification

### Check if data is cleared:

**Pinecone:**
```bash
cd Server
npx ts-node -e "
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';
dotenv.config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.Index(process.env.PINECONE_INDEX_NAME!);

index.describeIndexStats().then(stats => {
  console.log('Vectors in Pinecone:', stats.totalRecordCount);
  process.exit(0);
});
"
```

**Firebase:**
- Open Firebase Console → Firestore
- Check `chatHistories` and `userProfiles` collections
- Should be empty

**Browser:**
- Open DevTools (F12) → Application
- Check localStorage, sessionStorage, IndexedDB
- Should be empty

---

## 🚨 Troubleshooting

### Error: "Missing Pinecone credentials"
```bash
# Make sure Server/.env has:
PINECONE_API_KEY=your_api_key
PINECONE_INDEX_NAME=nubiq-ai-memory
```

### Error: "serviceAccountKey.json not found"
```bash
# Make sure Server/serviceAccountKey.json exists
# Download from Firebase Console → Project Settings → Service Accounts
```

### Error: "Cannot delete IndexedDB"
- Close all browser tabs with the app
- Try incognito/private mode
- Use DevTools manual clear

---

## 💡 Use Cases

### **Development Testing:**
```bash
# Clear everything between tests
npm run clear-history -- --confirm
```

### **User Requested Data Deletion:**
```bash
# Delete specific user's data (modify script)
# Or use Firebase Console for GDPR compliance
```

### **Performance Issues:**
```bash
# Clear local cache to fix issues
# Open: http://localhost:3000/clear-local-data.html
```

### **Fresh Demo:**
```bash
# Start with clean slate for demos
npm run clear-history -- --confirm
```

---

## 📊 Expected Results

### Before Cleanup:
```
Pinecone: 150 vectors (conversations + profiles)
Firebase: 25 chats, 3 profiles
Browser: 50MB cached images, 20 chat histories
```

### After Cleanup:
```
Pinecone: 0 vectors ✅
Firebase: 0 chats, 0 profiles ✅
Browser: 0 cached data ✅
```

---

## 🎯 Summary

| Method | What it Clears | Command |
|--------|----------------|---------|
| **Complete Cleanup** | Pinecone + Firebase | `npm run clear-history -- --confirm` |
| **Pinecone Only** | Vectors | `npm run clear-pinecone` |
| **Browser Only** | localStorage, IndexedDB | Open `clear-local-data.html` |

**Recommended for fresh start:**
1. Run `npm run clear-history -- --confirm`
2. Open `clear-local-data.html` and click clear
3. Refresh app
4. Done! 🎉

---

## 🔐 Safety Features

✅ Requires `--confirm` flag for server cleanup
✅ Shows preview of what will be deleted
✅ Interactive confirmation for Pinecone script
✅ Detailed logging of all operations
✅ Does NOT delete API keys or configs
✅ Does NOT delete source code

---

## 📞 Need Help?

If cleanup fails:
1. Check console logs for error details
2. Verify `.env` credentials
3. Check Firebase permissions
4. Try manual cleanup via web consoles
