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
- `POST /api/email-subscribers/unsubscribe`
- `POST /api/webhooks/twilio/sms`

These routes validate input server-side, use honeypot fields, apply basic in-memory rate limiting, and return safe user-facing errors. They do not send real email or SMS messages.

The beta waitlist form collects first name, last name, email, and an optional phone number. If a phone number is provided, explicit SMS consent is required before the phone number is stored as an SMS subscriber. Repeated beta signups with the same normalized email return a friendly already-signed-up success response instead of creating a second beta application.

## Required Environment Variables

Existing public content API:

- `NEXT_PUBLIC_API_URL`
- `APP_BASE_URL`

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
- `SES_FROM_EMAIL` - future verified sender, recommended `beta@suppvis.health`.
- `SES_REGION` - future SES region, recommended `us-east-1`.

Future Twilio SMS webhook verification:

- `TWILIO_AUTH_TOKEN`
- `TWILIO_WEBHOOK_SIGNATURE_REQUIRED` - keep `false` for local testing; production webhooks should require signatures before provider traffic is connected.

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
- Email subscribers: `id`, `email`, `normalized_email`, `status`, `consent_timestamp`, `consent_source`, `created_at`, `updated_at`, `unsubscribe_token`, optional `unsubscribed_at`, optional `unsubscribe_source`, optional `resubscribed_at`
- SMS subscribers: `id`, `phone_number_raw`, `phone_number_e164`, `status`, `sms_consent_timestamp`, `sms_consent_source`, `opt_out_timestamp`, optional `opt_out_source`, optional `last_opt_out_keyword`, optional `resubscribed_at`, `created_at`, `updated_at`
- Broadcast audit logs: `id`, `admin_identifier`, `channel`, `message_preview`, `intended_audience`, optional `target_count`, `dry_run`, `status`, `created_at`

## Welcome Message Templates

Welcome email and SMS copy lives in `app/lib/server/messages/welcome.ts`. This file only exports constants and template builders. It does not send messages, load provider SDKs, or run as part of form submission.

Real welcome sends must remain disabled until:

- Email unsubscribe suppression is wired into the future sending pipeline.
- SMS STOP/UNSUBSCRIBE suppression is wired into the future sending pipeline.
- A sending provider is configured.
- The `WELCOME_EMAIL_ENABLED` or `WELCOME_SMS_ENABLED` flags are explicitly enabled.

## Unsubscribe And SMS Opt-Out Foundation

Email unsubscribe support is provider-ready but not connected to a sender yet:

- Future emails should link to `/unsubscribe?subscriber=<email_subscriber_id>&token=<unsubscribe_token>`.
- The API route conditionally updates the matching email subscriber record to `status = unsubscribed`, sets `unsubscribed_at`, and keeps the record for audit/history.
- Token-only lookup is intentionally not used because it would require a GSI or token lookup table. Passing the deterministic subscriber id plus token avoids production scans.
- A later signup with the same email sets `status = subscribed` again and records `resubscribed_at` when the previous record was unsubscribed.

SMS opt-out support is provider-ready but not connected to Twilio yet:

- `POST /api/webhooks/twilio/sms` accepts Twilio-style inbound SMS form payloads.
- STOP keywords are `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, and `QUIT`.
- START keywords are `START` and `UNSTOP`.
- STOP updates the deterministic phone-based SMS subscriber record to `status = unsubscribed`, sets `opt_out_timestamp`, `opt_out_source`, and `last_opt_out_keyword`, and keeps the record.
- START or explicit website SMS consent can reactivate the phone record as `pending_verification` and set `resubscribed_at`.
- Production Twilio traffic should require signature verification with `TWILIO_AUTH_TOKEN`.
- The app currently returns empty TwiML and does not send a STOP confirmation. Prefer Twilio Messaging Service advanced opt-out confirmations during provider setup, or add app-generated confirmations only after that behavior is chosen.

## Future Email Sender Setup

Use `beta@suppvis.health` as the recommended production sender for beta/TestFlight/waitlist emails. Do not use a personal Gmail account or personal inbox for production sending.

Before real welcome emails are enabled:

- Verify `suppvis.health` or `beta@suppvis.health` with AWS SES or the chosen transactional provider.
- Configure DKIM records.
- Configure SPF/DMARC as appropriate.
- Request SES production access if the account is still in sandbox.
- Add bounce and complaint handling before broader sends.
- Set `SES_FROM_EMAIL=beta@suppvis.health` and `SES_REGION=us-east-1`, or equivalent provider-specific sender/domain variables.
- Include the unsubscribe link in every email and suppress subscribers with `status = unsubscribed` before sending.

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
- Email unsubscribe and SMS STOP foundations are present, but no sender/provider is connected yet.
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
- Connect future email sends to unsubscribe suppression.
- Connect future SMS sends to STOP/UNSUBSCRIBE suppression.
- Add a protected admin UI only after auth is fully decided.
