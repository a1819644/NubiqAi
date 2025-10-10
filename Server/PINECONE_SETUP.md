# Pinecone Integration for NubiqAi Memory System

This guide explains how to set up and use the Pinecone vector database integration for persistent memory and contextual conversations in NubiqAi.

## Prerequisites

1. **Pinecone Account**: Sign up at [https://www.pinecone.io/](https://www.pinecone.io/)
2. **Google Gemini API**: For generating embeddings (already configured)

## Setup Instructions

### 1. Create Pinecone Index

1. Log into your Pinecone console
2. Create a new index with these specifications:
   - **Name**: `nubiq-ai-memory` (or update `PINECONE_INDEX_NAME` in `.env`)
   - **Dimensions**: `768` (for Google's text-embedding-004 model)
   - **Metric**: `cosine` (recommended for text similarity)
   - **Pod Type**: `starter` or `s1.x1` (based on your needs)

### 2. Environment Configuration

Copy the Pinecone configuration to your `.env` file:

```bash
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=nubiq-ai-memory

# Existing Google Gemini configuration
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Get Your Pinecone Credentials

1. In Pinecone console, go to **API Keys**
2. Copy your **API Key**
3. Note your **Environment** (e.g., `us-east-1-aws`)

## API Endpoints

### Memory Storage

#### Store Single Memory
```bash
POST /api/store-memory
Content-Type: application/json

{
  "content": "The user prefers dark mode and uses VS Code for development",
  "type": "note",
  "userId": "user123",
  "tags": ["preferences", "ui"]
}
```

#### Store Multiple Memories
```bash
POST /api/store-memories
Content-Type: application/json

{
  "memories": [
    {
      "content": "User is a React developer",
      "type": "note",
      "userId": "user123"
    },
    {
      "content": "User prefers TypeScript over JavaScript",
      "type": "note", 
      "userId": "user123"
    }
  ]
}
```

### Memory Retrieval

#### Search Memories
```bash
POST /api/search-memory
Content-Type: application/json

{
  "query": "What does the user prefer for development?",
  "topK": 5,
  "threshold": 0.7,
  "userId": "user123"
}
```

#### Enhanced AI Chat with Memory
```bash
POST /api/ask-ai
Content-Type: application/json

{
  "prompt": "What programming language should I use?",
  "useMemory": true,
  "userId": "user123"
}
```

#### Process Document with Memory Storage
```bash
POST /api/process-document
Content-Type: application/json

{
  "fileBase64": "base64_encoded_content",
  "mimeType": "application/pdf",
  "storeInMemory": true,
  "userId": "user123"
}
```

### Memory Management

#### Delete Memory
```bash
DELETE /api/memory/{memoryId}
```

#### Get Memory Statistics
```bash
GET /api/memory-stats
```

## Features

### 1. Semantic Memory Search
- Uses Google's text-embedding-004 model for high-quality embeddings
- Cosine similarity search for contextually relevant memories
- Configurable similarity thresholds

### 2. Automatic Context Enhancement
- Chat conversations automatically include relevant memories
- Configurable memory integration (can be disabled per request)
- Automatic conversation storage for future context

### 3. Memory Types
- **conversation**: AI chat interactions
- **document**: Processed documents and files
- **note**: Manual notes and preferences

### 4. User-Specific Memory
- Memories are tagged with user IDs
- Searches can be filtered by user
- Privacy-preserving memory isolation

### 5. Metadata and Tagging
- Rich metadata for filtering and organization
- Custom tags for categorization
- Timestamp tracking for temporal relevance

## Memory Workflow Examples

### 1. Learning User Preferences
```javascript
// Store user preference
await fetch('/api/store-memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: "User prefers React with TypeScript for web development",
    type: "note",
    userId: "user123",
    tags: ["preferences", "development"]
  })
});

// Later, when user asks about web development
await fetch('/api/ask-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "What's the best framework for my project?",
    useMemory: true,
    userId: "user123"
  })
});
// AI will consider the stored preference in its response
```

### 2. Document Knowledge Base
```javascript
// Process and store a technical document
await fetch('/api/process-document', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileBase64: "base64_pdf_content",
    mimeType: "application/pdf",
    storeInMemory: true,
    userId: "user123"
  })
});

// Later, ask questions about the document
await fetch('/api/ask-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "What were the key findings in the research paper?",
    useMemory: true,
    userId: "user123"
  })
});
```

### 3. Search Specific Memories
```javascript
// Find all development-related memories
await fetch('/api/search-memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "programming development coding",
    topK: 10,
    threshold: 0.6,
    userId: "user123"
  })
});
```

## Performance Considerations

### 1. Embedding Generation
- Embedding generation adds ~200-500ms per request
- Consider caching strategies for frequently accessed content
- Batch operations for bulk memory storage

### 2. Memory Search
- Pinecone queries typically respond in <100ms
- Higher topK values increase response time
- Use appropriate similarity thresholds to filter noise

### 3. Storage Costs
- Pinecone pricing scales with index size
- Consider memory retention policies
- Implement cleanup strategies for old or irrelevant memories

## Best Practices

### 1. Memory Content
- Store meaningful, contextual information
- Avoid storing sensitive personal data
- Use clear, descriptive content for better search results

### 2. User Management
- Always include userId for multi-user applications
- Implement proper access controls
- Consider user consent for memory storage

### 3. Memory Hygiene
- Regularly clean up old or irrelevant memories
- Implement retention policies
- Monitor memory usage and costs

### 4. Error Handling
- Memory operations are non-blocking for chat
- Graceful degradation when Pinecone is unavailable
- Proper logging for debugging memory issues

## Troubleshooting

### Common Issues

1. **Index not found**
   - Verify index exists in Pinecone console
   - Check PINECONE_INDEX_NAME matches console

2. **Dimension mismatch**
   - Ensure index dimension is 768
   - Google's text-embedding-004 produces 768-dimensional vectors

3. **API key issues**
   - Verify PINECONE_API_KEY is correct
   - Check API key permissions in Pinecone console

4. **No embeddings returned**
   - Verify GEMINI_API_KEY is configured
   - Check text-embedding-004 model availability

### Debug Mode
Enable debug logging by setting:
```bash
NODE_ENV=development
```

## Frontend Integration

See the frontend components in `/src/components/` for examples of:
- Memory search interfaces
- Memory management UI
- Chat with memory context display

The memory system seamlessly integrates with the existing chat interface, providing contextual conversations without additional UI complexity.