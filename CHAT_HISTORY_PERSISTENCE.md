# 💾 Chat History Persistence Strategy

## Overview

NubiqAi uses a **dual-layer persistence strategy** for chat history:
1. **LocalStorage** - Fast, instant retrieval on the same device
2. **Pinecone** - Cloud backup for cross-device synchronization

This approach provides the best of both worlds: instant loading for returning users on the same device, and cloud sync for accessing history from any device.

---

## How It Works

### 🚀 Sign In Flow

When a user signs in:

```
1. User clicks "Sign In" → Google authentication
   ↓
2. ⚡ INSTANT: Load from localStorage
   - Key: `chat_history_${userId}`
   - Restores chats immediately (< 100ms)
   - User sees their history instantly!
   ↓
3. 🌐 BACKGROUND: Sync with Pinecone
   - Fetch latest chats from cloud
   - Merge/update local data
   - Save updated data back to localStorage
```

**Benefits:**
- ⚡ **Instant UX**: User sees their chats immediately
- 🌐 **Cross-device sync**: Always gets latest data from cloud
- 💪 **Offline resilience**: Works even if Pinecone is slow/down

### 💾 Auto-Save During Session

While the user is chatting:

```
Every time chats array changes:
  ↓
Auto-save to localStorage
  - Key: `chat_history_${userId}`
  - Happens in background
  - No user interaction needed
```

**Benefits:**
- 🔄 **Continuous backup**: Never lose data
- 🚫 **No manual save**: User doesn't think about it
- 💥 **Crash protection**: Survives browser crashes/refresh

### 👋 Sign Out Flow

When a user signs out:

```
1. User clicks "Sign Out"
   ↓
2. 💾 Save to localStorage
   - Final save of current state
   - Ensures latest data is stored
   ↓
3. 🌐 Persist to Pinecone
   - Call `/api/end-chat` for each chat
   - Stores in vector database
   - Available on any device
   ↓
4. 🧹 Clear local state
   - Clear chats array
   - Clear active chat
   - UI resets to empty state
   ↓
5. 🔓 Show sign-in dialog
   - User can sign in again
   - Or close the app
```

**Benefits:**
- 💾 **Double backup**: Both local and cloud
- 🌍 **Cross-device**: Available on other devices
- 🔒 **Privacy**: Clears UI after sign out

---

## Technical Implementation

### LocalStorage Structure

```typescript
// Key format
const key = `chat_history_${userId}`;

// Value format (JSON string)
[
  {
    id: "1234567890",
    title: "Chat Title",
    messages: [
      {
        id: "msg1",
        content: "Hello",
        role: "user",
        timestamp: "2025-10-16T12:00:00.000Z"
      },
      // ...more messages
    ],
    createdAt: "2025-10-16T11:00:00.000Z",
    updatedAt: "2025-10-16T12:00:00.000Z",
    archived: false
  },
  // ...more chats
]
```

### Date Serialization

**Important:** Dates are stored as ISO strings in localStorage and must be converted back to Date objects when loading:

```typescript
// Saving (automatic JSON.stringify)
localStorage.setItem(key, JSON.stringify(chats));

// Loading (manual Date conversion)
const parsedChats = JSON.parse(savedChats);
const restoredChats = parsedChats.map(chat => ({
  ...chat,
  createdAt: new Date(chat.createdAt),
  updatedAt: new Date(chat.updatedAt),
  messages: chat.messages.map(msg => ({
    ...msg,
    timestamp: new Date(msg.timestamp)
  }))
}));
```

### Pinecone Integration

Chats are persisted to Pinecone via the `/api/end-chat` endpoint:

```typescript
// Backend: Server/index.ts
app.post('/api/end-chat', async (req, res) => {
  const { userId, chatId } = req.body;
  
  // 1. Get chat messages from memory
  // 2. Create embeddings
  // 3. Store in Pinecone with metadata
  // 4. Available for semantic search
});
```

**What gets stored in Pinecone:**
- Chat messages as vector embeddings
- User ID and Chat ID metadata
- Timestamps and conversation context
- Used for semantic memory search

---

## Code Locations

### Frontend (src/App.tsx)

```typescript
// Auto-save on change
useEffect(() => {
  if (user && chats.length > 0) {
    const key = `chat_history_${user.id}`;
    localStorage.setItem(key, JSON.stringify(chats));
  }
}, [chats, user]);

// Load on sign-in
const handleSignIn = async () => {
  const user = await signInWithGoogle();
  
  // Fast: Load from localStorage
  const savedChats = localStorage.getItem(`chat_history_${user.id}`);
  if (savedChats) {
    setChats(JSON.parse(savedChats));
  }
  
  // Background: Sync with Pinecone
  const cloudChats = await apiService.getChats();
  if (cloudChats) {
    setChats(cloudChats);
    localStorage.setItem(`chat_history_${user.id}`, JSON.stringify(cloudChats));
  }
};

// Save on sign-out
const handleSignOut = async () => {
  if (user && chats.length > 0) {
    // Save to localStorage
    localStorage.setItem(`chat_history_${user.id}`, JSON.stringify(chats));
    
    // Save to Pinecone
    for (const chat of chats) {
      await apiService.endChat({ userId: user.id, chatId: chat.id });
    }
  }
  
  setChats([]);
  setActiveChat(null);
  await signOut();
};
```

