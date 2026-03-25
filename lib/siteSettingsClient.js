import { supabase } from "@/lib/supabaseClient";
import { normalizeSiteSettings } from "@/lib/contactChannels";

export async function loadSiteSettingsClient() {
  const { data } = await supabase.from("settings").select("data").limit(1).maybeSingle();
  return normalizeSiteSettings(data?.data);
}
