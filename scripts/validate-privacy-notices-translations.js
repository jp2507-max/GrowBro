#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const privacyNoticesPath = path.join(
  __dirname,
  '..',
  'compliance',
  'privacy-notices.json'
);

function validatePrivacyNotices() {
  if (!fs.existsSync(privacyNoticesPath)) {
    console.error('Privacy notices file not found:', privacyNoticesPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(privacyNoticesPath, 'utf8'));

  const requiredLanguages = ['en', 'de'];
  let errors = [];

  function validateTranslatable(obj, path = '') {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.en !== undefined || obj.de !== undefined) {
        // This is a translatable field
        for (const lang of requiredLanguages) {
          if (!(lang in obj)) {
            errors.push(`Missing ${lang} translation at ${path}`);
          } else if (typeof obj[lang] !== 'string' || obj[lang].trim() === '') {
            errors.push(`Empty ${lang} translation at ${path}`);
          }
        }
      } else {
        // Recurse into object/array
        if (Array.isArray(obj)) {
          obj.forEach((item, index) =>
            validateTranslatable(item, `${path}[${index}]`)
          );
        } else {
          for (const key in obj) {
            if (
              key !== 'noticeId' &&
              key !== 'audience' &&
              key !== 'deliveryContext' &&
              key !== 'occurs' &&
              key !== 'present'
            ) {
              validateTranslatable(obj[key], path ? `${path}.${key}` : key);
            }
          }
        }
      }
    }
  }

  data.notices.forEach((notice, index) => {
    validateTranslatable(notice, `notices[${index}]`);
  });

  if (errors.length > 0) {
    console.error('Validation errors:');
    errors.forEach((error) => console.error(' -', error));
    process.exit(1);
  } else {
    console.log('All privacy notices have valid translations for en and de.');
  }
}

validatePrivacyNotices();
