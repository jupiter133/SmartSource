#!/usr/bin/env node
/*
  SmartSource Mail-In Repair pricing importer.
  CSV (see template.csv / columns.txt) → Shopify repair products (one product per model, one variant per row).

  Usage:
    node import.mjs prices.csv --check                 validate only (no store access)
    node import.mjs prices.csv --emit payload.json     write productSet payloads (no store access)
    node import.mjs prices.csv --diff                  validate + show diff vs the live store
    node import.mjs prices.csv --apply [--yes]         diff, confirm, then replace rows in the store

  Store access: SHOPIFY_STORE=yourstore.myshopify.com  SHOPIFY_ADMIN_TOKEN=shpat_...
  (Shopify admin → Settings → Apps → Develop apps → create app with write_products, read_publications, write_publications.)

  Rules:
    - Rows in the CSV REPLACE the store's rows for every model in the file. Models not in the file are left alone.
    - Importing clears is_placeholder on every row (pass --keep-placeholder to keep the CSV's value, used for seeding).
    - Placeholder variants are made unpurchasable (tracked inventory, 0 stock, deny overselling), so checkout can't run on them.
*/
import fs from 'node:fs';
import readline from 'node:readline/promises';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const flag = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i > -1 ? args[i + 1] : null; };
if (!file) { console.error('Usage: node import.mjs prices.csv --check | --emit out.json | --diff | --apply [--yes]'); process.exit(1); }

const COLUMNS = fs.readFileSync(new URL('./columns.txt', import.meta.url), 'utf8').trim().split(',');
const KNOWN_TIERS = ['Aftermarket', 'Aftermarket Plus', 'Premium'];

