import NodeCache from "node-cache";

/**
 * ResponseCacheService - Caches AI responses to improve performance and reduce costs
 * 
 * Features:
 * - Normalized cache keys (lowercase, trimmed)
 * - TTL-based expiration (1 hour default, 24 hours for code templates)
 * - User-specific caching
 * - Cache warming with common questions
 * - Hit/miss metrics tracking
 */
class ResponseCacheService {
  private cache: NodeCache;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 3600, // Default: 1 hour
      checkperiod: 600, // Check for expired keys every 10 minutes
      maxKeys: 1000, // Max 1000 cached responses
      useClones: false, // Better performance, but be careful with mutations
    });

    console.log("💾 ResponseCacheService initialized");
  }

  /**
   * Generate cache key from prompt and userId
   * Normalizes the prompt to improve cache hit rate
   */
  private getCacheKey(prompt: string, userId: string): string {
    // Normalize: lowercase, trim, collapse whitespace
    const normalized = prompt
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[?!.,;:]+$/, ""); // Remove trailing punctuation

    return `${userId}:${normalized}`;
  }

  /**
   * Get cached response for a prompt
   */
  get(prompt: string, userId: string): string | undefined {
    const key = this.getCacheKey(prompt, userId);
    const cached = this.cache.get<string>(key);

    if (cached) {
      this.stats.hits++;
      console.log(`✅ Cache HIT (${this.stats.hits} total) - Instant response for: "${prompt.substring(0, 50)}..."`);
      return cached;
    }

    this.stats.misses++;
    return undefined;
  }

  /**
   * Cache a response
   */
  set(
    prompt: string,
    userId: string,
    response: string,
    ttl?: number
  ): void {
    const key = this.getCacheKey(prompt, userId);
    
    // Use custom TTL if provided, otherwise use default
    if (ttl) {
      this.cache.set(key, response, ttl);
    } else {
      this.cache.set(key, response);
    }

    this.stats.sets++;
    console.log(`💾 Cached response for: "${prompt.substring(0, 50)}..." (TTL: ${ttl || 3600}s)`);
  }

  /**
   * Warm cache with common questions on startup
   */
  async warmCache(): Promise<void> {
    console.log("🔥 Warming response cache with common questions...");

    const commonResponses: Array<{
      prompt: string;
      response: string;
      ttl: number;
    }> = [
      // React questions
      {
        prompt: "what is react",
        response: `## What is React? ⚛️

**React** is a powerful **JavaScript library** for building user interfaces, particularly single-page applications (SPAs). Created by Facebook, it's now maintained by Meta and a large community.

### 🔑 Key Concepts

- **Component-Based**: Build reusable UI components
- **Virtual DOM**: Fast rendering through efficient updates
- **JSX**: Write HTML-like syntax in JavaScript
- **Declarative**: Describe what the UI should look like

### 💡 Why Use React?

- **Reusability**: Components can be used across your app
- **Performance**: Virtual DOM minimizes expensive DOM operations
- **Ecosystem**: Massive library support (React Router, Redux, etc.)
- **Community**: Millions of developers, tons of resources

Want to see a simple React component example?`,
        ttl: 86400, // 24 hours for educational content
      },
      {
        prompt: "html hello world",
        response: `Here's a simple HTML example 👍

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
</head>
<body>
    <h1>Hello, World!</h1>
    <p>Welcome to my first webpage!</p>
</body>
</html>
\`\`\`

### 💡 How to use it:

1. Create a new file called \`index.html\`
2. Copy the code above
3. Open the file in any web browser
4. You'll see "Hello, World!" displayed

### 🔑 Key Points:

- **\`<!DOCTYPE html>\`** - Tells browser this is HTML5
- **\`<head>\`** - Contains meta information
- **\`<body>\`** - Contains visible content
- **\`<h1>\`** - Main heading
- **\`<p>\`** - Paragraph text

Want to add CSS styling to make it look better?`,
        ttl: 86400, // 24 hours for code templates
      },
      {
        prompt: "what is ndis",
        response: `## What is NDIS? 🦘

The **National Disability Insurance Scheme (NDIS)** is Australia's disability support system that provides funding to eligible people with permanent and significant disability.

### 🎯 Purpose

The NDIS helps people with disability access supports and services to:
- Live independently
- Participate in their community
- Find employment
- Improve their quality of life

### 🔑 Key Features

- **Individualized**: Plans tailored to each person's needs
- **Choice and Control**: Participants choose their providers
- **Reasonable and Necessary**: Supports must meet specific criteria
- **Lifetime Support**: Ongoing assistance as needs change

### 💡 Who is Eligible?

You must:
- Be under 65 when you apply
- Be an Australian citizen, permanent resident, or Protected Special Category Visa holder
- Live in Australia
- Have a permanent and significant disability that affects your daily life

Want to know more about how to apply or what supports are available?`,
        ttl: 86400, // 24 hours for informational content
      },
      // Add more common questions here
    ];

    // Cache with 'global' userId for common questions accessible to all
    for (const { prompt, response, ttl } of commonResponses) {
      this.set(prompt, "global", response, ttl);
    }

    console.log(`✅ Cache warmed with ${commonResponses.length} common questions`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 
      ? ((this.stats.hits / totalRequests) * 100).toFixed(1)
      : "0.0";

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.keys().length,
    };
  }

  /**
   * Clear entire cache (for testing/admin)
   */
  clear(): void {
    this.cache.flushAll();
    console.log("🗑️ Cache cleared");
  }

  /**
   * Delete specific cache entry
   */
  delete(prompt: string, userId: string): void {
    const key = this.getCacheKey(prompt, userId);
    this.cache.del(key);
  }
}

// Singleton instance
let instance: ResponseCacheService | null = null;

export function getResponseCacheService(): ResponseCacheService {
  if (!instance) {
    instance = new ResponseCacheService();
  }
  return instance;
}

export { ResponseCacheService };
