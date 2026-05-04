# Security Policy

## Authentication & Authorization
- Supabase Auth manages identity.
- JSON Web Tokens (JWT) are validated on every backend request via FastAPI dependencies.
- Administrative endpoints require explicit Role-Based Access Control (RBAC) validation.

## Data Protection
- **In Transit**: All traffic must be secured via TLS 1.2 or higher (HTTPS/WSS).
- **At Rest (DB)**: Managed by Supabase (encrypted via AES-256).
- **At Rest (Telegram)**: Video files uploaded to Telegram are chunked. Video IDs are obfuscated. Consider application-level encryption for chunks before upload for maximum security against Telegram account compromise.

## Content Protection
- Video streaming endpoints use short-lived signed URLs or require valid JWT context.
- Streaming routes implement byte-range validations and rate limiting to hinder automated scraping tools (youtube-dl).
- Dynamic watermarking (using student email) overlays on the frontend to deter screen recording.

## Vulnerability Managment
- Automated SAST via `bandit` and `npm audit` in CI/CD pipeline.
- Dependencies tracked and updated monthly.

## Incident Response
In case of suspected breach:
1. Revoke all active API keys.
2. Flush Redis cache (forces re-authentication flows).
3. Review audit logs in Supabase.
4. Notify users if PII is compromised per GDPR/local regulations.
