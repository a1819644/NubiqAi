# Two-Tier Memory System - Quick Test Guide 🧪

**Status**: Ready to Test  
**Estimated Test Time**: 10-15 minutes

---

## 🎯 Quick Start

### 1. Start the Server

```powershell
npm run start --prefix Server
```

**Expected Output**:
```
🧠 ConversationService initialized...
🔄 HybridMemoryService initialized...
🚀 Server is running on http://localhost:3000
```

---

## ✅ Test 1: Basic Profile Extraction (5 min)

### Objective
Verify that the system extracts user profile information from conversations.

### Steps

1. **Open the frontend** (http://localhost:5173 or your port)

2. **Start a new chat** and send these messages:

```
Message 1:
"Hi! My name is Alex and I'm a software engineer."

Message 2:
"I specialize in React and TypeScript development."

Message 3:
"I prefer technical details and concise explanations."
```

3. **Check the server console** for profile extraction logs:

```
Expected logs after 3rd message:
[USER PROFILE] Extracting profile info for user: user_xxx
[USER PROFILE] AI extraction response: ...
[USER PROFILE] ✓ Created new profile for user_xxx: {
  name: 'Alex',
  role: 'software engineer',
  interests: ['React', 'TypeScript'],
  preferences: ['technical details', 'concise explanations']
}
```

### ✅ Success Criteria
- [ ] Console shows profile extraction after 3 messages
- [ ] Profile contains name: "Alex"
- [ ] Profile contains role: "software engineer"
- [ ] Profile contains interests/preferences

---

## ✅ Test 2: Cross-Chat Profile Persistence (3 min)

### Objective
Verify that profile persists across different chat sessions.

### Steps

1. **Create a NEW chat** (different chatId)

2. **Send a message** that requires profile context:

```
"What programming topics should I focus on this week?"
```

3. **Check server console**:

```
Expected:
👤 Found user profile context for user_xxx
```

4. **Check AI response**:
   - Should mention your name ("Alex")
   - Should reference your role or interests
   - Example: "Hi Alex, given your expertise in React and TypeScript..."

### ✅ Success Criteria
- [ ] Console shows user profile found
- [ ] AI uses your name in the response
- [ ] AI references your role/interests

---

## ✅ Test 3: Chat Context Isolation (5 min)

### Objective
Verify that different chats maintain separate contexts while sharing profile.

### Steps

1. **Chat A** - Discuss React:
```
"I'm building a React dashboard. What state management should I use?"
```

2. **Chat B** - Discuss cooking (totally different topic):
```
"What's a good recipe for pasta carbonara?"
```

3. **Go back to Chat A** and ask:
```
"What did we discuss earlier?"
```

4. **Expected**: AI mentions the React dashboard, NOT the cooking

5. **Go to Chat B** and ask:
```
"What did we talk about?"
```

6. **Expected**: AI mentions the pasta recipe, NOT the React project

### ✅ Success Criteria
- [ ] Chat A only remembers React discussion
- [ ] Chat B only remembers cooking discussion
- [ ] BOTH chats remember your name/profile (Alex, software engineer)
- [ ] Contexts don't mix between chats

---

## ✅ Test 4: Profile Updates (3 min)

### Objective
Verify that profile merges new information without losing old data.

### Steps

1. **In a new or existing chat**, have 3 more exchanges mentioning new info:

```
Message 1:
"I also enjoy hiking and photography in my free time."

Message 2:
"I'm particularly interested in landscape photography."

Message 3:
"I use a Canon EOS R5 for my photos."
```

2. **After 3rd message**, check console:

```
Expected:
[USER PROFILE] ✓ Updated profile for user_xxx: {
  name: 'Alex',
  role: 'software engineer',
  interests: ['React', 'TypeScript', 'hiking', 'photography', 'landscape photography'],
  ...
}
```

3. **Verify**: Old interests (React, TypeScript) still present + new ones added

### ✅ Success Criteria
- [ ] Original profile data retained (name, role, React/TS)
- [ ] New interests added (hiking, photography)
- [ ] No data loss

---

## 🐛 Common Issues & Fixes

### Issue 1: No Profile Extraction

**Symptoms**: Console doesn't show profile extraction logs

**Possible Causes**:
1. Haven't reached 3 messages yet
2. GEMINI_API_KEY not set

**Fix**:
```powershell
# Check if API key is set
echo $env:GEMINI_API_KEY

# If not set, add to Server/.env:
GEMINI_API_KEY=your_key_here
```

---

### Issue 2: Profile Not Persisting Across Chats

**Symptoms**: New chat doesn't remember your name

**Check**:
1. Are you using the same userId?
2. Console shows "👤 Found user profile context"?

**Debug**:
- Look for userId in server logs
- Verify it's the same across chats
- Check if profile was actually created (Test 1)

---

### Issue 3: Chats Not Isolated

**Symptoms**: Chat B remembers Chat A's conversation

**Check**:
1. Are you actually creating separate chats?
2. Different chatId in the URL?
3. Console shows different chatId values?

**Note**: Profile (name, role) SHOULD persist - only conversation context should be separate.

---

### Issue 4: AI Not Using Profile

**Symptoms**: AI doesn't mention your name/role

**Check**:
```
Console should show:
👤 Found user profile context for user_xxx
🧠 Memory search results - Type: ...
```

**Debug**:
1. Profile might be empty (run Test 1 first)
2. Check if `generateProfileContext()` returns empty string
3. Verify profile has data: check extraction logs

---

## 📊 What to Look For in Console

### Good Signs ✅

```
[USER PROFILE] Extracting profile info for user: user_xxx
[USER PROFILE] ✓ Created new profile for user_xxx
👤 Found user profile context for user_xxx
💰 Skipping Pinecone search - found 2 local results (cost optimized)
```

### Warning Signs ⚠️

```
[USER PROFILE] No response from AI
[USER PROFILE] Gemini API not configured
[BACKGROUND] Profile extraction failed: ...
```

### Error Signs ❌

```
Error: Cannot find module 'userProfileService'
TypeError: genAI.models.generateContent is not a function
Error parsing profile JSON: ...
```

---

## 🎉 Success!

If all 4 tests pass, you've successfully implemented:

✅ User profile extraction  
✅ Cross-chat memory  
✅ Chat context isolation  
✅ Profile updates & merging  
✅ Non-blocking background processing  
✅ Cost-optimized memory system  

---

## 📈 Performance Monitoring

### Things to Monitor

1. **Profile Extraction Frequency**
   - Look for `[USER PROFILE]` logs
   - Should appear every 3 messages
   - Should NOT block responses

2. **Memory Search Performance**
   - Look for `💰 Skipping Pinecone` messages
   - Should skip Pinecone when local results are sufficient
   - Should use chat-scoped search in continuing chats

3. **Profile Size**
   - Profile should grow reasonably
   - Not duplicating interests
   - Merging properly

---

## 🚀 Next Steps After Testing

1. **If Tests Pass**:
   - Use the system normally
   - Monitor profile quality
   - Consider adding profile management UI

2. **If Tests Fail**:
   - Check console errors
   - Verify API keys
   - Review TWO_TIER_MEMORY_IMPLEMENTATION.md
   - Check file modifications were applied correctly

3. **For Production**:
   - Replace in-memory storage with database
   - Add profile management endpoints
   - Implement privacy controls
   - Add monitoring/analytics

---

## 📝 Test Results Template

Copy this and fill in as you test:

```
TWO-TIER MEMORY TEST RESULTS
Date: ___________
Tester: ___________

Test 1: Basic Profile Extraction
- Profile extracted after 3 messages: ☐ PASS ☐ FAIL
- Name captured correctly: ☐ PASS ☐ FAIL
- Role captured correctly: ☐ PASS ☐ FAIL
- Interests captured: ☐ PASS ☐ FAIL

Test 2: Cross-Chat Persistence
- Profile found in new chat: ☐ PASS ☐ FAIL
- AI used name in response: ☐ PASS ☐ FAIL
- AI referenced profile info: ☐ PASS ☐ FAIL

Test 3: Chat Isolation
- Chat A context isolated: ☐ PASS ☐ FAIL
- Chat B context isolated: ☐ PASS ☐ FAIL
- Profile shared across both: ☐ PASS ☐ FAIL

Test 4: Profile Updates
- New interests added: ☐ PASS ☐ FAIL
- Old data retained: ☐ PASS ☐ FAIL
- No duplicates: ☐ PASS ☐ FAIL

Overall: ☐ ALL TESTS PASSED ☐ SOME FAILURES

Notes:
_________________________________
_________________________________
_________________________________
```

---

**Happy Testing!** 🧪🎉

Need help? Check:
- `TWO_TIER_MEMORY_IMPLEMENTATION.md` for details
- `TWO_TIER_MEMORY_STRATEGY.md` for architecture
- Server console logs for debugging
