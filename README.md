# SmartSource — Shopify theme for new, refurbished & used electronics

Online Store 2.0 theme modeled on the Back Market / Reebelo layout.

## Homepage sections (all drag-and-drop in the theme editor)
| Section | What it does |
|---|---|
| Announcement bar | Accent-colour bar with link, dismissible |
| Header | Logo, pill search, account, cart, category menu (first link styled as deals), right-side menu (Trade in / Services) |
| Hero banner | Big color block + product image + CTA |
| Category carousel | "Shop our most wanted" round tiles with arrows |
| Promo banner | Full-width dark trade-in banner |
| Promo cards | 2–3 side-by-side cards |
| Product tabs | "Recommended for you" pills → product carousels per collection |
| Promise / trust | Warranty, inspection, returns, refurbished |
| Video reels (UGC) | 9:16 TikTok-style videos, click to play |

## Store setup (do this or it looks empty)
1. **Condition badge:** tag products `condition:new`, `condition:refurbished`, or `condition:used`.
2. **Grade picker:** add a variant option named **Condition** (New / Excellent / Good / Fair). The product page shows a "What's the difference?" guide next to it.
3. **"$999 new" price:** set the variant **compare-at price** to the new retail price. Shows as strikethrough "new" + "Save $X".
4. **Ratings:** Shopify's `reviews.rating` metafield (filled automatically by Judge.me, Okendo, etc.).
5. **Filters:** install Search & Discovery and add filters for Condition, Brand, Storage, Price.
6. **Menus:** `main-menu` (categories), plus menus for the right-side links, utility links, and footer columns.

## Install
Zip the folder → Online Store → Themes → Add theme → Upload zip. Or `shopify theme dev` with Shopify CLI.

---

## Sell Your Device page

A buyback page with an instant-quote wizard. Device data lives in Shopify **metaobjects**, the buyback terms live in **Theme settings > Sell program**, and everything else is editable in the theme editor. No apps.

### Sections (template `page.sell`, in this order)
| Section file | What it does |
|---|---|
| `sell-hero.liquid` | Headline, live device search, category chips, floating cards, trust bar |
| `sell-what-we-pay.liquid` | "Up to $X" tables for **Popular** devices, grouped by category |
| `sell-quote-wizard.liquid` | 7-step quote wizard. Submits through Shopify's contact form |
| `sell-steps.liquid` | "How it works" tabs |
| `sell-terms.liquid` | Key-terms stat cards |
| `trade-in-banner.liquid` | "Trade in. Trade up." banner (also works on the homepage and product pages) |
| `sell-faq.liquid` | FAQ accordion + FAQPage structured data |
| `sell-cta.liquid` | Final "Ready to get paid?" strip |

### One place for the terms
**Online Store > Themes > Customize > Theme settings > Sell program**
- Quote valid / ship within (days): default 21
- Payment after we receive it (business days): default 5
- Free return if a revised offer is declined: on
- Pay in-store drop-offs on the spot: on
- Prices last updated: shown under the price list

In any Sell-page text field you can write `{quote_valid_days}`, `{payment_business_days}` or `{prices_updated_date}`. Wrap a sentence in `[if_free_return]...[/if_free_return]` or `[if_instore_pay]...[/if_instore_pay]` to show it only while that option is on.

### 1. Create the metaobject definitions

**Option A: setup script (about 1 minute)**
1. Admin > Settings > Apps and sales channels > Develop apps > Create an app.
2. Configuration > Admin API scopes: `write_metaobject_definitions`, `write_metaobjects`. Install the app and copy the Admin API access token.
3. Run:
   ```
   node scripts/setup-sell-metaobjects.mjs --dry-run   # optional: shows every API call, changes nothing
   SHOPIFY_STORE=your-store.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx node scripts/setup-sell-metaobjects.mjs
   ```
   This creates the definitions and imports the full catalog from `scripts/sell-catalog.json`: 135 devices (every iPhone from the 8 up, Samsung Galaxy S/Z/A, iPads, Galaxy Tabs, MacBooks, Apple Watch, AirPods, PlayStation/Xbox/Switch/Steam Deck) with 384 price rows. Add `--no-seed` for definitions only. Re-running is safe: it updates entries by handle.

   **The prices are formula estimates** (launch price x age x brand x USD-to-CAD x condition share). Check them against your margins before launch. To change the formula or add models, edit `scripts/build_sell_catalog.py`, run `python3 scripts/build_sell_catalog.py`, then re-run the setup script.

**Option B: manual**
Admin > Settings > Custom data > Metaobjects > Add definition. For each one, turn on **Storefronts** access (needed for the theme to read it) and **Active/draft status**.

| Definition (type) | Fields: key, type |
|---|---|
| Buyback category (`buyback_category`) | `name` single line text (required) · `image` file (images) · `sort_order` integer |
| Buyback brand (`buyback_brand`) | `name` single line text (required) · `logo` file (images) · `sort_order` integer |
| Buyback device (`buyback_device`) | `name` single line text (required) · `category` metaobject ref → Buyback category · `brand` metaobject ref → Buyback brand · `image` file · `release_year` integer · `sort_order` integer · `is_popular` true/false · `active` true/false · `prices` **list** of metaobject refs → Buyback price (add this after creating Buyback price) |
| Buyback price (`buyback_price`) | `name` single line text · `device` metaobject ref → Buyback device · `storage` single line text (required) · `price_like_new`, `price_good`, `price_fair`, `price_cracked`, `price_defective` decimal (CAD) |

Keys must match exactly. Then add the categories: Smartphone, Tablet, Smartwatch, Laptop/MacBook, Gaming Console, Audio.

### 2. Admin guide

**Add a device:** Content > Metaobjects > Buyback device > Add entry. Fill in name, category, brand, image (transparent PNG, square) and release year. Tick **Active**, set status to **Active**, then save. Devices without at least one price don't appear in the wizard.

**Add prices:** open the device and use its **Prices** field > Add entry: type the storage exactly as you want it shown (e.g. `256GB`, `256GB Wi-Fi + Cellular`, `45mm GPS`), pick the device, and enter the CAD amount for each condition. Leave a condition blank if you don't buy it; it shows as "Not accepted". One entry per storage option. **A price only appears on the site when it's in the device's Prices list.**

**Mark popular:** open the device and tick **Popular**. Popular devices appear in "What we pay" (up to 7 per group; change this in the section settings) and get a Popular badge in the wizard. "Up to" is the highest Like New price across that device's storage sizes.

**Update the "prices updated" date:** Theme settings > Sell program > Prices last updated.

**Turn off a device:** untick **Active** on the device. It disappears from the search, wizard and price list.

**Create the page:** Online Store > Pages > Add page. Title "Sell your device", URL handle `sell-your-device` (the header's Trade in link and the trade-in banner point there). In the right sidebar, set **Theme template** to `page.sell`. Save. Then edit the drop-off stores and condition checklists in Customize > Sell: quote wizard.

**Where quotes go:** each submission arrives at your store's contact email (Settings > Notifications > Staff / Store contact email) with the quote reference (`Q-YYMMDD-XXXX`), every device with storage, condition and price, the total, send method, store, timestamp and expiry date.

**Before launch:** review the estimated prices, at least for the popular devices.

### Limits to know
- Liquid reads at most **250 devices** and **50** categories or brands. Prices are read through each device's Prices list, so there's no overall price limit.
- The quote wizard needs JavaScript. Without it, visitors see a message pointing them to a store.
