# Mobile plans: test checklist

Test on a phone (real device or narrow browser) and on desktop.

## Page and tabs
- [ ] `/pages/plans` loads with one H1 "Phone plans for less. Set up in minutes."
- [ ] Tabs switch Prepaid / Postpaid / Phones on financing; URL updates to `?tab=...`; opening that URL directly opens the same tab.
- [ ] Tabs stay stuck under the header while scrolling.
- [ ] `?tab=postpaid&byod=1` opens Postpaid with the "Bring your own phone" hint.
- [ ] Prepaid sub-tabs 30 / 90 / 365 days show the right plans. "Most popular" and "Best value" badges show.
- [ ] "Save $25 on a phone" tag shows on bundle-eligible cards only.
- [ ] Add-ons expand and collapse.
- [ ] Calculator: changing plan, phone price and the toggle updates both totals and the "You could save" line instantly.
- [ ] FAQ items open; page source contains `"@type":"FAQPage"`.
- [ ] No layout jump as the page loads (images and phone drawings keep their space).

## Prepaid request (submit one for real)
- [ ] "Activate this plan" opens the drawer (full screen on mobile) with that plan preselected, starting at step 2.
- [ ] Progress bar moves; Next blocks until required fields are filled; Back works.
- [ ] Transfer shows number + current carrier; eSIM hides the shipping address; "I want a SmartSource phone" shows the optional field, "Browse phones" link and the "$25 off" note on eligible plans.
- [ ] Review step lists everything; "Send activation request" submits.
- [ ] Success message shows after the page reloads.
- [ ] Email received with subject like `[PREPAID] Koodo $35 - Your Name`, tags `prepaid` (or `prepaid, bundle`), and every field: plan, number choice, transfer number and carrier (if chosen), SIM type, phone choice, unlocked confirmation or SmartSource phone, name, phone, email, address (if shipping), consent.

## Postpaid / BYOD / financing / help request (submit one of each)
- [ ] "Bring my own phone" on a plan card: summary shows the plan + "Bring my own phone". Subject `[POSTPAID BYOD] 5G+ 100GB - Name`, tags `postpaid, byod`.
- [ ] "Get this deal" on the promo card opens the form with the promo headline.
- [ ] Bottom "Help me choose": subject `[POSTPAID] Help me choose - Name`.
- [ ] Device page "Continue": summary shows device, model, storage, colour, SIM, payment, plan, estimate. Subject `[POSTPAID] 5G+ Unlimited + iPhone 18 Pro 256GB - Name`, tags `postpaid, financing`.
- [ ] Only name, email, phone and consent are asked. "Edit" closes the form and returns to the selection.
- [ ] Success: "Got it. We'll reach out shortly to schedule your call." and "Back to plans".
- [ ] Force an error (for example, edit the email to something invalid in dev tools): the form reopens with answers kept.

## Device pages
- [ ] `/pages/phones-on-financing/iphone-18-pro` loads; grid card on the Phones tab links there.
- [ ] Brand chips All / Apple / Samsung / Google filter the grid.
- [ ] With an empty price matrix: "Request pricing" on the card and "Request pricing for this configuration" on the page.
- [ ] After adding a price matrix: payment options change instantly when model or storage changes; estimate line updates when the plan changes; card shows "From $X/mo".
- [ ] Return option row and tooltip show only when "Device return option available" is on.

## Language
- [ ] Switch to Français: all page text is in French, prices show as `35 $`.
- [ ] Switch back to English.

## Content rules
- [ ] No carrier name other than Koodo anywhere on the page outside the Prepaid tab and the prepaid request (Postpaid, Phones, device pages, FAQ, bottom CTA).
- [ ] "Authorized Koodo dealer" appears only on the Prepaid tab.
- [ ] No wording about a physical store, pickup or visiting anywhere on these pages.
- [ ] Phone product pages show "Save $25 when you add a Koodo prepaid plan →" linking to `/pages/plans?tab=prepaid`; accessories do not.
- [ ] Main nav "Mobile plans" mega menu: 4 tiles link to the right tabs. Header side link "Mobile plans" works. Home card "Phone + plan, sorted." links to `/pages/plans` with no "in store" wording.
