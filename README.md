# SuppVis Site V2

Next.js App Router site for SuppVis. The repo contains the public marketing and content pages, beta signup collection, subscriber consent persistence, an authenticated admin announcement console, and AWS worker code for queued email and SMS announcement delivery.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS v4 through PostCSS
- Auth.js with Microsoft Entra ID for `/admin`
- Vercel serverless API routes
- AWS DynamoDB for applications, subscribers, campaigns, recipients, and audit logs
- AWS SQS and Lambda for durable campaign delivery workers
- AWS SES for email sending
- Twilio Programmable Messaging SMS for text sending and callbacks

## Local Development

Install dependencies:

```bash
npm install
```

Create local environment values:

```bash
copy .env.example .env.local
```

Run the app:

```bash
npm run dev
```

Production checks:

```bash
npx tsc --noEmit
npm run build
```

Do not commit `.env.local`, real secrets, access keys, Twilio tokens, or recipient data.

## Public Pages

| Route | Purpose |
| --- | --- |
| `/` | Main SuppVis homepage with the beta signup flow. |
| `/about` | Founder and company story. |
| `/how-it-works` | Product workflow and user education page. |
| `/research` | Research landing page backed by the configured public content API. |
| `/research/[canonical_key]` | Dynamic research detail page for a supplement or canonical research key. |
| `/blog` | SuppVis Journal listing. |
| `/blog/[slug]` | Dynamic article page. |
| `/shop` | Curated supplement shop listing backed by the public content API. |
| `/shop/[id]` | Dynamic product detail page. |
| `/partnerships` | Partner and affiliate intake page. |
| `/sources` | Source and evidence notes. |
| `/privacy` | Privacy policy. |
| `/terms` | Terms of service. |
| `/medical-disclaimer` | Medical disclaimer. |
| `/affiliate-disclosure` | Affiliate disclosure. |
| `/unsubscribe` | Email unsubscribe page. |
| `/admin` | Protected admin announcement console. |
| `/admin/sign-in` | Admin sign-in entry page. |

The `/admin` route is intentionally not linked from public navigation. Security is enforced server-side and does not rely on the URL being hidden.

## Public Collection Flows

### Beta Signup

`POST /api/beta-applications`

Collects beta application details from the public site. The route validates input server-side, uses honeypot/rate-limit protections, normalizes email and phone data, writes the beta application, and upserts subscriber records where consent exists.

Behavior:

- Email signup creates or updates an email subscriber record.
- Optional phone input is stored on the beta application when provided.
- SMS subscriber records are created only when the user explicitly checks the SMS consent box.
- SMS consent is informational/customer-care consent, not marketing consent.
- Duplicate beta signups with the same normalized email return a friendly already-signed-up success result instead of creating duplicate applications.

### Email Subscriber Endpoint

`POST /api/email-subscribers`

Creates or reactivates an email subscriber with a deterministic unsubscribe token and consent metadata.

### SMS Subscriber Endpoint

`POST /api/sms-subscribers`

Creates or reactivates an SMS subscriber only after explicit informational consent. Valid consented records may initially use `pending_verification`; this means the user opted in through the website and the record is eligible for customer-care beta announcements unless stopped, invalid, suppressed, or missing required consent.

Email-only signup should not create an eligible SMS subscriber record.

### Unsubscribe

`POST /api/email-subscribers/unsubscribe`

Requires subscriber id and token, conditionally updates the subscriber to `unsubscribed`, and preserves the record for audit/history. Future signups with the same email can resubscribe the record.

### Twilio Webhooks

| Route | Purpose |
| --- | --- |
| `POST /api/webhooks/twilio/sms` | Handles inbound STOP/START style SMS keywords and updates local SMS opt-out state. |
| `POST /api/webhooks/twilio/status` | Handles Twilio delivery callbacks for welcome/admin-test/announcement SMS message types. |

Production Twilio webhooks should use signature verification with `TWILIO_WEBHOOK_SIGNATURE_REQUIRED=true`.

## Admin Announcement Console

The admin console creates one combined beta announcement with both:

- an email draft
- a text draft

Email and text authoring are worked independently, but production approval requires both channels to be saved, previewed, and admin-tested.

### Admin Security

Admin access uses:

