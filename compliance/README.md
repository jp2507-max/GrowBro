# Compliance assets

This folder contains machine-readable compliance artifacts used to automate Google Play Data Safety documentation and CI gates.

- `data-inventory.json` — Authoritative data inventory: feature × data type × purpose × retention × sharedWith
- `sdk-index.json` — Local mirror for third-party SDK disclosures used by the validator (no network calls in CI)
- `privacy-policy.json` — Public URLs for the Privacy Policy and Web Deletion request page

Update these files whenever data practices change. CI will fail if they are missing or out of sync.
