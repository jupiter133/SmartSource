#!/usr/bin/env node
/**
 * Creates the buyback metaobject definitions used by the Sell Your Device page,
 * then seeds categories, brands and 3 SAMPLE devices with obviously fake prices.
 *
 * Usage (Node 18+, no npm install needed):
 *   SHOPIFY_STORE=your-store.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/setup-sell-metaobjects.mjs            # definitions + sample data
 *   node scripts/setup-sell-metaobjects.mjs --no-seed  # definitions only
 *   node scripts/setup-sell-metaobjects.mjs --dry-run  # print every API call, change nothing
 *
 * The token comes from a custom app (Settings > Apps and sales channels > Develop apps)
 * with Admin API scopes: write_metaobject_definitions, write_metaobjects.
 * Safe to re-run: existing definitions are kept, sample entries are upserted by handle.
 */

const STORE = process.env.SHOPIFY_STORE;
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
    if (op === 'metaobjectDefinitionByType') return { metaobjectDefinitionByType: null };
    if (op === 'metaobjectDefinitionCreate') return { metaobjectDefinitionCreate: { metaobjectDefinition: { id }, userErrors: [] } };
    return { metaobjectUpsert: { metaobject: { id }, userErrors: [] } };
  }
  const res = await fetch(`https://${STORE}/admin/api/${VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
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
const bool = (key, name) => ({ key, name, type: 'boolean' });

async function ensureDefinition(type, name, fieldDefinitions) {
  const existing = await gql(
    'query($type: String!) { metaobjectDefinitionByType(type: $type) { id fieldDefinitions { key } } }',
    { type },
  );
  if (existing.metaobjectDefinitionByType) {
    const have = existing.metaobjectDefinitionByType.fieldDefinitions.map((f) => f.key);
    const missing = fieldDefinitions.map((f) => f.key).filter((k) => !have.includes(k));
    console.log(`= ${type} already exists${missing.length ? ` (missing fields: ${missing.join(', ')}; add them in Settings > Custom data)` : ''}`);
    return existing.metaobjectDefinitionByType.id;
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
  await ensureDefinition('buyback_price', 'Buyback price', [
    text('name', 'Name (for your reference, e.g. iPhone 15 Pro 256GB)'),
    ref('device', 'Device', deviceDef),
    text('storage', 'Storage (e.g. 256GB)', true),
    money('price_like_new', 'Price: Like New'),
    money('price_good', 'Price: Good'),
    money('price_fair', 'Price: Fair'),
    money('price_cracked', 'Price: Cracked or Minor Issue'),
    money('price_defective', 'Price: Defective'),
  ]);

  if (!SEED) return console.log('Done (definitions only).');

  const categories = [
    ['smartphone', 'Smartphone'], ['tablet', 'Tablet'], ['smartwatch', 'Smartwatch'],
    ['laptop-macbook', 'Laptop/MacBook'], ['gaming-console', 'Gaming Console'], ['audio', 'Audio'],
  ];
  const cat = {};
  for (const [i, [handle, name]] of categories.entries()) cat[handle] = await upsert('buyback_category', handle, { name, sort_order: i + 1 });
  console.log(`+ ${categories.length} categories`);

  const brands = [['apple', 'Apple'], ['samsung', 'Samsung'], ['google', 'Google']];
  const brand = {};
  for (const [i, [handle, name]] of brands.entries()) brand[handle] = await upsert('buyback_brand', handle, { name, sort_order: i + 1 });
  console.log(`+ ${brands.length} brands`);

  // PLACEHOLDER DATA: fake names and obviously fake prices. Replace or delete before going live.
  const devices = [
    { handle: 'sample-iphone-15-pro', name: 'iPhone 15 Pro (SAMPLE)', category: 'smartphone', brand: 'apple', year: 2023, sort: 1,
      prices: { '128GB': [1111, 999, 888, 555, 111], '256GB': [1234, 1111, 999, 666, 123] } },
    { handle: 'sample-galaxy-s24', name: 'Galaxy S24 (SAMPLE)', category: 'smartphone', brand: 'samsung', year: 2024, sort: 2,
      prices: { '128GB': [777, 666, 555, 333, 77], '256GB': [888, 777, 666, 444, 88] } },
    { handle: 'sample-ipad-air-m2', name: 'iPad Air 11-inch M2 (SAMPLE)', category: 'tablet', brand: 'apple', year: 2024, sort: 3,
      prices: { '128GB': [444, 333, 222, 111, 44] } },
  ];
  for (const d of devices) {
    const id = await upsert('buyback_device', d.handle, {
      name: d.name, category: cat[d.category], brand: brand[d.brand], release_year: d.year,
      sort_order: d.sort, is_popular: true, active: true,
    });
    for (const [storage, [likeNew, good, fair, cracked, defective]] of Object.entries(d.prices)) {
      await upsert('buyback_price', `${d.handle}-${storage.toLowerCase()}`, {
        name: `${d.name} ${storage}`, device: id, storage,
        price_like_new: likeNew.toFixed(2), price_good: good.toFixed(2), price_fair: fair.toFixed(2),
        price_cracked: cracked.toFixed(2), price_defective: defective.toFixed(2),
      });
    }
  }
  console.log(`+ ${devices.length} SAMPLE devices with placeholder prices`);
  console.log('Done. Replace the SAMPLE devices and prices in Content > Metaobjects before launch.');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
