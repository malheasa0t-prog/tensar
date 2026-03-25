export const ADMIN_PANEL_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ADMIN_PANEL !== 'false';
export const ADMIN_DEV_BYPASS =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_DEV_BYPASS === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.ADMIN_DEV_BYPASS !== 'false');
