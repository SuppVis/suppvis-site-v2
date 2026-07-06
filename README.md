# SuppVis Site V2

Next.js marketing site for SuppVis.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- npm
- Tailwind CSS v4 via PostCSS
- Vercel serverless API routes
- AWS SDK v3 for future DynamoDB persistence

## Local Setup

Install dependencies:

```bash
npm install
```

Create local env values from the template:

```bash
copy .env.example .env.local
```

Do not commit `.env.local` or real secrets.

## Collection Endpoints

The site includes serverless API routes for:

- `POST /api/beta-applications`
- `POST /api/email-subscribers`
- `POST /api/sms-subscribers`
- `POST /api/admin/broadcast-audit`

These routes validate input server-side, use honeypot fields, apply basic in-memory rate limiting, and return safe user-facing errors. They do not send real email or SMS messages.

## Required Environment Variables

Existing public content API:

- `NEXT_PUBLIC_API_URL`

AWS/DynamoDB:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DYNAMODB_BETA_APPLICATIONS_TABLE`
- `DYNAMODB_EMAIL_SUBSCRIBERS_TABLE`
- `DYNAMODB_SMS_SUBSCRIBERS_TABLE`
- `DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE`

Admin dry-run audit:

- `ADMIN_BROADCAST_TOKEN_HASH`

Recommended before production public collection:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## DynamoDB Tables To Create Later

Create these tables after infrastructure approval. Use separate names for production and preview, for example with `suppvis-site-v2-prod-` and `suppvis-site-v2-preview-` prefixes.

Each table can start with:

- Partition key: `id` string
- Billing mode: on-demand
- Encryption: AWS-managed encryption at rest
- Point-in-time recovery: recommended for production

Tables:

- `beta_applications`
- `email_subscribers`
- `sms_subscribers`
- `broadcast_audit_logs`

The current code writes these record shapes:

- Beta applications: `id`, `email`, `normalized_email`, optional `phone_raw`, optional `phone_e164`, `sms_opt_in`, `status`, `source_page`, `created_at`, `updated_at`
- Email subscribers: `id`, `email`, `normalized_email`, `status`, `consent_timestamp`, `consent_source`, `created_at`, `updated_at`, `unsubscribe_token`
- SMS subscribers: `id`, `phone_number_raw`, `phone_number_e164`, `status`, `sms_consent_timestamp`, `sms_consent_source`, `opt_out_timestamp`, `created_at`, `updated_at`
- Broadcast audit logs: `id`, `admin_identifier`, `channel`, `message_preview`, `intended_audience`, optional `target_count`, `dry_run`, `status`, `created_at`

## Vercel Environment Setup

Add the server-only AWS and DynamoDB variables in Vercel as encrypted environment variables. Use separate table names for:

- Production
- Preview
- Development, if using `vercel env pull`

Do not add a personal IAM user's key to Vercel. Use a dedicated least-privilege app IAM principal for the first deployment, or prefer a future Vercel OIDC-to-AWS role setup.

## Admin Broadcast Audit

`POST /api/admin/broadcast-audit` is dry-run/audit-only. It does not send email or SMS.

Authorization uses:

```http
Authorization: Bearer <raw-admin-token>
```

Set `ADMIN_BROADCAST_TOKEN_HASH` to the SHA-256 hex hash of the raw token. Keep the raw token outside the repo.

Example PowerShell hash generation:

```powershell
$token = "replace-with-a-long-random-token"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($token)
$hash = [System.Security.Cryptography.SHA256]::HashData($bytes)
[Convert]::ToHexString($hash).ToLower()
```

## Current Intentional Limits

- No AWS infrastructure is created by this repo.
- No IAM credentials are created, modified, rotated, or deleted by this repo.
- No real email sending is enabled.
- No real SMS sending is enabled.
- SMS subscribers are stored as `pending_verification` until a verification and compliance flow exists.
- The current rate limiter is in-memory and best-effort for serverless functions.

## Production TODOs

- Create the DynamoDB tables.
- Create a least-privilege IAM principal or configure Vercel OIDC-to-AWS role assumption.
- Add Vercel environment variables for production and preview.
- Add Turnstile or another CAPTCHA before broad public collection.
- Replace in-memory rate limiting with DynamoDB TTL-backed limits, Upstash/Vercel KV, or Vercel Firewall rules.
- Verify SES domain identity and request SES production access before sending email.
- Complete AWS SMS sandbox exit, brand/campaign registration, and origination setup before sending texts.
- Implement SMS STOP/UNSUBSCRIBE handling and opt-out syncing.
- Add an unsubscribe endpoint before sending marketing email.
- Add a protected admin UI only after auth is fully decided.
