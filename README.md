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

The beta waitlist form collects first name, last name, email, and an optional phone number. If a phone number is provided, explicit SMS consent is required before the phone number is stored as an SMS subscriber. Repeated beta signups with the same normalized email return a friendly already-signed-up success response instead of creating a second beta application.

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

Welcome templates:

- `WELCOME_EMAIL_ENABLED` - keep `false` until unsubscribe handling and a sender are configured.
- `WELCOME_SMS_ENABLED` - keep `false` until STOP/UNSUBSCRIBE handling and an SMS provider are configured.

Recommended before production public collection:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## DynamoDB Tables

The production DynamoDB tables already exist. New Preview, Development, or future isolated environments need equivalent tables and matching environment variables before form writes will work.

Each table can start with:

- Partition key: `id` string
- Billing mode: on-demand
- Encryption: AWS-managed encryption at rest
- Point-in-time recovery: recommended for production

Tables:

- `suppvis-prod-beta-applications`
- `suppvis-prod-email-subscribers`
- `suppvis-prod-sms-subscribers`
- `suppvis-prod-broadcast-audit-logs`

The current code writes these record shapes:

- Beta applications: `id`, `first_name`, `last_name`, `email`, `normalized_email`, optional `phone_raw`, optional `phone_e164`, `sms_opt_in`, `status`, `source_page`, `created_at`, `updated_at`
- Email subscribers: `id`, `email`, `normalized_email`, `status`, `consent_timestamp`, `consent_source`, `created_at`, `updated_at`, `unsubscribe_token`
- SMS subscribers: `id`, `phone_number_raw`, `phone_number_e164`, `status`, `sms_consent_timestamp`, `sms_consent_source`, `opt_out_timestamp`, `created_at`, `updated_at`
- Broadcast audit logs: `id`, `admin_identifier`, `channel`, `message_preview`, `intended_audience`, optional `target_count`, `dry_run`, `status`, `created_at`

## Welcome Message Templates

Welcome email and SMS copy lives in `app/lib/server/messages/welcome.ts`. This file only exports constants and template builders. It does not send messages, load provider SDKs, or run as part of form submission.

Real welcome sends must remain disabled until:

- Email unsubscribe links/routes are implemented and tested.
- SMS STOP/UNSUBSCRIBE webhook handling is implemented and tested.
- A sending provider is configured.
- The `WELCOME_EMAIL_ENABLED` or `WELCOME_SMS_ENABLED` flags are explicitly enabled.

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
- Welcome message templates are present, but the submit routes do not send them.
- SMS subscribers are stored as `pending_verification` until a verification and compliance flow exists.
- The current rate limiter is in-memory and best-effort for serverless functions.

## Production TODOs

- Create equivalent DynamoDB tables for any new isolated non-production environments.
- Consider replacing the current least-privilege IAM user with a future Vercel OIDC-to-AWS role assumption.
- Keep Vercel environment variables current for production and preview.
- Add Turnstile or another CAPTCHA before broad public collection.
- Replace in-memory rate limiting with DynamoDB TTL-backed limits, Upstash/Vercel KV, or Vercel Firewall rules.
- Verify SES domain identity and request SES production access before sending email.
- Complete AWS SMS sandbox exit, brand/campaign registration, and origination setup before sending texts.
- Implement SMS STOP/UNSUBSCRIBE handling and opt-out syncing.
- Add an unsubscribe endpoint before sending marketing email.
- Add a protected admin UI only after auth is fully decided.
