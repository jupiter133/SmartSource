# Mobile plans: setup

Page: `/pages/plans` (tabs: `?tab=prepaid`, `?tab=postpaid`, `?tab=financing`, BYOD: `?tab=postpaid&byod=1`).
Device pages: `/pages/phones-on-financing/<handle>` (for example `/pages/phones-on-financing/iphone-18-pro`).

Nothing is sold or activated on the site. Every flow ends in a request sent through the Shopify contact form.

## Why device pages are metaobject web pages

Each `financing_device` entry has the Online Store capability turned on, so Shopify gives it its own URL and renders it with `templates/metaobject/financing_device.json`. That means:

- **Native per-device URLs** that can be shared and linked from ads or the nav.
- **SEO**: each phone is its own indexable page with its own H1.
- **Editable without code**: names, colours, storage, prices and photos are all fields in Content > Metaobjects.
- **No fake products**: these phones never appear in the catalog, search, collections, cart or checkout, because they are not products. Nobody can accidentally "buy" a financed phone.

## Metaobject definitions (all with storefront access PUBLIC_READ)

| Type | Fields | Notes |
|---|---|---|
| `prepaid_plan` | name (admin label), term (30/90/365), price, data, talk, auto_topup_bonus, promo_text, badge, bundle_eligible, sort_order, active | Shown in the Prepaid tab, grouped by term |
| `postpaid_plan` | name, price, price_note, data, network (5G+/5G), includes (list), byod_price, badge, promo_text, sort_order, active | Generic names only, never a carrier name |
| `financing_device` | name, brand (Apple/Samsung/Google), images (list), description, models (list), storage_options (list), colours (JSON), price_matrix (JSON), financing_term_months, return_option_available, return_option_note, compatible_plans (postpaid_plan refs), badge, sort_order, active | Web pages on, URL prefix `phones-on-financing`, publishable |
| `plan_promo` | section (prepaid/postpaid), headline, subtext, fine_print, image, cta_label, active, start_date, end_date | Postpaid promos show as cards on the Postpaid tab and in the device side panel |

Entries with `active` turned off are hidden. Blank `active` counts as on. `sort_order` sorts low to high.

### Seeded data

- **Prepaid (9)**: 30-day $22 talk and text (+500 MB bonus), $25 4 GB (+1 GB), $30 10 GB (+5 GB), $35 25 GB (+5 GB, Most popular), $39 70 GB (+5 GB, Best value); 90-day $59 60 GB, $75 75 GB (new activations only); 365-day $100 400 min/texts, $159 40 GB. Bundle eligible: every plan with data except $22 and $100. Change `bundle_eligible` to adjust.
- **Postpaid (4)**: 5G+ 100GB $70 (BYOD), 5G+ Essential $90, 5G+ Unlimited $105 (Most popular), 5G+ Unlimited Plus $115. Each "Includes $10 auto-pay discount". Essential has no data amount yet: fill in `data` and `includes` if you want to show it.
- **Devices (12)**: iPhone 18 Pro, 17e, 17, Air, 17 Pro; Galaxy S26 Ultra, S26, S25 FE, S25; Pixel 11, 11 Pro, 10. No images, `price_matrix` is `{}`, so every phone shows **Request pricing**. Compatible plans: Essential, Unlimited, Unlimited Plus.
- **Promo (1)**: postpaid "100GB for $70/mo", fine print "When you bring your own phone. Includes $10 in discounts, including auto-pay."

### price_matrix format

```json
{
  "iPhone 18 Pro": {
    "256GB": [
      { "label": "Pay $0 upfront", "upfront": 0, "monthly": 43.71 },
      { "label": "Pay $300 upfront", "upfront": 300, "monthly": 31.21 },
      { "label": "Return option", "upfront": 0, "monthly": 29.50, "return_option": true }
    ]
  }
}
```

Keys are the exact model and storage names from `models` and `storage_options`. Use `"*"` as a model or storage key to apply one set of prices to all. Any model/storage with no entry shows "Request pricing for this configuration" and still lets the customer send a request. The card on the Phones tab shows "From $X/mo" using the lowest monthly in the matrix.

