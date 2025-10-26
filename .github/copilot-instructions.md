# NubiqAI - AI Coding Agent Instructions

## Project Overview

NubiqAI is a context-aware AI chat application with sophisticated multi-tier memory management, document RAG, and image generation/editing capabilities. The architecture follows a **client-server split** with React (Vite) frontend and Express/TypeScript backend, using Google Gemini for AI, Pinecone for vector storage, and Firebase for auth & storage.

## Architecture & Key Concepts

### Client-Server Boundaries

- **Frontend** (`src/`): React 18 + TypeScript + Vite, port 3000
- **Backend** (`Server/`): Express + TypeScript, port 8000
- **Communication**: REST API at `/api/*` endpoints (ask-ai, process-document, chats, profile, etc.)
- **Environment**: Frontend uses `VITE_*` vars, backend uses direct env vars from `Server/.env`

### Three-Tier Memory System (Critical!)

This is the **core architectural pattern**. Every chat message goes through:

1. **Local Session Memory** (`conversationService.ts`): In-RAM storage of recent turns (last 5-10 messages per chat)
   - Fast access (~0ms), session-scoped by `userId:chatId`
   - Auto-summarization every 60s via background process
2. **Hybrid Memory Service** (`hybridMemoryService.ts`): Smart orchestrator
   - Combines local + long-term with cost-optimization strategies (`cost-optimized`, `comprehensive`, `balanced`)
   - **Upload cooldown**: 1-minute minimum between Pinecone uploads per chat
   - Returns `HybridMemoryResult` with optimization metadata

3. **Pinecone Long-Term Storage** (`pineconeStorageService.ts`): Vector DB for cross-session memory
   - **ID Structure**: `{userId}:{chatId}:{turnId}:{role}` (e.g., `user-123:chat-abc:turn-001:user`)
   - **Per-message storage**: Each message stored separately with full metadata (NOT summarized)
   - User isolation via metadata filters: `{ userId: "user-123" }`
   - Batch operations in chunks of 100 vectors

### Rolling Summary System (`contextManager.ts`)

Builds Copilot-style context for each request:

- Recent conversation summary with key facts
- User profile context (name, role, interests, background)
- Relevant memory chunks (local + long-term)
- Document RAG context (if `documentId` present)

## Critical Workflows

### Development Setup

```powershell
# Install dependencies for BOTH frontend and backend
cd "d:\flutter project\NubiqAi"
npm install
cd Server
npm install
cd ..

# Run development (two terminals)
npm run dev              # Frontend (port 3000)
cd Server; npm start     # Backend (port 8000, nodemon)
```

### Build for Production

```powershell
npm install; npm run build; cd Server; npm install
# Output: dist/ (frontend static), Server/ (backend with node_modules)
```

### Chat Persistence Flow (IMPORTANT!)

When switching/closing chats, **must** call `apiService.endChat()` to persist to Pinecone:

```typescript
// App.tsx pattern for chat switching
if (activeChat && activeChat.messages.length > 0 && user) {
  apiService
    .endChat({ userId: user.id, chatId: activeChat.id })
    .then(() => console.log("✅ Chat persisted"))
    .catch((err) => console.warn("⚠️ Failed to persist chat", err));
}
```

### Document RAG (Retrieval-Augmented Generation)

1. **Upload**: `POST /api/process-document` → extracts text → stores in `documentCacheService` → returns `documentId`
2. **Query**: Include `documentId` in chat request → backend retrieves top 3 relevant chunks via keyword matching
3. **Context injection**: Chunks added to prompt as "📄 DOCUMENT CONTEXT" section
4. **Auto-cleanup**: Documents evicted after 1 hour

### Image Generation vs Editing

- **Generation**: Use `gemini-2.0-flash-thinking-exp-01-21` with **clean user prompt only** (NO system instructions, NO memory context)
- **Editing**: Gemini doesn't support mask-based editing; simulates by re-generating with modified prompt
- **Storage**: Images cached in `localImageCacheService` (Server-side) + `imageStorageService` (IndexedDB client-side) + Firebase Storage for persistence

## Project-Specific Conventions

### File Naming & Structure

- **Services**: Always in `Server/services/` with `get{ServiceName}()` singleton pattern
  ```typescript
  let instance: ServiceName | null = null;
  export function getServiceName(): ServiceName {
    if (!instance) instance = new ServiceName();
    return instance;
  }
  ```
- **Components**: PascalCase in `src/components/`, use shadcn/ui primitives from `src/components/ui/`
- **Types**: Shared in `src/types.ts` (frontend), `Server/types/` (backend-specific)

