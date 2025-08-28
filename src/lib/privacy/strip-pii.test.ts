import fixture from './__fixtures__/playbook-with-pii.json';
import { stripPII } from './strip-pii';

describe('stripPII', () => {
  it('removes top-level ids and PII from text and attachments', () => {
    const out = stripPII(fixture);
    // top-level ids removed
    expect(out.userId).toBeUndefined();
    expect(out.accountId).toBeUndefined();
    // title sanitized (name placeholder)
    expect(out.title).toMatch(/__PII_N_[0-9a-f]{8}__/);
    // description should have email and phone replaced
    expect(out.description).toMatch(/__PII_E_[0-9a-f]{8}__/);
    expect(out.description).toMatch(/__PII_P_[0-9a-f]{8}__/);

    // steps preserved but exif removed from attachments
    expect(Array.isArray(out.steps)).toBe(true);
    const att = out.steps[0].attachments[0];
    expect(att.filename).toBe('plant.jpg');
    expect(att.mimeType).toBe('image/jpeg');
    // exif should not be present
    expect(att.exif).toBeUndefined();

    // metadata macAddress removed
    expect(out.steps[0].metadata.macAddress).toBeUndefined();
    // notes should have email replaced
    expect(out.steps[0].metadata.notes).toMatch(/__PII_E_[0-9a-f]{8}__/);
  });

  it('is idempotent', () => {
    const once = stripPII(fixture);
    const twice = stripPII(once);
    expect(twice).toEqual(once);
  });
});
