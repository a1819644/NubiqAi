# 🎯 Two-Tier Memory Strategy: User Profile + Chat Context

**Problem**: Need to remember user details (name, preferences) across all chats, while keeping individual chat contexts separate.

---

## 📊 Current vs Desired State

### ❌ Current Problem

```
Chat A (Yesterday):
User: "My name is John and I love React"
AI: "Nice to meet you, John! React is great."

Chat B (Today):
User: "What's my name?"
AI: "I don't know, we just started chatting" ❌ FORGOT!
```

**Issue**: Each chat is isolated. AI forgets user details from previous chats.

---

### ✅ Desired Solution

```
Chat A (Yesterday):
User: "My name is John and I love React"
AI: "Nice to meet you, John!"
→ Stores in USER PROFILE (permanent, cross-chat)

Chat B (Today):  
User: "What's my name?"
AI: "Your name is John!" ✅ REMEMBERS!
→ Retrieved from USER PROFILE

BUT when user asks "What did we discuss?"
AI: "We just started this chat" ✅ CORRECT!
→ Only shows Chat B history, not Chat A
```

---

## 🏗️ Architecture Design

### Two-Level Memory System

```
┌─────────────────────────────────────────────────────────────┐
│                     USER PROFILE MEMORY                      │
│  • Name, preferences, personal info                         │
│  • Shared across ALL chats                                  │
│  • Permanent, never expires                                 │
│  • Stored in Pinecone with userId tag (no chatId)          │
└─────────────────────────────────────────────────────────────┘
                            ↓
                            ↓ AI gets both contexts
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     CHAT CONVERSATION MEMORY                 │
│  • Current chat history                                     │
│  • Specific to THIS chat only                               │
│  • Expires when chat ends                                   │
│  • Stored in Pinecone with userId + chatId tags            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Strategy

### Phase 1: Add User Profile Storage

```typescript
// New interface for user profile
interface UserProfile {
  userId: string;
  name?: string;
  preferences: {
    favoriteTopics: string[];
    programmingLanguages: string[];
    timezone?: string;
    location?: string;
  };
  personalInfo: {
    role?: string;          // "developer", "student", etc.
    experience?: string;    // "beginner", "intermediate", "expert"
    interests: string[];
  };
  lastUpdated: number;
}

// Store profiles separately from conversations
private userProfiles: Map<string, UserProfile> = new Map();
```

### Phase 2: Extract Profile Information from Conversations

```typescript
async extractUserProfile(conversation: ConversationTurn[]): Promise<UserProfile> {
  // Use AI to extract personal information
  const prompt = `
Analyze this conversation and extract the user's personal information:

${conversation.map(t => `User: ${t.userPrompt}\nAI: ${t.aiResponse}`).join('\n\n')}

Extract:
1. User's name (if mentioned)
2. Favorite topics or interests
3. Programming languages they use
4. Their role (developer, student, etc.)
5. Experience level

Return as JSON.
  `;
  
  const response = await ai.generateContent(prompt);
  return parseProfileFromAI(response);
}
```

### Phase 3: Smart Memory Search with Two Tiers

```typescript
async searchMemoryWithProfile(userId: string, query: string, chatId: string) {
  
  // 1️⃣ ALWAYS get user profile (cross-chat, permanent)
  const userProfile = await this.getUserProfile(userId);
  
  // 2️⃣ Get chat-specific context (only this chat)
  const chatContext = await this.searchChatMemory(userId, chatId, query);
  
  // 3️⃣ Combine both contexts
  return {
    userProfile: `
User Profile:
- Name: ${userProfile.name || 'Unknown'}
- Interests: ${userProfile.interests.join(', ')}
- Experience: ${userProfile.experience}
    `,
    chatContext: `
Current Chat History:
${chatContext.map(turn => `User: ${turn.userPrompt}\nAI: ${turn.aiResponse}`).join('\n')}
    `
  };
}
```

---

## 📝 Enhanced Prompt Structure

### Current Prompt (Single-tier)
```typescript
const prompt = `
Context: ${chatMemory}

User: ${question}
`;
```

### New Prompt (Two-tier)
```typescript
const prompt = `
═══════════════════════════════════════════════════════════
USER PROFILE (Remember across all chats):
${userProfile}

IMPORTANT: This information persists across all conversations.
If the user asks about their name, preferences, or past interactions,
use this profile information.
═══════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════
CURRENT CHAT CONTEXT (Only this conversation):
${chatContext}

IMPORTANT: This is the history of ONLY the current chat.
When discussing "what we talked about", refer only to this context.
═══════════════════════════════════════════════════════════

Current Question: ${question}

Instructions:
- Use USER PROFILE for personal information (name, preferences, etc.)
- Use CURRENT CHAT CONTEXT for conversation history
- Keep these two contexts separate in your understanding
`;
```

---

## 🔍 Example Scenarios

### Scenario 1: User Introduces Themselves

**Chat A - First interaction**:
```
User: "Hi, my name is Sarah and I'm a React developer"

