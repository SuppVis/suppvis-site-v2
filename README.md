# SuppVis Site V2

Next.js marketing site for SuppVis.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- npm
- Tailwind CSS v4 via PostCSS
- Vercel serverless API routes
- Auth.js with Microsoft Entra ID for the future admin console
- AWS SDK v3 for DynamoDB persistence and disabled future SES email sending

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
- `POST /api/webhooks/twilio/status`

These routes validate input server-side, use honeypot fields, apply basic in-memory rate limiting, and return safe user-facing errors. Email and SMS sender paths are gated by explicit environment flags.

The beta waitlist form collects first name, last name, email, and an optional phone number. SMS consent is a separate optional checkbox, unchecked by default, and is not required to join the beta waitlist. A phone number is stored on the beta application when provided, but an SMS subscriber record is created only when the user explicitly opts into texts. Repeated beta signups with the same normalized email return a friendly already-signed-up success response instead of creating a second beta application.

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
- `DYNAMODB_EMAIL_CAMPAIGNS_TABLE`
- `DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE`
- `DYNAMODB_SMS_SUBSCRIBERS_TABLE`
- `DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE`

Admin dry-run audit:

- `ADMIN_BROADCAST_TOKEN_HASH`

Admin console auth:

- `AUTH_SECRET` - Auth.js secret used to encrypt session tokens. Generate with `npx auth secret`.
- `AUTH_MICROSOFT_ENTRA_ID_ID` - Microsoft Entra app registration client ID.
- `AUTH_MICROSOFT_ENTRA_ID_SECRET` - Microsoft Entra app registration client secret.
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER` - single-tenant issuer, `https://login.microsoftonline.com/<tenant-id>/v2.0`.
- `ADMIN_ALLOWED_EMAILS` - comma-separated `@suppvis.health` admin emails allowed into `/admin`.
- `ADMIN_EMAIL_CAMPAIGNS_ENABLED` - keep `false` until campaign persistence is approved.
- `ADMIN_EMAIL_TEST_SEND_ENABLED` - keep `false` until one-recipient test sending is approved.
- `ADMIN_EMAIL_BULK_SEND_ENABLED` - keep `false` until queued batch sending and audit controls are approved.
- `ADMIN_EMAIL_BULK_SEND_INFRA_READY` - extra default-off readiness gate for subscriber campaign queueing; keep `false` until the queue, worker, IAM, and live tests are explicitly approved.
- `ADMIN_EMAIL_CAMPAIGN_QUEUE_URL` - SQS queue URL used only after the readiness gate is enabled.

Welcome templates:

- `WELCOME_EMAIL_ENABLED` - enables first-time welcome and beta resubscribe emails from the beta signup route; keep `false` unless an approved send test or production rollout is active.
- `UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED` - optional unsubscribe confirmation email; keep `false` unless explicitly approved.
- `WELCOME_SMS_ENABLED` - keep `false` until STOP/UNSUBSCRIBE handling and an SMS provider are configured.
- `SES_FROM_EMAIL` - future verified sender, recommended `beta@suppvis.health`.
- `SES_FROM_NAME` - display name for the sender, recommended `SuppVis Beta Testers`.
- `SES_REGION` - future SES region, recommended `us-east-1`.
- `SES_CONFIGURATION_SET` - future SES event configuration set, currently `suppvis-welcome`.

Twilio SMS configuration:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_WEBHOOK_SIGNATURE_REQUIRED` - keep `false` for local testing; production webhooks should require signatures before provider traffic is connected.
- `TWILIO_STATUS_CALLBACK_URL` - recommended `https://www.suppvis.health/api/webhooks/twilio/status`.

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
- `suppvis-prod-email-campaigns`
- `suppvis-prod-email-campaign-recipients`
- `suppvis-prod-sms-subscribers`
- `suppvis-prod-broadcast-audit-logs`

The current code writes these record shapes:

