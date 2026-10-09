# Updating prices (under 2 minutes per change)

Everything is in **Shopify admin > Content > Metaobjects**. No theme edits, no code.

## Change a prepaid plan price (about 30 seconds)
1. Content > Metaobjects > **Prepaid plan**.
2. Click the plan (for example "30-day $35 25 GB").
3. Change **Price** (and **Admin label** so the list stays readable). Save.

## Change a postpaid plan (about 30 seconds)
1. Content > Metaobjects > **Postpaid plan** > click the plan.
2. Edit **Monthly price**, **Price note**, **BYOD price** or **Badge**. Save.

## Change a phone's financing price (1 to 2 minutes)
1. Content > Metaobjects > **Financing device** > click the phone.
2. Edit **Price matrix (JSON)**. Change only the numbers, for example `"monthly": 43.71`. Keep the quotes, commas and brackets as they are.
3. Save, then open `/pages/phones-on-financing/<phone>` and pick the model and storage to check.

Tip: to remove a price and show "Request pricing", delete that storage entry, or set the whole field to `{}`.

## Hide or show something
- Set **Active** off to hide a plan, phone or promo. Turn it back on to show it.
- Reorder with **Sort order** (lower shows first).

## Promos
1. Content > Metaobjects > **Plan promo** > Add entry (or edit the existing one).
2. Section: `postpaid`, Headline (for example "100GB for $70/mo"), Fine print, CTA label.
3. Optional **Start date** / **End date**: the promo shows only between those dates. Save.

## Bundle discount and calculator
Online Store > Themes > Customize > Theme settings > **Mobile plans**.
