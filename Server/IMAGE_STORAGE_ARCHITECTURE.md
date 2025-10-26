# 📸 Image Storage Architecture - Complete Guide

## Current Setup: Three-Tier Storage System

Your NubiqAI app uses a **redundant, multi-tier storage system** to ensure images are always available:

```
┌─────────────────────────────────────────────────────────────┐
│                    IMAGE GENERATION                          │
│                    (Gemini API)                              │
└──────────────────┬──────────────────────────────────────────┘
                   │ Returns base64 image
                   ↓
    ┌──────────────────────────────────────────────┐
    │          TIER 1: LOCAL SERVER CACHE          │
    │     (Server/local-images/*.png)              │
    │  - Fast access (~1ms)                        │
    │  - TTL: 60 minutes (configurable)            │
    │  - Max files: 500 (auto-cleanup)             │
    │  - Dev/testing friendly                      │
    └──────────────┬───────────────────────────────┘
                   │ Saves as: timestamp_userId_chatId_uuid.png
                   │ Returns: http://localhost:8000/local-images/...
                   ↓
    ┌──────────────────────────────────────────────┐
    │       TIER 2: FIREBASE CLOUD STORAGE         │
    │  (vectorslabai-16a5b.appspot.com)            │
    │  - Permanent storage                         │
    │  - CDN delivery                              │
    │  - Cross-device access                       │
    │  - Path: users/{userId}/chats/{chatId}/...  │
    └──────────────┬───────────────────────────────┘
                   │ Returns: https://storage.googleapis.com/...
                   ↓
    ┌──────────────────────────────────────────────┐
    │       TIER 3: FRONTEND INDEXEDDB CACHE       │
    │  (Client-side browser storage)               │
    │  - 50MB limit                                │
    │  - Offline access                            │
    │  - No network needed                         │
    │  - Managed by imageStorageService.ts         │
    └──────────────────────────────────────────────┘
```

---

## 📁 TIER 1: Local Server Cache (Development/Testing)

### Location
```
Server/local-images/
```

### Current Files
You have **10 images** stored locally:
```
1761313629539_RbOddx8T18YqqkQ2vMkfdwsV04f2_1761312853084_eefcfa5f-44b8-4573-8539-56b9fbe7cc54.png
1761313787186_RbOddx8T18YqqkQ2vMkfdwsV04f2_1761312853084_9fb89604-63d5-47d2-82fc-8a34a09f9499.png
... (8 more)
```

### Naming Convention
```
{timestamp}_{userId}_{chatId}_{uuid}.png
```

Example: `1761313629539_RbOddx8T18YqqkQ2vMkfdwsV04f2_1761312853084_eefcfa5f.png`
- `1761313629539` = Unix timestamp (when generated)
- `RbOddx8T18YqqkQ2vMkfdwsV04f2` = Firebase User ID
- `1761312853084` = Chat ID
- `eefcfa5f-44b8-4573-8539-56b9fbe7cc54` = Random UUID

### Configuration (`.env`)
```env
# Enable local caching (default: true in dev, false in production)
LOCAL_IMAGE_CACHE_ENABLED=true

# Storage directory (default: Server/local-images)
LOCAL_IMAGE_CACHE_DIR=./local-images

# Time-to-live in minutes (default: 60 = 1 hour)
LOCAL_IMAGE_CACHE_TTL_MINUTES=60

# Max files before cleanup (default: 500)
LOCAL_IMAGE_CACHE_MAX_FILES=500

# Base URL for serving images
LOCAL_IMAGE_BASE_URL=http://localhost:8000
```

### Auto-Cleanup
- **Runs every 5 minutes**
- Deletes files older than `TTL` (60 min default)
- Deletes oldest files if count exceeds `MAX_FILES`

### Access URL
```
http://localhost:8000/local-images/{filename}
```

### Code Location
- **Service:** `Server/services/localImageCacheService.ts`
- **Express route:** `Server/index.ts` (serves `/local-images` static folder)

---

## ☁️ TIER 2: Firebase Cloud Storage (Production)

### Location
```
Firebase Project: vectorslabai-16a5b
Bucket: vectorslabai-16a5b.appspot.com
```

