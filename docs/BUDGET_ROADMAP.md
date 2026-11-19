# MVP budget, operating model and roadmap

Planning estimate prepared 12 November 2026. These are engineering planning allowances, not supplier quotations, a bill for this session or a promise that the existing build is production-complete. Re-estimate after business decisions, vendor onboarding and a technical/security review.

## Scope assumptions

Nigeria-first pilot; 5–20 directly contracted vendors; up to 1,000 initial SKUs; one currency; one payment provider; a small catalogue/operations team; web/PWA first. No native mobile apps, warehouse operation or unrestricted external marketplace aggregation in the pilot. Plan 12–16 calendar weeks for production hardening, provider onboarding, acceptance testing and a controlled launch, subject to account approvals.

## One-time delivery allowance

| Workstream                                         |    Low estimate |   High estimate |
| -------------------------------------------------- | --------------: | --------------: |
| Product definition, UX and final design assets     |      ₦1,200,000 |      ₦2,500,000 |
| Storefront and account hardening                   |      ₦2,000,000 |      ₦3,500,000 |
| Backend, suppliers, inventory and order operations |      ₦2,500,000 |      ₦4,500,000 |
| Payment, refunds and settlement integration        |      ₦1,200,000 |      ₦2,500,000 |
| QA, accessibility, security review and deployment  |      ₦1,500,000 |      ₦3,000,000 |
| Launch operations setup and documentation          |        ₦600,000 |      ₦1,000,000 |
| **Delivery subtotal**                              |  **₦9,000,000** | **₦17,000,000** |
| Contingency, 20%                                   |      ₦1,800,000 |      ₦3,400,000 |
| **Planning total**                                 | **₦10,800,000** | **₦20,400,000** |

Includes a small mixed engineering/design/QA team. Excludes VAT where applicable, legal/tax professional fees, domain purchase, brand registration, advertising, customer acquisition, inventory working capital, delivery charges, supplier deposits and payment reserves. Existing code should reduce some implementation effort, but its production review and remediation still require time. A 4–6 week tightly restricted closed pilot may be possible with fewer features, but should not be presented as full-marketplace readiness.

## Monthly technology allowance

Budget in USD for foreign infrastructure to avoid pretending an unverified NGN exchange rate is fixed. Convert at the actual procurement rate and include bank/FX charges and applicable taxes.

| Component                         | Pilot monthly allowance | Notes                                                   |
| --------------------------------- | ----------------------: | ------------------------------------------------------- |
| Node application hosting          |                 $20–$60 | Capacity and workspace/bandwidth charges vary           |
| Managed PostgreSQL                |                 $20–$80 | Backups, storage and recovery requirements drive sizing |
| Background jobs and queue         |                 $10–$40 | Scheduler plus worker capacity                          |
| Object storage/CDN                |                  $5–$25 | Request volume matters as well as GB stored             |
| Transactional email               |                 $10–$30 | Provider and send volume to be selected                 |
| Monitoring/logging/backup extras  |                 $10–$40 | Retention and alert requirements                        |
| **Base infrastructure allowance** |      **$75–$275/month** | Excludes SMS, domain, payment fees and high traffic     |
| 20% usage contingency             |                 $15–$55 |                                                         |
| **Budget envelope**               |      **$90–$330/month** | Planning range, not a hosting quote                     |

Use paid production services with appropriate backups. Do not rely on expiring/free prototype databases for customer orders. Render lists separate workspace, compute, storage and bandwidth charges. Cloudflare R2 lists Standard storage at $0.015/GB-month plus operation charges and no egress charge; the total storage allowance above also covers operational overhead and growth, rather than being a direct R2 bill.

Indicative non-technology staffing: **₦800,000–₦2,500,000/month** for an early combination of support, catalogue/vendor operations and retained engineering, depending on headcount and coverage. This is a planning assumption. Marketing, couriers, refunds and fraud reserves are additional. No 24/7 support promise should be made without staffing it.

## Payment-cost example

Paystack's published Nigerian local transaction fee is 1.5% + ₦100, with the ₦100 waived below ₦2,500 and a ₦2,000 cap. International and payout pricing differ. Confirm the actual merchant contract and current pricing before launch.

For a sample ₦18,000 merchandise payment with ₦15,000 supplier cost, the gross markup is ₦3,000. The indicative local processing fee is ₦370, leaving ₦2,630 **before** shipping subsidy, tax liability, refunds, payout costs and operating expenses. At 1,000 such successful payments, processing fees alone would be approximately ₦370,000 under those assumptions. This example is not net profit or a tax calculation.

## Milestones and acceptance gates

| Stage                              | Planning window | Exit criteria                                                                                                     |
| ---------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. Product/legal/vendor definition | Weeks 1–2       | Merchant model, pilot vendors, returns, fees, tax and data responsibilities approved                              |
| 2. Production foundation           | Weeks 2–4       | PostgreSQL integration tests, versioned migrations, verified email/recovery, MFA, media uploads and monitoring    |
| 3. Direct vendor pilot             | Weeks 4–7       | SKU/variant import, stock reconciliation, fulfilment exceptions, returns and support tested by real pilot vendors |
| 4. Payment operations              | Weeks 6–9       | Paystack sandbox end-to-end tests, verified refund/chargeback/payout reconciliation and bank/KYC approval         |
| 5. Hardening and acceptance        | Weeks 9–12      | Security, load, accessibility and device tests; successful restore drill; operational playbooks signed off        |
| 6. Controlled rollout              | Weeks 12–16     | Explicit launch approval, limited vendor/customer cohort, daily reconciliation and measured service performance   |

Commercial onboarding may extend the calendar independently of development progress.

## Decisions requiring business approval

1. Is Ahiakom principal/reseller, marketplace agent or a mixed model per supplier? Who issues the tax invoice and is responsible for warranty/returns?
2. Which initial vendors and product categories are approved? What evidence is required for approval and what items are prohibited?
3. What commission/markup, minimum contribution, promotion rules, reserve/hold period and payout frequency apply?
4. Who pays delivery, failed-delivery and return costs? What are the pilot service areas and actual SLA?
5. Which legal entity, bank account, domain ownership and privacy/contact details will be published?
6. Which hosting region, backup targets, vendors and data-processing agreements are approved?
7. What are the actual staffing hours and escalation responsibilities?

No further permission was needed to develop and test the local application. These decisions govern real commercial operation, provider contracts and a future public release.

## Expansion roadmap

**Nigeria pilot:** direct vendor catalogue, naira checkout, verified service areas, written seller terms and measured unit economics. Prioritize repeat purchases, delivery success, refund turnaround and positive contribution rather than raw listing count.

**Nigeria growth:** approved logistics APIs, search indexing, stronger SKU/variant content, fraud controls, repeatable vendor onboarding, finance exports and monitored stock synchronization. Add an approved external connector one provider at a time after commercial validation.

**Mobile applications:** improve the PWA first. Once usage warrants app-store maintenance, reuse domain APIs in React Native/Expo or a comparable mobile stack. Include secure token storage, deep-link payment returns, push opt-in and app-store compliance. A PWA manifest alone is not a finished native app.

**African expansion:** launch one market at a time with local legal/tax advice, supported payments, local settlement accounts, currency/FX rules, data-transfer review, logistics/returns and language support. Introduce country-specific catalogue eligibility and tax/shipping calculators before allowing cross-border checkout.

## Pricing references

- [Render pricing](https://render.com/pricing)
- [Render compute-plan documentation](https://render.com/docs/compute-plans)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Paystack transaction pricing](https://support.paystack.com/en/articles/2130306)