→ System detects profile information:
  {
    name: "Sarah",
    role: "developer",
    interests: ["React"],
    programmingLanguages: ["React"]
  }

→ Stores in USER PROFILE (permanent, no chatId)
→ Also stores in Chat A history (chatId: "chat-a-123")
```

---

### Scenario 2: New Chat - Profile Remembered

**Chat B - New conversation (next day)**:
```
User: "What's my name?"

→ System searches:
  1. USER PROFILE → Found: "Sarah"
  2. Chat B history → Empty (new chat)

→ AI receives both:
  USER PROFILE: "Name: Sarah, Developer, likes React"
  CURRENT CHAT: "(empty)"

AI: "Your name is Sarah! Nice to see you again." ✅
```

---

### Scenario 3: Chat-Specific Questions

**Chat B - Continuing**:
```
User: "What did we just discuss?"

→ System searches:
  1. USER PROFILE → "Sarah, developer, React"
  2. Chat B history → "What's my name?" conversation

AI: "We just discussed your name - you're Sarah!" ✅

❌ DOES NOT include Chat A history about React
```

---

### Scenario 4: Cross-Chat Context When Appropriate

**Chat C - New conversation about React**:
```
User: "Tell me about React hooks"

→ System searches:
  1. USER PROFILE → "Sarah, developer, likes React"
  2. Chat C history → Empty (new chat)
  3. Relevant summaries → Chat A discussed React

AI: "I remember you're interested in React! Let me explain hooks..." ✅
```

---

## 🎯 Implementation Plan

### Step 1: Add User Profile Interface

```typescript
// Server/services/userProfileService.ts (NEW FILE)

export interface UserProfile {
  userId: string;
  metadata: {
    name?: string;
    email?: string;
    createdAt: number;
    lastUpdated: number;
  };
  preferences: {
    favoriteTopics: string[];
    programmingLanguages: string[];
    frameworks: string[];
    interests: string[];
  };
  personalInfo: {
    role?: string;           // "developer", "student", "designer"
    experienceLevel?: string; // "beginner", "intermediate", "expert"
    location?: string;
    timezone?: string;
  };
  chatHistory: {
    totalChats: number;
    totalMessages: number;
    firstChatDate: number;
    lastChatDate: number;
  };
}

class UserProfileService {
  private profiles: Map<string, UserProfile> = new Map();
  
  // Get or create user profile
  async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.profiles.get(userId);
    
    if (!profile) {
      profile = this.createDefaultProfile(userId);
      this.profiles.set(userId, profile);
    }
    