- Beta applications: `id`, `first_name`, `last_name`, `email`, `normalized_email`, optional `phone_raw`, optional `phone_e164`, `sms_opt_in`, `legacy_sms_consent`, `sms_informational_consent`, `sms_marketing_consent`, `sms_consent_version`, `status`, `source_page`, `created_at`, `updated_at`
- Email subscribers: `id`, `email`, `normalized_email`, `status`, `consent_timestamp`, `consent_source`, `created_at`, `updated_at`, `unsubscribe_token`, optional `unsubscribed_at`, optional `unsubscribe_source`, optional `resubscribed_at`
- Email campaigns: `id`, `record_type`, `message_type`, `subject`, `heading`, `body`, optional `cta_label`, optional `cta_url`, `status`, `created_by`, `updated_by`, `created_at`, `updated_at`, `version`, nullable `tested_at`, nullable `approved_at`, nullable `sent_at`, nullable `test_recipient`, optional `test_message_id`, optional approval/queue timestamps, soft-delete fields, and aggregate send counters
- Email campaign recipients: `campaign_id`, `subscriber_id`, `record_type`, `status`, `eligibility_decision`, optional `skip_reason`, optional `ses_message_id`, queue/send/delivery/failure timestamps, `retry_count`, optional safe failure classification, `created_at`, `updated_at`
- SMS subscribers: `id`, `phone_number_raw`, `phone_number_e164`, `status`, `sms_informational_consent`, `sms_informational_consent_at`, `sms_marketing_consent`, `sms_marketing_consent_at`, `sms_consent_timestamp`, `sms_consent_source`, `sms_consent_version`, `sms_global_opt_out`, `sms_global_opt_out_at`, `opt_out_timestamp`, optional `opt_out_source`, optional `last_opt_out_keyword`, optional `resubscribed_at`, optional SMS send/status tracking fields, `created_at`, `updated_at`
- Broadcast audit logs: `id`, `admin_identifier`, `channel`, `message_preview`, `intended_audience`, optional `target_count`, `dry_run`, `status`, `created_at`

Email campaign table settings:

- Table name: `suppvis-prod-email-campaigns`
- Partition key: `id` string
- Billing mode: on-demand
- Encryption: AWS-managed encryption at rest
- Point-in-time recovery: recommended for production
- GSI name: `record_type-updated_at-index`
- GSI partition key: `record_type` string
- GSI sort key: `updated_at` string
- GSI projection: all attributes

Email campaign recipient table settings:

- Table name: `suppvis-prod-email-campaign-recipients`
- Partition key: `campaign_id` string
- Sort key: `subscriber_id` string
- Billing mode: on-demand
- Encryption: AWS-managed encryption at rest
- Point-in-time recovery: enabled for production
- Deletion protection: enabled for production

Email subscriber campaign index:

- Existing table: `suppvis-prod-email-subscribers`
- GSI name: `status-updated_at-index`
- GSI partition key: `status` string
- GSI sort key: `updated_at` string
- GSI projection: all attributes

## Welcome Message Templates

Welcome email and SMS copy lives in `app/lib/server/messages/welcome.ts`. The disabled, server-only SES helper lives in `app/lib/server/email/welcome.ts`.

The beta signup route can call the SES helper, but only after storage succeeds and only when `WELCOME_EMAIL_ENABLED=true`. First-time beta signups send the `beta_signup_welcome` variant with `message_type=welcome_beta`. Explicit beta-form resubscribes after an unsubscribe send the `beta_resubscribe` variant with `message_type=beta_resubscribe`. Ordinary duplicate beta signups while already subscribed do not send another email.

The unsubscribe route can optionally send a one-time `beta_unsubscribe_confirmation` email after a successful unsubscribe, but only when `UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED=true`. That confirmation uses `message_type=beta_unsubscribe_confirmation` and should remain disabled unless explicitly approved.

The `founder_contact_outreach` template exists for later contact-list/founder outreach use only. It is not connected to a public route or bulk sender.

Real welcome sends must remain disabled until:

- Email unsubscribe suppression is wired into the future sending pipeline.
- SMS STOP/UNSUBSCRIBE suppression is wired into the future sending pipeline.
- A sending provider is configured and approved.
- The `WELCOME_EMAIL_ENABLED` or `WELCOME_SMS_ENABLED` flags are explicitly enabled.

Do not enable bulk sends or broadcast sends from these helpers. They are one-recipient transactional paths only.

## Admin Email Campaign Console

The `/admin` route is intentionally not linked from public navigation, but hidden URLs are not a security boundary. Admin access is enforced by:

- Microsoft Entra ID login through Auth.js.
- A single-tenant Microsoft Entra issuer for the SuppVis Microsoft 365 tenant.
- A server-side `ADMIN_ALLOWED_EMAILS` allowlist.
- Server-side authorization checks on the admin page.
- Disabled send flags until each sending phase is approved.

