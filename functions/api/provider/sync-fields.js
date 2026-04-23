/**
 * Cloudflare Pages Function to sync Serva-S provider fields into local services metadata.
 *
 * POST /api/provider/sync-fields — fetches the Serva-S catalog and updates
 * local services metadata with link_required and provider_fields.
 */

import { requireAdminAccess } from '../../_lib/adminAccess.js';
import { handlePreflight, withCors } from '../../_lib/cors.js';
import { getProviderServices } from '../../_lib/providerApi.js';
import { withSecurityHeaders } from '../../_lib/securityHeaders.js';
import { createSupabaseAdmin, errorResponse, successResponse } from '../../_lib/supabase.js';

const SYNC_METHODS = 'POST, OPTIONS';
const CACHE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * Applies security and CORS wrappers to a response.
 *
 * @param {Response} response
 * @param {Request} request
 * @returns {Response}
 */
function finalize(response, request) {
  return withSecurityHeaders(withCors(response, request, SYNC_METHODS), CACHE_HEADERS);
}

/**
 * POST /api/provider/sync-fields — sync provider fields into local services.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  const access = await requireAdminAccess(request, env);
  if (access.errorResponse) {
    return finalize(access.errorResponse, request);
  }

  const catalogResult = await getProviderServices(env);
  if (!catalogResult.success) {
    return finalize(
      errorResponse(catalogResult.error || 'Failed to fetch Serva-S catalog', 502),
      request
    );
  }

  const services = catalogResult.services || [];
  const admin = createSupabaseAdmin(env);

  const catalogMap = new Map();
  for (const service of services) {
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

  const { data: localServices, error: fetchError } = await admin
    .from('services')
    .select('id, provider_service_id, metadata')
    .not('provider_service_id', 'is', null);

  if (fetchError) {
    return finalize(
      errorResponse(`Failed to read local services: ${fetchError.message}`, 500),
      request
    );
  }

  let updated = 0;
  let skipped = 0;

  for (const local of (localServices || [])) {
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

    const { error: updateError } = await admin
      .from('services')
      .update({ metadata: newMetadata })
      .eq('id', local.id);

    if (!updateError) {
      updated++;
    } else {
      console.error(`Failed to update service ${local.id}:`, updateError.message);
    }
  }

  return finalize(
    successResponse({
      data: {
        catalog_count: services.length,
        local_count: (localServices || []).length,
        updated,
        skipped,
      },
    }),
    request
  );
}

/**
 * Handles CORS preflight.
 *
 * @param {EventContext} context
 * @returns {Response}
 */
export function onRequestOptions(context) {
  return withSecurityHeaders(
    handlePreflight(context.request, SYNC_METHODS),
    CACHE_HEADERS
  );
}
