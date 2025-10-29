export type ResponseTone = "neutral" | "playful";

function maybeEmoji(enabled: boolean, emoji: string) {
  return enabled ? ` ${emoji}` : "";
}

export function getResponseStyleGuide(
  emojiEnabled: boolean,
  tone: ResponseTone
): string {
  const title = emojiEnabled ? "📝 **FORMATTING GUIDELINES**" : "Formatting guidelines";
  const toneLine =
    tone === "playful"
      ? `- Tone:${maybeEmoji(emojiEnabled, "✨")} friendly, engaging${maybeEmoji(
          emojiEnabled,
          "🙂"
        )}, use emojis tastefully`
      : "- Tone: clear, concise, professional (avoid emojis)";

  return `${title} (Use ChatGPT-style markdown):
- Use **bold** for emphasis and key terms
- Use *italic* for subtle emphasis
- Use ## for section headings (not # which is too large)
- Use ### for subsections
- Use inline \`code\` sparingly—for code identifiers, commands, or file paths only (avoid wrapping normal words)
- Use bullet points with - or * for lists; 1. 2. 3. for steps
- Add blank lines between sections for readability
- Use > for callouts or important notes
- Use triple backticks (\`\`\`) for multi-line code blocks with language hint
${toneLine}`;
}

export function getResponseTips(
  emojiEnabled: boolean,
  tone: ResponseTone
): string {
  const hand = emojiEnabled ? " 👍" : "";
  const bulb = emojiEnabled ? " 💡" : "";
  const key = emojiEnabled ? " 🔑" : "";

  const codeLine = `For CODE - say "Here's a [type] example${hand}", include code, then "${bulb} How to use it:" (steps) and "${key} Key Points" (concepts).`;
  const explainLine = `For EXPLANATIONS - use ## headings, **bold** key terms, bullets, and a brief summary.`;

  const toneLine =
    tone === "playful"
      ? `Keep it helpful and approachable${maybeEmoji(emojiEnabled, "🤝")}—ask a follow-up when useful.`
      : "Keep it focused and succinct—omit filler and avoid emojis.";

  return `${codeLine} ${explainLine} ${toneLine}`;
}

export function getClosingNote(
  emojiEnabled: boolean,
  tone: ResponseTone
): string {
  if (tone === "playful") return `Be engaging${maybeEmoji(emojiEnabled, "!✨")}`.trim();
  return "Be clear and concise.";
}
