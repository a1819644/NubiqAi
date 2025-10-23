/**
 * User Profile Service
 *
 * This service manages persistent user profiles that exist across all chat sessions.
 * It extracts and stores user information like name, role, interests, preferences, etc.
 *
 * Two-Tier Memory Strategy:
 * - Tier 1: User Profile (cross-chat, permanent) ← THIS SERVICE
 * - Tier 2: Chat Context (chat-specific, temporary) ← hybridMemoryService
 */

import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// INTERFACES
// ============================================================================

export interface UserProfile {
  userId: string;
  name?: string;
  role?: string;
  interests?: string[];
  preferences?: string[];
  background?: string;
  conversationStyle?: string; // e.g., "prefers technical details", "casual tone"
  extractedAt: Date;
  lastUpdated: Date;
  conversationCount: number; // Track how many chats contributed to this profile
}

export interface ProfileExtractionResult {
  extracted: boolean;
  profile?: Partial<UserProfile>;
  error?: string;
}

// ============================================================================
// IN-MEMORY STORAGE (Replace with DB in production)
// ============================================================================

const userProfiles = new Map<string, UserProfile>();

// ============================================================================
// GOOGLE GEMINI CLIENT
// ============================================================================

let genAI: GoogleGenAI | undefined;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// ============================================================================
// PROFILE EXTRACTION LOGIC
// ============================================================================

/**
 * Extract user profile information from a conversation using AI
 */
