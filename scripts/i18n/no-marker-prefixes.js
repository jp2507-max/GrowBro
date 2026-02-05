'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES = ['en', 'de'];
const MARKER_REGEX = /^\[(EN|DE)\]\s*/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walk(value, currentPath, hits) {
  if (typeof value === 'string') {
    if (MARKER_REGEX.test(value)) {
      hits.push({ path: currentPath, value });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walk(item, `${currentPath}[${index}]`, hits);
    });
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      walk(child, nextPath, hits);
    });
  }
}

const results = [];

for (const locale of LOCALES) {
  const filePath = path.join(ROOT, 'src', 'translations', `${locale}.json`);
  const data = readJson(filePath);
  const hits = [];
  walk(data, '', hits);

  hits.forEach((hit) => {
    results.push({ locale, filePath, ...hit });
  });
}

if (results.length > 0) {
  console.error('Translation marker prefixes found:');
  results.forEach((hit) => {
    console.error(
      `- [${hit.locale}] ${hit.path} -> ${JSON.stringify(hit.value)}`
    );
  });
  process.exit(1);
}

console.log('No translation marker prefixes found.');
