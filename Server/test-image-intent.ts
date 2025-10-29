// Quick test for image generation intent detection
// Run: npx ts-node Server/test-image-intent.ts

const testCases = [
  // Should be TEXT (false positives before fix)
  { prompt: "write me n article on india again", expected: false },
  { prompt: "write an article on india", expected: false },
  { prompt: "create a blog post about technology", expected: false },
  { prompt: "generate code for a website", expected: false },
  { prompt: "make a presentation about AI", expected: false },
  { prompt: "explain quantum physics", expected: false },
  
  // Should be IMAGE GENERATION (true positives)
  { prompt: "draw a cat", expected: true },
  { prompt: "draw me a picture of god from india", expected: true },
  { prompt: "picture of a sunset", expected: true },
  { prompt: "create a logo", expected: true },
  { prompt: "illustrate a landscape scene", expected: true },
  { prompt: "generate an image of mountains", expected: true },
  { prompt: "visualize a futuristic city", expected: true },
  { prompt: "/imagine a dragon", expected: true },
  { prompt: "make a realistic portrait", expected: true },
  { prompt: "create a landscape with blue sky", expected: true },
  
  // Edge cases
  { prompt: "another", expected: false }, // single word too ambiguous - needs context
  { prompt: "another article", expected: false }, // continuation with text keyword
];

// Inline heuristic (copy from index.ts for standalone test)
function detectImageGenerateIntentHeuristic(p: string): {
  likely: boolean;
  confidence: number;
  signal?: string;
} {
  if (!p) return { likely: false, confidence: 0 };
  
  const lower = p.toLowerCase();
  
  // Helper for fuzzy matching
  const fuzzyIncludes = (text: string, terms: string[], maxDist: number) => {
    for (const term of terms) {
      if (text.includes(term)) {
        return { matched: term, distance: 0 };
      }
    }
    return { matched: null, distance: maxDist + 1 };
  };
  
  // STRICT: Must explicitly mention visual/image creation keywords
  const visualVerbs = [
    "draw",
    "illustrate",
    "visualize",
    "render",
    "design",
    "sketch",
    "paint",
  ];
  
  const explicitImageNouns = [
    "image of",
    "picture of",
    "photo of",
    "art of",
    "logo",
    "icon",
    "avatar",
    "wallpaper",
    "poster",
    "banner",
    "thumbnail",
    "graphic",
    "illustration",
  ];
  
  // "generate"/"create"/"make" alone is ambiguous - require visual context
  const ambiguousVerbs = ["generate", "create", "make", "produce"];
  const hasAmbiguousVerb = ambiguousVerbs.some(v => new RegExp(`\\b${v}\\b`, "i").test(lower));
  
  // Check for explicit visual nouns
  const { matched: visualNoun } = fuzzyIncludes(lower, explicitImageNouns, 1);
  if (visualNoun) {
    return {
      likely: true,
      confidence: 0.9,
      signal: visualNoun,
    };
  }
  
  // Check for visual verbs (draw, illustrate, etc.)
  const { matched: visualVerb } = fuzzyIncludes(lower, visualVerbs, 1);
  if (visualVerb) {
    return {
      likely: true,
      confidence: 0.85,
      signal: visualVerb,
    };
  }
  
  // /imagine command
  if (lower.includes("/imagine")) {
    return { likely: true, confidence: 0.95, signal: "/imagine" };
  }
  
  // If ambiguous verb + visual descriptors (specific objects, colors, compositions)
  if (hasAmbiguousVerb) {
    const visualDescriptors = [
      " landscape",
      " sunset",
      " portrait",
      " scene",
      " background",
      " with colors",
      " with blue",
      " with red",
      " with green",
      " in style of",
      " realistic",
      " anime",
      " cartoon",
      " 3d render",
    ];
    const hasVisualDescriptor = visualDescriptors.some(d => lower.includes(d));
    
    if (hasVisualDescriptor) {
      return {
        likely: true,
        confidence: 0.75,
        signal: "ambiguous verb + visual descriptor",
      };
    }
  }
  
  // "another/more/again" should only trigger if the prompt is very short and context suggests images
  // Otherwise "write another article" would incorrectly trigger
  const continuationWords = ["another", "more", "one more"];
  const hasContinuation = continuationWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower));
  if (hasContinuation && p.length < 30) {
    // Very short continuation like "another" or "one more" - likely image if recent context
    return {
      likely: true,
      confidence: 0.65,
      signal: "short continuation",
    };
  }
  
  return { likely: false, confidence: 0.2 };
}

console.log("🧪 Testing Image Generation Intent Detection\n");

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = detectImageGenerateIntentHeuristic(test.prompt);
  const detected = result.likely && result.confidence >= 0.7;
  const correct = detected === test.expected;
  
  const status = correct ? "✅ PASS" : "❌ FAIL";
  const expectedStr = test.expected ? "IMAGE" : "TEXT";
  const detectedStr = detected ? "IMAGE" : "TEXT";
  
  console.log(`${status} | "${test.prompt}"`);
  console.log(`     Expected: ${expectedStr}, Got: ${detectedStr} (conf: ${result.confidence.toFixed(2)}, signal: ${result.signal || "none"})\n`);
  
  if (correct) passed++;
  else failed++;
}

console.log(`\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed`);
console.log(`   Accuracy: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed > 0) {
  process.exit(1);
}
