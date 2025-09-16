'use strict';
/* eslint-env node */
const fs = require('fs');
const path = require('path');

function loadJson(p) {
  const content = fs.readFileSync(p, 'utf8');
  return JSON.parse(content);
}

function validate(list) {
  const issues = [];
  for (const p of list) {
    if (!p.name) issues.push('missing-name');
    if (!p.purpose) issues.push(`missing-purpose:${p.name}`);
    if (!p.dpaLink) issues.push(`missing-dpaLink:${p.name}`);
    if (!['EU', 'US', 'Global'].includes(p.region)) {
      issues.push(`invalid-region:${p.name}`);
    }
    if (p.region !== 'EU') {
      if (!p.sccModule || !p.tiaDocId) issues.push(`missing-scc-tia:${p.name}`);
    }
  }
  return issues;
}

function main() {
  const file = path.resolve(process.cwd(), 'docs', 'legal', 'processors.json');
  const data = loadJson(file);
  const issues = validate(data);
  if (issues.length) {
    console.error('Processor validation failed:', issues.join(', '));
    process.exit(1);
  }
  console.log('Processor validation passed.');
}

if (require.main === module) {
  main();
}

module.exports = { validate };
