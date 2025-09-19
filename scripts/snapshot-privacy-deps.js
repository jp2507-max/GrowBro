const fs = require('fs');
const path = require('path');

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const pkgPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {}).sort();

  const outPath = path.join(repoRoot, 'docs', 'privacy-manifest-deps.json');
  const payload = { generatedAt: new Date().toISOString(), dependencies: deps };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`[privacy:snapshot] Wrote ${outPath}`);
}

main();