/* ---------- CSV ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const bool = v => /^(true|yes|1|y)$/i.test(String(v).trim());
const num = v => (String(v).trim() === '' ? null : Number(String(v).replace(/[$,]/g, '')));
const slug = s => s.toLowerCase().replace(/\+/g, ' plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const raw = parseCSV(fs.readFileSync(file, 'utf8'));
const header = raw.shift().map(h => h.trim());
const errors = [], warnings = [];
const missing = COLUMNS.filter(c => !header.includes(c));
if (missing.length) errors.push('Missing columns: ' + missing.join(', '));
const extra = header.filter(c => !COLUMNS.includes(c));
if (extra.length) warnings.push('Ignored columns: ' + extra.join(', '));

const rows = raw.map((r, i) => {
  const o = Object.fromEntries(header.map((h, j) => [h, (r[j] ?? '').trim()]));
  o._line = i + 2;
  return o;
});

const seen = new Set();
for (const r of rows) {
  const L = `line ${r._line}`;
  r.lane = (r.lane || 'A').toUpperCase();
  if (!['A', 'B'].includes(r.lane)) errors.push(`${L}: lane must be A or B`);
  if (!r.issue_or_service) errors.push(`${L}: issue_or_service is required`);
  if (r.lane === 'A') {
    if (!r.brand || !r.model) errors.push(`${L}: brand and model are required for lane A`);
    if (num(r.parts_price) == null || num(r.labour) == null) errors.push(`${L}: parts_price and labour are required for lane A`);
    if (!r.part_tier) r.part_tier = 'Standard';
    else if (!KNOWN_TIERS.includes(r.part_tier)) warnings.push(`${L}: part_tier "${r.part_tier}" is not a default tier key. Make sure it matches a tier key in Theme settings → Mail-in repair.`);
  } else {
    if (!r.spec) errors.push(`${L}: lane B needs a device class in "spec" (Phone, Tablet, Laptop, Console)`);
    if (num(r.diagnostic_fee) == null) errors.push(`${L}: diagnostic_fee is required for lane B`);
  }
  for (const k of ['parts_price', 'labour', 'diagnostic_fee', 'range_low', 'range_high', 'turnaround_days', 'warranty_days', 'oos_extra_days'])
    if (r[k] !== '' && r[k] != null && Number.isNaN(num(r[k]))) errors.push(`${L}: ${k} must be a number`);
  if (r.oos_mode && !['hide', 'show'].includes(r.oos_mode)) errors.push(`${L}: oos_mode must be hide or show`);
  const key = rowKey(r);
  if (seen.has(key)) errors.push(`${L}: duplicate row (${key})`);
  seen.add(key);
  if (!flag('keep-placeholder')) r.is_placeholder = 'FALSE';
}
function rowKey(r) { return r.lane === 'B' ? `B|${r.spec}|${r.issue_or_service}` : `A|${r.brand}|${r.model}|${r.spec}|${r.issue_or_service}|${r.part_tier}`; }

if (warnings.length) console.log('Warnings:\n  ' + warnings.join('\n  '));
if (errors.length) { console.error('Errors:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`✓ ${rows.length} rows valid (${rows.filter(r => r.lane === 'A').length} standard, ${rows.filter(r => r.lane === 'B').length} specialized). Placeholder rows: ${rows.filter(r => bool(r.is_placeholder)).length}`);
if (flag('check')) process.exit(0);

/* ---------- Build productSet inputs ---------- */
const mf = (key, type, value) => (value === '' || value == null ? null : { namespace: 'repair', key, type, value: String(value) });
function variantMetafields(r) {
  return [
    mf('parts_price', 'number_decimal', num(r.parts_price)), mf('labour', 'number_decimal', num(r.labour)),
    mf('diagnostic_fee', 'number_decimal', num(r.diagnostic_fee)), mf('range_low', 'number_decimal', num(r.range_low)), mf('range_high', 'number_decimal', num(r.range_high)),
    mf('turnaround_days', 'number_integer', num(r.turnaround_days) ?? 0), mf('warranty_days', 'number_integer', num(r.warranty_days) ?? 0),
    mf('tier_description', 'single_line_text_field', r.tier_description), mf('in_stock', 'boolean', r.in_stock === '' ? true : bool(r.in_stock)),
    mf('oos_mode', 'single_line_text_field', r.oos_mode || 'hide'), mf('oos_extra_days', 'number_integer', num(r.oos_extra_days) ?? 0),
    mf('recommended', 'boolean', bool(r.recommended)), mf('is_placeholder', 'boolean', bool(r.is_placeholder)),
  ].filter(Boolean);
}
const groups = new Map();
for (const r of rows) {
  const handle = r.lane === 'B' ? 'repair-diagnostic' : 'repair-' + slug(`${r.brand} ${r.model}`);
  if (!groups.has(handle)) groups.set(handle, []);
  groups.get(handle).push(r);
}
const payloads = [];
for (const [handle, list] of groups) {
  const first = list[0]; const diag = first.lane === 'B';
  const hasSpec = !diag && list.some(r => r.spec);
  const optNames = diag ? ['Service', 'Device'] : hasSpec ? ['Issue', 'Part tier', 'Spec'] : ['Issue', 'Part tier'];
  const valuesFor = r => diag ? [r.issue_or_service, r.spec] : hasSpec ? [r.issue_or_service, r.part_tier, r.spec || 'All'] : [r.issue_or_service, r.part_tier];
  const productOptions = optNames.map((name, i) => ({ name, values: [...new Set(list.map(r => valuesFor(r)[i]))].map(v => ({ name: v })) }));
  const variants = list.map(r => {
    const price = diag ? num(r.diagnostic_fee) : num(r.parts_price) + num(r.labour);
    const ph = bool(r.is_placeholder);
    return {
      optionValues: valuesFor(r).map((v, i) => ({ optionName: optNames[i], name: v })),
      price: price.toFixed(2), taxable: true,
      inventoryPolicy: 'DENY', inventoryItem: { tracked: ph, requiresShipping: true },
      metafields: variantMetafields(r),
    };
  });
  payloads.push({
    handle, title: diag ? 'Mail-in diagnostic' : `Mail-in repair: ${first.model}`, vendor: diag ? 'SmartSource' : first.brand,
    productType: diag ? 'Mail-in Diagnostic' : 'Mail-in Repair', status: 'ACTIVE', templateSuffix: 'repair', tags: ['mail-in-repair'],
    productOptions, variants,
    metafields: [
      mf('model', 'single_line_text_field', diag ? 'Diagnostic' : first.model), mf('category', 'single_line_text_field', diag ? 'diagnostic' : (first.category || 'phone')),
      mf('popular', 'boolean', list.some(r => bool(r.popular))), { namespace: 'seo', key: 'hidden', type: 'number_integer', value: '1' },
    ].filter(Boolean),
  });
}
if (opt('emit')) { fs.writeFileSync(opt('emit'), JSON.stringify(payloads, null, 1)); console.log(`Wrote ${payloads.length} product payloads to ${opt('emit')}`); process.exit(0); }

