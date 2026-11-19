# Implementation status and outstanding scope

## Implemented and runnable

- Next.js/React/TypeScript application with emerald/gold responsive homepage and navigation.
- Sample catalogue, search, sorting, price/availability/category filters and pagination.
- Product detail, independent SKU variants, guest and account cart/wishlist.
- Customer registration/login/logout, password hashing and database sessions.
- Supplier application, manual approval/suspension, product entry, simple CSV import and inventory updates.
- Persistent PostgreSQL-compatible local backend; parameterized remote PostgreSQL adapter.
- Server-side price/commission rules, estimated margin protection and immutable order snapshots.
- Stock reservation, multi-seller fulfilments, cancellation, processing/shipping/delivery tracking and failure states.
- Simulated payment confirmation, partial/full refund processing, return review and simulated supplier settlement.
- Paystack test initialization/verification and authenticated webhook code, tested with fixtures.
- Admin pricing/categories, approval, operations, finance/cost review, refunds/returns, support and audit screens.
- Customer support tickets and in-portal replies.
- Reservation expiry command, dispatch queue retries and manual administrator controls.
- PWA manifest, app symbol and public-illustration cache.
- Automated tests, production compilation, setup/deployment documents and budget/roadmap.

## Explicitly simulated

All catalogue stock/prices/sellers are demonstration data. Payment simulation, supplier connector dispatch and settlement records move no money and create no external shipment. Seeded sellers are fictional. Shipping is a flat test estimate. Seeded listings use illustrations. Approved sellers can upload a product photo and edit their own listings. The pilot stores compressed WebP images in PostgreSQL.

## Implemented adapters not externally verified

The Paystack test adapter requires merchant test credentials and a reachable HTTPS callback/webhook. No actual provider sandbox payment was made. The PostgreSQL network adapter requires a provisioned database and deployment-level integration tests. Browser/device coverage is limited to desktop and a 390px development viewport.

## Required external inputs

Merchant approval and Paystack test credentials; PostgreSQL hosting; secure media storage; email/SMS provider; contracted vendors; courier/delivery arrangements; finalized legal entity, tax treatment and customer policies. Jumia, Amazon, AliExpress and Shopify each need appropriate account/app access and explicit commercial permissions for the intended model.

## Remaining engineering before production

- Real payment-provider refunds, chargeback events, payouts, split payments and settlement reconciliation.
- Durable asynchronous webhook inbox and real-connector retry/idempotency strategies.
- Secure object-storage uploads, media moderation and multi-image product galleries.
- Verified email, password recovery, MFA and session-management UX.
- Real delivery quote/tax services, stock-sync freshness and supplier cancellation APIs.
- Structured variant option matrices, CSV quoting support, SKU identifiers and richer product specifications.
- Backend product review/moderation workflow, banner scheduling, customer-management tooling and fully granular admin permissions.
- Persistent review/rating system, price-history validation for promotional claims and production search indexing.
- Complete support conversation history/attachments and email/SMS notifications.
- Detailed supplier recovery accounting after settlement, return-item allocation and general-ledger exports.
- Versioned migrations, distributed job leases, edge rate limits, monitoring, backup restore validation, privacy deletion/export and security/load/device testing.

Some admin screens expose read-only financial data to the support role in this development model. Review and narrow operational roles before real personal/financial data is introduced.

## Relationship to the requested deliverables

| Deliverable                     | Current result                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Technical architecture          | `ARCHITECTURE.md`, current model and production direction                                         |
| Design system                   | `DESIGN_SYSTEM.md`, tokens, assets and component behavior                                         |
| Responsive site/cart/checkout   | Runnable local application, sample merchandise                                                    |
| Persistent backend              | Disk-backed PGlite local database; remote PostgreSQL adapter                                      |
| Customer/supplier/admin systems | Functional core workflows; hardening gaps listed above                                            |
| Pricing/order engine            | Working server calculations, reservations and split fulfilments                                   |
| Payment sandbox                 | Test-only adapter plus local simulation; actual provider execution blocked by missing credentials |
| Supplier architecture           | Direct vendor + simulated adapter, no marketplace agreements assumed                              |
| Tests/deployment instructions   | Automated domain/API tests and reviewed local UI; deployment not performed                        |
| Budget/roadmap                  | `BUDGET_ROADMAP.md`, assumptions and business decisions                                           |

This is a substantive development baseline and a reviewable first release. It should not be described as a finished commercial marketplace or a complete implementation of every item in the original brief.