### Error Handling Pattern

Backend follows consistent error logging with emojis:

```typescript
console.log("✅ Success message");
console.warn("⚠️ Warning message");
console.error("❌ Error message");
```

Always wrap API routes in try-catch and return structured JSON:

```typescript
try {
  // ... logic
  res.json({ success: true, data });
} catch (error) {
  console.error("❌ Error in /api/endpoint:", error);
  res.status(500).json({ success: false, error: "User-friendly message" });
}
```

### Firebase Authentication Flow

- Uses `useAuth` hook from `src/hooks/useAuth.ts`
- Google Sign-In via Firebase Auth, returns `{ user, isNewUser }`
- User ID stored as `user.id` (Firebase UID), used for all backend requests
- **Security**: Backend validates userId from request body (TODO: Replace with JWT verification before production)

### Environment Configuration

- **Backend**: `Server/.env` (see `Server/.env.example`)
  - `GEMINI_API_KEY`, `PINECONE_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`
  - Firebase admin credentials (private key as single-line string with `\n`)
- **Frontend**: Root `.env` with `VITE_*` prefix
  - `VITE_API_URL`, `VITE_FIREBASE_*` config

### Job Queue System (`jobQueue.ts`)

In-memory queue with retry/backoff for background tasks:

- `persist-chat` job: Uploads conversations to Pinecone asynchronously
- Exponential backoff: 0.5s, 1s, 2s, 4s (max 5 attempts)
- **Single-node only** (for multi-node, replace with BullMQ/Redis)

## Testing & Debugging

### Utility Scripts (all in `Server/`)

```bash
# Clear all conversation history (local + Pinecone)
npm run clear-history  # Runs clear-all-history.ts

# Delete all Pinecone data (vector reset)
npm run clear-pinecone  # Runs delete-all-pinecone-data.ts

# Test document processing
node test-process-doc.cjs
```

### Common Issues

1. **"No turns found for chat"**: Ensure `endChat()` called before switching chats (see `CHAT_PERSISTENCE_IMPLEMENTATION_COMPLETE.md`)
2. **CORS errors**: Check `ALLOWED_ORIGINS` in `Server/.env` matches frontend URL
3. **LocalStorage quota exceeded**: Image base64 stripped on save (see `App.tsx` line ~112), rehydrated from Firebase URLs on load
4. **Pinecone upload failures**: Check upload cooldown (1min between uploads per chat)

## Key Files to Reference

### Memory & Context

- `Server/services/hybridMemoryService.ts` - Memory orchestration logic
- `Server/services/contextManager.ts` - Rolling summary builder (like Copilot's context)
- `Server/services/pineconeStorageService.ts` - Vector storage with user isolation

### Request Processing

- `Server/index.ts` line 272-1800 - Main `/api/ask-ai` endpoint with full context pipeline
- `src/components/ChatInterface.tsx` - Frontend message handling & API calls

### Data Persistence

- `Server/services/firestoreChatService.ts` - Firestore chat metadata storage
- `Server/services/jobQueue.ts` - Background job processing
- `src/services/imageStorageService.ts` - IndexedDB image caching (50MB limit)

## Documentation Hotspots

Extensive implementation guides in `docs/`:

- `docs/architecture/PINECONE_MULTI_USER_STORAGE.md` - User isolation & scalability design
- `docs/implementation/DOCUMENT_RAG_COMPLETE.md` - RAG system explanation
- `docs/guides/MEMORY_SYSTEM_VISUALIZED.md` - Two-tier memory architecture
- `CONTEXT_AWARE_CHAT_VISUAL_GUIDE.md` - Request lifecycle with mermaid diagrams

## DO NOT

- ❌ Send large base64 images to localStorage (strip & rehydrate instead)
- ❌ Include system instructions/memory context in image generation prompts
- ❌ Upload to Pinecone on every message (use upload cooldown)
- ❌ Trust userId from request body in production (implement JWT verification first)
- ❌ Store summarized conversations in Pinecone (store individual messages)

## When Adding Features

1. Check if memory system needs to track new data → update `ConversationTurn` in `conversationService.ts`
2. New API endpoint? → Add rate limiting via `rateLimitMiddleware("general")`
3. User-specific data? → Always filter by `userId` in Pinecone queries
4. Long-running task? → Use `jobQueue.enqueue()` for background processing
5. New service? → Follow singleton pattern with `get{ServiceName}()` export
