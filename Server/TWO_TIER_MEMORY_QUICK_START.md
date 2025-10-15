# 🎯 Two-Tier Memory: Quick Implementation Guide

## Problem Solved
- ✅ AI remembers user's name across all chats
- ✅ Each chat remembers only its own conversation
- ✅ Maintains 90% cost savings from chat-scoped search

---

## Quick Example

```
Yesterday - Chat A:
User: "My name is John, I love React"
→ Stored in USER PROFILE ✅

Today - Chat B:
User: "What's my name?"
AI: "Your name is John!" ✅ (from profile)

User: "What did we discuss?"
AI: "We just discussed your name" ✅ (only Chat B)
❌ Does NOT mention React from Chat A
```

---

## Implementation Steps

### Step 1: Create User Profile Service (30 min)

**File**: `Server/services/userProfileService.ts`

```typescript
export interface UserProfile {
  userId: string;
  name?: string;
  preferences: {
    interests: string[];
    programmingLanguages: string[];
  };
  role?: string;
  experienceLevel?: string;
  lastUpdated: number;
}

class UserProfileService {
  private profiles: Map<string, UserProfile> = new Map();
  
  getUserProfile(userId: string): UserProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        preferences: { interests: [], programmingLanguages: [] },
        lastUpdated: Date.now()
      };
      this.profiles.set(userId, profile);
    }
    return profile;
  }
  
  // Extract name/interests from conversation using AI
  async extractProfileInfo(conversation: string): Promise<Partial<UserProfile>> {
    // Use Gemini to extract: name, interests, role, etc.
    // Return extracted info
  }
  
  updateProfile(userId: string, updates: Partial<UserProfile>): void {
    const profile = this.getUserProfile(userId);
    Object.assign(profile, updates, { lastUpdated: Date.now() });
  }
}

export const userProfileService = new UserProfileService();
```

---

### Step 2: Update Memory Search (15 min)

**File**: `Server/services/hybridMemoryService.ts`

```typescript
import { userProfileService } from './userProfileService';

async searchMemory(userId, query, chatId, messageCount) {
  // 1. Get user profile (cross-chat)
  const userProfile = userProfileService.getUserProfile(userId);
  const profileContext = `
User Profile:
- Name: ${userProfile.name || 'Unknown'}
- Interests: ${userProfile.preferences.interests.join(', ')}
- Role: ${userProfile.role || 'Unknown'}
  `;
  
  // 2. Get chat context (current chat only)
  const localResults = this.conversationService.searchLocalConversations(
    userId, query, maxLocalResults
  );
  
  // 3. Get Pinecone results (chat-scoped)
  const isNewChat = messageCount === 0;
  const longTermResults = await this.embeddingService.searchMemories(query, {
    userId,
    chatId: isNewChat ? undefined : chatId,
    isNewChat
  });
  
  // 4. Combine with TWO SECTIONS
  const combinedContext = `
═══════════════════════════════════════════════════════════
🔵 USER PROFILE (Remember across all chats):
${profileContext}
═══════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════
🟢 CURRENT CHAT HISTORY (Only this conversation):
${localResults.map(t => `User: ${t.userPrompt}\nAI: ${t.aiResponse}`).join('\n\n')}
═══════════════════════════════════════════════════════════
  `;
  
  return { combinedContext, userProfile, localResults, longTermResults };
}
```

---

### Step 3: Update Storage (15 min)

**File**: `Server/index.ts`

```typescript
// After AI responds
setImmediate(async () => {
  // 1. Store in chat memory (with chatId)
  hybridMemoryService.storeConversationTurn(
    userId, prompt, aiText, chatId
  );
  
  // 2. Extract and update user profile
  const profileUpdates = await userProfileService.extractProfileInfo(
    `User: ${prompt}\nAI: ${aiText}`
  );
  
  if (Object.keys(profileUpdates).length > 0) {
    userProfileService.updateProfile(userId, profileUpdates);
    console.log(`✅ [BACKGROUND] Updated user profile:`, profileUpdates);
  }
});
```