- Microsoft Entra ID through Auth.js
- single-tenant issuer configuration
- server-side `ADMIN_ALLOWED_EMAILS`
- protected admin API routes
- no public caching of admin responses
- optimistic version checks on draft mutations
- audit logging for safe admin events
- a six-minute sliding inactivity timeout in the browser tab
- an eight-hour absolute session cap
- manual sign-out
- page refresh/navigation re-entry protection

The browser never controls production recipients, sender identity, arbitrary test email addresses, or production phone numbers.

### Admin Workflow

1. Sign in to `/admin`.
2. Click `New announcement`.
3. Save the email.
4. Generate the email preview.
5. Send one admin email test to yourself.
6. Save the text.
7. Generate the text preview.
8. Send one admin text test to the configured admin test number.
9. Refresh recipient count.
10. Type the generated confirmation phrase, such as `SEND EMAIL TO 3 AND TEXT TO 2`.
11. Click `Approve & send announcement`.
12. The server queues eligible email and SMS recipient jobs; delivery workers continue independently.

The per-channel test controls are grouped by workspace:

- Email: `Save email`, `Generate preview`, `Send test to myself`
- Text: `Save text`, `Generate preview`, `Send test to myself`

Final production sending still requires both email and text authoring/test prerequisites.

### Recipient Rules

Manual recipient refresh queries the current Production subscriber records each time. It applies current eligibility, suppression, opt-out, bounce, complaint, invalid, and deduplication rules. It does not send or queue anything.

Sending rules:

- Announcement content must include both email and text.
- Both previews and both admin tests must be current.
- Email jobs are queued only for eligible email subscribers.
- SMS jobs are queued only for eligible SMS subscribers.
- If one channel has zero eligible recipients, the other channel may still queue if all authoring/test requirements are met and that channel infrastructure is ready.
- If both channels have zero eligible recipients, final sending is blocked.
- The final start route recalculates eligibility before queueing and verifies the confirmation phrase server-side.

### Recent And Sent Announcements

Recent announcements show active unsent work. Sent/queued/completed announcements move to sent history and should not show pin/delete controls.

Recent card channel labels use admin-test wording:

- `Not saved`
- `Saved`
- `Previewed`
- `Test accepted`
- `Test delivered`
- `Test failed`
- `Test stale`

Production history uses delivery wording:

- `Queued`
- `Accepted`
- `Sent`
- `Delivered`
- `Failed`
- `Partially delivered`

## API Routes

### Public API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/beta-applications` | `POST` | Beta application and consent capture. |
| `/api/email-subscribers` | `POST` | Email subscriber upsert/resubscribe. |
| `/api/email-subscribers/unsubscribe` | `POST` | Token-protected email unsubscribe. |
| `/api/sms-subscribers` | `POST` | SMS subscriber consent upsert. |
| `/api/webhooks/twilio/sms` | `POST` | Inbound SMS keyword handling. |
| `/api/webhooks/twilio/status` | `POST` | SMS provider status callbacks. |

### Auth API

| Route | Purpose |
| --- | --- |
| `/api/auth/[...nextauth]` | Auth.js provider callbacks and session handling. |

### Admin API

Every admin route requires an authenticated, allowlisted admin session.

| Route | Purpose |
| --- | --- |
| `/api/admin/session/touch` | Refreshes the sliding admin session while the tab is active. |
| `/api/admin/audience/summary` | Protected safe aggregate live audience summary. |
| `/api/admin/audience/health` | Protected safe audience table/index diagnostics. |
| `/api/admin/broadcast-audit` | Legacy dry-run audit endpoint guarded by token hash. |
| `/api/admin/email-campaigns` | Lists/creates admin announcement drafts. |
| `/api/admin/email-campaigns/[id]` | Loads, patches, archives, and hydrates an announcement. |
| `/api/admin/email-campaigns/preview` | Server-rendered email preview. |
| `/api/admin/email-campaigns/sms-preview` | Server-rendered SMS preview/metadata. |
| `/api/admin/email-campaigns/[id]/test-send` | One-recipient admin email test. |
| `/api/admin/email-campaigns/[id]/sms-test-readiness` | Safe SMS test readiness state for the signed-in admin. |
| `/api/admin/email-campaigns/[id]/sms-test-send` | One-recipient admin SMS test using the server-side admin mapping. |
| `/api/admin/email-campaigns/[id]/audience` | Campaign-bound recipient snapshot. |
| `/api/admin/email-campaigns/[id]/approve` | Approval state transition, retained for compatibility with existing flow. |
| `/api/admin/email-campaigns/[id]/start` | Final approve-and-queue route for production jobs. |
| `/api/admin/email-campaigns/[id]/progress` | Campaign delivery progress summary. |
| `/api/admin/email-campaigns/[id]/pin` | Protected recent-announcement pin/unpin. |

