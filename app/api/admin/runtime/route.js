import { NextResponse } from 'next/server';
import { getAdminRuntimeConfig } from '@/lib/adminRuntimeConfig';

export const runtime = 'nodejs';

/**
 * Returns the public runtime config needed by the legacy admin shell.
 *
 * @returns {Promise<NextResponse>}
 */
export async function GET() {
  try {
    const config = getAdminRuntimeConfig();
    return NextResponse.json({
      success: true,
      supabaseUrl: config.supabaseUrl,
      supabasePublishableKey: config.supabasePublishableKey,
      writeEnabled: config.writeEnabled,
    });
  } catch (error) {
    console.error('Failed to resolve admin runtime config.', error);
    const safeErrorMessage =
      error instanceof Error && error.message
        ? error.message
        : 'Legacy admin runtime config is unavailable.';

    return NextResponse.json(
      { success: false, error: safeErrorMessage },
      { status: 500 }
    );
  }
}