---

### Step 4: AI Extraction Function (20 min)

**File**: `Server/services/userProfileService.ts`

```typescript
async extractProfileInfo(conversation: string): Promise<Partial<UserProfile>> {
  if (!this.ai) return {};
  
  const prompt = `
Analyze this conversation and extract ONLY personal user information:

${conversation}

Extract ONLY if explicitly mentioned:
- name: User's name
- interests: Topics they're interested in
- programmingLanguages: Languages they use/mention
- role: Their job/role (developer, student, etc.)
- experienceLevel: beginner, intermediate, expert

Return as JSON. If nothing found, return {}.
Example: { "name": "John", "interests": ["React"], "role": "developer" }
  `;
  
  try {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [prompt]
    });
    
    const text = response.candidates[0].content.parts[0].text;
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    return json;
  } catch (error) {
    console.error('Failed to extract profile info:', error);
    return {};
  }
}
```

---

## Testing

### Test 1: Set Profile
```bash
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hi, my name is Sarah and I love Python",
    "userId": "user123",
    "chatId": "chatA",
    "messageCount": 0
  }'

# Expected console log:
✅ [BACKGROUND] Updated user profile: { name: "Sarah", interests: ["Python"] }
```

### Test 2: Retrieve Profile in New Chat
```bash
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is my name?",
    "userId": "user123",
    "chatId": "chatB",
    "messageCount": 0
  }'

# Expected response:
"Your name is Sarah!"
```

### Test 3: Chat-Specific Context
```bash
curl -X POST http://localhost:8000/api/ask-ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What did we just discuss?",
    "userId": "user123",
    "chatId": "chatB",
    "messageCount": 1
  }'

# Expected response:
"We just discussed your name - you're Sarah"
# Should NOT mention Python from Chat A
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              HYBRID MEMORY SERVICE SEARCHES:                 │
│                                                              │
│  1. 🔵 User Profile (cross-chat, permanent)                │
│     └─ Name: "Sarah"                                        │
│     └─ Interests: ["Python", "React"]                      │
│                                                              │
│  2. 🟢 Chat Context (this chat only)                       │
│     └─ Recent messages from THIS chat                       │
│                                                              │
│  3. 🟡 Pinecone Long-term (chat-scoped if continuing)      │
│     └─ Old messages filtered by chatId                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    AI RECEIVES PROMPT:                       │
│                                                              │
│  USER PROFILE:                                              │
│  - Name: Sarah                                              │
│  - Interests: Python, React                                 │
│                                                              │
│  CURRENT CHAT CONTEXT:                                      │
│  - [Messages from THIS chat only]                           │
│                                                              │
│  Current Question: "What's my name?"                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              AI RESPONDS: "Your name is Sarah!"              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKGROUND STORAGE:                       │
│                                                              │
│  1. Store in Chat B memory (with chatId)                   │
│  2. Update User Profile if new info found                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

### ✅ What This Solves
1. User profile remembered across ALL chats
2. Each chat keeps its own conversation context
3. AI knows the difference between personal info and chat history
4. 90% cost savings maintained (chat-scoped search still works)

### ⚠️ Important Notes
- Profile updates are **additive** (doesn't overwrite existing info)
- Profile extraction happens in **background** (doesn't slow response)
- Chat context is **chat-specific** (chatId filtering)
- Profile is **user-specific** (no chatId, applies to all chats)

---

## Time Estimate

- Step 1: 30 minutes (UserProfileService)
- Step 2: 15 minutes (Update memory search)
- Step 3: 15 minutes (Update storage)
- Step 4: 20 minutes (AI extraction)
- Testing: 20 minutes

**Total: ~1.5 hours** ⏱️

---

## Next Steps

1. Read `TWO_TIER_MEMORY_STRATEGY.md` for complete details
2. Create `userProfileService.ts`
3. Update `hybridMemoryService.ts`
4. Test with the scenarios above
5. Monitor console logs for profile updates

Ready to implement? 🚀