## Email Rendering

Email HTML is rendered server-side from structured fields, not raw admin HTML. The renderer is shared by preview, admin tests, and production subscriber emails.

Branding:

- Public logo asset: `/email/suppvis-logo.png`
- Production URL: `https://www.suppvis.health/email/suppvis-logo.png`
- Alt text: `SuppVis`

Every production subscriber email must include an individualized unsubscribe URL and suppress unsubscribed, bounced, and complained subscribers before send.

## SMS Rendering

Admin and production SMS announcement text uses the same server-side formatter:

```text
SuppVis: [admin-written message]

Msg frequency varies. Msg & data rates may apply.
```

Rules:

- Standard SMS only.
- No RCS sender, RCS profile, rich cards, generated RCS images, or Content API path.
- Use the approved Twilio Messaging Service and sender.
- Prevent duplicated `SuppVis:` prefix and duplicated compliance footer.
- Keep customer-care/informational use case only.
- Do not treat admin test numbers as subscriber consent.

## Delivery Architecture

### Email Announcements

Production email delivery uses:

1. Admin final start route.
2. Server-side audience recalculation.
3. Deterministic per-recipient records in `DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE`.
4. SQS email campaign queue.
5. `suppvis-email-campaign-send-worker` Lambda.
6. SES send through the configured sender/configuration set.
7. SES event processor Lambda updates send/delivery/bounce/complaint/reject state.

Email worker source:

- `aws/lambdas/email-campaign-send-worker/lambda_function.py`

SES event processor source:

- `aws/lambdas/ses-campaign-event-processor/lambda_function.py`

Provisioning script:

- `aws/scripts/provision-email-campaign-worker.sh`

### SMS Announcements

Production SMS delivery uses:

1. Admin final start route.
2. Server-side SMS audience recalculation.
3. Deterministic per-recipient records in `DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE` with `channel = sms`.
4. SQS SMS announcement queue.
5. `suppvis-sms-announcement-send-worker` Lambda.
6. Twilio standard SMS through the approved Messaging Service.
7. Twilio status callback updates campaign-recipient provider state.

SMS worker source:

- `aws/lambdas/sms-announcement-send-worker/lambda_function.py`

Provisioning script:

- `aws/scripts/provision-sms-announcement-worker.sh`

Recommended SMS Messaging Service:

- `TWILIO_MESSAGING_SERVICE_SID=MGa88964d7c8a19058525ba21ca648715e`
- approved sender: `+16507025913`

## DynamoDB Tables And Indexes

Use separate table names for Production, Preview, and Development.

### Tables

| Environment variable | Purpose |
| --- | --- |
| `DYNAMODB_BETA_APPLICATIONS_TABLE` | Public beta application records. |
| `DYNAMODB_EMAIL_SUBSCRIBERS_TABLE` | Email subscriber consent, unsubscribe, bounce, and complaint state. |
| `DYNAMODB_SMS_SUBSCRIBERS_TABLE` | SMS consent, STOP/START, invalid, and provider state. |
| `DYNAMODB_EMAIL_CAMPAIGNS_TABLE` | Admin announcement drafts and campaign state. |
| `DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE` | Per-recipient email/SMS campaign delivery records. |
| `DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE` | Audit-safe admin/broadcast events. |

### Required Indexes

Email campaigns:

- Table: `suppvis-prod-email-campaigns`
- GSI: `record_type-updated_at-index`
- Partition key: `record_type` string
- Sort key: `updated_at` string
- Projection: all attributes

Email subscribers:

- Table: `suppvis-prod-email-subscribers`
- GSI: `status-updated_at-index`
- Partition key: `status` string
- Sort key: `updated_at` string
- Projection: all attributes