    return profile;
  }
  
  // Extract profile info from conversation using AI
  async updateProfileFromConversation(
    userId: string,
    conversation: ConversationTurn[]
  ): Promise<void> {
    const profile = await this.getUserProfile(userId);
    const extractedInfo = await this.extractInfoFromConversation(conversation);
    
    // Merge extracted info with existing profile
    this.mergeProfileInfo(profile, extractedInfo);
    
    // Store in Pinecone for permanent storage
    await this.storePr ofileToPinecone(profile);
  }
  
  // Search for user profile information
  async searchProfile(userId: string, query: string): Promise<string> {
    const profile = await this.getUserProfile(userId);
    
    // Format profile as context
    return `
User Profile for ${profile.metadata.name || 'User'}:
- Role: ${profile.personalInfo.role || 'Unknown'}
- Experience: ${profile.personalInfo.experienceLevel || 'Unknown'}
- Interests: ${profile.preferences.interests.join(', ') || 'None recorded'}
- Favorite Topics: ${profile.preferences.favoriteTopics.join(', ') || 'None recorded'}
- Programming Languages: ${profile.preferences.programmingLanguages.join(', ') || 'None recorded'}
    `;
  }
}
```

---

### Step 2: Enhance Hybrid Memory Service

```typescript
// Server/services/hybridMemoryService.ts

async searchMemory(
  userId: string,
  query: string,
  chatId?: string,
  messageCount?: number
): Promise<HybridMemoryResult> {
  
  const isNewChat = messageCount === 0;
  
  // 1️⃣ ALWAYS get user profile (cross-chat, permanent)
  const userProfile = await this.userProfileService.searchProfile(userId, query);
  
  // 2️⃣ Get local conversation context (fast, in-memory)
  const localResults = this.conversationService.searchLocalConversations(
    userId,
    query,
    maxLocalResults
  );
  
  // 3️⃣ Get Pinecone results with smart scoping
  let longTermResults: SearchResult[] = [];
  
  if (isNewChat) {
    // New chat: Search user-wide (but NOT profile info)
    longTermResults = await this.embeddingService.searchMemories(query, {
      userId,
      filter: { type: 'conversation' }, // Exclude profile data
      isNewChat: true
    });
  } else {
    // Continuing chat: Search only this chat
    longTermResults = await this.embeddingService.searchMemories(query, {
      userId,
      chatId,
      filter: { type: 'conversation' },
      isNewChat: false
    });
  }
  
  // 4️⃣ Combine all contexts with clear separation
  return {
    userProfile,           // 🔵 Cross-chat, permanent
    localResults,          // 🟢 Recent, in-memory
    longTermResults,       // 🟡 Historical, Pinecone
    combinedContext: this.createTwoTierContext(
      userProfile,
      localResults,
      longTermResults
    )
  };
}