async function extractProfileFromConversation(
  userId: string,
  conversationText: string
): Promise<ProfileExtractionResult> {
  try {
    if (!genAI) {
      console.log(
        "[USER PROFILE] Gemini API not configured, skipping profile extraction"
      );
      return { extracted: false, error: "Gemini API not configured" };
    }

    console.log(`[USER PROFILE] Extracting profile info for user: ${userId}`);
    console.log(
      `[USER PROFILE] Conversation text (${conversationText.length} chars):`,
      conversationText.substring(0, 200) + "..."
    );

    const prompt = `
You are a profile extraction assistant. Analyze the conversation below and extract ANY personal information about the USER.

CRITICAL INSTRUCTIONS:
1. Look for sentences like "my name is X", "I am X", "I'm X", "call me X"
2. Look for "I work at/for X", "I'm a X", "my role is X"
3. Extract interests from "I like X", "I'm interested in X", "I enjoy X"
4. Extract preferences from how they communicate
5. If you find ANY information, include it in the JSON

CONVERSATION:
${conversationText}

EXAMPLES OF WHAT TO EXTRACT:
- "my name is anoop kumar" → name: "Anoop Kumar"
- "i work for nubevest" → role: null, background: "Works at Nubevest"
- "I'm a software engineer" → role: "Software Engineer"

Return ONLY a JSON object with this exact structure:
{
  "name": "extracted name or null",
  "role": "string or null",
  "interests": ["array", "of", "strings"] or null,
  "preferences": ["array", "of", "strings"] or null,
  "background": "string or null",
  "conversationStyle": "string or null"
}

IMPORTANT: Return ONLY the JSON object, no markdown, no explanations.
`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-pro", // Use better model for more accurate extraction
      contents: [prompt],
    });

    const resultText =
      response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!resultText) {
      console.log("[USER PROFILE] No response from AI");
      return { extracted: false };
    }

    console.log(
      `[USER PROFILE] AI extraction response:`,
      resultText.substring(0, 200)
    );
    `   `;
    // Parse the JSON response
    const cleanedResponse = resultText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const extracted = JSON.parse(cleanedResponse);

    // Filter out null values
    const profile: Partial<UserProfile> = {};
    if (extracted.name) profile.name = extracted.name;
    if (extracted.role) profile.role = extracted.role;
    if (extracted.interests && extracted.interests.length > 0)
      profile.interests = extracted.interests;
    if (extracted.preferences && extracted.preferences.length > 0)
      profile.preferences = extracted.preferences;
    if (extracted.background) profile.background = extracted.background;
    if (extracted.conversationStyle)
      profile.conversationStyle = extracted.conversationStyle;

    const hasAnyInfo = Object.keys(profile).length > 0;

    if (hasAnyInfo) {
      console.log(`[USER PROFILE] ✓ Extracted profile:`, profile);
    } else {
      console.log(`[USER PROFILE] No profile info found in conversation`);
    }

    return {
      extracted: hasAnyInfo,
      profile: hasAnyInfo ? profile : undefined,
    };
  } catch (error) {
    console.error("[USER PROFILE] Error extracting profile:", error);
    return {
      extracted: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get user profile by userId
 */
export function getUserProfile(userId: string): UserProfile | null {
  return userProfiles.get(userId) || null;
}

/**
 * Create or update user profile
 */
export function upsertUserProfile(
  userId: string,
  profileData: Partial<UserProfile>
): UserProfile {
  const existing = userProfiles.get(userId);

  if (existing) {
    // Merge with existing profile
    const updated: UserProfile = {
      ...existing,
      ...profileData,
      lastUpdated: new Date(),
      conversationCount: existing.conversationCount + 1,
      // Merge arrays safely, handling null/undefined from profileData
      interests:
        profileData.interests && Array.isArray(profileData.interests)
          ? [
              ...new Set([
                ...(existing.interests || []),
                ...profileData.interests,
              ]),
            ]
          : existing.interests || [],
      preferences:
        profileData.preferences && Array.isArray(profileData.preferences)
          ? [
              ...new Set([
                ...(existing.preferences || []),
                ...profileData.preferences,
              ]),
            ]
          : existing.preferences || [],
    };

    userProfiles.set(userId, updated);
    console.log(`[USER PROFILE] ✓ Updated profile for ${userId}:`, updated);
    return updated;
  } else {
    // Create new profile
    const newProfile: UserProfile = {
      userId,
      extractedAt: new Date(),
      lastUpdated: new Date(),
      conversationCount: 1,
      ...profileData,
    };

    userProfiles.set(userId, newProfile);
    console.log(
      `[USER PROFILE] ✓ Created new profile for ${userId}:`,
      newProfile
    );
    return newProfile;
  }
}

/**
 * Delete user profile
 */
export function deleteUserProfile(userId: string): boolean {
  const deleted = userProfiles.delete(userId);
  if (deleted) {
    console.log(`[USER PROFILE] ✓ Deleted profile for ${userId}`);
  }
  return deleted;
}

/**
 * Get all profiles (for debugging/admin)
 */
export function getAllProfiles(): UserProfile[] {
  return Array.from(userProfiles.values());
}

// ============================================================================
// MAIN PROFILE EXTRACTION
// ============================================================================

/**
 * Extract and update user profile from a conversation
 * This should be called in the background after storing a conversation
 */
export async function updateProfileFromConversation(
  userId: string,
  conversationMessages: Array<{ role: string; content: string }>
): Promise<void> {
  try {
    // Convert messages to text
    const conversationText = conversationMessages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");

    // Extract profile info
    const result = await extractProfileFromConversation(
      userId,
      conversationText
    );

    if (result.extracted && result.profile) {
      // Update the profile
      upsertUserProfile(userId, result.profile);
    }
  } catch (error) {
    console.error(
      "[USER PROFILE] Error updating profile from conversation:",
      error
    );
  }
}

// ============================================================================
// PROFILE CONTEXT GENERATION
// ============================================================================

/**
 * Generate a text summary of user profile to inject into AI prompts
 */
export function generateProfileContext(userId: string): string {
  const profile = getUserProfile(userId);

  if (!profile) {
    return "";
  }

  const parts: string[] = [];

  if (profile.name) {
    parts.push(`The user's name is ${profile.name}.`);
  }

  if (profile.role) {
    parts.push(`They work as a ${profile.role}.`);
  }

  if (profile.interests && profile.interests.length > 0) {
    parts.push(`Their interests include: ${profile.interests.join(", ")}.`);
  }

  if (profile.preferences && profile.preferences.length > 0) {
    parts.push(`Preferences: ${profile.preferences.join(", ")}.`);
  }

  if (profile.background) {
    parts.push(`Background: ${profile.background}`);
  }

  if (profile.conversationStyle) {
    parts.push(`Communication style: ${profile.conversationStyle}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `\n--- USER PROFILE ---\n${parts.join(" ")}\n--- END PROFILE ---\n`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const userProfileService = {
  getUserProfile,
  upsertUserProfile,
  deleteUserProfile,
  getAllProfiles,
  updateProfileFromConversation,
  generateProfileContext,
  extractProfileFromConversation, // For testing
};

export default userProfileService;
