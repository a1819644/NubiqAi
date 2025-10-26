# Image Persistence Troubleshooting Guide 🔍

## Problem

Generated images and their prompts disappear after page reload, even though other messages persist correctly.

## Root Cause Analysis

The image persistence system has **three storage layers**:

1. **Runtime Memory** (activeChat state) - ✅ Works
2. **localStorage** (with base64 stripped) - ✅ Works (saves placeholders)
3. **IndexedDB** (full base64 images) - ❓ **Potential issue here**

### The Flow

```
Image Generated → Stored in IndexedDB → Placeholder in localStorage
  ↓
Page Reload
  ↓
Load from localStorage → Find placeholders → Look up in IndexedDB
  ↓
❌ If IndexedDB lookup fails → Image disappears!
```

## Debugging Steps

### Step 1: Check Browser Console on Page Reload

Open DevTools Console and look for these messages:

**✅ Good Signs:**
```
💾 Auto-saved 3 chat(s) to localStorage (IndexedDB placeholders preserved)
🔄 User authenticated, loading chat history...
✅ PHASE 1: Loaded 3 chat(s) from localStorage with image rehydration
🔍 Found IndexedDB placeholder for message: img-1234567890
✅ Rehydrated image from IndexedDB: img-1234567890
```

**❌ Problem Signs:**
```
⚠️ Image not found in IndexedDB with ID: img-1234567890
```

### Step 2: Inspect localStorage

```javascript
// In browser console:
const userId = 'YOUR_USER_ID'; // Get from Firebase Auth
const key = `chat_history_${userId}`;
const data = JSON.parse(localStorage.getItem(key));

// Check a message with an image:
console.log(data[0].messages[5].attachments);

// Should show:
// [{ messageId: "img-1234567890", index: 0, type: "indexeddb" }]
```

### Step 3: Inspect IndexedDB

```javascript
// In browser console:
import { imageStorageService } from './src/services/imageStorageService';

// Try to get the image:
const image = await imageStorageService.getImage('img-1234567890');
console.log(image ? '✅ Found' : '❌ Not found');
```

**OR** use DevTools Application tab:
1. Open DevTools → Application tab
2. IndexedDB → `image_storage` → `images`
3. Check if images are there
4. Note the `id` field of stored images

### Step 4: Check ID Mismatch

The #1 cause of image persistence failures is **ID mismatch** between:

**Where image is stored:**
```typescript
// ChatInterface.tsx line ~610
const messageId = `img-${Date.now()}`;
await imageStorageService.storeImage(messageId, ...);
```

**Where placeholder references:**
```typescript
// App.tsx line ~115
return { messageId: msg.id, index, type: 'indexeddb' };
```

**Where rehydration looks:**
```typescript
// imageRehydrationService.ts line ~111
const imageId = attachment.messageId || message.id;
const cached = await imageStorageService.getImage(imageId);
```

**The message ID MUST match at all three points!**

## Common Issues & Solutions

### Issue 1: Images Stored with Wrong ID

**Symptom:**
```
⚠️ Image not found in IndexedDB with ID: msg-abc-123
```

**Check:**
```javascript
// DevTools → Application → IndexedDB → image_storage → images
// Look at the 'id' column - does it match what's being searched?
```

**Fix:**
Ensure the message ID used when storing the image matches the message ID in the chat:

```typescript
// In ChatInterface.tsx, when creating image message:
const messageId = `img-${Date.now()}`;

// Store with SAME ID:
await imageStorageService.storeImage(messageId, ...);

// Create message with SAME ID:
const imageMessage: Message = {
  id: messageId,  // ✅ Same ID!
  ...
};
```

### Issue 2: Placeholder Not Created

**Symptom:**
```
// localStorage shows:
attachments: [undefined]
// Instead of:
attachments: [{ messageId: "img-123", type: "indexeddb" }]
```

**Fix:**
Check `App.tsx` line ~115 - ensure placeholders are NOT filtered out:

```typescript
attachments: msg.attachments?.map((att, index) => {
  if (typeof att === 'string' && att.startsWith('data:image')) {
    return { messageId: msg.id, index, type: 'indexeddb' };
  }
  return att;
}) // ✅ No .filter() here!
```

### Issue 3: IndexedDB Cleared

**Symptom:** Images work until page reload, then disappear

**Check:**
```javascript
// Browser console:
navigator.storage.estimate().then(estimate => {
  console.log(`Used: ${estimate.usage} / ${estimate.quota}`);
});
```

**Possible causes:**
- Browser cleared IndexedDB (incognito mode, storage limit)
- User cleared site data
- IndexedDB quota exceeded

**Fix:**
Add to `imageStorageService.ts`:

```typescript
async getStorageInfo() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage,
      quota: estimate.quota,
      percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
    };
  }
  return null;
}
```

### Issue 4: Firebase URLs Not Falling Back

