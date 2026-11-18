# Ahiakom — working marketplace development build

**One Market. Endless Possibilities.**

This repository contains a runnable Next.js/TypeScript marketplace with persistent PostgreSQL-compatible storage, customer accounts, supplier onboarding, inventory, server-priced orders, simulated payment and fulfilment workflows, administration and a Paystack **test-only** adapter. It is an initial development release, not a production-ready or commercially connected marketplace.

## Start locally

Requirements: Node.js 24 LTS, npm, and a modern browser. PostgreSQL is optional for local development.

```bash
npm ci
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Registration is available in **Sign in / Register**. Use fictitious information. No default admin password or backdoor is shipped. The local database is persisted under `.data/ahiakom` and must have only one application process accessing it. Do not run seed, migrations or maintenance in a separate process while a PGlite application process is running.

The CLI database commands use process environment values, not Next.js `.env.local`. Defaults work locally. For a custom database, export the relevant variables before running CLI commands. Node also supports loading a file explicitly:

```bash
node --env-file=.env.local --import tsx scripts/migrate.ts
```

The app uses the exact `APP_ORIGIN` to protect state-changing requests. If your port or hostname changes, update `APP_ORIGIN` to match your browser origin exactly. The managed development preview adapts its supplied port through `scripts/dev.mjs`.

## Create an administrator

Stop the local application first if using PGlite. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` securely in your terminal environment, then run:

```bash
npm run admin:create
```

The password must contain at least 12 characters. Do not put passwords in shell history, source control or a support conversation. Restart the app, sign in with that account, then choose **My Account → Administration**. The command only creates a new account; it does not promote existing accounts. A separate customer account is needed to test supplier applications.

## Demonstration walkthrough

1. Browse the sample catalogue, search, sort, filter and open product details.
2. Add products from Circuit House and Everyday Living to the cart. These are fictional demonstration sellers.
3. Register a customer account, open the cart and complete the test delivery form.
4. Review the server-created order and select **Simulate successful payment**. No payment provider is called and no money moves.
5. Open **My Account → My orders** to inspect the single order and separate seller fulfilments.
6. From a separate customer account, apply to become a supplier. An admin approves it in the Suppliers tab. Add products or CSV rows and update available inventory.
7. Place an order for that supplier's product. The supplier can accept it, add a tracking reference and mark it delivered. Skipping states is rejected.
8. The administrator can process dispatch jobs, review costs, respond to support tickets, manage pricing/categories, inspect audits and simulate settlement of eligible delivered orders.
9. Customers can cancel unpaid orders, request a refund after successful test payment and request a return after delivery. Administrators review returns and process **simulated** refunds.

Seeded vendors have no login accounts and exist only for customer browsing tests. Use supplier registration to test a vendor with a real local account.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

Tests use an isolated PostgreSQL engine plus a disposable disk-persistence fixture and do not alter the development database. An explicit TEST_DATABASE_URL enables a disposable local PostgreSQL integration run. Build does not require database credentials. See `docs/TESTING.md` for evidence and limitations.

## Paystack test mode

Set `PAYMENT_MODE=paystack`, `ENABLE_DEMO_PAYMENTS=false`, and supply `PAYSTACK_SECRET_KEY=sk_test_...` through your environment/secret manager. Do not share the key in chat. Configure `APP_ORIGIN` and a reachable HTTPS webhook endpoint at `/api/payments/webhook`. Set `PAYSTACK_WEBHOOK_SECRET` if using the modern signature scheme. Restart the application and create a **new** order: existing simulated orders retain their provider.

The server initializes checkout and verifies transactions. A browser return never marks an order paid. The order page provides **Verify payment** and the admin can reconcile a stored reference. Live secret keys are intentionally rejected. No live payment credentials are requested or included. Provider refunds, payouts and split settlement are not enabled; simulated refunds and a simulated settlement ledger are available.

## PostgreSQL deployment preparation

Set `DATABASE_DRIVER=postgres` and `DATABASE_URL` to a PostgreSQL connection string configured with your host's required TLS verification. Never disable certificate validation. Export them before running `npm run db:migrate`. Do not seed demo products into a live catalogue.

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

A deployment needs approval and the launch gates in `docs/DEPLOYMENT.md`; the commands above are preparation instructions, not evidence of a deployment. This build requires a Node.js runtime. It is not a Cloudflare Worker bundle and cannot be deployed to Worker hosting unchanged.

## Documents

- `docs/ARCHITECTURE.md` — architecture, schema, permissions and transaction boundaries
- `docs/DESIGN_SYSTEM.md` — brand palette, UI components and responsive behavior
- `docs/INTEGRATIONS.md` — official API research, access requirements and limitations
- `docs/DEPLOYMENT.md` — environment, operations, backup and release procedures
- `docs/TESTING.md` — actual test evidence and verification limits
- `docs/BUDGET_ROADMAP.md` — planning estimate, business approvals and expansion sequence
- `docs/STATUS.md` — implemented, simulated, blocked and outstanding scope

## Source layout

| Path                               | Responsibility                                                      |
| ---------------------------------- | ------------------------------------------------------------------- |
| `app/page.tsx`, `app/layout.tsx`   | Application entry and metadata                                      |
| `components/storefront.tsx`        | Customer browsing, account, cart and checkout interface             |
| `components/dashboard.tsx`         | Supplier and administrator workspaces                               |
| `components/support.tsx`           | Customer support requests and replies                               |
| `app/api/[...path]/route.ts`       | Validated HTTP endpoints and role enforcement                       |
| `lib/auth.ts`                      | Passwords, opaque sessions, origin checks, rate limits              |
| `lib/catalog.ts`, `lib/pricing.ts` | Catalogue projection and price/margin rules                         |
| `lib/orders.ts`                    | Stock reservations, checkout, payment confirmation and cancellation |
| `lib/paystack.ts`                  | Test-only Paystack API and webhook verification                     |
| `lib/connectors.ts`                | Direct/simulated supplier adapters and dispatch queue               |
| `lib/operations.ts`                | Expiry, finance and simulated settlement                            |
| `db/schema.sql`                    | Idempotent development schema migration                             |
| `scripts/`                         | Seed, migrate, admin bootstrap and maintenance tools                |
| `tests/`                           | Domain and HTTP-handler integration tests                           |
| `public/products/`                 | Small original SVG demonstration illustrations                      |

The sample wordmark and illustrations are development assets, not trademark clearance or evidence of product-image rights for real merchants.
