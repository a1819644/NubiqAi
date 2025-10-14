# Hybrid Memory System Test

## Overview
This document describes how to test the new two-tier memory system that combines:
1. **Local Memory** - Fast, recent conversations stored in server memory
2. **Long-term Memory** - Summarized conversations uploaded to Pinecone every 10 minutes

## Test Steps

### 1. Test Local Memory Storage

```powershell
# Test storing a conversation in local memory
Invoke-RestMethod -Uri "http://localhost:8000/api/ask-ai" -Method POST -ContentType "application/json" -Body '{"prompt": "My favorite programming language is TypeScript and I love working on AI projects", "useMemory": true, "userId": "anoop123"}'
```

### 2. Test Immediate Local Recall

```powershell
# Should recall from local memory immediately
Invoke-RestMethod -Uri "http://localhost:8000/api/ask-ai" -Method POST -ContentType "application/json" -Body '{"prompt": "What programming language do I prefer?", "useMemory": true, "userId": "anoop123"}'
```

### 3. Check Local Memory Debug Info

```powershell
# Check local memory statistics
Invoke-RestMethod -Uri "http://localhost:8000/api/hybrid-memory-debug/anoop123" -Method GET
```

### 4. View Recent Conversation Context

```powershell
# Get recent conversation context
Invoke-RestMethod -Uri "http://localhost:8000/api/recent-context/anoop123" -Method GET
```

### 5. Test Hybrid Memory Search

```powershell
# Search across both local and long-term memory
Invoke-RestMethod -Uri "http://localhost:8000/api/hybrid-memory-search" -Method POST -ContentType "application/json" -Body '{"userId": "anoop123", "query": "programming language preferences", "maxLocalResults": 3, "maxLongTermResults": 2}'
```

### 6. Wait for Automatic Summarization (10 minutes)

After 10 minutes of inactivity, the system should automatically:
- Summarize the conversation session
- Upload the summary to Pinecone for long-term storage
- Clean up old local conversations

### 7. Test Cross-Device Memory (Simulate)

```powershell
# After summarization, test if memories persist across "devices"
# This simulates switching devices where local memory would be empty
# but long-term memory in Pinecone should still work
Invoke-RestMethod -Uri "http://localhost:8000/api/ask-ai" -Method POST -ContentType "application/json" -Body '{"prompt": "What do you remember about my programming preferences?", "useMemory": true, "userId": "anoop123"}'
```

## Expected Behavior

### Local Memory (Immediate - under 10 minutes):
- ✅ Fast recall of recent conversations
- ✅ No network delay to Pinecone
- ✅ Detailed conversation history

### Long-term Memory (After 10 minutes):
- ✅ Conversations automatically summarized
- ✅ Summaries uploaded to Pinecone
- ✅ Local memory kept for fast access (1 week retention)
- ✅ Cross-device memory persistence

### Hybrid Search:
- ✅ Checks local memory first (fastest)
- ✅ Falls back to Pinecone for older memories
- ✅ Combines both sources intelligently
- ✅ Prioritizes recent local conversations

## Key Features

1. **Performance**: Local memory provides instant access to recent conversations
2. **Scalability**: Old conversations are summarized and moved to Pinecone
3. **Persistence**: Memory survives server restarts via Pinecone
4. **Cross-device**: Users can switch devices and retain memory
5. **Automatic**: No manual intervention required for memory management
6. **Extended Local Storage**: 1 week retention maximizes fast response times

## Memory Timeline

- **0-10 minutes**: Fresh conversations in active local memory
- **10+ minutes**: Conversations summarized → uploaded to Pinecone + kept locally
- **1+ week**: Local conversations finally cleaned up (summaries remain in Pinecone)

This means users get **lightning-fast responses** for up to a week of conversation history! 🚀

## API Endpoints

- `POST /api/ask-ai` - Enhanced with hybrid memory
- `GET /api/hybrid-memory-debug/:userId` - Debug local memory state
- `GET /api/recent-context/:userId` - Get recent conversation context
- `POST /api/hybrid-memory-search` - Search hybrid memory system
- `GET /api/debug-memories/:userId` - View all Pinecone memories

## Configuration

The system uses these default settings:
- **Summarization Interval**: 10 minutes
- **Local Memory Retention**: 1 week after summarization
- **Session Timeout**: 30 minutes of inactivity
- **Local Search Results**: 3-5 recent conversations
- **Long-term Search Results**: 2-3 relevant summaries
- **Memory Threshold**: 0.3 similarity score

## Monitoring

Watch the server console for these log messages:
- `🧠 ConversationService initialized with local memory`
- `📝 Added turn to session [sessionId]`
- `⏰ Started periodic summarization (every 10 minutes)`
- `📋 Summarizing X conversation sessions...`
- `📤 Uploaded conversation summary to Pinecone`
- `🧹 Cleaned up X old conversation sessions (older than 1 week)`