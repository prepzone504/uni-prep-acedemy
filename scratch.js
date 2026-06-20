const rawText = `1)
FRONT: What is the molecular formula of glucose?
BACK: C6H12O6

2)
FRONT: Define oxidation in chemistry.
BACK: Oxidation is the loss of electrons.`;

const lines = rawText.split(/\r?\n/);
let expectedNumber = 1;
const cardStartRegex = /^\s*(?:(?:card|q|ques)\s*:?\s*(\d+)[\)\.\-]?|(\d+)\s*[\)\.\-])/i;

let error = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(cardStartRegex);
  if (match) {
    const numStr = match[1] || match[2];
    if (numStr) {
      const num = parseInt(numStr, 10);
      if (num !== expectedNumber) {
         error = 'Sequence broken at line ' + (i+1) + ': Expected ' + expectedNumber + ', found ' + num;
         break;
      }
      expectedNumber++;
    }
  }
}
console.log('Error:', error);
