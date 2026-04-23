/**
 * One-time script to sync Serva-S provider fields into local services metadata.
 * Run: node scripts/sync-provider-fields.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bayubxlmrgkquwoutwmn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROVIDER_API_URL = process.env.PROVIDER_API_BASE_URL;
const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY;

if (!SUPABASE_KEY || !PROVIDER_API_URL || !PROVIDER_API_KEY) {
  console.error('Missing env vars. Set: SUPABASE_SERVICE_ROLE_KEY, PROVIDER_API_BASE_URL, PROVIDER_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchServaSCatalog() {
  const params = new URLSearchParams({ action: 'services', key: PROVIDER_API_KEY });
  const response = await fetch(PROVIDER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new Error(`Serva-S API error: ${response.status}`);
  return response.json();
}

async function main() {
  console.log('Fetching Serva-S catalog...');
  const catalog = await fetchServaSCatalog();
  
  if (!Array.isArray(catalog)) {
    console.error('Unexpected catalog format:', catalog);
    process.exit(1);
  }
  
  console.log(`Fetched ${catalog.length} services from Serva-S`);

  const catalogMap = new Map();
  for (const service of catalog) {
    const sid = String(service.service || '').trim();
    if (sid) {
      catalogMap.set(sid, {
        link_required: Boolean(service.link_required),
        provider_fields: Array.isArray(service.fields) ? service.fields : [],
        pricing_type: service.pricing_type || 'default',
        has_quantity: Boolean(service.has_quantity),
      });
    }
  }

  console.log(`Mapped ${catalogMap.size} services from catalog`);

  const { data: localServices, error } = await supabase
    .from('services')
    .select('id, provider_service_id, metadata')
    .not('provider_service_id', 'is', null);

  if (error) {
    console.error('Failed to fetch local services:', error.message);
    process.exit(1);
  }

  console.log(`Found ${localServices.length} local services to update`);

  let updated = 0;
  let skipped = 0;

  for (const local of localServices) {
    const providerData = catalogMap.get(local.provider_service_id);
    if (!providerData) {
      skipped++;
      continue;
    }

    const existingMetadata = local.metadata || {};
    const newMetadata = {
      ...existingMetadata,
      link_required: providerData.link_required,
      provider_fields: providerData.provider_fields,
      pricing_type: providerData.pricing_type,
      has_quantity: providerData.has_quantity,
    };

    const { error: updateError } = await supabase
      .from('services')
      .update({ metadata: newMetadata })
      .eq('id', local.id);

    if (!updateError) {
      updated++;
    } else {
      console.error(`Failed to update ${local.id}:`, updateError.message);
    }
  }

  console.log(`\nSync complete! Updated: ${updated}, Skipped: ${skipped}`);
  
  // Show sample of updated metadata
  const { data: sample } = await supabase
    .from('services')
    .select('id, name, provider_service_id, metadata')
    .not('provider_service_id', 'is', null)
    .limit(3);
  
  console.log('\nSample services after update:');
  for (const s of (sample || [])) {
    console.log(`  ${s.name} (${s.provider_service_id}): fields=${JSON.stringify(s.metadata?.provider_fields?.length || 0)}, link_required=${s.metadata?.link_required}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
