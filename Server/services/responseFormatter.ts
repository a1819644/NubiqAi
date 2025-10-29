import type { ResponseTone } from "./responseStyle";

export interface FormatOptions {
  emojiEnabled: boolean;
  tone: ResponseTone;
}

const headingRe = /^#{1,6}\s/m;
const listRe = /^\s*(?:[-*]|\d+\.)\s/m;
const fenceRe = /```/;

export function formatResponse(text: string, opts: FormatOptions): string {
  if (!text || typeof text !== "string") return text;
  let out = text.trim();

  // Normalize excessive blank lines (3+ → 2)
  out = out.replace(/\n{3,}/g, "\n\n");

  // Normalize common markdown glitches produced by models
  out = normalizeListsAndPunctuation(out);

  const hasHeading = headingRe.test(out);
  const hasList = listRe.test(out);
  const hasFence = fenceRe.test(out);

  // If the content has no structure at all, provide a minimal heading
  if (!hasHeading && !hasList && !hasFence) {
    out = `## Answer\n\n${out}`;
  }

  // Ensure blank lines around fenced code blocks for readability
  out = out
    // Blank line before code fence
    .replace(/([^\n])\n```/g, "$1\n\n```")
    // Blank line after code fence
    .replace(/```\n([^`])/g, "```\n\n$1");

  // Ensure proper spacing around headings (GPT/Gemini style)
  out = out
    // Add blank line before headings (unless at start or after another heading)
    .replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2")
    // Ensure blank line after headings
    .replace(/(#{1,6}\s[^\n]+)\n([^#\n])/g, "$1\n\n$2");

  // Fix inline code blocks that span multiple lines (backticks should be on same line)
  out = out.replace(/`([^`\n]+)\n([^`\n]+)`/g, "`$1 $2`");

  // Normalize "Table of contents" to proper heading format
  out = out.replace(/^Table of contents$/gim, "## Table of Contents");

  // Table of Contents injection for long, structured replies
  const toc = buildTableOfContents(out);
  if (toc) {
    // Insert TOC after the first heading if present, else at the top
    const firstHeadingIdx = out.search(/^#{1,6}\s.*$/m);
    if (firstHeadingIdx >= 0) {
      // Find end of that line
      const lineEnd = out.indexOf("\n", firstHeadingIdx);
      if (lineEnd >= 0) {
        out = out.slice(0, lineEnd + 1) + "\n" + toc + "\n" + out.slice(lineEnd + 1);
      } else {
        out = out + "\n\n" + toc;
      }
    } else {
      out = toc + "\n\n" + out;
    }
  }

  // Final cleanup: ensure consistent spacing
  out = out
    // Remove excessive whitespace at start/end
    .trim()
    // Normalize multiple blank lines again (in case new ones were introduced)
    .replace(/\n{3,}/g, "\n\n");

  return out;
}

function normalizeListsAndPunctuation(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const trimmed = line.trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // If line starts with many spaces before a list marker, trim to avoid code block indentation
    line = line.replace(/^[\t ]{2,}(-|\*|\d+\.)\s+/, "$1 ");

    // CRITICAL: Detect inline code bullets (like `• `GenerativeModel(...)`` or `- `code``) 
    // and format as bold paragraphs instead of list items
    if (/^\s*[•◦●\-*]\s+`[^`]+`/.test(line)) {
      const codeMatch = line.match(/^\s*[•◦●\-*]\s+`([^`]+)`(:\s*(.*))?/);
      if (codeMatch) {
        const codeTerm = codeMatch[1]; // e.g., GenerativeModel(...)
        const immediateDesc = codeMatch[3]; // description after colon on same line
        
        // Check if next line is a colon + description
        const nextLine = (lines[i + 1] || "").trim();
        const hasColonDesc = /^:\s+/.test(nextLine);
        
        if (hasColonDesc) {
          const desc = nextLine.replace(/^:\s+/, "").trim();
          out.push(`**${codeTerm}**: ${desc}`);
          i += 1; // consume next line
          continue;
        } else if (immediateDesc) {
          out.push(`**${codeTerm}**: ${immediateDesc}`);
          continue;
        } else {
          // Standalone code term
          out.push(`**${codeTerm}**`);
          continue;
        }
      }
    }

    // DON'T convert angle brackets to bullets (vector notation like <a₁, a₂, a₃>)
    // Skip conversion for lines that look like vector/mathematical notation
    const looksLikeVectorNotation = /^[•◦●\-*]\s*[a-z]\s*=\s*$/i.test(line) || /<[^>]+>/.test(lines[i + 1] || "");
    
    // Convert remaining non-markdown bullets to markdown (- ) for regular list items
    if (!looksLikeVectorNotation) {
      line = line.replace(/^[\t ]*[•◦●]\s+/u, "- ");
      // Fix cases like `•` alone
      line = line.replace(/^[\t ]*`?•`?[\t ]*$/u, "- ");
    }

    // Heuristic: collapse bullets that were split across lines like:
    // -\n<term>\n: explanation => - `term`: explanation
    // BUT: If the term is inline code (backticked), format as bold paragraph instead of bullet
    if (/^\s*-\s*$/.test(line)) {
      const term = (lines[i + 1] || "").trim();
      const next = (lines[i + 2] || "");
      const hasColonDesc = /^\s*:\s+/.test(next);
      // Avoid headings, other lists, or fences as term
      const looksLikeTerm = term && !/^\s*#/.test(term) && !/^\s*(-|\*|\d+\.)\s+/.test(term) && !/^\s*```/.test(term);
      
      if (looksLikeTerm && hasColonDesc) {
        const desc = next.replace(/^\s*:\s+/, "").trim();
        // If term is already wrapped in backticks (inline code), format as bold paragraph
        if (/^`[^`]+`$/.test(term)) {
          out.push(`**${term}**: ${desc}`);
        } else {
          // Regular term - make it a bullet with backticks
          const codeWrapped = /`.*`/.test(term) ? term : `\`${term}\``;
          out.push(`- ${codeWrapped}: ${desc}`);
        }
        i += 2; // consume term + desc
        continue;
      } else if (looksLikeTerm) {
        // If standalone term is inline code, format as bold paragraph
        if (/^`[^`]+`$/.test(term)) {
          out.push(`**${term}**`);
        } else {
          const codeWrapped = /`.*`/.test(term) ? term : `\`${term}\``;
          out.push(`- ${codeWrapped}`);
        }
        i += 1; // consume term only
        continue;
      }
      // If not a recognizable pattern, fall through and keep "-"
    }

    // Merge stray colon-prefixed lines with previous line
    if (/^\s*:\s+/.test(line) && out.length > 0) {
      const prev = out.pop() as string;
      const merged = prev.replace(/[\s]*$/, "") + " " + line.replace(/^\s*:\s+/, ": ");
      out.push(merged);
      continue;
    }

    // Merge orphan "The" with next short line to fix broken phrases like
    // "The\nlang=\"en\"\nattribute ..." => "The lang=\"en\"\nattribute ..."
    if (/^\s*The\s*$/.test(line)) {
      const nxt = (lines[i + 1] || "").trim();
      if (nxt && nxt.length < 60 && !/^\s*[-*#`]/.test(nxt)) {
        out.push(`The ${nxt}`);
        i += 1;
        continue;
      }
    }

    // Merge list numbers that are split across lines like:
    // "1." on its own line followed by the sentence
    if (/^\s*(\d+)\.[\s]*$/.test(line)) {
      const nxt = (lines[i + 1] || "").trim();
      if (nxt && !/^\s*[-*#`]/.test(nxt)) {
        const num = line.match(/\d+/)![0];
        out.push(`${num}. ${nxt}`);
        i += 1;
        continue;
      }
    }

    // Merge file extension-only lines (e.g., ".c") with the previous line
    if (/^\s*\.[a-zA-Z0-9]{1,8}\s*$/.test(line) && out.length > 0) {
      const prev = out.pop() as string;
      const needsSpace = !/\s$/.test(prev);
      out.push(prev.replace(/[\s]*$/, "") + (needsSpace ? " " : "") + line.trim());
      continue;
    }

    // Merge single filename lines after ", for example," or similar
    if (/^\s*[A-Za-z0-9_\-]+\.[A-Za-z0-9]{1,10}\s*$/.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      // Merge if previous ends with "saved", "for example,", etc.
      if (/(?:saved|for example,|e\.g\.,|:|,)\s*$/.test(prev)) {
        const prevLine = out.pop() as string;
        out.push(`${prevLine} ${line.trim()}`);
        // If next line is just a period or blank, consume it too
        const nextIsPeriodOrBlank = /^\s*\.?\s*$/.test(lines[i + 1] || "");
        if (nextIsPeriodOrBlank) i += 1;
        continue;
      }
    }

    // Merge lines beginning with "extension" after a file extension-only merge
    if (/^\s*extension\b/i.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      if (/\.[a-z0-9]{1,8}\s*$/i.test(prev)) {
        out[out.length - 1] = `${prev} ${line.trim()}`;
        continue;
      }
    }

    // Merge orphan period lines (just ".") with previous
    if (/^\s*\.[\s]*$/.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      // Only merge if previous line doesn't already end with punctuation
      if (!/[.!?;]$/.test(prev.trim())) {
        out[out.length - 1] = `${prev.trim()}.`;
      }
      continue;
    }

    // Merge code-tag-only lines with next line's colon description
    // Pattern: line is just <tag> (like <html>), next is ": description"
    if (/^\s*<[^>]+>\s*$/.test(line)) {
      const nxt = (lines[i + 1] || "");
      if (/^\s*:\s+/.test(nxt)) {
        const tag = line.trim();
        const desc = nxt.replace(/^\s*:\s+/, "").trim();
        out.push(`- \`${tag}\`: ${desc}`);
        i += 1; // consume description line
        continue;
      }
    }

    // Merge split patterns like: code tag on one line, ": description" on next
    // when they appear after a bullet point
    if (/^\s*<[^>]+>\s*$/.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      const nxt = (lines[i + 1] || "");
      // If previous is a bullet marker and next is colon description
      if (/^\s*[-*•]\s*$/.test(prev) && /^\s*:\s+/.test(nxt)) {
        const tag = line.trim();
        const desc = nxt.replace(/^\s*:\s+/, "").trim();
        out[out.length - 1] = `- \`${tag}\`: ${desc}`;
        i += 1; // consume description
        continue;
      }
    }

    // Merge "tags (" followed by content on next lines, then closing paren text
    if (/^\s*tags\s*\(\s*$/.test(line)) {
      const nxt = (lines[i + 1] || "").trim();
      const nxt2 = (lines[i + 2] || "").trim();
      if (nxt && !/^\s*[-*#`]/.test(nxt)) {
        // Check if there's continuation
        if (nxt2 && /^in this case\)|^\)/.test(nxt2)) {
          out.push(`tags (${nxt} ${nxt2}`);
          i += 2;
        } else {
          out.push(`tags (${nxt}`);
          i += 1;
        }
        continue;
      }
    }

    // Merge "in this case)" or text ending with ")" after tags content
    if (/^in this case\)/.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      if (/tags\s*\(/.test(prev)) {
        out[out.length - 1] = `${prev} ${line.trim()}`;
        continue;
      }
    }

    // Merge inline code tags that appear alone on a line (mid-sentence split)
    // E.g., "text inside the" -> "<title>" -> "tags (" should become "text inside the <title> tags ("
    if (/^\s*<[^>]+>\s*$/.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      const nxt = (lines[i + 1] || "").trim();
      // If previous line ends with a preposition/article and next continues the sentence
      if (/\b(the|a|an|in|of|for|inside)\s*$/i.test(prev) && nxt && !/^\s*[-*#:]/.test(nxt)) {
        const needsSpace = !/\s$/.test(prev);
        out[out.length - 1] = `${prev}${needsSpace ? ' ' : ''}${line.trim()}`;
        continue;
      }
    }

    // Merge continuation lines that start with lowercase words (likely mid-sentence)
    // But skip if they look like list markers or headings
    if (/^\s*[a-z]/.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      // If previous ends with a tag or incomplete phrase and doesn't end with punctuation
      if ((/<[^>]+>\s*$/.test(prev) || /\b(the|a|an|in|of|for|inside|saved)\s*$/i.test(prev)) && !/[.!?;]\s*$/.test(prev)) {
        const needsSpace = !/\s$/.test(prev);
        out[out.length - 1] = `${prev}${needsSpace ? ' ' : ''}${line.trim()}`;
        continue;
      }
    }

    // Merge standalone "file" or similar continuation words after filenames
    if (/^\s*(file|document|page)\b/i.test(line) && out.length > 0) {
      const prev = out[out.length - 1];
      if (/\.(html?|txt|pdf|docx?|csv)\s*$/i.test(prev)) {
        out[out.length - 1] = `${prev} ${line.trim()}`;
        continue;
      }
    }

    out.push(line);
  }

  return out.join("\n");
}

function buildTableOfContents(md: string): string | null {
  // Skip generating TOC for short messages
  if (md.length < 800) return null;

  const lines = md.split(/\r?\n/);
  const headings: { level: number; text: string }[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith("```") || line.trim().startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = /^(#{2,3})\s+(.*)$/.exec(line); // capture ## and ### only
    if (m) {
      const level = m[1].length; // 2 or 3
      let text = m[2].trim();
      // Strip trailing hashes and whitespace
      text = text.replace(/\s*#+\s*$/, "").trim();
      // Strip backticks around inline code in headings
      text = text.replace(/^`(.+?)`$/, "$1");
      headings.push({ level, text });
    }
  }

  if (headings.length < 3) return null;

  const items = headings
    .slice(0, 20)
    .map(h => {
      const slug = slugify(h.text);
      const indent = h.level === 3 ? "  " : "";
      return `${indent}- [${h.text}](#${slug})`;
    })
    .join("\n");

  return `## Table of contents\n\n${items}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[`~!@#$%^&*()+=\[\]{}|;:'",.<>/?\\]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
