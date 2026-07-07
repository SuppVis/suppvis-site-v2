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

Recommended SES setup:

- Use SES in `us-east-1` unless there is a later reason to move email sending to a different AWS Region.
- Verify the domain `suppvis.health` in SES, not only `beta@suppvis.health`, so future domain addresses can inherit verification.
- Use Easy DKIM with SES-generated DNS records.
- Keep `SES_FROM_EMAIL=beta@suppvis.health`.
- Keep `WELCOME_EMAIL_ENABLED=false` until sender verification, unsubscribe suppression, bounce/complaint handling, and internal test approval are complete.

High-level AWS console steps:

1. Open AWS SES in `us-east-1`.
2. Go to Configuration > Identities.
3. Create an identity with type `Domain` and value `suppvis.health`.
4. Enable Easy DKIM.
5. Copy the generated DKIM `CNAME` records into the domain DNS provider.
6. Add SPF and DMARC DNS records if they are not already present.
7. Optionally configure a custom MAIL FROM subdomain, such as `mail.suppvis.health` or `bounce.suppvis.health`.
8. Check the SES Account dashboard to determine whether the account is still in sandbox.
9. If sandboxed, request production access only after DNS/authentication records and bounce/complaint handling plans are ready.

DNS records to expect:

- SES Easy DKIM: three generated `CNAME` records under `_domainkey.suppvis.health`.
- SPF: a `TXT` record authorizing SES if using a custom MAIL FROM, usually including `include:amazonses.com`.
- DMARC: a `TXT` record at `_dmarc.suppvis.health`; start with monitoring policy such as `p=none` before tightening.
- Custom MAIL FROM, if used: SES-provided `MX` and `TXT` records for the chosen subdomain.

Before real welcome emails are enabled:

- Verify `suppvis.health` or `beta@suppvis.health` with AWS SES or the chosen transactional provider.
- Configure DKIM records.
- Configure SPF/DMARC as appropriate.
- Request SES production access if the account is still in sandbox.
- Add bounce and complaint handling before broader sends.
- Set `SES_FROM_EMAIL=beta@suppvis.health` and `SES_REGION=us-east-1`, or equivalent provider-specific sender/domain variables.
- Include the unsubscribe link in every email and suppress subscribers with `status = unsubscribed` before sending.
- Add least-privilege SES IAM permissions only after explicit approval. The future app principal should only need `ses:SendEmail` and/or `ses:SendRawEmail` scoped to the verified identity and optional configuration set.

Future bounce/complaint handling:

- Use an SES configuration set for welcome emails.
- Route bounce, complaint, delivery, and reject events to SNS, EventBridge, or another approved event processor.
- Update `email_subscribers.status` to `bounced` or `complained` when those events occur.
- Suppress sends for `unsubscribed`, `bounced`, and `complained` records.

Do not do yet:

- Do not enable `WELCOME_EMAIL_ENABLED`.
- Do not send test or production email.
- Do not request SES production access until domain authentication and bounce/complaint handling are planned.
- Do not use a personal Gmail address for production sending.

## Future Twilio SMS Setup

Use a Twilio Messaging Service for future beta welcome SMS and STOP/START handling. Keep `WELCOME_SMS_ENABLED=false` until compliance, webhook signing, and internal testing are approved.

Recommended setup:

- Create or use a Twilio account owned by SuppVis.
- Create a Messaging Service for SuppVis beta/waitlist messages.
- Use A2P 10DLC for standard US app-to-person long-code messaging unless Twilio recommends verified toll-free for the use case.
- Complete required brand/campaign or toll-free verification before real sends.
- Configure the inbound message webhook on the Messaging Service:
  - URL: `https://www.suppvis.health/api/webhooks/twilio/sms`
  - Method: `POST`
- Require Twilio webhook signature verification in production.

Future Twilio environment variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_WEBHOOK_SIGNATURE_REQUIRED=true`
- `WELCOME_SMS_ENABLED=false`

Compliance information likely needed:

- Legal business name and contact details.
- Website URL: `https://www.suppvis.health`.
- Message use case: beta waitlist access and product updates for users who explicitly opted into texts.
- Sample messages, including welcome copy and STOP language.
- Opt-in flow description: website beta form with phone field and explicit SMS consent checkbox.
- Opt-out flow description: users can reply STOP; app syncs opt-out state into DynamoDB.
- Privacy policy and terms URLs.

Current recommended future SMS welcome copy:

> Welcome to SuppVis. You're one of our founding beta members. We built SuppVis to show what your supplements are actually doing - backed by research, not hype. Get access: https://testflight.apple.com/join/nTASgewZ Complete onboarding to unlock everything. Reply STOP to unsubscribe. Msg & data rates may apply.

STOP/START behavior:

- Twilio Messaging Service or Advanced Opt-Out can block provider-level sends to opted-out numbers.
- The app webhook also syncs STOP keywords into DynamoDB with `status = unsubscribed`, `opt_out_timestamp`, `opt_out_source`, and `last_opt_out_keyword`.
- START/UNSTOP can reactivate the local record as `pending_verification`; explicit website SMS consent can also resubscribe a previously opted-out phone number.
- Future sending code must suppress any SMS subscriber with `status = unsubscribed` and should also respect Twilio/provider-level opt-out state.

Do not do yet:

- Do not enable `WELCOME_SMS_ENABLED`.
- Do not send test or production SMS.
- Do not create accidental broadcast or bulk-send tooling.
- Do not add Twilio secrets to the repo.
- Do not turn off webhook signature verification for production provider traffic.

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
