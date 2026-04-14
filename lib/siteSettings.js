import { cache } from "react";
import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeSiteSettings } from "@/lib/contactChannels";

export const getSiteSettings = cache(async function getSiteSettings() {
  const { data } = await supabaseServer.from("settings").select("data").limit(1).maybeSingle();
  return normalizeSiteSettings(data?.data);
});
