// performanceOptimizations.ts - Quick performance wins
import { UserProfile } from './userProfileService';

/**
 * In-memory cache for user profiles
 * Reduces database/service lookups from 10-50ms to <1ms
 */
class ProfileCache {
  private cache = new Map<string, { profile: UserProfile | null; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get(userId: string): UserProfile | null | undefined {
    const cached = this.cache.get(userId);
    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(userId);
      return undefined;
    }

    return cached.profile;
  }

  set(userId: string, profile: UserProfile | null): void {
    this.cache.set(userId, {
      profile,
      timestamp: Date.now()
    });
  }

  clear(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }

  getStats(): { size: number; maxAge: number } {
    let maxAge = 0;
    const now = Date.now();

    this.cache.forEach(item => {
      const age = now - item.timestamp;
      if (age > maxAge) maxAge = age;
    });

    return {
      size: this.cache.size,
      maxAge: Math.round(maxAge / 1000) // seconds
    };
  }
}

export const profileCache = new ProfileCache();

/**
 * Recent context cache for faster memory retrieval
 * Caches last N conversation turns per chat
 */
interface CachedContext {
  turns: any[];
  timestamp: number;
  chatId: string;
}

class RecentContextCache {
  private cache = new Map<string, CachedContext>();
  private readonly TTL = 2 * 60 * 1000; // 2 minutes (shorter than profile cache)

  get(userId: string, chatId: string): any[] | undefined {
    const key = `${userId}:${chatId}`;
    const cached = this.cache.get(key);

    if (!cached) return undefined;

    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.turns;
  }

  set(userId: string, chatId: string, turns: any[]): void {
    const key = `${userId}:${chatId}`;
    this.cache.set(key, {
      turns,
      timestamp: Date.now(),
      chatId
    });
  }

  clear(userId?: string, chatId?: string): void {
    if (userId && chatId) {
      this.cache.delete(`${userId}:${chatId}`);
    } else if (userId) {
      // Clear all chats for this user
      Array.from(this.cache.keys())
        .filter(key => key.startsWith(`${userId}:`))
        .forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  getStats(): { size: number; totalTurns: number } {
    let totalTurns = 0;
    this.cache.forEach(item => {
      totalTurns += item.turns.length;
    });

    return {
      size: this.cache.size,
      totalTurns
    };
  }
}

export const recentContextCache = new RecentContextCache();

/**
 * Determine if a query needs memory search
 * Returns false for simple queries to save 200-500ms
 */
export function needsMemorySearch(prompt: string, messageCount: number = 0): boolean {
  const trimmed = prompt.toLowerCase().trim();

  // Simple greetings (first 3 messages only)
  if (messageCount < 3) {
    const greetings = /^(hi|hello|hey|sup|yo|morning|afternoon|evening|greetings)(!|\?)?$/;
    if (greetings.test(trimmed)) {
      return false; // Just use profile
    }
  }

  // Simple acknowledgments
  const acknowledgments = /^(thanks|thank you|thx|ty|ok|okay|sure|alright|cool|nice)(!|\?)?$/;
  if (acknowledgments.test(trimmed)) {
    return false;
  }

  // Simple yes/no
  const yesNo = /^(yes|no|yep|nope|yeah|nah|yup|sure)(!|\?)?$/;
  if (yesNo.test(trimmed)) {
    return false;
  }

  // Image generation requests (don't need conversation memory)
  const imageRequest = /(generate|create|make|draw|design|show me) (an? )?(image|picture|photo|illustration)/i;
  if (imageRequest.test(prompt)) {
    return false;
  }

  // General knowledge questions (no personal memory needed)
  const generalKnowledge = /^(what|who|where|when|why|how) (is|are|was|were|do|does|did|can|could|would|should)/i;
  if (generalKnowledge.test(prompt) && prompt.length < 50) {
    // Short general questions don't need memory
    return false;
  }

  // Everything else needs memory search
  return true;
}

/**
 * Determine optimal memory search strategy
 */
export function determineMemoryStrategy(
  prompt: string,
  messageCount: number
): 'none' | 'profile-only' | 'cache' | 'search' {
  // No memory needed
  if (!needsMemorySearch(prompt, messageCount)) {
    return 'none';
  }

  // First few messages - profile only
  if (messageCount < 3) {
    return 'profile-only';
  }

  // Ongoing conversation - try cache first
  if (messageCount >= 3 && messageCount < 15) {
    return 'cache';
  }

  // Long conversation or explicit memory reference - full search
  const explicitMemory = /(remember|recall|earlier|before|previous|last time|we discussed|you said|you told)/i;
  if (explicitMemory.test(prompt)) {
    return 'search';
  }

  // Default for long conversations
  return 'cache';
}

/**
 * Preload memory for next query (background operation)
 */
export async function preloadMemoryForNextQuery(
  userId: string,
  chatId: string,
  hybridMemoryService: any
): Promise<void> {
  try {
    console.log(`📦 Preloading memory for next query - User: ${userId}, Chat: ${chatId}`);

    // Get recent context and cache it
    const recentContext = hybridMemoryService.getRecentContext(userId, 5);
    recentContextCache.set(userId, chatId, recentContext);

    console.log(`✅ Preloaded ${recentContext.length} recent turns for ${userId}`);
  } catch (error) {
    console.warn(`⚠️ Failed to preload memory:`, error);
  }
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  return {
    profileCache: profileCache.getStats(),
    contextCache: recentContextCache.getStats(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Clear all caches (for testing/debugging)
 */
export function clearAllCaches(): void {
  profileCache.clear();
  recentContextCache.clear();
  console.log('🧹 All performance caches cleared');
}
