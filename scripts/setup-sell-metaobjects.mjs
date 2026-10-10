#!/usr/bin/env node
/**
 * Creates the buyback metaobject definitions used by the Sell Your Device page,
 * then imports the full catalog from scripts/sell-catalog.json (categories, brands,
 * 135 devices, their ESTIMATED prices). Rebuild that file with scripts/build_sell_catalog.py.
 *
 * Usage (Node 18+, no npm install needed):
 *   SHOPIFY_STORE=your-store.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/setup-sell-metaobjects.mjs            # definitions + full catalog
 *   node scripts/setup-sell-metaobjects.mjs --no-seed  # definitions only
 *   node scripts/setup-sell-metaobjects.mjs --dry-run  # print every API call, change nothing
 *
 * The token comes from a custom app (Settings > Apps and sales channels > Develop apps)
 * with Admin API scopes: write_metaobject_definitions, write_metaobjects.
 * Safe to re-run: existing definitions are kept, sample entries are upserted by handle.
 */

import { readFileSync } from 'node:fs';

const STORE = process.env.SHOPIFY_STORE || process.env.SHOPIFY_FLAG_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION || '2026-01';
const SEED = !process.argv.includes('--no-seed');
const DRY_RUN = process.argv.includes('--dry-run');

if (!DRY_RUN && (!STORE || !TOKEN)) {
  console.error('Set SHOPIFY_STORE (your-store.myshopify.com) and SHOPIFY_ADMIN_TOKEN first. See README.md > Sell Your Device page.');
  process.exit(1);
}

