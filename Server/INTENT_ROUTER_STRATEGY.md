# 🎯 Intent Router Strategy with Fast Classification Model

## Architecture: Use Gemini Flash Lite as Intent Router

Your configuration is perfect for this pattern:
```env
INTENT_CLASSIFIER=always           # Always use AI model for intent
INTENT_MODEL=gemini-2.0-flash-lite-001  # Fast, cheap router model
AUTO_GENERATE_INTENT=fallback      # Use heuristic as fallback only
```

## 🚀 How It Works

```
User Prompt → Fast Classifier (Flash Lite) → Route to Specialized Model
                    ↓
    ┌───────────────┼───────────────┬─────────────┐
    ↓               ↓                ↓             ↓
imageGenerate   imageEdit      visionQA       text
    ↓               ↓                ↓             ↓
Flash Image   Flash Image    Flash Image    Flash/Pro
```

## Benefits

1. **Speed**: Flash Lite responds in ~200-500ms
2. **Cost**: Flash Lite is ~50x cheaper than Flash
3. **Accuracy**: AI classification > heuristic pattern matching
4. **Scalability**: Easy to add new intents (code, music, 3D, etc.)
5. **Logging**: Track which intents users request most

## 📊 Performance Comparison

| Method | Speed | Cost | Accuracy |
|--------|-------|------|----------|
| Heuristic Only | ~1ms | Free | 60-70% |
| Flash Lite Router | ~300ms | $0.00001 | 85-90% |
| Heuristic + Fallback | ~1ms + 300ms | $0.00001 | 75-85% |

## 🎯 Recommended Configuration

```env
# PRIMARY: Use AI classifier for all requests
INTENT_CLASSIFIER=always
INTENT_MODEL=gemini-2.0-flash-lite-001

# FALLBACK: Use heuristic only if AI fails
AUTO_GENERATE_INTENT=off  # Don't run heuristic first

# THRESHOLDS: Lower = more sensitive
INTENT_CONFIDENCE_THRESHOLD=0.5  # Min confidence to accept AI classification
```

## 💡 Enhanced Classification Prompt

Your current prompt is good, but here's an improved version with better examples:

```typescript
const instruction = `You are a fast intent classifier. Analyze the user's prompt and return a JSON object.

VALID INTENTS:
- "imageGenerate": User wants to create/generate a NEW image
- "imageEdit": User wants to modify an EXISTING uploaded image  
- "visionQA": User asks questions about an uploaded image
- "text": Regular conversation, no image involved

EXAMPLES:
"draw a cat" → {"intent": "imageGenerate", "confidence": 0.95}
"show me a sunset" → {"intent": "imageGenerate", "confidence": 0.9}
"make it darker" → {"intent": "imageEdit", "confidence": 0.85} [requires image]
"what's in this image" → {"intent": "visionQA", "confidence": 0.9} [requires image]
"how are you" → {"intent": "text", "confidence": 0.99}

Return ONLY valid JSON: {"intent": "<intent>", "confidence": <0-1>}`;

classificationPrompt = `${instruction}\n\nUSER PROMPT:\n${p}`;
```

## 🔧 Code Improvements

### 1. Add Structured Output (JSON Mode)

```typescript
// In classifyIntentWithModel() function
const resp = await generateContent({
  model: intentModel,
  contents: [classificationPrompt],
  generationConfig: {
    temperature: 0.1,  // Low temp = more deterministic
    responseMimeType: "application/json",  // Force JSON output
  },
});
```

### 2. Add Caching for Similar Prompts

```typescript
// Add before classifyIntentWithModel()
const intentCache = new Map<string, {
  intent: string;
  confidence: number;
  timestamp: number;
}>();

const CACHE_TTL = 60 * 1000; // 1 minute

function getCachedIntent(prompt: string) {
  const normalized = prompt.toLowerCase().trim();
  const cached = intentCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`⚡ Cache hit for intent classification`);
    return { intent: cached.intent, confidence: cached.confidence };
  }
  return null;
}

function setCachedIntent(prompt: string, intent: string, confidence: number) {
  const normalized = prompt.toLowerCase().trim();
  intentCache.set(normalized, {
    intent,
    confidence,
    timestamp: Date.now(),
  });
  // Limit cache size
  if (intentCache.size > 1000) {
    const firstKey = intentCache.keys().next().value;
    intentCache.delete(firstKey);
  }
}
```

### 3. Add Intent Logging/Analytics

```typescript
// Track which intents users request
const intentAnalytics = new Map<string, number>();

function logIntentUsage(intent: string, confidence: number) {
  intentAnalytics.set(intent, (intentAnalytics.get(intent) || 0) + 1);
  console.log(`🎯 Intent: ${intent} (conf: ${confidence.toFixed(2)}) | Usage: ${intentAnalytics.get(intent)}`);
}

// Add endpoint to view analytics
app.get("/api/admin/intent-analytics", (req, res) => {
  const stats = Array.from(intentAnalytics.entries()).map(([intent, count]) => ({
    intent,
    count,
    percentage: ((count / Array.from(intentAnalytics.values()).reduce((a, b) => a + b, 0)) * 100).toFixed(1) + "%"
  }));
  res.json({ stats, total: Array.from(intentAnalytics.values()).reduce((a, b) => a + b, 0) });
});
```

