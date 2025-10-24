const fs = require('fs');
const path = require('path');

const REQUIRED_LANGS = ['en', 'de'];
const TRANSLATIONS_DIR = path.resolve(__dirname, '..', 'src', 'translations');
const NOTICE_FILE = path.join(
  __dirname,
  '..',
  'compliance',
  'privacy-notices.json'
);

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read/parse ${filePath}: ${err.message}`);
    process.exit(2);
  }
}

function main() {
  const notices = loadJson(NOTICE_FILE);

  const translations = {};
  for (const lang of REQUIRED_LANGS) {
    const file = path.join(TRANSLATIONS_DIR, `${lang}.json`);
    translations[lang] = loadJson(file);
  }

  const ns =
    notices &&
    notices.metadata &&
    notices.metadata.translations &&
    notices.metadata.translations.namespace;

  if (!ns) {
    console.error('Missing namespace in privacy-notices metadata');
    process.exit(2);
  }

  const keys = (notices.metadata &&
    notices.metadata.translations &&
    notices.metadata.translations.keys) || [
    'title',
    'audience',
    'deliveryContext',
  ];

  const missing = [];

  for (const notice of notices.notices || []) {
    const id = notice.noticeId;
    for (const key of keys) {
      for (const lang of REQUIRED_LANGS) {
        const hasLang =
          translations[lang] &&
          translations[lang][ns] &&
          translations[lang][ns][id];
        const value = hasLang ? translations[lang][ns][id][key] : undefined;
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          missing.push({ noticeId: id, key, lang });
        }
      }
    }
  }

  if (missing.length > 0) {
    console.error(
      'Privacy notice translations missing or empty for the following entries:'
    );
    missing.forEach((m) => {
      console.error(` - noticeId=${m.noticeId} key=${m.key} lang=${m.lang}`);
    });
    process.exit(1);
  }

  console.log(
    'All required privacy notice translations present and non-empty for languages:',
    REQUIRED_LANGS.join(', ')
  );
  process.exit(0);
}

if (require.main === module) {
  main();
}