The current admin console supports campaign draft persistence, recent draft loading, server-rendered HTML/plain-text previews, one-recipient admin test sends, approval, recipient counting, draft archiving, and a queued production-send route that remains blocked unless `ADMIN_EMAIL_BULK_SEND_INFRA_READY=true`.

Recommended Microsoft Entra setup:

1. Create named Microsoft 365 accounts for every admin. Do not use shared accounts.
2. Require MFA for those accounts in Microsoft 365.
3. In Microsoft Entra admin center, create an App Registration for the SuppVis admin console.
4. Use a single-tenant registration.
5. Add the redirect URI `https://www.suppvis.health/api/auth/callback/microsoft-entra-id`.
6. For local testing, optionally add `http://localhost:3000/api/auth/callback/microsoft-entra-id`.
7. Add the app registration values to Vercel as sensitive Production env vars.
8. Put only named admin emails in `ADMIN_ALLOWED_EMAILS`.

Queued production campaign sending uses:

1. The admin API to approve a tested campaign and calculate the eligible audience count server-side.
2. A typed confirmation phrase, such as `SEND TO 123 SUBSCRIBERS`.
3. A per-recipient DynamoDB tracking record in `suppvis-prod-email-campaign-recipients`.
4. One SQS message per eligible recipient.
5. `suppvis-email-campaign-send-worker` Lambda to re-check subscriber eligibility immediately before sending through SES.
6. SES tags with `campaign_id`, `subscriber_id`, and `message_type=admin_campaign`.
7. `suppvis-ses-campaign-event-processor` Lambda to record SEND, DELIVERY, DELIVERY_DELAY, BOUNCE, COMPLAINT, and REJECT events on campaign-recipient records.

`ADMIN_EMAIL_BULK_SEND_ENABLED=true` is not enough by itself. Subscriber campaign queueing also requires `ADMIN_EMAIL_BULK_SEND_INFRA_READY=true` and a configured `ADMIN_EMAIL_CAMPAIGN_QUEUE_URL`.

Every campaign send must suppress `unsubscribed`, `bounced`, and `complained` email subscribers and must include an unsubscribe link.

Campaign draft APIs deliberately accept only structured fields (`messageType`, `subject`, `heading`, `body`, optional link text/URL), render email HTML server-side, reject raw HTML, and use optimistic `version` checks to avoid silent overwrites.

## Unsubscribe And SMS Opt-Out Foundation

Email unsubscribe support is provider-ready. The unsubscribe-confirmation sender path exists but stays disabled unless `UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED=true`:

- Future emails should link to `/unsubscribe?subscriber=<email_subscriber_id>&token=<unsubscribe_token>`.
- The API route conditionally updates the matching email subscriber record to `status = unsubscribed`, sets `unsubscribed_at`, and keeps the record for audit/history.
- Token-only lookup is intentionally not used because it would require a GSI or token lookup table. Passing the deterministic subscriber id plus token avoids production scans.
- A later signup with the same email sets `status = subscribed` again and records `resubscribed_at` when the previous record was unsubscribed.

SMS opt-out support is provider-ready:

- `POST /api/webhooks/twilio/sms` accepts Twilio-style inbound SMS form payloads.
- `POST /api/webhooks/twilio/status` accepts Twilio-style SMS status callbacks when outbound SMS is enabled later.
- STOP keywords are `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, and `QUIT`.
- START keywords are `START` and `UNSTOP`.
- STOP updates the deterministic phone-based SMS subscriber record to `status = unsubscribed`, sets `opt_out_timestamp`, `opt_out_source`, and `last_opt_out_keyword`, and keeps the record.
- START or explicit website SMS consent can reactivate a locally unsubscribed phone record as `pending_verification` and set `resubscribed_at`.
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
- Set `SES_FROM_EMAIL=beta@suppvis.health`, `SES_FROM_NAME=SuppVis Beta Testers`, `SES_REGION=us-east-1`, `SES_CONFIGURATION_SET=suppvis-welcome`, and `APP_BASE_URL=https://www.suppvis.health`.
- Include the unsubscribe link in every email and suppress subscribers with `status = unsubscribed` before sending.
- Add least-privilege SES IAM permissions only after explicit approval. The future app principal should only need `ses:SendEmail` and/or `ses:SendRawEmail` scoped to the verified identity and optional configuration set.

Future bounce/complaint handling:

- Use the `suppvis-welcome` SES configuration set for welcome emails.
- Route bounce, complaint, and reject events to SNS, EventBridge, or another approved event processor.
- Update `email_subscribers.status` to `bounced` or `complained` when those events occur.
- Suppress sends for `unsubscribed`, `bounced`, and `complained` records.

