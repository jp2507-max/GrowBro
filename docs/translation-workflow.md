Translation workflow for privacy notices

- All privacy notices live in `compliance/privacy-notices.json` as canonical templates (English).
- Required languages for EU deployment: en, de
- The app loads localized strings from `src/translations/{en,de}.json` using i18next. We add a `privacyNotices` namespace mapping noticeId -> { title, audience, deliveryContext }.

Task for release engineers / localization:

1. Obtain German translations for every noticeId listed in `compliance/privacy-notices.json:notices`.
2. Add them to `src/translations/de.json` under the `privacyNotices` key following existing translation structure.
3. Run `pnpm run validate:privacy-notices` locally to ensure no missing/empty entries.
4. Only after the CI validation passes and the translations are merged, enable the EU deployment feature flag for community moderation notices.

Notes:

- CI will block PRs that remove or add notices without corresponding translations for required languages.
- Keep translation keys stable (do not change noticeId values).
