# NubiqAI – Continuation Plan

## What Happened Today
- Fixed Pinecone metadata mapping so `/api/chats` returns image attachments and stable ids again.
- Tightened frontend image intent detection (last-two-message context, clarification when prompt lacks a subject).
- Ensured cached Firebase images hydrate correctly via IndexedDB (image placeholder path verified).

## Current State Snapshot
- Frontend: `ChatInterface.tsx`
	- Clarifies generic image prompts
	- Pre-processes attached docs before asking AI
	- Single-flight UX: disables inputs while a response is in progress
- Backend:
	- Pinecone metadata (chatId, role, image flags) preserved in `embeddingService` and surfaced by `/api/chats`
	- Firestore session storage live: `users/{userId}/activeChats/{chatId}`
	- Concurrency guard on `/api/ask-ai`: per-user+chat lock with 409 on overlap and 2m TTL fail-safe
- Persistence: Local/Firestore during chat; Pinecone save triggered via `/api/end-chat` and `/api/save-all-chats`
- Runtime: Single Node process; heavy tasks (Gemini, Pinecone, Firebase uploads) currently run inline

## Open Questions / Follow Ups
1. Validate the new clarification flow in the UI (“generate me an image”) and ensure analytics/toasts feel right.
2. Confirm multi-tab behaviour when cached images rehydrate (no duplicate `initial-*` chat ids).
3. Introduce a lightweight background queue for Pinecone uploads and large document/image tasks (retry/backoff)
4. Re-run `npm run start --prefix Server` after fixing the typo in the last command

## Tomorrow's Action Plan
- [ ] Regression test image generation: specific prompt, generic prompt, `/imagine`, and chat switching during generation
- [ ] Exercise chat-loading via `/api/chats` to ensure Firestore + Pinecone merge cleanly (especially archived chats)
- [ ] Add background job queue (phase 1: in-memory) for `/api/end-chat` persistence retries with backoff
- [ ] Review `handleNewChat`/`handleSelectChat` flows for duplicate `initial-*` ids and confirm `/api/end-chat` always fires

## Longer-Term Considerations
- Introduce durable storage for active sessions to survive restarts and support horizontal scaling.
- Wrap Pinecone/image uploads in background jobs with retry/backoff so the UI stays responsive under load.
- Add per-user or per-plan throttles to the rate limiter and monitor token usage per request.

## Quick Verification Checklist
- `npm run start --prefix Server` and `npm run dev` both launch without warnings
- Trigger `getChats` (local, then all) and confirm messages/attachments + Firestore metadata show correctly
- Upload a DOCX and ask for a summary; confirm the first reply references the document content
- Send two prompts rapidly in the same chat; confirm the second is blocked (client) or returns 409 (server)
- Switch chats; confirm `/api/end-chat` logs and Firestore `pendingPersistence` flips to false after background upload
