# Strains Feature Compliance Policy Checklist

This checklist should be reviewed during PR reviews for any changes to the strains feature to ensure compliance with Apple App Store (1.4.3) and Google Play Store restricted content policies.

## Age Verification

- [ ] Age gate is displayed before any strain content is accessible
- [ ] Age verification persists for 12 months maximum
- [ ] Re-verification is triggered after 12 months or sign-out
- [ ] No strain content is visible without age verification

## Educational Content Only

- [ ] All strain descriptions focus on cultivation and botanical information
- [ ] No language encouraging consumption or recreational use
- [ ] No glamorization of cannabis effects
- [ ] Terpene and cannabinoid information presented scientifically
- [ ] Growing information is educational and factual

## No Commerce Features

- [ ] No "buy", "purchase", "shop", or "order" buttons or links
- [ ] No pricing information displayed
- [ ] No links to dispensaries, stores, or delivery services
- [ ] No affiliate links or commercial partnerships
- [ ] No shopping cart or checkout functionality
- [ ] No product recommendations for purchase

## Regional Compliance

- [ ] Conservative mode is automatically enabled for restricted regions
- [ ] Content filtering removes commerce keywords in conservative mode
- [ ] Compliance banner is displayed in restricted regions
- [ ] No outbound commerce links in any region
- [ ] Legal disclaimers are prominently displayed

## Content Filtering (Conservative Mode)

- [ ] Descriptions are filtered to remove commerce keywords
- [ ] Glamorization phrases are removed or neutralized
- [ ] External links are validated (no commerce links)
- [ ] Educational disclaimers are displayed
- [ ] "Not reported" is shown instead of hiding missing data

## User Interface

- [ ] No imagery that glamorizes consumption
- [ ] Strain images focus on plant characteristics
- [ ] Icons and emojis are neutral and educational
- [ ] Color schemes don't suggest recreational use
- [ ] CTAs focus on cultivation planning, not consumption

## Data Privacy

- [ ] User favorites are stored locally first
- [ ] Sync to cloud requires explicit consent
- [ ] No tracking of consumption patterns
- [ ] Search queries are not shared with third parties
- [ ] Analytics respect user privacy settings

## Accessibility & Localization

- [ ] All compliance notices are accessible via screen readers
- [ ] Disclaimers are translated to all supported languages
- [ ] Age gate works with assistive technologies
- [ ] Compliance banners have proper ARIA labels

## Testing Requirements

- [ ] Age gate expiration is tested (12-month cycle)
- [ ] Regional detection is tested for restricted regions
- [ ] Content filtering is tested in conservative mode
- [ ] Commerce link detection is tested
- [ ] Compliance banner visibility is tested

## Documentation

- [ ] Any new strain-related features document compliance considerations
- [ ] API integrations document content filtering requirements
- [ ] User-facing documentation emphasizes educational purpose
- [ ] Privacy policy reflects strain data handling

## Red Flags to Watch For

❌ **Immediate Rejection Risks:**

- Any "Add to Cart" or purchase functionality
- Links to cannabis retailers or delivery services
- Pricing or promotional language
- Consumption encouragement or glamorization
- Missing age verification
- Commerce features in restricted regions

⚠️ **Review Carefully:**

- New external links (validate they're educational)
- User-generated content (ensure moderation)
- Third-party integrations (verify compliance)
- Marketing copy (ensure educational tone)
- New data fields (verify they're cultivation-focused)

## Approval Criteria

For a PR to be approved, it must:

1. ✅ Pass all checklist items relevant to the changes
2. ✅ Include tests for compliance-related functionality
3. ✅ Update documentation if compliance behavior changes
4. ✅ Be reviewed by at least one team member familiar with app store policies

## References

- [Apple App Store Review Guidelines 1.4.3](https://developer.apple.com/app-store/review/guidelines/#unacceptable)
- [Google Play Restricted Content Policy](https://support.google.com/googleplay/android-developer/answer/9878810)
- [GrowBro Privacy Policy](https://growbro.app/privacy)
- [GrowBro Terms of Service](https://growbro.app/terms)

## Last Updated

Date: 2025-10-02
Reviewer: Development Team
