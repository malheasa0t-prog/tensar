const SERVICE_UNAVAILABLE_STATUS = 503;
const UNAUTHORIZED_STATUS = 401;

export const MISSING_SYNC_SECRET_ERROR = 'Sync endpoint is not configured.';
export const UNAUTHORIZED_SYNC_TRIGGER_ERROR = 'Unauthorized sync trigger';

/**
 * Resolves whether the order-sync route may proceed.
 *
 * @param {{ expectedSecret?: unknown, providedSecret?: unknown }} input
 * @returns {{ isAuthorized: boolean, status: number, error: string }}
 */
export function resolveOrderSyncAccess({ expectedSecret, providedSecret }) {
  const normalizedExpectedSecret = String(expectedSecret || '').trim();
  const normalizedProvidedSecret = String(providedSecret || '').trim();

  if (!normalizedExpectedSecret) {
    return {
      isAuthorized: false,
      status: SERVICE_UNAVAILABLE_STATUS,
      error: MISSING_SYNC_SECRET_ERROR,
    };
  }

  if (normalizedProvidedSecret !== normalizedExpectedSecret) {
    return {
      isAuthorized: false,
      status: UNAUTHORIZED_STATUS,
      error: UNAUTHORIZED_SYNC_TRIGGER_ERROR,
    };
  }

  return {
    isAuthorized: true,
    status: 200,
    error: '',
  };
}
