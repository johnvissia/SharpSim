const Tesseract = require('tesseract.js');

Tesseract.recognize(
  'C:/Users/javis/.gemini/antigravity/brain/434777ac-e0ff-4cd3-814c-06c8d4e4fd8b/artifacts/error1.png',
  'eng',
  { logger: m => {} }
).then(({ data: { text } }) => {
  console.log("TEXT FROM ERROR 1:");
  console.log(text);
});

Tesseract.recognize(
  'C:/Users/javis/.gemini/antigravity/brain/434777ac-e0ff-4cd3-814c-06c8d4e4fd8b/artifacts/error2.png',
  'eng',
  { logger: m => {} }
).then(({ data: { text } }) => {
  console.log("TEXT FROM ERROR 2:");
  console.log(text);
});
