import { cache } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeSiteSettings } from "@/lib/contactChannels";

export const getSiteSettings = cache(async function getSiteSettings() {
  const { data } = await supabase.from("settings").select("data").limit(1).maybeSingle();
  return normalizeSiteSettings(data?.data);
});