SMS subscribers:

- Table: `suppvis-prod-sms-subscribers`
- GSI: `status-updated_at-index`
- Partition key: `status` string
- Sort key: `updated_at` string
- Projection: all attributes

Campaign recipients:

- Table: `suppvis-prod-email-campaign-recipients`
- Partition key: `campaign_id` string
- Sort key: `subscriber_id` string

Recommended table settings:

- on-demand billing
- encryption at rest
- point-in-time recovery for production
- deletion protection for production tables that hold campaign history

## Environment Variables

Use `.env.example` as the source of truth for local shape. Production values live in Vercel and AWS/Lambda configuration, not in the repo.

### Public Content And App URL

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | No | Public content API used by blog, shop, and research pages. |
| `APP_BASE_URL` | No | Canonical app URL for unsubscribe links and absolute email assets. |

### AWS And DynamoDB

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | No | AWS region, normally `us-east-1`. |
| `AWS_ACCESS_KEY_ID` | Yes | Least-privilege app AWS access key for Vercel serverless routes. |
| `AWS_SECRET_ACCESS_KEY` | Yes | Matching AWS secret key. |
| `DYNAMODB_BETA_APPLICATIONS_TABLE` | No | Beta applications table name. |
| `DYNAMODB_EMAIL_SUBSCRIBERS_TABLE` | No | Email subscribers table name. |
| `DYNAMODB_SMS_SUBSCRIBERS_TABLE` | No | SMS subscribers table name. |
| `DYNAMODB_EMAIL_CAMPAIGNS_TABLE` | No | Admin campaigns table name. |
| `DYNAMODB_EMAIL_CAMPAIGN_RECIPIENTS_TABLE` | No | Campaign recipient table name. |
| `DYNAMODB_BROADCAST_AUDIT_LOGS_TABLE` | No | Broadcast/admin audit table name. |

### Admin Auth And Session

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `AUTH_SECRET` | Yes | Auth.js secret. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Yes | Microsoft Entra client ID. |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Yes | Microsoft Entra client secret. |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | No | Single-tenant issuer URL. |
| `ADMIN_ALLOWED_EMAILS` | Yes | Comma-separated allowlisted admin emails. |

### Admin Email Announcements

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `ADMIN_EMAIL_CAMPAIGNS_ENABLED` | No | Master gate for admin campaigns. |
| `ADMIN_EMAIL_TEST_SEND_ENABLED` | No | Enables one-admin email tests. |
| `ADMIN_EMAIL_BULK_SEND_ENABLED` | No | Enables production email campaign queueing. |
| `ADMIN_EMAIL_BULK_SEND_INFRA_READY` | No | Confirms queue/worker/IAM readiness. |
| `ADMIN_EMAIL_CAMPAIGN_QUEUE_URL` | No | SQS URL for email campaign recipient jobs. |

### Admin SMS Announcements

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `ADMIN_SMS_ANNOUNCEMENTS_ENABLED` | No | Master gate for admin SMS announcements. |
| `ADMIN_SMS_TEST_SEND_ENABLED` | No | Enables one-admin SMS tests. |
| `ADMIN_SMS_TEST_RECIPIENTS` | Yes | Server-only `admin@suppvis.health=+1XXXXXXXXXX` mapping. |
| `ADMIN_SMS_BULK_SEND_ENABLED` | No | Enables production SMS campaign queueing. |
| `ADMIN_SMS_BULK_SEND_INFRA_READY` | No | Confirms SMS queue/worker/IAM/Twilio readiness. |
| `ADMIN_SMS_CAMPAIGN_QUEUE_URL` | No | SQS URL for SMS announcement recipient jobs. |

### Email Provider

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `WELCOME_EMAIL_ENABLED` | No | Enables beta signup welcome email path. |
| `UNSUBSCRIBE_CONFIRMATION_EMAIL_ENABLED` | No | Enables unsubscribe confirmation email path. |
| `SES_FROM_EMAIL` | No | Verified sender email, normally `beta@suppvis.health`. |
| `SES_FROM_NAME` | No | Sender display name. |
| `SES_REGION` | No | SES region. |
| `SES_CONFIGURATION_SET` | No | SES configuration set for events/tags. |

