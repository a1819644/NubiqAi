// Test keyword matching logic
const imageKeywords = [
  'generate image', 'generate an image', 'generate a picture',
  'create image', 'create an image', 'create a picture',
  'draw image', 'draw an image', 'draw a picture', 'draw me',
  'make image', 'make an image', 'make a picture',
  'gambar', 'buatkan gambar'
];

const testInputs = [
  'image of catt',
  'image of cat',
  'generate image of cat',
  'create an image',
  'show me a picture',
  'tell me about cats'
];

testInputs.forEach(text => {
  const textLower = text.toLowerCase();
  const match = imageKeywords.find(keyword => textLower.includes(keyword));
  console.log(`"${text}" → ${match ? `MATCHED: "${match}"` : 'NO MATCH'}`);
});
