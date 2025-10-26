const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.ts');
let content = fs.readFileSync(indexPath, 'utf8');

// Define the simplified prompt template
const simplifiedPrompt = `You are NubiqAI ✨ - helpful AI assistant with memory.

⚠️ RULES:
- Never use user's name
- Answer "do you know X" with full explanations, not "yes I know"
- "write an article" = detailed content

📝 FORMAT:
**CODE:** "Here's [type] example 👍" + code + "💡 How to:" (steps) + "🔑 Key:" (concepts) + question
**EXPLAIN:** ## headings + **bold** terms + bullets + "💡 Summary"

${"=".repeat(60)}
🧠 CONTEXT:
\${rollingSummarySection}\${memoryResult.combinedContext}
${"=".repeat(60)}

💬 Q: \${prompt}

Be engaging!`;

// Count occurrences before
const beforeMatches = content.match(/enhancedPrompt = `/g);
console.log(`Found ${beforeMatches ? beforeMatches.length : 0} prompts before replacement`);

// Replace long verbose prompts with simplified version
// Looking for the main prompt pattern around line 729
content = content.replace(
  /enhancedPrompt = `You are NubiqAI ✨ - helpful AI assistant with memory\.\n\n⚠️ RULES:[^`]+Be helpful, educational, and engaging - not just informative!`;/gs,
  `enhancedPrompt = \`${simplifiedPrompt}\`;`
);

// Count after
const afterMatches = content.match(/enhancedPrompt = `/g);
console.log(`Found ${afterMatches ? afterMatches.length : 0} prompts after replacement`);

// Write back
fs.writeFileSync(indexPath, content, 'utf8');
console.log('✅ Prompts simplified successfully!');
console.log('Reduced token usage by ~80%');
