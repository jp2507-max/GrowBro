#!/usr/bin/env node
/* eslint-disable prettier/prettier */
/*
 Non-blocking EU AI Act monitor
 - Reads docs/ai-act-compliance.md and prints actionable warnings
 - Exits with code 0 (non-blocking); use CI gating later if desired
 */

const fs = require('fs');
const path = require('path');

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_err) {
    return null;
  }
}

function main() {
  const repoRoot = process.cwd();
  const docPath = path.join(repoRoot, 'docs', 'ai-act-compliance.md');
  const content = readFileSafe(docPath);

  if (!content) {
    console.log('[ai-act] info: docs/ai-act-compliance.md not found. Create it to enable monitoring.');
    process.exit(0);
  }

  const hasDiagnosis = content.includes('#ai-diagnosis');
  const hasTraining = content.includes('#ai-training');

  const warnings = [];

  if (!hasDiagnosis) {
    warnings.push('Missing AI diagnosis section (#ai-diagnosis).');
  }
  if (!hasTraining) {
    warnings.push('Missing AI training section (#ai-training).');
  }

  // Simple milestone reminders
  const now = new Date();
  const milestones = [
    { name: 'Transparency copy finalized', date: new Date('2025-12-31') },
    { name: 'Risk management doc refresh', date: new Date('2026-06-30') },
  ];

  const soonDays = 120; // warn if due within ~4 months
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const milestoneMsgs = milestones
    .map((m) => {
      const days = Math.ceil((m.date.getTime() - now.getTime()) / MS_PER_DAY);
      if (days <= soonDays) {
        return `Milestone approaching: ${m.name} due in ${days} day(s)`;
      }
      return null;
    })
    .filter(Boolean);

  // Output
  if (warnings.length === 0 && milestoneMsgs.length === 0) {
    console.log('[ai-act] OK: No immediate warnings.');
  } else {
    console.log('[ai-act] warnings:');
    warnings.forEach((w) => console.log(' - ' + w));
    milestoneMsgs.forEach((m) => console.log(' - ' + m));
  }

  // Non-blocking
  process.exit(0);
}

main();


