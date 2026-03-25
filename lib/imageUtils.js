const fallbackSupabaseUrl = "http://127.0.0.1:54321";
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl;

function collectAllowedHosts() {
  const hosts = new Set();

  try {
    hosts.add(new URL(rawSupabaseUrl).hostname);
  } catch {}

  return hosts;
}

const allowedRemoteHosts = collectAllowedHosts();

export function isOptimizableImageSrc(src) {
  if (!src || typeof src !== "string") {
    return false;
  }

  if (src.startsWith("/")) {
    return true;
  }

  if (src.startsWith("data:") || src.startsWith("blob:")) {
    return false;
  }

  try {
    const url = new URL(src);
    return allowedRemoteHosts.has(url.hostname);
  } catch {
    return false;
  }
}
