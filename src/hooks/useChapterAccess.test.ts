import { describe, it, expect } from 'vitest';

export function normalizeCode(code: string) {
  const clean = code.replace(/[^A-Z0-9a-z]/gi, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join('-') || clean;
}

describe('normalizeCode', () => {
  it('upper cases and adds dashes', () => {
    expect(normalizeCode(' abc-12 34 ')).toBe('ABC1-234');
    expect(normalizeCode('XXXXYYYYZZZZ')).toBe('XXXX-YYYY-ZZZZ');
  });
});