let fakeId = 0;
async function gql(query, variables = {}) {
  if (DRY_RUN) {
    const op = query.match(/(metaobject\w+)/)[1];
    console.log(`  [dry-run] ${op} ${JSON.stringify(variables)}`);
    const id = `gid://shopify/Fake/${++fakeId}`;
    if (op === 'metaobjectDefinitionByType') return { metaobjectDefinitionByType: gql.made?.[variables.type] || null };
    if (op === 'metaobjectDefinitionCreate') {
      gql.made = { ...gql.made, [variables.definition.type]: { id, fieldDefinitions: variables.definition.fieldDefinitions.map((f) => ({ key: f.key })) } };
      return { metaobjectDefinitionCreate: { metaobjectDefinition: { id }, userErrors: [] } };
    }
    if (op === 'metaobjectDefinitionUpdate') return { metaobjectDefinitionUpdate: { metaobjectDefinition: { id }, userErrors: [] } };
    return { metaobjectUpsert: { metaobject: { id }, userErrors: [] } };
  }
  const res = await fetch(`https://${STORE}/admin/api/${VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  const throttled = res.status === 429 || (body.errors || []).some((e) => e.extensions?.code === 'THROTTLED');
  if (throttled && (gql.retries = (gql.retries || 0) + 1) <= 8) {
    await new Promise((r) => setTimeout(r, 1000 * gql.retries));
    return gql(query, variables);
  }
  gql.retries = 0;
  if (!res.ok || body.errors) throw new Error(`GraphQL request failed (${res.status}): ${JSON.stringify(body.errors || body)}`);
  return body.data;
}

function assertNoUserErrors(result, what) {
  const errors = result.userErrors || [];
  if (errors.length) throw new Error(`${what}: ${errors.map((e) => `${(e.field || []).join('.')} ${e.message}`).join('; ')}`);
}

const image = (key, name) => ({ key, name, type: 'file_reference', validations: [{ name: 'file_type_options', value: '["Image"]' }] });
const ref = (key, name, definitionId) => ({ key, name, type: 'metaobject_reference', validations: [{ name: 'metaobject_definition_id', value: definitionId }] });
const text = (key, name, required = false) => ({ key, name, type: 'single_line_text_field', required });
const int = (key, name) => ({ key, name, type: 'number_integer' });
const money = (key, name) => ({ key, name, type: 'number_decimal', description: 'CAD, before tax. Leave blank if you do not buy in this condition.' });
const refList = (key, name, definitionId) => ({ key, name, type: 'list.metaobject_reference', validations: [{ name: 'metaobject_definition_id', value: definitionId }] });
const bool = (key, name) => ({ key, name, type: 'boolean' });

async function ensureDefinition(type, name, fieldDefinitions) {
  const existing = await gql(
    'query($type: String!) { metaobjectDefinitionByType(type: $type) { id fieldDefinitions { key } } }',
    { type },
  );
  if (existing.metaobjectDefinitionByType) {
    const { id } = existing.metaobjectDefinitionByType;
    const have = existing.metaobjectDefinitionByType.fieldDefinitions.map((f) => f.key);
    const missing = fieldDefinitions.filter((f) => !have.includes(f.key));
    if (missing.length) await addFields(id, type, missing);
    else console.log(`= ${type} already exists`);
    return id;
  }
  const data = await gql(
    `mutation($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition { id type }
        userErrors { field message code }
      }
    }`,
    {
      definition: {
        type,
        name,
        displayNameKey: 'name',
        access: { storefront: 'PUBLIC_READ' }, // required so the theme (Liquid) can read the entries
        capabilities: { publishable: { enabled: true } }, // entries can be Draft or Active; only Active show on the site
        fieldDefinitions,
      },
    },
  );
  assertNoUserErrors(data.metaobjectDefinitionCreate, `Create ${type}`);
  console.log(`+ created ${type}`);
  return data.metaobjectDefinitionCreate.metaobjectDefinition.id;
}

async function addFields(id, type, fields) {
  const data = await gql(
    `mutation($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
      metaobjectDefinitionUpdate(id: $id, definition: $definition) {
        metaobjectDefinition { id }
        userErrors { field message code }
      }
    }`,
    { id, definition: { fieldDefinitions: fields.map((f) => ({ create: f })) } },
  );
  assertNoUserErrors(data.metaobjectDefinitionUpdate, `Add fields to ${type}`);
  console.log(`+ ${type}: added ${fields.map((f) => f.key).join(', ')}`);
}

// null/undefined = not bought in that condition (field left empty), e.g. sealed-only devices have no used prices.
const dec = (n) => (typeof n === 'number' ? n.toFixed(2) : null);

async function upsert(type, handle, fields) {
  const data = await gql(
    `mutation($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message code }
      }
    }`,
    {
      handle: { type, handle },
      metaobject: {
        fields: Object.entries(fields).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => ({ key, value: String(value) })),
        capabilities: { publishable: { status: 'ACTIVE' } },
      },
    },
  );
  assertNoUserErrors(data.metaobjectUpsert, `Upsert ${type}/${handle}`);
  return data.metaobjectUpsert.metaobject.id;
}

async function main() {
  console.log(`Store: ${STORE || '(dry run)'} (Admin API ${VERSION})${DRY_RUN ? ' - DRY RUN, nothing is changed' : ''}`);

  const categoryDef = await ensureDefinition('buyback_category', 'Buyback category', [
    text('name', 'Name', true), image('image', 'Image'), int('sort_order', 'Sort order'),
  ]);
  const brandDef = await ensureDefinition('buyback_brand', 'Buyback brand', [
    text('name', 'Name', true), image('logo', 'Logo'), int('sort_order', 'Sort order'),
  ]);
  const deviceDef = await ensureDefinition('buyback_device', 'Buyback device', [
    text('name', 'Name', true),
    ref('category', 'Category', categoryDef),
    ref('brand', 'Brand', brandDef),
    image('image', 'Image'),
    int('release_year', 'Release year'),
    int('sort_order', 'Sort order'),
    bool('is_popular', 'Popular (show in "What we pay")'),
    bool('active', 'Active (buying this device)'),
  ]);
  const priceDef = await ensureDefinition('buyback_price', 'Buyback price', [
    text('name', 'Name (for your reference, e.g. iPhone 15 Pro 256GB)'),
    ref('device', 'Device', deviceDef),
    text('storage', 'Storage (e.g. 256GB)', true),
    money('price_like_new', 'Price: Like New'),
    money('price_good', 'Price: Good'),
    money('price_fair', 'Price: Fair'),
    money('price_cracked', 'Price: Cracked or Minor Issue'),
    money('price_defective', 'Price: Defective'),
    money('price_new', 'Price: Brand new (sealed)'),
  ]);
  // Device -> its prices. The theme reads prices through this list, so there's no 250-row page limit.
  await ensureDefinition('buyback_device', 'Buyback device', [refList('prices', 'Prices (one entry per storage option)', priceDef)]);

  if (!SEED) return console.log('Done (definitions only).');

  const catalog = JSON.parse(readFileSync(new URL('./sell-catalog.json', import.meta.url)));
  const cat = {};
  for (const c of catalog.categories) cat[c.name] = await upsert('buyback_category', c.handle, { name: c.name, sort_order: c.sort_order });
  console.log(`+ ${catalog.categories.length} categories`);
  const brand = {};
  for (const b of catalog.brands) brand[b.name] = await upsert('buyback_brand', b.handle, { name: b.name, sort_order: b.sort_order });
  console.log(`+ ${catalog.brands.length} brands`);

  let n = 0;
  for (const d of catalog.devices) {
    const id = await upsert('buyback_device', d.handle, {
      name: d.name, category: cat[d.category], brand: brand[d.brand], release_year: d.release_year,
      sort_order: d.sort_order, is_popular: d.is_popular, active: true,
    });
    const priceIds = [];
    for (const p of d.prices) {
      const ph = `${d.handle}-${p.storage}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      priceIds.push(await upsert('buyback_price', ph, {
        name: `${d.name} ${p.storage}`, device: id, storage: p.storage,
        price_like_new: dec(p.like_new), price_good: dec(p.good), price_fair: dec(p.fair),
        price_cracked: dec(p.cracked), price_defective: dec(p.defective), price_new: dec(p.new),
      }));
    }
    await upsert('buyback_device', d.handle, { prices: JSON.stringify(priceIds) });
    n += 1;
    if (n % 10 === 0) console.log(`  ${n}/${catalog.devices.length} devices`);
  }
  console.log(`+ ${catalog.devices.length} devices, ${catalog.devices.reduce((s, d) => s + d.prices.length, 0)} prices`);
  console.log('Done. Prices are ESTIMATES: review them in Content > Metaobjects before launch.');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