`colours` format: `[{"name": "Black", "hex": "#1d1d1f"}, {"name": "Blue", "hex": "#5b7fa6"}]`.

## Files

| File | What it does |
|---|---|
| `templates/page.plans.json` | Page template (section `mobile-plans`) |
| `sections/mobile-plans.liquid` | Hero, sticky tabs, all three tabs, add-ons, calculator, FAQ + JSON-LD, bottom CTA, prepaid request drawer |
| `templates/metaobject/financing_device.json` | Device page template |
| `sections/financing-device.liquid` | Device page: gallery, selectors, payment and plan pickers, estimate |
| `snippets/plans-postpaid-form.liquid` | Postpaid / financing / BYOD / "Help me choose" request drawer |
| `snippets/plans-money.liquid` | Price formatting for EN and FR |
| `snippets/plans-phone-art.liquid` | Generic phone illustration used until photos are uploaded |
| `snippets/bundle-badge.liquid` | "Save $X when you add a Koodo prepaid plan" link on phone product pages |
| `assets/mobile-plans.js` | Tabs, forms, calculator, device configurator |
| `assets/base.css` | Styles (section "Mobile plans" at the end) |
| `locales/en.default.json`, `locales/fr.json` | All page text under `plans` |
| `config/settings_schema.json` | Theme settings > Mobile plans |
| Also edited | `snippets/nav-default.liquid` (Mobile plans mega menu), `sections/header.liquid` (Mobile plans link), `sections/main-product.liquid` (bundle badge), `sections/promo-cards.liquid`, `sections/announcement-bar.liquid`, `sections/footer.liquid`, `sections/main-collection.liquid` (old `/pages/phone-plans` links now go to `/pages/plans`, "in store" wording removed) |

## Setup steps

1. **Page**: already created (`/pages/plans`, template `page.plans`, published, SEO title and description set). If it's ever deleted, create a page with handle `plans` and pick template `plans`.
2. **Device images**: Content > Metaobjects > Financing device > pick a phone > Images > upload (transparent PNG or white background, square, at least 1000 px). The first image is used on the grid card. Until then a generic phone drawing shows.
3. **Koodo logo**: Online Store > Themes > Customize > open the Mobile plans page > Mobile plans section > "Koodo logo (prepaid tab)". Upload the official file from your dealer materials. Until then a plain text wordmark shows. Don't hotlink logos from other sites.
4. **Device prices**: fill in `price_matrix` for each phone (see format above). See `WEEKLY-PRICES.md`.
5. **Theme settings > Mobile plans**: bundle discount (default $25), bundle fine print, calculator postpaid $/mo (90), financing $/mo (43.71), optional disclaimer override.
6. **Optional blocks** in the Mobile plans section: Prepaid add-on (replaces the built-in add-on list once you add one), FAQ item (replaces the built-in FAQ once you add one; built-in FAQ is translated, blocks are not unless you translate them), Postpaid promo banner (toggle and dates; one "Lock in your rate" banner is included, turned off).
7. **Contact form email**: requests go to the store's contact email (Settings > Notifications > Staff / sender email). Send one test of each form (see `TEST-CHECKLIST.md`).
8. **French**: text is in `locales/fr.json`. If the admin language editor ever overwrites that file, missing keys fall back to English.

## Forms: what's collected

- Prepaid: plan, new number or transfer (number + current carrier), SIM or eSIM, own unlocked phone or SmartSource phone, name, phone, email, shipping address (only for a shipped SIM), consent.
- Postpaid / financing / BYOD / help: read-only summary of the selection, then only name, email, phone and consent.
- Never collected: SIN, date of birth, ID, payment or banking details, account numbers, PINs. Every form says so.
- Subjects: `[PREPAID] Koodo $35 - John Smith`, `[POSTPAID] 5G+ Unlimited + iPhone 18 Pro 256GB - John Smith`, `[POSTPAID BYOD] 5G+ 100GB - John Smith`, `[POSTPAID] Help me choose - John Smith`.
- Tags (`contact[tags]`): `prepaid`, `prepaid, bundle`, `postpaid, financing`, `postpaid, byod`, `postpaid`.
- Spam: hidden honeypot field plus Shopify's own form protection. If the server rejects a submission, the form reopens with the person's answers restored.