private createTwoTierContext(
  userProfile: string,
  localResults: ConversationTurn[],
  longTermResults: SearchResult[]
): string {
  const sections: string[] = [];
  
  // Section 1: User Profile (ALWAYS included, cross-chat)
  sections.push(`
═══════════════════════════════════════════════════════════
🔵 USER PROFILE (Persists across all chats):
${userProfile}

This is permanent information about the user. Use this for:
- User's name and personal details
- Preferences and interests
- Experience level and role
═══════════════════════════════════════════════════════════
  `);
  
  // Section 2: Current Chat Context (chat-specific)
  if (localResults.length > 0 || longTermResults.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════
🟢 CURRENT CHAT CONTEXT (Only this conversation):

${localResults.map((turn, i) => 
  `${i + 1}. User: ${turn.userPrompt}\n   AI: ${turn.aiResponse}`
).join('\n\n')}

This is the history of ONLY the current chat.
When user asks "what did we discuss?", refer to this section.
═══════════════════════════════════════════════════════════
    `);
  }
  
  return sections.join('\n\n');
}
```

---

### Step 3: Update Storage Logic

```typescript
// After AI responds, store in TWO places:

// 1️⃣ Store in chat-specific memory (with chatId)
await hybridMemoryService.storeConversationTurn(
  userId,
  prompt,
  aiResponse,
  chatId  // Chat-scoped
);

// 2️⃣ Extract and update user profile (no chatId)
await userProfileService.updateProfileFromConversation(
  userId,
  [{ userPrompt: prompt, aiResponse }]
);
```

---

## 📊 Memory Storage Breakdown

### Storage Location Decision Tree

```
New conversation turn received
    ↓
Does it contain personal info?
    ├─ YES → Extract and store in USER PROFILE
    │         (Pinecone with userId, type: "profile")
    └─ NO → Skip profile update
    ↓
Store conversation turn:
    1. Local memory (in-memory Map)
       - Fast access
       - Tagged with: userId + chatId
    
    2. Pinecone (after 10 turns or timeout)
       - Permanent storage
       - Tagged with: userId + chatId + type: "conversation"
```

---

### Pinecone Metadata Structure

```typescript
// User Profile Memory
{
  id: "profile_user123",
  metadata: {
    userId: "user123",
    type: "profile",          // ← KEY: No chatId!
    name: "Sarah",
    role: "developer",
    interests: ["React", "TypeScript"]
  }
}

// Chat Conversation Memory
{
  id: "turn_chat456_789",
  metadata: {
    userId: "user123",
    chatId: "chat456",        // ← KEY: Chat-specific!
    type: "conversation",
    timestamp: 1234567890
  }
}
```

---

## 🧪 Testing Scenarios

### Test 1: Profile Creation
```bash
# Chat A
POST /api/ask-ai
{
  "prompt": "Hi, my name is Alex and I'm learning Python",
  "userId": "user123",
  "chatId": "chatA",
  "messageCount": 0
}

# Expected:
→ Creates USER PROFILE with name="Alex", interests=["Python"]
→ Stores in Chat A history
```

---

### Test 2: Profile Retrieval in New Chat
```bash
# Chat B (different chat)
POST /api/ask-ai
{
  "prompt": "What's my name?",
  "userId": "user123",
  "chatId": "chatB",
  "messageCount": 0
}

# Expected:
→ Loads USER PROFILE: "Alex"
→ Chat B history is empty
→ AI responds: "Your name is Alex"
```

---

### Test 3: Chat-Specific Context
```bash
# Chat B (continuing)
POST /api/ask-ai
{
  "prompt": "What did we just talk about?",
  "userId": "user123",
  "chatId": "chatB",
  "messageCount": 1
}

# Expected:
→ Loads USER PROFILE: "Alex"
→ Loads Chat B history: "What's my name?" conversation
→ AI responds: "We just discussed your name - you're Alex"
→ Does NOT mention Python from Chat A
```

---

## 💡 Key Benefits

### 1. **Natural User Experience**
- User feels remembered across chats
- Each chat stays focused and relevant
- No confusion about "what we discussed"

### 2. **Cost Optimization**
- User profile stored once (not per chat)
- Chat contexts remain small and focused
- Less Pinecone storage needed

### 3. **Privacy & Control**
- Easy to delete specific chat history
- User profile persists independently
- Clear separation of concerns

### 4. **Scalability**
- User profile doesn't grow with chats
- Each chat remains lightweight
- Efficient memory usage

---

## 🚀 Implementation Priority

### Phase 1: Core Functionality (Week 1)
- [ ] Create UserProfileService
- [ ] Add profile extraction from conversations
- [ ] Update memory search to include profile

### Phase 2: Enhanced Features (Week 2)
- [ ] Auto-update profile from conversations
- [ ] Profile storage in Pinecone
- [ ] Two-tier prompt structure

### Phase 3: Polish (Week 3)
- [ ] Profile editing UI
- [ ] Profile privacy controls
- [ ] Analytics on profile usage

---

## 📝 Summary

**The Solution**:
```
┌──────────────────┐
│  USER PROFILE    │ ← Name, preferences (ALL chats)
└──────────────────┘
        +
┌──────────────────┐
│  CHAT CONTEXT    │ ← Conversation history (THIS chat only)
└──────────────────┘
        =
  Smart, contextual AI that remembers you but keeps chats focused!
```

This gives you the best of both worlds:
- ✅ AI remembers who you are (name, preferences)
- ✅ Each chat stays focused on its own topic
- ✅ 90% cost savings maintained (chat-scoped search)
- ✅ Natural user experience

Ready to implement? 🚀