Do not do yet:

- Do not enable `WELCOME_EMAIL_ENABLED`.
- Do not send test or production email.
- Do not request SES production access until domain authentication and bounce/complaint handling are planned.
- Do not use a personal Gmail address for production sending.

## Future Twilio SMS Setup

Use a Twilio Messaging Service for beta SMS confirmation messages and STOP/START handling. Keep `WELCOME_SMS_ENABLED=false` until compliance, webhook signing, and an explicitly approved internal test are ready.

Recommended setup:

- Create or use a Twilio account owned by SuppVis.
- Create a Messaging Service for SuppVis beta/waitlist messages.
- Register the current beta SMS program as `CUSTOMER_CARE` or the closest Twilio customer-care/account-notification use case available. The public form currently collects one optional, unchecked SMS consent for beta access, onboarding, account status, requested support, and service-related notifications only. Do not include marketing, promotional offers, general company news, discounts, or sales messages in this campaign.
- Complete required brand/campaign or toll-free verification before real sends.
- Configure the inbound message webhook on the Messaging Service:
  - URL: `https://www.suppvis.health/api/webhooks/twilio/sms`
  - Method: `POST`
- Configure the status callback on outgoing messages:
  - URL: `https://www.suppvis.health/api/webhooks/twilio/status`
  - Method: `POST`
- Require Twilio webhook signature verification in production.

Future Twilio environment variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_WEBHOOK_SIGNATURE_REQUIRED=true`
- `TWILIO_STATUS_CALLBACK_URL=https://www.suppvis.health/api/webhooks/twilio/status`
- `WELCOME_SMS_ENABLED=false`

Do not add `SMS_TEST_RECIPIENT_ALLOWLIST`. SMS eligibility comes from DynamoDB `sms_subscribers` consent/status fields and the global `WELCOME_SMS_ENABLED` kill switch.

Compliance information likely needed:

- Legal business name and contact details.
- Website URL: `https://www.suppvis.health`.
- Message use case: recurring customer care and account-related beta messages for users who explicitly opt in.
- Sample messages for beta access, onboarding, account status, requested support, and service-related notifications, including STOP/HELP language.
- Opt-in flow description: website beta form with optional phone field and one separate optional SMS consent checkbox, unchecked by default.
- Opt-out flow description: users can reply STOP; app syncs opt-out state into DynamoDB.
- Privacy policy and terms URLs.

SMS beta/account consent checkbox copy:

> I agree to receive recurring customer care and account-related text messages from SuppVis about my beta waitlist status, beta access instructions, onboarding assistance, account status updates, requested support responses, and service-related notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is optional and is not required to join the SuppVis beta waitlist, create an account, or use SuppVis services. See our Terms of Service and Privacy Policy.

Marketing/news SMS is intentionally not part of the current beta SMS campaign. Add a separate public consent flow and campaign later before sending SuppVis news, promotional offers, discounts, sales messages, or broader marketing updates by SMS.

Prepared SMS confirmation copy:

- Beta/account confirmation: `SuppVis: You're opted in to recurring beta access and account-related texts, including waitlist status, onboarding, service notices, and support updates. Msg frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to opt out.`

Twilio campaign notes:

- Select only website/web form as the opt-in method unless another method is truly implemented.
- Leave opt-in keywords blank unless keyword enrollment is actually supported.
- Use embedded links = yes if sample messages include `https://www.suppvis.health`.
- Use phone numbers in message content = no.
- Use direct lending = no.
- Use age-gated content = no.

STOP/START behavior:

- Twilio Messaging Service or Advanced Opt-Out can block provider-level sends to opted-out numbers.
- The app webhook also syncs STOP keywords into DynamoDB with `status = unsubscribed`, `opt_out_timestamp`, `opt_out_source`, and `last_opt_out_keyword`.
- START/UNSTOP can clear the local global opt-out state as `pending_verification`, but it does not invent consent without an existing subscriber record.
- Explicit website SMS consent can resubscribe a previously opted-out phone number for the beta/account SMS program.
- Future sending code must suppress any SMS subscriber with `status = unsubscribed`, `status = opt_out_provider`, or `sms_global_opt_out = true`.
- Beta/account sends must only select records with `sms_informational_consent = true`.
- Do not use `sms_marketing_consent` for the current beta SMS campaign.

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
