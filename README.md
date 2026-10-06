# SmartSource — Shopify theme for new, refurbished & used electronics

Online Store 2.0 theme modeled on the Back Market / Reebelo layout.

## Homepage sections (all drag-and-drop in the theme editor)
| Section | What it does |
|---|---|
| Announcement bar | Lime bar with link, dismissible |
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
