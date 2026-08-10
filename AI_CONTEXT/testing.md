# Testing
Run: `.venv/bin/pytest backend/tests -v` (34 tests) · `npm run test:ci` (14 tests, 6 files) · `npm run typecheck` · `npm run build`.
Suites: stream tickets (5), progress rules (6), admin validation (6+3 anon), stream authz matrix (7), enrollments authz (3), catalog degraded (1), auth/health (3), upload bulk auth (2), FE: enrollmentCode (7), api urls (3), ErrorBoundary, Player, AdminDashboard (async).
Matrix & post-deploy smoke: docs/TESTING_MATRIX.md. No live-DB or browser-E2E harness yet (declared gaps).
