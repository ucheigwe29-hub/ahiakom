# Deployment and operations guide

## Release status

This is a local development release. No public production deployment, live payment, domain registration or supplier API connection has been performed. Use a reviewed Node.js hosting environment; this project is not packaged for a Worker runtime. Keep any staging environment access-restricted.

## Configuration

| Variable                    | Purpose                                                                    | Required / default                                |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| DATABASE_DRIVER             | `pglite` for local development, `postgres` for a server database           | Local default: PGlite                             |
| DATABASE_PATH               | PGlite directory                                                           | `.data/ahiakom`                                   |
| DATABASE_URL                | PostgreSQL URI with the provider's TLS requirements                        | Required for `postgres`; secret                   |
| APP_ORIGIN                  | Exact browser scheme/host/port for write-origin checks and payment returns | Set explicitly in every environment               |
| PAYMENT_MODE                | `simulated` or `paystack`                                                  | Local default: simulated                          |
| ENABLE_DEMO_PAYMENTS        | Explicit simulated-payment/settlement switch                               | `true` only in a test environment                 |
| PAYSTACK_SECRET_KEY         | Paystack **test** secret key                                               | Only `sk_test_` keys accepted                     |
| PAYSTACK_WEBHOOK_SECRET     | Modern webhook signing secret                                              | Required when provider emits the modern signature |
| ADMIN_EMAIL, ADMIN_PASSWORD | One-time admin bootstrap inputs                                            | Never persist in application config/source        |
| ALLOW_LOCAL_DB              | Explicit override for a local production-build smoke run                   | Do not use for real production                    |

`.env.local` is ignored and is not part of the delivered source archive. `.env.example` contains no credentials. Next.js loads environment files; standalone scripts use exported environment variables or Node's `--env-file` option. Do not run two PGlite processes against one directory.

## Database lifecycle

Local setup: stop any running app, run `npm run db:seed`, then `npm run dev`. The seed is additive/idempotent and does not reset stock or accounts. Use a separate directory for independent test datasets.

PostgreSQL staging: provision an access-controlled database; export configuration; run `npm run db:migrate`; then create an admin securely. Seed only a designated demonstration environment. The schema currently uses idempotent SQL for an initial development baseline. Before team/production deployments, introduce ordered migration files, a schema version table and a migration lock, and test forward/rollback strategies.

Never migrate the production database from an unreviewed developer machine. Use a controlled release job with least-privilege credentials and a prior backup. Application credentials should not own unrestricted server-level permissions.

## Build and run

```bash
npm ci
npm run typecheck
npm test
npm run build
npm start
```

Use a trusted HTTPS reverse proxy. Set `APP_ORIGIN` to the external HTTPS origin. Secure cookies follow that configured origin. Limit inbound body sizes at the proxy and enforce trusted-client/IP rate limits there. The app's per-account limits alone do not prevent distributed credential stuffing.

Supply PostgreSQL TLS settings according to the provider, with certificate validation enabled. Set connection pool limits to fit the database and number of application replicas. Add health and readiness monitoring for `/api/health`; a healthy response is not proof of correct payment or supplier operations.

## Jobs

With PostgreSQL, configure an approved scheduler to run `npm run maintenance` at a suitable interval, initially every minute. The command releases unpaid orders older than 30 minutes and processes a bounded outbox batch. It is implemented but **not scheduled** in this workspace. The admin can also run the corresponding operations manually.

For PGlite development, use the administrator's HTTP actions while the app is running, or stop the app before executing a CLI process. This prevents multiple writers against the embedded database directory.

Before real integrations: add durable leases, dead-letter management, observability and provider timeout/retry classification. Do not hold SQL transactions open around slow third-party network calls.

## Payment operations

1. Obtain approved merchant test credentials through the provider; store them in a secret manager.
2. Set test mode, disable simulation, configure an HTTPS webhook and its signing secret.
3. Create a fresh test order and complete the provider's test checkout.
4. Validate successful, failed, abandoned, duplicate, late and mismatched payment scenarios.
5. Compare stored references, amount/currency, provider transaction IDs and fees with the provider dashboard.
6. Implement and test provider refund events, chargebacks, payout matching and settlement recovery before live operation.
7. Remove the deliberate test-only key guard only in a separately reviewed release after explicit live-payment approval.

Never treat a successful browser redirect as payment confirmation. Never retry an uncertain provider-side refund or payout blindly. Reconcile the original provider reference first.

## Supplier and finance operations

Review business registration and required identity documents through an approved secure process. The current portal stores only a reference and manual approval state. It does not validate CAC records or identity documents.

Inventory is **available-to-sell quantity**, after reservations, not total physical stock. Train vendors not to overwrite it with a physical count that includes reserved goods. Product price updates recalculate availability at the next checkout; existing order snapshots remain fixed and require contractual vendor acceptance.

Handle rejected/failed fulfilments through the exception list. Arrange refund, replacement or customer communication explicitly. Returned goods must be inspected before manual restocking. Any open refund/return holds settlement; a return or refund after an earlier settlement requires supplier recovery accounting. Current settlement records are simulations, not bank payout evidence.

Finance reports are contribution estimates until actual delivery/tax/other costs are reviewed. They do not replace general-ledger accounting, audited profit, VAT returns or provider payout statements.

## Backup and recovery

Proposed pilot targets for business approval: recovery point ≤24 hours and recovery time ≤4 hours. Prefer managed PostgreSQL point-in-time recovery and encrypted daily logical backups in a separate controlled location. Retain according to an approved privacy/records policy. Back up media metadata and object versions separately.

For local PGlite, stop the app and copy the entire database directory for a consistent development backup. Never hot-copy selected internal database files. For PostgreSQL, use the provider's backup tools or a version-matched `pg_dump` job; keep credentials outside command-line arguments and logs.

Run a restore drill into an isolated database before launch. Verify user/order/item counts, foreign keys, payment uniqueness, open fulfilments and ledger totals. Restore tests have not been performed against a managed PostgreSQL service in this workspace.

## Monitoring and incident handling

Alert on verification failures, mismatched amounts, late paid orders, stale reservations, failed dispatches, delayed fulfilments, refund/payout exceptions, database capacity and elevated 5xx errors. Redact credentials, tokens, card data and personal addresses from logs. Define on-call ownership and a customer communication plan.

Rotate a compromised key; revoke sessions if needed; disable affected operations; preserve audit evidence; reconcile money and supplier state before re-enabling traffic. Apply applicable breach-reporting obligations with qualified legal/privacy support.

## Required launch gates

- Explicit business approval for production/public deployment and live payments.
- Approved legal entity, merchant-of-record model, supplier terms, domain and brand clearance.
- Current Nigerian tax/consumer/data-protection review and final policy/contact pages.
- PostgreSQL integration/concurrency/migration tests, real-device accessibility checks and a successful restore drill.
- Email verification, password recovery, privileged MFA and operational session management.
- Secure product media uploads, validation, rights review and object storage.
- Real delivery quotes/tracking, fulfilment SLAs and staffed customer support.
- Actual Paystack sandbox execution including refund/chargeback/settlement failure paths.
- Monitoring, durable webhook processing, scheduled jobs and reconciliation ownership.
- Penetration/load testing and an approved remediation list.

## Rollback

Deploy immutable builds. Keep a verified previous application image and compatible database migrations. Roll back code only when the schema remains compatible. Never restore a database over new paid orders as a routine release rollback: that can lose financial events. Stop writes, preserve current records and reconcile with the payment provider before any exceptional data restore.
