import { randomBytes } from 'node:crypto';
import { normalizePhone, tempCode } from './phone';

describe('phone identifiers', () => {
  it('normalizes common Togolese formats', () => {
    expect(normalizePhone('+228 90 07 91 90')).toBe('+22890079190');
    expect(normalizePhone('00228-90.07.91.90')).toBe('+22890079190');
    expect(normalizePhone('90 07 91 90')).toBe('+22890079190');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('rejects what is not a phone number', () => {
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('1234')).toBeNull();
    expect(normalizePhone('admin@example.com')).toBeNull();
  });

  it('makes readable 10-character codes', () => {
    const code = tempCode(randomBytes);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });
});