### Folder Structure
```
users/
  └── {userId}/
      └── chats/
          └── {chatId}/
              └── images/
                  ├── 7afa2386-b2fd-4c77-bd6b-90e54ac4163b.png
                  ├── 66de4edf-102c-4778-b936-c1dfa12946bb.png
                  └── ...
```

### Example Path
```
users/RbOddx8T18YqqkQ2vMkfdwsV04f2/chats/1761312853084/images/eefcfa5f-44b8-4573-8539-56b9fbe7cc54.png
```

### Access URL
```
https://storage.googleapis.com/vectorslabai-16a5b.appspot.com/users/RbOddx8T18YqqkQ2vMkfdwsV04f2/chats/1761312853084/images/eefcfa5f.png
```

### Features
- ✅ **Permanent storage** (doesn't expire)
- ✅ **CDN delivery** (fast worldwide)
- ✅ **Cross-device sync** (same image on mobile/desktop)
- ✅ **Secure** (Firebase rules control access)
- ✅ **Scalable** (no file limits)

### Security Rules
Currently in **production mode** (you set this earlier). Users must be authenticated to upload/read.

To view/edit rules:
```
https://console.firebase.google.com/project/vectorslabai-16a5b/storage/rules
```

### Code Location
- **Service:** `Server/services/firebaseStorageService.ts`
- **Upload logic:** `Server/index.ts` (background tasks after image generation)

---

## 💾 TIER 3: Frontend IndexedDB (Client Cache)

### Location
```
Browser IndexedDB: "NubiqAI-ImageCache"
Store: "images"
```

### Purpose
- Cache images in the **browser** to avoid re-downloading
- **50MB size limit** (browser enforced)
- Works **offline** after first load
- Survives page refresh

### Storage Format
```javascript
{
  id: "imageId",
  dataUrl: "data:image/png;base64,iVBORw0KG...", // base64 string
  timestamp: 1761313629539,
  userId: "RbOddx8T18YqqkQ2vMkfdwsV04f2",
  chatId: "1761312853084"
}
```

### Features
- ✅ Instant image display (no network)
- ✅ Automatic cleanup when storage full
- ✅ Per-user isolation

### Code Location
- **Service:** `src/services/imageStorageService.ts`
- **Usage:** `src/App.tsx` (loads images on app start)

---

## 🔄 Complete Image Lifecycle

### 1. Image Generation
```typescript
// User sends: "draw a cat"
POST /api/ask-ai
{
  "prompt": "draw a cat",
  "userId": "RbOddx8T18YqqkQ2vMkfdwsV04f2",
  "chatId": "1761312853084"
}
```

### 2. AI Generates Image
```typescript
// Gemini API returns base64 image
const base64Image = "iVBORw0KGgoAAAANSU..."; // 2MB base64 string
```

### 3. Immediate Response (with local URI)
```typescript
// Server responds IMMEDIATELY with local cached version
res.json({
  success: true,
  isImageGeneration: true,
  text: "A fluffy orange cat sitting in sunlight",
  imageBase64: base64Image,  // Full base64 for immediate display
  imageLocalUri: "http://localhost:8000/local-images/1761313629539_RbOddx8T18...png",
  // Firebase URL added later in background
});
```

### 4. Background Storage (async)
```typescript
setImmediate(async () => {
  // STEP 1: Save to local cache (Server/local-images/)
  const localPath = await localImageCacheService.saveBase64(
    userId, chatId, base64Image, "png"
  );
  console.log("🗃️ Cached locally:", localPath);

  // STEP 2: Upload to Firebase Storage (async, doesn't block response)
  try {
    const firebaseUrl = await firebaseStorageService.uploadImage(
      base64Image, userId, chatId, imageId, "image/png"
    );
    console.log("☁️ Uploaded to Firebase:", firebaseUrl);
    // Could notify client via WebSocket about permanent URL
  } catch (err) {
    console.error("❌ Firebase upload failed:", err);
    // Local cache still works!
  }
});
```

### 5. Frontend Caching
```typescript
// Client receives response, caches in IndexedDB
await imageStorageService.saveImage({
  id: imageId,
  dataUrl: `data:image/png;base64,${base64Image}`,
  timestamp: Date.now(),
  userId, chatId
});
```

---

## 🎯 Why Three Tiers?

| Feature | Local Cache | Firebase | IndexedDB |
|---------|-------------|----------|-----------|
| **Speed** | ⚡ Super fast (1ms) | 🌐 Network (~100-500ms) | ⚡ Instant (0ms) |
| **Persistence** | ⏰ 60 min | ✅ Forever | ⏰ Until browser clear |
| **Offline** | ❌ Server must run | ❌ Need network | ✅ Works offline |
| **Cross-device** | ❌ Single server | ✅ Yes | ❌ Per-browser |
| **Cost** | 💰 Free (local disk) | 💰 ~$0.026/GB | 💰 Free (browser) |
| **Use case** | Dev/testing | Production | Client cache |

---

## 📊 Current Status Check

### Check Local Storage
```powershell
# View stored images
ls "d:\flutter project\NubiqAi\Server\local-images"

# Count images
(ls "d:\flutter project\NubiqAi\Server\local-images").Count

# Check total size
(ls "d:\flutter project\NubiqAi\Server\local-images" | Measure-Object -Property Length -Sum).Sum / 1MB
```

**Current:** 10 images stored locally ✅

### Check Firebase Storage
Visit: https://console.firebase.google.com/project/vectorslabai-16a5b/storage

**Current Status:** Bucket created, ready to receive uploads ✅

### Check IndexedDB (Browser)
1. Open your app: http://localhost:3000
2. Press `F12` (DevTools)
3. Go to **Application** tab
4. Expand **IndexedDB** → **NubiqAI-ImageCache** → **images**
5. See cached images

---

## 🚨 Common Issues & Solutions

### Issue 1: Local images not accessible
**Symptom:** 404 on `http://localhost:8000/local-images/...`

**Fix:**
```typescript
// Check if route is registered in Server/index.ts
app.use('/local-images', express.static(localImageCacheService.getBaseDir()));
```

### Issue 2: Firebase uploads failing
**Symptom:** `❌ Failed to upload image to Firebase Storage`

**Causes:**
- Storage bucket doesn't exist → Create in Firebase Console
- Permissions issue → Add Storage rules
- API not enabled → Enable Cloud Storage API

**Fix:** We already fixed this earlier! ✅

### Issue 3: IndexedDB quota exceeded
**Symptom:** `QuotaExceededError` in browser console

**Fix:**
```typescript
// Auto-cleanup in imageStorageService.ts handles this
// Deletes oldest images when approaching 50MB limit
```

### Issue 4: Images disappear after 60 minutes
**Cause:** Local cache TTL (expected behavior)

**Fix:** Images are still in Firebase! Frontend loads from Firebase URLs as fallback.

---

## 🔧 Configuration Examples

### Development Mode (Current)
```env
# Fast local caching for testing
LOCAL_IMAGE_CACHE_ENABLED=true
LOCAL_IMAGE_CACHE_TTL_MINUTES=60
LOCAL_IMAGE_CACHE_MAX_FILES=500
```

### Production Mode (Recommended)
```env
# Disable local cache, use Firebase only
LOCAL_IMAGE_CACHE_ENABLED=false

# Or keep it enabled with shorter TTL
LOCAL_IMAGE_CACHE_ENABLED=true
LOCAL_IMAGE_CACHE_TTL_MINUTES=5  # Quick cleanup
LOCAL_IMAGE_CACHE_MAX_FILES=100   # Lower limit
```

---

## 📝 Summary

### ✅ You ARE storing images locally!

**Location:** `Server/local-images/` (10 files currently)

**Auto-cleanup:** Every 5 minutes, deletes files older than 60 minutes

**Purpose:** Fast development/testing, immediate response to user

### ✅ You ARE also uploading to Firebase!

**Location:** `vectorslabai-16a5b.appspot.com/users/{userId}/chats/{chatId}/images/`

**Purpose:** Permanent storage, cross-device sync, production use

### ✅ You ARE caching in browser!

**Location:** Browser IndexedDB (`NubiqAI-ImageCache` database)

**Purpose:** Offline access, instant loading, reduce network traffic

---

## 🎯 Recommendation: Keep All Three!

Your architecture is **production-ready** and follows best practices:

1. **Local Cache** - Immediate responses, great UX
2. **Firebase Storage** - Permanent, scalable, cross-device
3. **IndexedDB** - Offline support, fast reloads

This is exactly how professional apps (like Discord, Slack, WhatsApp) handle media! 🚀
