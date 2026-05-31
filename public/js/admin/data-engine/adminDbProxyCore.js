/**
 * Shared admin Supabase proxy helpers for secured reads, writes, and RPC calls.
 */

import { executeAdminDbOperation } from "./adminDbRequest.js?v=20260531-2";

const FILTER_METHODS = new Set(["eq", "ilike", "in"]);
const MUTATION_METHODS = new Set(["delete", "insert", "update", "upsert"]);

/**
 * Maintains one normalized admin DB operation state for a proxied table query.
 *
 * @param {string} table
 * @returns {{ action: string | null, columns: string | null, filters: Array<{ column: string, operator?: string, type: string, value: unknown }>, limit: number | null, maybeSingle: boolean, orders: Array<{ ascending: boolean, column: string }>, options: Record<string, unknown> | null, select: string | null, single: boolean, table: string, type: "mutation" | "read" | null, values: unknown }}
 */
function createTableOperationState(table) {
  return {
    action: null,
    columns: null,
    filters: [],
    limit: null,
    maybeSingle: false,
    orders: [],
    options: null,
    select: null,
    single: false,
    table: String(table || "").trim(),
    type: null,
    values: null,
  };
}

/**
 * Converts one table operation state into the request payload sent to the API.
 *
 * @param {ReturnType<typeof createTableOperationState>} state
 * @returns {Record<string, unknown>}
 */
function serializeTableOperation(state) {
  if (state.type === "mutation") {
    return {
      action: state.action,
      filters: [...state.filters],
      maybeSingle: state.maybeSingle,
      options: state.options,
      select: state.select,
      single: state.single,
      table: state.table,
      type: state.type,
      values: state.values,
    };
  }

  return {
    columns: state.columns || "*",
    filters: [...state.filters],
    limit: state.limit,
    maybeSingle: state.maybeSingle,
    orders: [...state.orders],
    single: state.single,
    table: state.table,
    type: "read",
  };
}

/**
 * Creates a Supabase-like table proxy that routes reads and writes through the admin API.
 *
 * @param {{
 *   baseClient: { from: (table: string) => Record<string, unknown> },
 *   fetchImpl?: typeof fetch,
 *   route?: string,
 *   table: string
 * }} options
 * @returns {Record<string, unknown>}
 */
function createAdminTableProxy(options) {
  const state = {
    baseBuilder: options.baseClient.from(options.table),
    operation: createTableOperationState(options.table),
    pendingPromise: null,
    proxy: null,
  };

  /**
   * Executes the queued admin operation exactly once and memoizes the promise.
   *
   * @returns {Promise<{ count: number | null, data: unknown, error: { message: string, status: number } | null }>}
   */
  function runOperation() {
    if (!state.pendingPromise) {
      state.pendingPromise = executeAdminDbOperation({
        baseClient: options.baseClient,
        fetchImpl: options.fetchImpl,
        operation: serializeTableOperation(state.operation),
        route: options.route,
      });
    }

    return state.pendingPromise;
  }

  state.proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "then" || property === "catch" || property === "finally") {
        if (state.operation.type) {
          const pendingPromise = runOperation();
          return pendingPromise[property].bind(pendingPromise);
        }

        return state.baseBuilder[property].bind(state.baseBuilder);
      }

      if (!state.operation.type && MUTATION_METHODS.has(property)) {
        return (...args) => {
          state.operation.type = "mutation";
          state.operation.action = property;
          state.operation.options = args.length > 1 && args[1] && typeof args[1] === "object" ? args[1] : null;
          state.operation.values = property === "delete" ? null : args[0];
          return state.proxy;
        };
      }

      if (!state.operation.type && property === "select") {
        return (columns = "*") => {
          state.operation.type = "read";
          state.operation.columns = String(columns || "*").trim() || "*";
          return state.proxy;
        };
      }

      if (state.operation.type && FILTER_METHODS.has(property)) {
        return (column, value) => {
          state.operation.filters.push({
            column: String(column || "").trim(),
            type: property,
            value,
          });
          return state.proxy;
        };
      }

      if (state.operation.type && property === "not") {
        return (column, operator, value) => {
          state.operation.filters.push({
            column: String(column || "").trim(),
            operator: String(operator || "").trim(),
            type: "not",
            value,
          });
          return state.proxy;
        };
      }

      if (state.operation.type === "mutation" && property === "select") {
        return (columns = "*") => {
          state.operation.select = String(columns || "*").trim() || "*";
          return state.proxy;
        };
      }

      if (state.operation.type === "read" && property === "order") {
        return (column, options = {}) => {
          state.operation.orders.push({
            ascending: options?.ascending !== false,
            column: String(column || "").trim(),
          });
          return state.proxy;
        };
      }

      if (state.operation.type === "read" && property === "limit") {
        return (value) => {
          state.operation.limit = Number(value);
          return state.proxy;
        };
      }

      if (state.operation.type && property === "single") {
        return () => {
          state.operation.single = true;
          state.operation.maybeSingle = false;
          return state.proxy;
        };
      }

      if (state.operation.type && property === "maybeSingle") {
        return () => {
          state.operation.maybeSingle = true;
          state.operation.single = false;
          return state.proxy;
        };
      }

      const builderProperty = state.baseBuilder[property];
      return typeof builderProperty === "function"
        ? (...args) => {
          const result = builderProperty.apply(state.baseBuilder, args);
          if (result && typeof result === "object") {
            state.baseBuilder = result;
            return state.proxy;
          }
          return result;
        }
        : builderProperty;
    },
  });

  return state.proxy;
}

/**
 * Creates the secured Supabase proxy used by the legacy admin shell.
 *
 * @param {{
 *   adminPage?: boolean,
 *   baseClient: Record<string, unknown>,
 *   fetchImpl?: typeof fetch,
 *   route?: string
 * }} options
 * @returns {Record<string, unknown>}
 */
export function createAdminSupabaseClient(options) {
  const adminPage = options?.adminPage === true;
  const baseClient = options?.baseClient;

  if (!adminPage || !baseClient) {
    return baseClient;
  }

  return new Proxy({ __rawClient: baseClient }, {
    get(_target, property) {
      if (property === "from") {
        return (table) => createAdminTableProxy({
          baseClient,
          fetchImpl: options.fetchImpl,
          route: options.route,
          table: String(table || "").trim(),
        });
      }

      if (property === "rpc") {
        return (functionName, args) => executeAdminDbOperation({
          baseClient,
          fetchImpl: options.fetchImpl,
          operation: {
            args: args && typeof args === "object" ? args : {},
            functionName: String(functionName || "").trim(),
            type: "rpc",
          },
          route: options.route,
        });
      }

      const clientProperty = baseClient[property];
      return typeof clientProperty === "function"
        ? clientProperty.bind(baseClient)
        : clientProperty;
    },
  });
}
