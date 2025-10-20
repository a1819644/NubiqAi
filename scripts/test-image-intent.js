// Quick test for image-intent detection logic
function detectsImageIntent(text) {
  const imageKeywords = [
    'generate image', 'generate an image', 'generate a picture',
    'create image', 'create an image', 'create a picture',
    'draw image', 'draw an image', 'draw a picture', 'draw me',
    'make image', 'make an image', 'make a picture',
    'gambar', 'buatkan gambar'
  ];
  const textLower = text.toLowerCase();
  const containsImageKeyword = imageKeywords.some(keyword => textLower.includes(keyword));
  const naturalImageRequest = (
    /^(?:\s*(?:an?|the)\s+)?(?:image|picture|photo|drawing|illustration)\s+of\b/.test(textLower) ||
    /^\s*show\s+me\s+(?:an?\s+)?(?:image|picture|photo)\s+of\b/.test(textLower)
  );
  const verbImageOfRequest = (
    /^\s*(?:generate|create|draw|make)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|drawing|illustration)\s+of\b/.test(textLower)
  );
  return containsImageKeyword || naturalImageRequest || verbImageOfRequest;
}

const tests = [
  'an image of another dog',
  'a picture of a mountain at dusk',
  'show me an image of a dragon',
  'generate an image of a cat',
  'generate me an image of dog',
  'generate me image of dog',
  'create me an image of a lion',
  'create a picture of New York skyline',
  'draw me a futuristic car',
  'make an image of a robot',
  'image of a cat', // should trigger now
  'tell me about images', // should not trigger
  'what is the image of the company', // should not trigger
  'photo of happiness as a concept', // ambiguous; we keep it triggering
  'show me information about cats', // should not trigger
];

for (const t of tests) {
  console.log(`${t.padEnd(45)} => ${detectsImageIntent(t) ? 'TRIGGER' : 'NO TRIGGER'}`);
}
