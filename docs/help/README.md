# GrowBro Help Documentation

This directory contains user-facing help articles for the GrowBro mobile app. Articles are written in Markdown format and available in English (EN) and German (DE).

## Structure

```
docs/help/
├── README.md                          # This file
├── settings-profile-en.md             # Profile settings (English)
├── settings-profile-de.md             # Profile settings (German)
├── settings-notifications-en.md       # Notification settings (English) [TODO]
├── settings-notifications-de.md       # Notification settings (German) [TODO]
├── settings-privacy-en.md             # Privacy controls (English) [TODO]
├── settings-privacy-de.md             # Privacy controls (German) [TODO]
├── settings-security-en.md            # Security settings (English) [TODO]
├── settings-security-de.md            # Security settings (German) [TODO]
├── settings-delete-account-en.md      # Account deletion (English) [TODO]
├── settings-delete-account-de.md      # Account deletion (German) [TODO]
├── support-bug-report-en.md           # Bug reporting (English) [TODO]
├── support-bug-report-de.md           # Bug reporting (German) [TODO]
├── support-feedback-en.md             # Sending feedback (English) [TODO]
├── support-feedback-de.md             # Sending feedback (German) [TODO]
├── legal-documents-en.md              # Legal documents (English) [TODO]
├── legal-documents-de.md              # Legal documents (German) [TODO]
└── community-guidelines-en.md         # Community guidelines (English) [TODO]
└── community-guidelines-de.md         # Community guidelines (German) [TODO]
```

## Completed Articles

### Profile Settings

- ✅ **English** (`settings-profile-en.md`) - Comprehensive guide covering:
  - Display name, bio, location editing
  - Avatar upload with detailed pipeline explanation
  - Privacy visibility controls
  - Account statistics
  - Offline functionality and sync behavior
  - Troubleshooting common issues
  - Best practices for privacy and community engagement

- ✅ **German** (`settings-profile-de.md`) - Full translation of profile settings guide

## Writing Guidelines

### Tone & Style

- **Friendly and Approachable:** Use "you" and "your" (du/dein in German)
- **Clear and Concise:** Short sentences, simple language
- **Step-by-Step:** Number steps clearly (1, 2, 3...)
- **Visual Cues:** Use emojis sparingly for icons (🌱, 🔒, ✅, ❌)
- **Action-Oriented:** Start with verbs ("Tap...", "Select...", "Choose...")

### Structure

Each help article should follow this structure:

1. **Overview** - Brief intro (1-2 sentences)
2. **Getting Started** - How to access the feature
3. **Main Content** - Step-by-step instructions with screenshots
4. **Troubleshooting** - Common problems and solutions
5. **Best Practices** - Tips and recommendations
6. **Related Articles** - Links to other help content
7. **Need More Help?** - Contact options

### Formatting

#### Headings

```markdown
# Article Title (H1 - once per article)

## Section (H2 - major sections)

### Subsection (H3 - detailed topics)
```

#### Lists

- Use **numbered lists** for sequential steps
- Use **bullet lists** for options or features
- Use **checkmarks** for dos and don'ts (✅ ❌)

#### Code & Deep Links

```markdown
`growbro://settings/profile` - Inline code for deep links
**Bold** - Important terms or UI elements
_Italic_ - Emphasis
```

#### Callouts

```markdown
**Problem:** Description of issue
**Solutions:**

1. Step one
2. Step two

**Privacy Note:** Important privacy information
**Tip:** Helpful suggestion
```

### Screenshots

Screenshots should be added to `docs/help/images/` directory:

- Use descriptive filenames: `profile-avatar-upload-en.png`
- Keep file sizes under 500KB (compress if needed)
- Include in articles with: `![Alt text](./images/filename.png)`
- Provide both light and dark mode versions where applicable

### Translation Notes

#### German Translation Guidelines

- Use "Sie" form for formal tone (more appropriate for help docs)
- Technical terms can remain in English if commonly used (e.g., "App", "Deep Link")
- UI element names should match the app's German translation strings
- Maintain consistent terminology across all German articles

#### Common Translations

- Settings → Einstellungen
- Profile → Profil
- Save → Speichern
- Cancel → Abbrechen
- Tap → Tippen
- Swipe → Wischen
- Toggle → Umschalten
- Upload → Hochladen
- Download → Herunterladen

## Integration with App

### In-App Help Center

Help articles are displayed in the app through:

1. **Settings → Support → Help Center**
   - Opens in-app browser or external browser
   - URL: `https://growbro.app/help` (maps to these docs)

2. **Contextual Help Links**
   - Question mark icons on complex screens
   - Deep links to specific help articles
   - Example: Profile screen → `growbro://help/settings-profile`

3. **Search Functionality**
   - Help Center includes search for all articles
   - Keywords extracted from article headings and content

### Deep Link Format

Help articles support deep linking:

```
growbro://help/[article-slug]

Examples:
growbro://help/settings-profile
growbro://help/settings-notifications
growbro://help/delete-account
```

## Maintenance

### Updating Articles

When features change:

1. Update the affected help article(s)
2. Update screenshots if UI changed
3. Update the version number at bottom of article
4. Update "Last updated" date
5. Translate changes to all languages

### Adding New Articles

1. Create English version first (`[topic]-en.md`)
2. Follow the structure and guidelines above
3. Add to this README's structure section
4. Create German translation (`[topic]-de.md`)
5. Link from related articles
6. Update app's help center navigation

### Review Schedule

- **Minor Updates:** As features change
- **Major Review:** Quarterly (every 3 months)
- **Translation Sync:** Within 1 week of English updates

## TODO: Remaining Articles

Priority articles to create next:

### High Priority

1. **Account Deletion** (`settings-delete-account-en/de.md`)
   - Covers grace period, consequences, restore process
   - Requirements: 6.1-6.12

2. **Privacy Controls** (`settings-privacy-en/de.md`)
   - Consent management, data export, GDPR rights
   - Requirements: 5.1-5.10

3. **Notification Settings** (`settings-notifications-en/de.md`)
   - Category toggles, quiet hours, multi-device sync
   - Requirements: 4.1-4.11

### Medium Priority

4. **Security Settings** (`settings-security-en/de.md`)
   - Password change, biometric setup, active sessions
   - Requirements: 11.1-11.10

5. **Bug Reporting** (`support-bug-report-en/de.md`)
   - How to report bugs with diagnostics
   - Requirements: 7.4, 7.8, 7.9

### Low Priority

6. **Legal Documents** (`legal-documents-en/de.md`)
   - How to view and understand terms/privacy policy
   - Requirements: 8.1-8.11

7. **Community Guidelines** (`community-guidelines-en/de.md`)
   - Community rules and moderation policies

## Contributing

### Internal Team

When adding/updating help content:

1. Follow the writing guidelines above
2. Test deep links and navigation
3. Verify translations with native speakers
4. Request review from product team

### External Contributors

We don't currently accept external help documentation contributions, but you can:

- Report unclear or outdated help content via bug reports
- Suggest improvements via feedback forms
- Request new help topics via support email

## Resources

### Writing Tools

- **Markdown Editor:** VSCode with Markdown Preview
- **Screenshot Tool:** OS built-in (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
- **Translation:** DeepL for draft translations, native speaker for review
- **Spell Check:** Grammarly or VSCode spell checker extension

### Style References

- Apple Human Interface Guidelines - Help Content
- Google Material Design - Writing
- Nielsen Norman Group - Writing for the Web

---

_Last updated: November 2025_
_Documentation Version: 1.0_