/* ---------- Store access ---------- */
const STORE = process.env.SHOPIFY_STORE, TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
if (!STORE || !TOKEN) { console.error('Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN to diff or apply.'); process.exit(1); }
async function gql(query, variables) {
  const r = await fetch(`https://${STORE}/admin/api/2025-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN }, body: JSON.stringify({ query, variables }) });
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data;
}
async function currentRows() {
  const out = new Map(); let after = null;
  do {
    const d = await gql(`query($a:String){ products(first:50, after:$a, query:"tag:mail-in-repair"){ pageInfo{hasNextPage endCursor} nodes{ handle productType vendor model: metafield(namespace:"repair",key:"model"){value}
      variants(first:250){ nodes{ price selectedOptions{name value} metafields(first:20, namespace:"repair"){ nodes{ key value } } } } } } }`, { a: after });
    for (const p of d.products.nodes) for (const v of p.variants.nodes) {
      const o = Object.fromEntries(v.selectedOptions.map(x => [x.name, x.value]));
      const m = Object.fromEntries(v.metafields.nodes.map(x => [x.key, x.value]));
      const diag = p.productType === 'Mail-in Diagnostic';
      const r = diag ? { lane: 'B', spec: o.Device, issue_or_service: o.Service } : { lane: 'A', brand: p.vendor, model: p.model?.value, spec: o.Spec && o.Spec !== 'All' ? o.Spec : '', issue_or_service: o.Issue, part_tier: o['Part tier'] };
      out.set(rowKey(r), { price: Number(v.price).toFixed(2), placeholder: m.is_placeholder === 'true', warranty: m.warranty_days, days: m.turnaround_days, stock: m.in_stock, desc: m.tier_description });
    }
    after = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
  } while (after);
  return out;
}
const live = await currentRows();
const next = new Map(rows.map(r => [rowKey(r), { price: (r.lane === 'B' ? num(r.diagnostic_fee) : num(r.parts_price) + num(r.labour)).toFixed(2), placeholder: bool(r.is_placeholder), warranty: String(num(r.warranty_days) ?? 0), days: String(num(r.turnaround_days) ?? 0), stock: String(r.in_stock === '' ? true : bool(r.in_stock)), desc: r.tier_description }]));
const touchedModels = new Set(rows.map(r => r.lane === 'B' ? 'B' : `A|${r.brand}|${r.model}`));
const added = [], removed = [], changed = [];
for (const [k, v] of next) { const o = live.get(k); if (!o) added.push(k); else { const diffs = Object.keys(v).filter(f => String(v[f] ?? '') !== String(o[f] ?? '')).map(f => `${f}: ${o[f]} → ${v[f]}`); if (diffs.length) changed.push(`${k}  (${diffs.join(', ')})`); } }
for (const k of live.keys()) { const mk = k.startsWith('B|') ? 'B' : k.split('|').slice(0, 3).join('|'); if (touchedModels.has(mk) && !next.has(k)) removed.push(k); }
console.log(`\nDiff vs ${STORE}:\n  + ${added.length} added\n  ~ ${changed.length} changed\n  - ${removed.length} removed`);
for (const [s, l] of [['+', added], ['~', changed], ['-', removed]]) l.slice(0, 200).forEach(x => console.log(`  ${s} ${x}`));
const phLeft = [...live].filter(([k, v]) => v.placeholder && !next.has(k)).length + [...next.values()].filter(v => v.placeholder).length;
console.log(`\nPlaceholder rows left in the store after this import: ${phLeft}`);
if (!flag('apply')) process.exit(0);

if (!flag('yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question('\nApply these changes to the live store? Type "yes": '); rl.close();
  if (a.trim().toLowerCase() !== 'yes') { console.log('Cancelled.'); process.exit(0); }
}
const pub = (await gql(`{ publications(first:20){ nodes{ id name } } }`)).publications.nodes.find(p => /online store/i.test(p.name));
for (const p of payloads) {
  const d = await gql(`mutation($input: ProductSetInput!, $id: ProductSetIdentifiers){ productSet(synchronous:true, input:$input, identifier:$id){ product{ id handle } userErrors{ field message } } }`, { input: p, id: { handle: p.handle } });
  const e = d.productSet.userErrors; if (e.length) { console.error(p.handle, e); continue; }
  if (pub) await gql(`mutation($id:ID!,$p:ID!){ publishablePublish(id:$id, input:{publicationId:$p}){ userErrors{ message } } }`, { id: d.productSet.product.id, p: pub.id });
  console.log('✓', p.handle);
}
console.log('\nDone. If no placeholder rows remain, you can switch on Theme settings → Mail-in repair → Pricing Live.');
