# Mail-In Repair: admin guide

## Where things live

| What | Where in Shopify admin |
|---|---|
| Prices (one row = one variant) | Products → filter **Product type: Mail-in Repair** (standard) / **Mail-in Diagnostic** (specialized). Use **Bulk edit** to see every row as a spreadsheet with the `repair.*` columns. |
| Tier names, order, descriptions, recommended helper line | Online Store → Themes → Customize → Theme settings → **Mail-in repair** |
| Pricing Live switch + override | Same panel. Stays effectively OFF while any row has `is_placeholder = true`, unless the override is checked. |
| Region shipping days / surcharges, tax table, bundle %, quote validity | Same panel |
| Sub-pages (How it works, Quote, Pricing…) and model pages | Content → Metaobjects → **Mail-In Repair page** |
| Order repair status (admin "board") | Orders → open an order → **Repair status** metafield. Part tier, device and quote ID are on each line item. Filter orders by product type to see repairs only. |

## Pricing table columns (CSV)

`lane, brand, model, category, spec, issue_or_service, part_tier, tier_description, parts_price, labour, diagnostic_fee, range_low, range_high, turnaround_days, warranty_days, in_stock, oos_mode, oos_extra_days, recommended, popular, is_placeholder`

- **lane**: `A` = standard instant quote, `B` = specialized / diagnosis-first.
- **Lane A** needs brand, model, issue_or_service, part_tier, parts_price, labour. Customer price = parts_price + labour.
- **Lane B** puts the device class in `spec` (Phone, Tablet, Laptop, Console) and needs `diagnostic_fee`. `range_low`/`range_high` are the typical repair price; leave blank to show "quote after diagnosis".
- **part_tier** must match a tier key in Theme settings (default: Aftermarket, Aftermarket Plus, Premium).
- **in_stock = FALSE** + **oos_mode = show** shows the tier with `oos_extra_days` added; `hide` removes it.
- **category**: phone, tablet, laptop, console (drives the brand/category tiles).
- **popular = TRUE** puts the model in the "Popular" grid.

`template.csv` has one example row per tier plus one Lane B row.

## Importing real prices

```
cd tools/repair-pricing
node import.mjs my-prices.csv --check        # validate
SHOPIFY_STORE=1ttwg1-eh.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx node import.mjs my-prices.csv --diff
SHOPIFY_STORE=... SHOPIFY_ADMIN_TOKEN=... node import.mjs my-prices.csv --apply
```

`--apply` shows the diff (added / changed / removed rows, placeholders left) and asks you to type `yes`.
It replaces every row for each model in the file, clears `is_placeholder`, and makes rows purchasable.
Token: Settings → Apps and sales channels → Develop apps → create an app with `write_products`, `read_publications`, `write_publications`.

`seed.csv` (from `gen_seed.py`) is the placeholder data currently in the store.

## Bundle discount

The quote shows the bundle % from Theme settings. Checkout only applies it if you create a matching
automatic discount: Discounts → Automatic → Amount off products → collection **Mail-in Repair** → minimum quantity 2 → same %.
