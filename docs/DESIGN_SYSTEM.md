# AHIAKOM design system

## Brand foundation

Wordmark: `ahiakom`, with emerald `ahia` and warm-gold `kom`. The shopping-bag symbol includes a simple smile for the standalone app icon. Both are development assets; trademark and domain availability have not been verified. Primary tagline: **One Market. Endless Possibilities.** Secondary brand line: **Shop Everything. From Everywhere.** The latter is a future positioning statement, not a current shipping claim.

| Token            | Value              | Role                                           |
| ---------------- | ------------------ | ---------------------------------------------- |
| Emerald          | `#06452F`          | Primary actions, identity, selected navigation |
| Warm gold        | `#F5C451`          | Hero action and restrained accents             |
| Soft ivory       | `#F7F8F6`          | Page background                                |
| Charcoal         | `#202723`          | Primary text                                   |
| White            | `#FFFFFF`          | Cards, forms and surfaces                      |
| Border           | `#E6EAE5`          | Subtle divisions                               |
| Supporting green | Muted green shades | Secondary panels and illustration tones        |

The wordmark uses a darker gold on a white background to improve legibility. Hero gold sits on emerald. Never use gold text as the sole signal for a transaction status.

## Typography and spacing

The current interface uses a system sans-serif stack to avoid font network requests and licensing dependencies. A self-hosted Inter or Manrope family can be introduced once licensed files are supplied and reviewed. Headlines use tight tracking, body copy uses approximately 1.5–1.8 line height and monetary values use high contrast. The visual scale is 8, 12, 16, 20, 24, 32 and 40px spacing, with larger hero spacing on desktop. Small secondary text should be reviewed with real devices and accessibility tools before launch.

Surface radii: 8–14px on cards and controls; modal corners 18px. Shadows are restrained. Maximum content width is 1408px including padding. Prefer whitespace and clear hierarchy to dense promotional badges.

## Components

- Wordmark and standalone bag icon.
- Search bar with accessible label and submit action.
- Desktop category sidebar and navigation; mobile search-first header.
- Two promotional slides with buttons and swipe handling.
- Policy strip explicitly qualifying delivery, payments, returns and verification as development features.
- Category illustration tiles, product cards, wishlist toggles and price states.
- Product details with SKU variant selection, seller, availability and test return conditions.
- Native dialog for product/account/checkout flows and a cart drawer.
- Customer orders with supplier-level tracking and refund/return requests.
- Supplier/admin tabs, financial metrics, forms, tables and audit records.
- Persistent mobile navigation with Home, Categories, Deals, Cart and Account.

## Responsive rules

| Range           | Behavior                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| Above 1150px    | Category sidebar, wide hero, 8 category tiles and 4 product columns               |
| 851–1150px      | Tighter spacing and smaller hero illustrations                                    |
| 561–850px       | Sidebar removed, wrapped search, 4 category columns, 3 product columns            |
| 560px and below | Compact header, two product columns, mobile bottom navigation and full-width cart |

At 390px the hero, category grid, two-column cards, cart navigation and bottom bar were visually inspected in a development-only iframe. This is not certification on real Android/iOS hardware or a screen reader.

## Interaction and accessibility

Use real buttons and labels. The modal is a native `<dialog>` with keyboard dismissal and focus behavior. Include visible focus outlines, a skip link, descriptive image alt text and status/error announcements. Hover movement respects reduced-motion preferences. Mobile add-to-cart controls have larger touch areas. Do not rely only on colour for an error, approval or payment state.

## Imagery and truthful claims

All current product imagery is lightweight original SVG **illustration**, not product photography. The asset directory is approximately 52 KB on disk. These assets avoid implying real brands or supplier agreements. Production requires approved product photography, image-size derivatives, alt text, upload inspection and appropriate usage rights.

No fictional review counts or ratings are displayed. Discounts are derived only from configured promotional rules, but a production discount still needs a genuine reference-price history; the current rule-derived comparison price is not proof of a legally valid historic discount. All products remain explicitly labelled as demonstration listings.

## Progressive web app status

A manifest and SVG app icon are included. A service worker caches only public product illustrations; it does not cache API responses, account pages or payment information. Full offline checkout is deliberately unsupported. Installability across browsers is not certified: production should add 192/512px PNG icons, Apple touch assets and run platform-specific checks.