**Symptom:** Images show on first load but disappear on reload

**Check:**
```typescript
// ChatInterface.tsx line ~630
attachments: [displayUrl, imgResp.imageUri].filter(Boolean)
```

Should store BOTH:
1. Base64 for immediate display (stripped on save)
2. Firebase URL for rehydration (kept on save)

**Verify:**
```javascript
// Check message before save:
console.log(message.attachments);
// Should show: ["data:image/png;base64,...", "https://firebasestorage..."]

// After save to localStorage:
const saved = JSON.parse(localStorage.getItem(key));
console.log(saved[0].messages[5].attachments);
// Should show: [{ messageId: "...", type: "indexeddb" }, "https://firebasestorage..."]
```

## Manual Recovery

If images are in IndexedDB but not showing:

```javascript
// 1. Get all images from IndexedDB
const db = await openDB('image_storage', 1);
const allImages = await db.getAll('images');
console.log('Images:', allImages.map(img => ({ id: img.id, prompt: img.prompt })));

// 2. Get chat history
const userId = 'YOUR_USER_ID';
const key = `chat_history_${userId}`;
const chats = JSON.parse(localStorage.getItem(key));

// 3. Manually match and fix:
chats.forEach(chat => {
  chat.messages.forEach(msg => {
    if (msg.attachments) {
      msg.attachments = msg.attachments.map(att => {
        if (att && att.type === 'indexeddb') {
          // Find matching image
          const image = allImages.find(img => img.id === att.messageId);
          if (image) {
            return image.imageData; // Restore base64
          }
        }
        return att;
      });
    }
  });
});

// 4. Save back
localStorage.setItem(key, JSON.stringify(chats));
location.reload();
```

## Prevention Checklist

✅ **Store images with correct ID**
```typescript
const messageId = `img-${Date.now()}`;
await imageStorageService.storeImage(messageId, ...);
const message = { id: messageId, ... }; // SAME ID!
```

✅ **Create placeholders, don't filter**
```typescript
attachments: msg.attachments?.map(att => {
  if (att.startsWith('data:image')) {
    return { messageId: msg.id, type: 'indexeddb' };
  }
  return att;
}) // No .filter()!
```

✅ **Store Firebase URLs for fallback**
```typescript
attachments: [displayUrl, firebaseUrl].filter(Boolean)
```

✅ **Call rehydration on load**
```typescript
const rehydratedChats = await imageRehydrationService.rehydrateChats(chats, userId);
```

✅ **Handle rehydration failures gracefully**
```typescript
if (!cached) {
  console.warn(`Image not found: ${imageId}`);
  return firebaseUrl || null; // Fallback to Firebase URL
}
```

## Testing

### Test Case 1: Generate & Reload

1. Generate an image: "draw a sunset"
2. Open DevTools Console
3. Note the message ID: `💾 Image cached in IndexedDB: img-1234567890`
4. Reload page (F5)
5. Check console: Should see `✅ Rehydrated image from IndexedDB: img-1234567890`
6. **Result:** Image should still be visible ✅

### Test Case 2: Multiple Images

1. Generate 3 images in same chat
2. Reload page
3. **Result:** All 3 images should persist ✅

### Test Case 3: Cross-Session

1. Generate image
2. Sign out
3. Sign in again
4. **Result:** Image should load from Firebase Storage ✅

## Monitoring

Add to `App.tsx` load function:

```typescript
console.log(`📊 Rehydration Stats:`);
let totalImages = 0;
let successCount = 0;
let failCount = 0;

chats.forEach(chat => {
  chat.messages.forEach(msg => {
    if (msg.attachments) {
      msg.attachments.forEach(att => {
        if (att && typeof att === 'object' && att.type === 'indexeddb') {
          totalImages++;
        } else if (typeof att === 'string' && att.startsWith('data:image')) {
          successCount++;
        }
      });
    }
  });
});

console.log(`Total: ${totalImages}, Success: ${successCount}, Failed: ${totalImages - successCount}`);
```

## Related Files

- `src/App.tsx` (lines 95-130): localStorage save with placeholders
- `src/App.tsx` (lines 161-200): localStorage load with rehydration
- `src/components/ChatInterface.tsx` (lines 605-650): Image storage on generation
- `src/services/imageRehydrationService.ts`: Rehydration logic
- `src/services/imageStorageService.ts`: IndexedDB operations

## Next Steps

Based on console logs, the issue is most likely:

1. **ID Mismatch** - Image stored with one ID, searched with different ID
2. **IndexedDB Cleared** - Browser cleared storage
3. **Rehydration Not Called** - Load function not calling rehydration service

**Run the debugging steps above and report what you find in the console!** 🔍

---

**Status**: Debugging Enhanced  
**Date**: 2025-01-24  
**Impact**: Critical - Core feature not working after reload
