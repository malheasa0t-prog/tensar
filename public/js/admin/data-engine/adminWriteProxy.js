/**
 * Compatibility wrapper around the secured admin Supabase proxy helpers.
 */

import {
  createAdminSupabaseClient,
} from "./adminDbProxyCore.js";
import { executeAdminDbOperation } from "./adminDbRequest.js?v=20260530-2";

/**
 * Executes one secured admin write operation through the shared DB proxy.
 *
 * @param {Parameters<typeof executeAdminDbOperation>[0]} options
 * @returns {ReturnType<typeof executeAdminDbOperation>}
 */
export function executeAdminWriteOperation(options) {
  return executeAdminDbOperation(options);
}

export { createAdminSupabaseClient };
