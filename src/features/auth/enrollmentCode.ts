/**
 * Enrollment code canonicalization.
 *
 * Stage 4: extracted from useChapterAccess so the format rules can be
 * unit-tested. The bug class this protects against (Stage 3 N-5): the
 * generators emit XXXXXX-XXXXXX (6-6) codes — backend
 * generate_secure_hex(3)-generate_secure_hex(3), SQL
 * admin_generate_chapter_code, and quick codes "NEXUS-XXXXXX" — but the
 * original hook re-grouped input into 4-char chunks, corrupting every
 * valid code before it reached the RPC.
 */
export function normalizeEnrollmentCode(raw: string): string {
  if (!raw) return '';
  const clean = raw.replace(/\s+/g, '').toUpperCase();
  const alnum = clean.replace(/[^A-Z0-9-]/g, '');
  const bare = alnum.replace(/-/g, '');
  // Bare 12-char input → canonical 6-6 grouping used by all generators.
  if (bare.length === 12) return `${bare.slice(0, 6)}-${bare.slice(6)}`;
  // Anything else (e.g. NEXUS-XXXXXX quick codes) is preserved as typed
  // after whitespace/case cleanup so exact-match RPC lookups keep working.
  return alnum;
}
