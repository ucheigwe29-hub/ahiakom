# Validation evidence

Last validation: 18 November 2026. This is development evidence, not production certification.

| Check | Result |
|---|---|
| TypeScript type checking | Passed |
| Automated tests | 25 passed; 0 failed |
| Next.js production build | Passed |
| Database restart persistence | Passed using disk-backed PGlite in separate processes |
| Desktop storefront | Loaded and visually reviewed |
| Mobile layout | Reviewed at 390px width using the development QA frame |
| Search and cart | Browser checked search, quantity changes, totals and reload persistence |
| Paystack | Adapter tested with mocked responses; no merchant sandbox transaction performed |
| Remote PostgreSQL | Adapter implemented; service integration not executed here |
| Docker and GitHub Actions | Configuration prepared; not executed here |

Tests cover server-calculated prices, minimum profit guards, hashed passwords, multi-seller order creation, stock rollback, concurrent stock contention, request idempotency, duplicate payment events, cancellation, late payments, signature tampering and expiry, role/ownership isolation, supplier onboarding and fulfilment, refund limits, support privacy, reservation expiry, return transitions, settlement eligibility and cost reporting.

API tests invoke route handlers directly. They do not substitute for complete browser automation, accessibility auditing, penetration testing, load testing or a real payment-provider sandbox test. Local PGlite runs PostgreSQL in-process; it does not verify network database behaviour or production connection pooling.

## Reproduce

Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. Tests isolate their database by default. The persistence test creates a disposable directory. To exercise the remote adapter, explicitly set TEST_DATABASE_URL to a disposable local PostgreSQL database whose name ends in `_test`. Never supply production data or credentials. The CI workflow includes this intended PostgreSQL service job, but no CI result is claimed.

The development-only `/qa` route embeds the storefront at mobile width and is unavailable in production. No screenshots or customer data are included in the source archive.
