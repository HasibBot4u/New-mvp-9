import { describe, it, expect } from 'vitest';
import { normalizeEnrollmentCode } from './enrollmentCode';

describe('normalizeEnrollmentCode', () => {
  it('preserves a canonical 6-6 code', () => {
    expect(normalizeEnrollmentCode('ABC123-DEF456')).toBe('ABC123-DEF456');
  });

  it('uppercases and re-dashes a bare 12-char code (user typed without dash)', () => {
    expect(normalizeEnrollmentCode('abc123def456')).toBe('ABC123-DEF456');
  });

  it('strips spaces a mobile keyboard inserts', () => {
    expect(normalizeEnrollmentCode(' abc1 23def 456 ')).toBe('ABC123-DEF456');
  });

  it('does NOT corrupt codes with the old 4-char grouping', () => {
    // Regression guard for Stage-3 N-5: the previous implementation
    // returned 'ABC1-23DE-F456' here.
    expect(normalizeEnrollmentCode('ABC123DEF456')).not.toContain('ABC1-23DE');
  });

  it('preserves quick-code formats like NEXUS-XXXXXX', () => {
    expect(normalizeEnrollmentCode('nexus-Ab3xY9')).toBe('NEXUS-AB3XY9');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeEnrollmentCode('')).toBe('');
    expect(normalizeEnrollmentCode('   ')).toBe('');
  });

  it('drops characters that cannot appear in a code', () => {
    expect(normalizeEnrollmentCode('ABC123!@#DEF456')).toBe('ABC123-DEF456');
  });
});
