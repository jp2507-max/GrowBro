const fs = require('fs');
const path = require('path');

// Read both files
const enPath = path.join(__dirname, '../src/translations/en.json');
const dePath = path.join(__dirname, '../src/translations/de.json');

// Read and parse en.json
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Read de.json, strip BOM, and parse
let deContent = fs.readFileSync(dePath, 'utf8');
deContent = deContent.replace(/^\uFEFF/, ''); // Remove BOM if present
const de = JSON.parse(deContent);

// Function to reorder object keys to match template
function reorderObject(source, template) {
  const result = {};

  for (const key of Object.keys(template)) {
    if (key in source) {
      if (
        typeof template[key] === 'object' &&
        !Array.isArray(template[key]) &&
        template[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        source[key] !== null
      ) {
        result[key] = reorderObject(source[key], template[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

// Reorder de.json to match en.json structure
const reordered = reorderObject(de, en);

// Write back without BOM
fs.writeFileSync(dePath, JSON.stringify(reordered, null, 2) + '\n', {
  encoding: 'utf8',
});

console.log('✅ Fixed de.json key order to match en.json');
