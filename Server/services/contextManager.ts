// services/contextManager.ts
// Builds a Copilot-style rolling summary and key facts for better context
import { GoogleGenAI } from '@google/genai';
import { getConversationService } from './conversationService';
import { userProfileService } from './userProfileService';

export interface RollingSummary {
  summary: string;
  keyFacts: string[];
}

function estimateTokens(text: string): number {
  // Rough heuristic: ~4 chars per token
  return Math.ceil((text || '').length / 4);
}

function sanitize(text: string): string {
  return (text || '').replace(/[#*`>]/g, '').trim();
}

export async function buildRollingSummary(userId: string, chatId?: string): Promise<RollingSummary | null> {
  const convo = getConversationService();
  // Get recent turns, prefer same chat when available
  const recent = convo.getRecentConversations(userId, 20)
    .filter(t => !chatId || t.chatId === chatId)
    .slice(0, 12);

  if (recent.length === 0) return null;

  const conversationText = recent
    .map(t => `User: ${t.userPrompt}\nAI: ${t.aiResponse}`)
    .join('\n\n');

  // Include quick profile facts if exist
  const profile = userProfileService.getUserProfile(userId);
  const profileContext = profile ? userProfileService.generateProfileContext(userId) : '';

  const prompt = `You are a summarizer that produces compact, actionable chat context.
Return JSON with fields {"summary": string, "keyFacts": string[]} only. No prose.
- summary: 4-8 sentences maximum, include goals, decisions, and any ongoing tasks
- keyFacts: 3-8 short bullets with durable facts, constraints, preferences, or identifiers

PROFILE (optional):\n${profileContext}\n\nCONVERSATION (most recent first):\n${conversationText}`;

  // Use TEXT_MODEL if set, else a sensible default
  const model = process.env.TEXT_MODEL || 'gemini-2.5-pro';

  // Try AI summarization first (best quality)
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const resp: any = await (ai as any).models.generateContent({ model, contents: [prompt] });
    const txt: string = resp?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
    const jsonText = (txt.match(/\{[\s\S]*\}/)?.[0]) || txt;
    const parsed = JSON.parse(jsonText);
    const summary = sanitize(String(parsed.summary || ''));
    const keyFacts = Array.isArray(parsed.keyFacts) ? parsed.keyFacts.map((s: any) => sanitize(String(s))).filter(Boolean) : [];

    // Guardrail: trim if too large
    const budget = Number(process.env.CONTEXT_SUMMARY_BUDGET_TOKENS || 800);
    let finalSummary = summary;
    if (estimateTokens(finalSummary) > budget) {
      finalSummary = finalSummary.slice(0, budget * 4);
    }

    return { summary: finalSummary, keyFacts: keyFacts.slice(0, 8) };
  } catch (err) {
    // Fallback: heuristic compression of last turns
    const facts: string[] = [];
    for (const t of recent.slice(0, 6)) {
      const u = t.userPrompt.replace(/\s+/g, ' ').slice(0, 140);
      const a = (t.aiResponse || '').replace(/\s+/g, ' ').slice(0, 140);
      facts.push(`User asked: ${u}`);
      if (a) facts.push(`AI: ${a}`);
      if (facts.length >= 8) break;
    }
    const summary = `Recent conversation includes ${recent.length} exchanges. Focus topics: ongoing assistance and follow-ups. Key snippets captured below.`;
    return { summary, keyFacts: facts };
  }
}