### Twilio SMS

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `WELCOME_SMS_ENABLED` | No | Enables beta signup welcome SMS path only. Not used for admin announcements. |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token and webhook verification secret. |
| `TWILIO_MESSAGING_SERVICE_SID` | Yes | Approved Messaging Service SID. |
| `TWILIO_SMS_FROM_NUMBER` | No | Approved sender, recommended `+16507025913`. |
| `TWILIO_WEBHOOK_SIGNATURE_REQUIRED` | No | Require Twilio signatures in production. |
| `TWILIO_STATUS_CALLBACK_URL` | No | Status callback URL, usually `https://www.suppvis.health/api/webhooks/twilio/status`. |

### Optional Protection

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Public Turnstile site key if bot protection is enabled. |
| `TURNSTILE_SECRET_KEY` | Yes | Turnstile server secret. |

### Legacy Dry-Run Audit

| Key | Sensitive | Purpose |
| --- | --- | --- |
| `ADMIN_BROADCAST_TOKEN_HASH` | Yes | SHA-256 hash for `/api/admin/broadcast-audit`. |

## Repository Structure

```text
app/
  admin/                         Protected admin UI and sign-in page.
  api/                           Vercel serverless API routes.
  blog/, research/, shop/         Public dynamic content pages.
  about/, how-it-works/, ...      Public static marketing/legal pages.
  components/                    Shared React UI components.
  hooks/                         Shared client hooks.
  lib/                           Client helpers and server-only business logic.
    server/                      Auth, DynamoDB, validation, email/SMS, queues.
aws/
  lambdas/                       Python Lambda workers for campaign delivery/events.
  scripts/                       Provisioning scripts for AWS queues/workers.
public/
  email/suppvis-logo.png         Email-compatible public logo asset.
  favicon.svg                    Site favicon/source logo.
  images/                        Public image assets.
types/                           Shared TypeScript declarations.
auth.ts                          Auth.js configuration entry.
next.config.mjs                  Next.js configuration.
package.json                     npm scripts and dependencies.
```

Some legacy static HTML files remain in `public/` for reference or backwards compatibility. The App Router pages under `app/` are the primary site implementation.

## Common Actions

### Local

```bash
npm install
npm run dev
npx tsc --noEmit
npm run build
```

### Deploy

Normal deployment is Git/Vercel driven:

- push `main` for Production
- push `andrew` or another non-production branch for Preview

### Provision Email Worker

```bash
bash aws/scripts/provision-email-campaign-worker.sh
```

Use from AWS CloudShell or another environment with AWS CLI access and the required environment variables. Do not run it from a personal machine unless AWS credentials and secrets are handled securely.

### Provision SMS Worker

```bash
bash aws/scripts/provision-sms-announcement-worker.sh
```

Use from AWS CloudShell or another secure AWS CLI environment. The script creates or updates the SMS announcement queue, DLQ, worker Lambda, and related least-privilege permissions. It does not send SMS.

## Security And Privacy Rules

- Never commit secrets or subscriber data.
- Do not expose raw email addresses, phone numbers, unsubscribe tokens, Twilio tokens, AWS keys, or recipient lists in browser responses or logs.
- Admin identity comes from Auth.js/Microsoft Entra, not client input.
- Production recipients are always derived server-side from DynamoDB consent records.
- Admin SMS test destinations are derived from `ADMIN_SMS_TEST_RECIPIENTS`, not browser input.
- Every production send must be idempotent and recipient-tracked.
- Email sends must suppress unsubscribed, bounced, and complained records.
- SMS sends must suppress STOP/opt-out, invalid, suppressed, and non-consented records.
- RCS is not part of the production path. Use standard Twilio SMS through the approved Messaging Service.

## Operational Notes

- `pending_verification` SMS records are explicitly opted-in customer-care beta SMS records that have not been renamed/migrated to a later status. They are eligible for beta announcements when informational consent is true and no STOP/invalid/suppression state exists.
- Manual audience refresh is required before every production announcement send.
- Automatic live audience snapshot in `/admin` is informational and does not authorize sending.
- A successful final action queues work; it does not mean messages were delivered.
- Workers and provider callbacks update delivery history asynchronously.
- `tsconfig.tsbuildinfo`, `.next/`, `out/`, and local env files are generated/local artifacts and should not be treated as source changes.
