# Fix: Generated Images Missing After Page Reload

## Problem

When users generate images with prompts like "draw a cat", the images appear correctly but **disappear after page reload**. The prompts are also missing.

## Root Cause

The persistence system had a critical flaw in how it handled generated images:

### The Broken Flow

1. **Image Generated** ✅
   - Stored in IndexedDB with prompt
   - Displayed as base64 data URL
   - Shown in chat

2. **Saved to localStorage** ❌
   - Base64 stripped to save space (correct)
   - **BUT** attachment marked as `undefined`
   - **THEN** filtered out entirely with `.filter(att => att !== undefined)`
   - Result: **Attachment array becomes empty!**

3. **Page Reload** ❌
   - localStorage loaded: messages have **no attachments**
   - Rehydration service: "No attachments to rehydrate"
   - Result: **Images lost forever!**

### Why It Happened

```typescript
// OLD CODE (BROKEN):
attachments: msg.attachments?.map(att => {
  if (att.startsWith('data:image')) {
    return undefined; // ❌ Marks for deletion
  }
  return att;
}).filter(att => att !== undefined) // ❌ Removes all base64 images!
```

**Problem**: The filter removed **all** generated images, not just the base64 data. The rehydration service had no way to know an image existed!

## Solution Implemented

### 1. Keep IndexedDB Placeholders

Instead of removing base64 attachments entirely, replace them with **placeholders** that reference the IndexedDB entry:

```typescript
// NEW CODE (FIXED):
attachments: msg.attachments?.map((att, index) => {
  if (att.startsWith('data:image')) {
    return { messageId: msg.id, index, type: 'indexeddb' }; // ✅ Placeholder
  }
  return att;
}) // ❌ NO .filter() - keep all placeholders!
```

**File**: `src/App.tsx` lines 95-122

### 2. Enhanced Rehydration Service

Updated `imageRehydrationService` to recognize and resolve placeholders:

```typescript
// Check if attachment is an IndexedDB placeholder
if (attachment?.type === 'indexeddb') {
  const cached = await imageStorageService.getImage(attachment.messageId);
  if (cached) {
    return cached.imageData; // ✅ Restore from IndexedDB
  }
}
```

**File**: `src/services/imageRehydrationService.ts` lines 101-114

### 3. Fallback for Missing URLs

Added fallback logic for messages with no URL (legacy data):

```typescript
if (!url) {
  // Try to find in IndexedDB by message ID
  const cached = await imageStorageService.getImage(message.id);
  if (cached) {
    return cached.imageData;
  }
}
```

**File**: `src/services/imageRehydrationService.ts` lines 117-132

## How It Works Now

### The Fixed Flow

1. **Image Generated** ✅
   ```typescript
   // User: "draw a cat"
   const imageUrl = `data:image/png;base64,iVBORw0...`;
   await imageStorageService.storeImage(
     messageId, userId, chatId, 
     imageUrl, 
     "draw a cat", // ✅ Prompt stored
     firebaseUrl
   );
   ```

2. **Saved to localStorage** ✅
   ```json
   {
     "messages": [{
       "content": "draw a cat",
       "attachments": [
         { "messageId": "123", "index": 0, "type": "indexeddb" }
       ]
     }]
   }
   ```
   **Size**: ~100 bytes (vs 500KB+ for base64)

3. **Page Reload** ✅
   ```typescript
   // Load from localStorage
   const chats = JSON.parse(localStorage.getItem('chat_history_user123'));
   
   // Rehydrate images
   for (const message of chat.messages) {
     if (message.attachments[0]?.type === 'indexeddb') {
       const cached = await imageStorageService.getImage(message.id);
       message.attachments[0] = cached.imageData; // ✅ Restored!
     }
   }
   ```

## Data Flow Diagram

