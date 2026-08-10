# AI_CONTEXT — Persistent Technical Memory

Read this directory FIRST when working on this repository. Every file is maintained as ground truth; if code and docs disagree, verify against code and update these files.

| File | Contents |
|---|---|
| architecture.md | System topology, data flow, deployment model |
| business-logic.md | Monetization, enrollment rules, progress rules |
| database.md | Schema truth, RLS model, migration rules |
| api.md | Endpoint inventory with auth requirements |
| authentication.md | JWT lifecycle, tickets, refresh behavior |
| authorization.md | Roles, chapter access, admin checks |
| integrations.md | Supabase/Telegram/Render/Netlify/GH wiring |
| telegram.md | Channel/bot/session model + reconstruction |
| deployment.md | Environments, pipeline, rollback |
| testing.md | Suites, matrix, how to run |
| troubleshooting.md | Symptom → cause table |
| known-issues.md | Open residuals (update after incidents) |
| conventions.md | Code style + hard-won rules |

Stage history: Stage 1 forensics (`FORENSIC_ANALYSIS.md`), Stage 2 repair (`docs/STAGE2_REPAIR_REPORT.md`), Stage 3 re-audit (`docs/STAGE3_REAUDIT_REPORT.md`), Stages 4–15 (`docs/TESTING_MATRIX.md`, `SECURITY_THREAT_MODEL.md`, `PERFORMANCE_SCALE_PLAN.md`, `DEPLOYMENT_PIPELINE.md`, `OBSERVABILITY_AND_INCIDENTS.md`, `DISASTER_RECOVERY.md`, `FAILURE_AND_CHAOS_AUDIT.md`, `PRODUCT_READINESS.md`, `docs/PRODUCTION_CERTIFICATION.md`).