### 4. Add Graceful Fallback Chain

```typescript
async function classifyIntentWithModel(
  p: string,
  hasImage: boolean
): Promise<{
  intent: "imageEdit" | "visionQA" | "imageGenerate" | "text";
  confidence: number;
  method: "ai" | "heuristic" | "default";
} | null> {
  // Try cache first
  const cached = getCachedIntent(p);
  if (cached) {
    return { ...cached, method: "ai" };
  }

  try {
    // Try AI classification
    const classificationPrompt = buildClassificationPrompt(p, hasImage);
    const resp = await generateContent({
      model: intentModel,
      contents: [classificationPrompt],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const parsed = parseClassificationResponse(resp);
    if (parsed && parsed.confidence >= 0.5) {
      setCachedIntent(p, parsed.intent, parsed.confidence);
      logIntentUsage(parsed.intent, parsed.confidence);
      return { ...parsed, method: "ai" };
    }
  } catch (e) {
    console.warn("⚠️ AI Intent classifier failed:", e.message);
  }

  // Fallback to heuristic
  if (!hasImage) {
    const heuristic = detectImageGenerateIntentHeuristic(p);
    if (heuristic.likely && heuristic.confidence >= 0.6) {
      console.log(`🔄 Using heuristic fallback: ${heuristic.signal}`);
      return {
        intent: "imageGenerate",
        confidence: heuristic.confidence,
        method: "heuristic",
      };
    }
  }

  // Final fallback: default to text
  console.log(`⚠️ No confident intent detected, defaulting to text`);
  return {
    intent: "text",
    confidence: 0.5,
    method: "default",
  };
}
```

## 📈 Monitoring & Optimization

### Add Performance Metrics

```typescript
let classificationTimes: number[] = [];

async function classifyIntentWithModel(p: string, hasImage: boolean) {
  const startTime = Date.now();
  
  try {
    // ... classification logic ...
    const result = await performClassification();
    
    const duration = Date.now() - startTime;
    classificationTimes.push(duration);
    if (classificationTimes.length > 100) classificationTimes.shift();
    
    const avgTime = classificationTimes.reduce((a, b) => a + b, 0) / classificationTimes.length;
    console.log(`⏱️ Intent classification took ${duration}ms (avg: ${avgTime.toFixed(0)}ms)`);
    
    return result;
  } catch (e) {
    // ... error handling ...
  }
}
```

### Add Intent Distribution Endpoint

```typescript
app.get("/api/admin/intent-stats", (req, res) => {
  const avgClassificationTime = 
    classificationTimes.reduce((a, b) => a + b, 0) / classificationTimes.length;
  
  res.json({
    intentDistribution: Object.fromEntries(intentAnalytics),
    performance: {
      avgClassificationTime: avgClassificationTime.toFixed(2) + "ms",
      cacheHitRate: (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1) + "%",
      totalClassifications: cacheHits + cacheMisses,
    },
  });
});
```

## 🎯 Final Configuration for Your Use Case

```env
# ═══════════════════════════════════════════
# INTENT ROUTING STRATEGY
# ═══════════════════════════════════════════

# Use AI classifier as primary router (recommended)
INTENT_CLASSIFIER=always
INTENT_MODEL=gemini-2.0-flash-lite-001

# Disable heuristic pre-check (let AI handle everything)
AUTO_GENERATE_INTENT=off

# Confidence thresholds
INTENT_CONFIDENCE_THRESHOLD=0.5  # Accept if AI is 50%+ confident
HEURISTIC_FALLBACK_THRESHOLD=0.6 # Use heuristic only if 60%+ confident

# Model assignments
TEXT_MODEL=gemini-2.5-flash
IMAGE_MODEL=gemini-2.5-flash-image
INTENT_MODEL=gemini-2.0-flash-lite-001

# Performance
INTENT_CACHE_TTL=60000  # 1 minute cache for similar prompts
```

## 🚀 Migration Steps

1. ✅ You already have `INTENT_CLASSIFIER=always` set
2. ✅ You already have `INTENT_MODEL=gemini-2.0-flash-lite-001` set
3. **Update** `AUTO_GENERATE_INTENT=off` (trust AI over heuristic)
4. **Add** new env vars for thresholds
5. **Implement** caching for performance
6. **Add** logging/analytics to track usage

Want me to implement any of these improvements? I can:
- Add JSON mode + structured output
- Add intent caching
- Add analytics tracking
- Improve the classification prompt
- Add performance monitoring