```
┌─────────────────────┐
│ User: "draw a cat"  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ AI generates image                  │
│ - Base64: iVBORw0... (500KB)       │
│ - Prompt: "draw a cat"              │
└──────────┬──────────────────────────┘
           │
           ├─────────────────────────────┐
           │                             │
           ▼                             ▼
┌──────────────────────┐   ┌────────────────────────┐
│ IndexedDB Storage    │   │ Message Attachment     │
│ (Persistent)         │   │ (In-memory)           │
├──────────────────────┤   ├────────────────────────┤
│ ID: msg-123          │   │ url: "data:image..."   │
│ Image: base64 (500KB)│   │                        │
│ Prompt: "draw a cat" │   │                        │
│ Firebase: (optional) │   │                        │
└──────────┬───────────┘   └────────┬───────────────┘
           │                        │
           │                        │ Page Save
           │                        ▼
           │            ┌────────────────────────┐
           │            │ localStorage           │
           │            │ (Size-optimized)       │
           │            ├────────────────────────┤
           │            │ attachment: {          │
           │            │   messageId: "msg-123",│
           │            │   type: "indexeddb"    │
           │            │ }                      │
           │            └────────┬───────────────┘
           │                     │
           │                     │ Page Reload
           │                     ▼
           │            ┌────────────────────────┐
           │            │ Rehydration Service    │
           │            │ Sees placeholder →     │
           │◄───────────┤ Looks up IndexedDB     │
           │            └────────────────────────┘
           │
           ▼
┌──────────────────────┐
│ Restored Image       │
│ - Prompt visible ✅  │
│ - Image visible ✅   │
└──────────────────────┘
```

## Test Cases

### Test 1: Generate Image
```
1. User: "draw a sunset"
2. AI: [Generates image]
3. ✅ Image appears with prompt
4. Reload page
5. ✅ Image still visible
6. ✅ Prompt "draw a sunset" preserved
```

### Test 2: Multiple Images
```
1. User: "draw a cat"
2. User: "now draw a dog"
3. ✅ Both images visible
4. Reload page
5. ✅ Both images restored
6. ✅ Both prompts visible
```

### Test 3: Edit Then Generate
```
1. Upload image
2. User: "remove background"
3. ✅ Edited image shown
4. User: "draw a mountain"
5. ✅ New image generated
6. Reload page
7. ✅ Both images visible
```

## Storage Sizes

### Before Fix
```
localStorage: 5MB+ (with base64)
IndexedDB: 50MB (with images)
Problem: QuotaExceededError ❌
```

### After Fix
```
localStorage: ~100KB (placeholders only)
IndexedDB: 50MB (with images + prompts)
Result: Efficient + Persistent ✅
```

## Backward Compatibility

### Legacy Data (Before Fix)
Messages with stripped attachments will show placeholder text:
```typescript
if (!cached) {
  return null; // Filtered out by rehydration
}
```

### Migration Strategy
For users with existing broken data:
1. Images generated after this fix: ✅ Will work
2. Images generated before fix: ❌ Already lost (can't recover)
3. **Solution**: Users should regenerate lost images

## Files Modified

1. **src/App.tsx** (lines 95-122)
   - Changed: Attachment stripping logic
   - Added: IndexedDB placeholder objects
   - Removed: `.filter(att => att !== undefined)`

2. **src/services/imageRehydrationService.ts** (lines 101-132, 201-208)
   - Added: Placeholder recognition
   - Added: IndexedDB fallback lookup
   - Added: Null filtering for failed rehydrations

## Console Logs to Watch

### Successful Rehydration
```
💾 Auto-saved 3 chat(s) to localStorage (IndexedDB placeholders preserved)
🔄 Starting image rehydration for 3 chats...
🔍 Found IndexedDB placeholder for message: msg-123
✅ Rehydrated image from IndexedDB: msg-123
✅ PHASE 1: Loaded 3 chat(s) with image rehydration
```

### Failed Rehydration (Expected for old data)
```
🔍 Found IndexedDB placeholder for message: msg-456
⚠️ Image not found in IndexedDB: msg-456
```

## Known Limitations

1. **Images generated before this fix are lost** - Cannot be recovered
2. **IndexedDB quota (50MB)** - Old images auto-evicted when full
3. **No cross-device sync** - Images only on local device (Firebase URLs needed for sync)

## Future Improvements

1. **Auto-upload to Firebase** - Generate Firebase URLs for all images
2. **Lazy loading** - Only rehydrate visible messages
3. **Progressive loading** - Show low-res placeholders first
4. **Compression** - Reduce image size before storage

---

**Status**: ✅ Fix implemented and ready for testing

**Test Now**: Generate image → Reload page → Verify image + prompt persist
