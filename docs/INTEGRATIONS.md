# Supplier and payment integration assessment

Reviewed against publicly accessible official documentation on 12 November 2026. API documentation is not a commercial authorization. No marketplace partnership, account approval or live connection has been established.

## Provider matrix

| Provider       | What the official material supports                                                                              | What Ahiakom still needs                                                                                                                           | Current code                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Paystack       | Hosted payment initialization, transaction verification, signed webhooks, refunds and split-payment capabilities | Approved merchant, test keys, reachable webhook, bank/KYC configuration and live authorization                                                     | Test-only initialization and verification; modern/legacy signature checks; simulated refunds/settlements |
| Jumia          | Vendor-facing catalogue/order management documentation                                                           | Written permission for Ahiakom's specific commerce model and authorized vendor credentials; validate country and API scopes                        | No connector; no scraping or automatic retail purchasing                                                 |
| Amazon         | Selling Partner API for authorized seller/vendor operations                                                      | Developer registration, approved application, seller authorization and review of permitted business model                                          | No connector; SP-API is not treated as permission to purchase the Amazon retail catalogue                |
| AliExpress     | Official dropshipping onboarding describes developer approval, dropshipping membership and authorization         | Confirm current Nigerian account/program eligibility, app approval, tokens, order/fulfilment permissions and commercial conditions                 | No connector; official onboarding material needs revalidation during account onboarding                  |
| Shopify stores | Merchant-granted authenticated Admin API scopes; Storefront API checkout capability                              | Agreement with each merchant, app installation/scopes, protected-customer-data review where applicable and confirmed off-site ordering arrangement | No Shopify connector                                                                                     |
| Direct vendors | Ahiakom can implement its own contractual marketplace workflow                                                   | Supplier agreement, business/identity checks, delivery SLA, returns and payout terms                                                               | Working registration, approval, products, stock and fulfilment portal                                    |

## Compliant alternatives

1. Start with directly contracted local vendors who can price, stock and fulfil through Ahiakom.
2. Use merchant-authorized product feeds or CSV imports with explicit image/data rights.
3. Where only referral/affiliate permissions exist, direct customers to the provider's checkout with clear disclosure. Do not take an Ahiakom payment for an unapproved fulfilment path.
4. Use approved wholesale/dropship accounts when their terms specifically cover resale, branding, customer data transfer, returns and cross-border duties.
5. Do not implement account-sharing bots, bypasses, unauthorized scraping or assumed retail checkout automation.

## Paystack implementation details

- Secret keys stay server-side. The adapter refuses keys that are not test keys with the expected `sk_test_` prefix.
- The server initializes a transaction with its own stored amount/reference and offers card/bank-transfer channels subject to provider availability.
- The redirect carries no authority to change payment state. A server verification call must confirm success, test domain, reference, currency and amount.
- The modern `Paystack-Signature` format signs timestamp + `.` + the raw request body with a `whsec_` secret; a five-minute timestamp window and constant-time comparison are enforced.
- Legacy `x-paystack-signature` signs the raw body with the test secret key. Once a modern signing secret is configured, the implementation rejects legacy downgrade.
- Duplicate verification is idempotent. A payment confirmed after cancellation is an exception, not a new shipment.
- No live Paystack sandbox request was executed because merchant test credentials were not supplied. Adapter behavior is tested using mock provider responses and signature fixtures.
- Provider refunds, refund-event reconciliation, chargeback workflows, payouts and split settlements remain **not implemented**. Use no live checkout until these operational paths are completed. The demo refund and settlement ledger do not call Paystack.

## Connector contract and jobs

`SupplierConnector.submit()` accepts stable Ahiakom order/fulfilment identifiers and returns an external identifier. Current implementations are direct portal delivery and a simulation; neither submits an external order. `outbox.fulfilment_id` is unique. The dispatcher claims jobs, records attempts, retries failures and retains exceptions. Extend the contract with quote, stock sync, submit, cancel, tracking and return methods only after an approved provider is selected.

A production integration must preserve supplier SKU mapping, currency, stock timestamp, cost version, idempotency key, external order reference, raw-provider-event retention policy and permissions. Price/stock synchronization needs stale-data thresholds and quarantine. Cancellation after supplier acceptance and refunds after settlement need explicit compensating actions.

## Official references

- [Paystack: accept payments](https://paystack.com/docs/payments/accept-payments/)
- [Paystack: verify payments](https://paystack.com/docs/payments/verify-payments/)
- [Paystack: webhooks](https://paystack.com/docs/payments/webhooks/)
- [Paystack: refunds](https://paystack.com/docs/payments/refunds/)
- [Paystack: transaction pricing](https://support.paystack.com/en/articles/2130306)
- [Paystack: transaction splits](https://support.paystack.com/en/articles/2132802)
- [Jumia: vendor API documentation, official hosted PDF](https://file.jumia-global.com.cn/jumia/rich_text/831dbbc0-2653-4c5d-a990-84a6d275f380.pdf)
- [Amazon: SP-API registration overview](https://developer-docs.amazon.com/sp-api/lang-en_EN/docs/sp-api-registration-overview)
- [Amazon: Selling Partner API](https://sell.amazon.com/developers)
- [AliExpress: official dropshipping onboarding material](https://open.alitrip.com/docs/doc.htm?articleId=120418&docType=1&treeId=762)
- [Shopify: access scopes](https://shopify.dev/docs/api/usage/access-scopes)
- [Shopify: Order object](https://shopify.dev/docs/api/admin-graphql/latest/objects/order)

## Nigerian launch review

The FCCPC's published e-commerce guidance calls for clear terms, prominent policies, product/price disclosures and accessible complaint resolution. Its consumer-rights guidance covers information, price disclosure, returns, fair dealings and quality. The NDPC's guidance addresses controller/processor obligations and registration criteria. The Nigeria Tax Act 2025, effective in 2026, requires current tax review rather than assumptions carried over from older rules.

Before launch, engage qualified Nigerian advisers to settle the marketplace's legal entity, merchant-of-record role, vendor agreements, product restrictions, consumer complaints, returns/warranties, privacy notices, lawful processing basis, processor contracts, cross-border data transfers, retention, breach response and tax invoicing. Do not assume every SKU has the same tax treatment. Assess NDPC registration applicability and payment-provider KYC rather than treating this document as a legal opinion.

- [FCCPC: e-commerce guidance](https://fccpc.gov.ng/business-guidance-on-e-commerce-2/)
- [FCCPC: consumer rights and responsibilities](https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/)
- [NDPC: implementation guidance](https://ndpc.gov.ng/wp-content/uploads/2026/01/NDP-ACT-GAID-2025-MARCH-20-1.pdf)
- [NIPC-hosted Nigeria Tax Act 2025](https://www.nipc.gov.ng/wp-content/uploads/2025/07/Nigeria-Tax-Act-2025.pdf)
- [Nigeria Revenue Service: tax legislation portal](https://www.nrs.gov.ng/tax-laws/nrs-act)