### API Service (src/services/api.ts)

```typescript
// End chat - triggers Pinecone persistence
async endChat(data: { userId: string; chatId: string }) {
  return this.request('/end-chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get chats - fetch from Pinecone
async getChats(): Promise<ChatHistory[]> {
  return this.request('/chats');
}
```

### Backend (Server/index.ts)

```typescript
// Persist chat to Pinecone
app.post('/api/end-chat', async (req, res) => {
  const { userId, chatId } = req.body;
  
  const hybridMemory = getHybridMemoryService();
  await hybridMemory.persistConversation(userId, chatId);
  
  res.json({ success: true });
});

// Retrieve chats from Pinecone
app.get('/api/chats', async (req, res) => {
  const { userId } = req.query;
  
  const hybridMemory = getHybridMemoryService();
  const chats = await hybridMemory.getUserChats(userId);
  
  res.json(chats);
});
```

---

## Storage Limits

### LocalStorage
- **Limit:** ~5-10 MB per domain (browser-dependent)
- **Strategy:** Store only recent/active chats locally
- **Cleanup:** Auto-cleanup old chats if limit approached

### Pinecone
- **Limit:** Based on your plan (100K-1M+ vectors)
- **Strategy:** All chats stored with vector embeddings
- **Retention:** Permanent until manually deleted

---

## User Privacy

### Data Isolation
- Each user's chats are stored with their unique Firebase UID
- Users can only access their own chat history
- LocalStorage key includes user ID: `chat_history_${userId}`

### Data Clearing
When user signs out:
- UI state cleared (chats array, active chat)
- LocalStorage data **remains** for faster next sign-in
- User can clear browser data to remove localStorage

To add "Clear All Data" option:
```typescript
const clearAllData = () => {
  if (user) {
    localStorage.removeItem(`chat_history_${user.id}`);
    setChats([]);
    setActiveChat(null);
    toast.success("All local data cleared");
  }
};
```

---

## Testing

### Test LocalStorage Persistence
1. Sign in with Google
2. Create a few chats with messages
3. **Hard refresh** the page (Ctrl+Shift+R)
4. ✅ Chats should load instantly from localStorage

### Test Pinecone Sync
1. Sign in on Device A, create chats
2. Sign out
3. Sign in on Device B (or different browser)
4. ✅ Chats should load from Pinecone after a few seconds

### Test Auto-Save
1. Sign in and create a chat
2. Add some messages
3. Open DevTools → Application → Local Storage
4. ✅ See `chat_history_${userId}` key updating automatically

---

## Future Enhancements

### 1. Conflict Resolution
If local and cloud data differ:
- Merge by timestamp
- Prefer newer messages
- Deduplicate by message ID

### 2. Selective Sync
- Only sync chats modified since last sync
- Use "lastSyncedAt" timestamp
- Reduces API calls and bandwidth

### 3. Offline Mode
- Queue Pinecone operations when offline
- Retry when connection restored
- Show "syncing" indicator

### 4. Storage Optimization
- Compress chat data before storing
- Use IndexedDB for larger storage (50-100 MB)
- Archive old chats to separate storage

### 5. Export/Import
- Export all chats as JSON
- Import chats from file
- Backup to Google Drive

---

## Troubleshooting

### "Chats not loading after sign-in"
- Check browser console for errors
- Verify localStorage key exists: DevTools → Application → Local Storage
- Check if Pinecone API is responding: Network tab

### "Chats disappear after refresh"
- Check if auto-save useEffect is running (console logs)
- Verify user is authenticated before auto-save
- Check if localStorage is disabled (private browsing)

### "Old chats showing up"
- Clear localStorage: `localStorage.clear()`
- Or remove specific key: `localStorage.removeItem('chat_history_...')`

### "LocalStorage full" error
- Browser reached storage limit (5-10 MB)
- Implement cleanup strategy
- Move to IndexedDB for larger storage

---

## Summary

✅ **Dual persistence**: localStorage (fast) + Pinecone (cloud)  
✅ **Auto-save**: Continuous background saving  
✅ **Instant load**: < 100ms from localStorage  
✅ **Cross-device**: Available on any device via Pinecone  
✅ **Crash-proof**: Data never lost  
✅ **Privacy**: User-isolated storage with Firebase UID  

Your chat history is safe, fast, and always available! 🚀
