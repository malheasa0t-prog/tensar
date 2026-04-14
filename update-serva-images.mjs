/**
 * Script to update service and category images from Serva-S.
 * Maps category/subcategory names to their corresponding Serva-S image URLs.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BASE_IMG = 'https://serva-s.com/assets/images/groups';

/** Main category images */
const MAIN_CATEGORY_IMAGES = {
  'خدمات ميديا': `${BASE_IMG}/social_media.png`,
  'شحن ألعاب': `${BASE_IMG}/gaming.png`,
  'حسابات و اشتراكات': `${BASE_IMG}/acc_s.png`,
  'أرقام وهمية': `${BASE_IMG}/numbers.png`,
  'ويندوز': `${BASE_IMG}/windows.png`,
  'بطاقات كاش': `${BASE_IMG}/cash.png`,
};

/** Subcategory images - name → image mapping */
const SUBCATEGORY_IMAGES = {
  // Social Media
  'tiktok': `${BASE_IMG}/tiktok.png`,
  'instagram': `${BASE_IMG}/instagram.png`,
  'facebook': `${BASE_IMG}/facebook.png`,
  'youtube': `${BASE_IMG}/youtube.png`,
  'snapchat': `${BASE_IMG}/snapchat.png`,
  'telegram': `${BASE_IMG}/telegram.png`,
  'whatsapp': `${BASE_IMG}/whatsapp.png`,
  'twitter / x': `${BASE_IMG}/twitter.png`,
  'twitter': `${BASE_IMG}/twitter.png`,
  'spotify': `${BASE_IMG}/spotify.png`,
  'twitch': `${BASE_IMG}/twitch.png`,
  'kick': `${BASE_IMG}/kick.png`,
  'kwai': `${BASE_IMG}/kwai.png`,
  'likee': `${BASE_IMG}/likee.png`,
  'bluesky': `${BASE_IMG}/bluesky.png`,
  'لينكدإن': `${BASE_IMG}/linkedin.png`,
  // Gaming
  'pubg mobile': `${BASE_IMG}/pubg.png`,
  'free fire': `${BASE_IMG}/freefire.png`,
  'عضويات فري فاير': `${BASE_IMG}/freefire.png`,
  'جواكر': `${BASE_IMG}/jawaker.png`,
  'mobile legends': `${BASE_IMG}/mobilelegends.png`,
  'fc mobile 24': `${BASE_IMG}/easports.png`,
  'steam': `${BASE_IMG}/steam.png`,
  'whiteoutsurvival': `${BASE_IMG}/whiteoutsurvival.png`,
  // Apps & Accounts
  'canva': `${BASE_IMG}/canva.png`,
  'chat gpt plus': `${BASE_IMG}/chatgpt.png`,
  'office 365 premium': `${BASE_IMG}/office.png`,
  '𝐀𝐃𝐎𝐁𝐄 𝐂𝐑𝐄𝐀𝐓𝐈𝐕𝐄 𝐂𝐋𝐎𝐔𝐃': `${BASE_IMG}/adobe.png`,
  'github copilot pro': `${BASE_IMG}/github.png`,
  'google ai gemini pro': `${BASE_IMG}/gemini.png`,
  'capcut pro': `${BASE_IMG}/capcut.png`,
  'شاهد': `${BASE_IMG}/shahid.png`,
  'يوتيوب بريميوم': `${BASE_IMG}/youtube.png`,
  'تيليجرام بريميوم': `${BASE_IMG}/telegram.png`,
  'windows 10/11 pro': `${BASE_IMG}/windows.png`,
  'coursera': `${BASE_IMG}/coursera.png`,
  'iptv': `${BASE_IMG}/iptv.png`,
  'itunes': `${BASE_IMG}/itunes.png`,
  'lovable pro': `${BASE_IMG}/lovable.png`,
  'perplexity pro': `${BASE_IMG}/perplexity.png`,
  'proton vpn': `${BASE_IMG}/protonvpn.png`,
};

async function updateCategoryImages() {
  console.log('=== Updating category images ===');

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, parent_id, image')
    .eq('status', 'active');

  if (error) { console.error('Failed to fetch categories:', error); return; }

  let updated = 0;

  for (const cat of categories) {
    let imageUrl = null;
    const nameLower = cat.name.toLowerCase().trim();

    // Check main categories
    if (!cat.parent_id) {
      imageUrl = MAIN_CATEGORY_IMAGES[cat.name] || null;
    }

    // Check subcategories
    if (cat.parent_id) {
      imageUrl = SUBCATEGORY_IMAGES[nameLower] || SUBCATEGORY_IMAGES[cat.name] || null;
    }

    if (imageUrl && imageUrl !== cat.image) {
      const { error: updateError } = await supabase
        .from('categories')
        .update({ image: imageUrl })
        .eq('id', cat.id);

      if (updateError) {
        console.error(`  ✗ ${cat.name}: ${updateError.message}`);
      } else {
        console.log(`  ✓ ${cat.name}: ${imageUrl}`);
        updated++;
      }
    } else if (!imageUrl) {
      console.log(`  ⚠ No image found for: ${cat.name}`);
    }
  }

  console.log(`\nUpdated ${updated} category images.`);
}

async function updateServiceImages() {
  console.log('\n=== Updating service images ===');

  // Get all services with their category info
  const { data: services, error } = await supabase
    .from('services')
    .select('id, name, category_id, image')
    .eq('status', 'active');

  if (error) { console.error('Failed to fetch services:', error); return; }

  // Get categories for mapping
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, parent_id, image')
    .eq('status', 'active');

  const categoryMap = {};
  for (const cat of (categories || [])) {
    categoryMap[cat.id] = cat;
  }

  let updated = 0;
  let skipped = 0;

  for (const srv of services) {
    if (srv.image) { skipped++; continue; }

    const cat = categoryMap[srv.category_id];
    if (!cat) continue;

    // Use the subcategory image for the service
    const nameLower = (cat.name || '').toLowerCase().trim();
    let imageUrl = SUBCATEGORY_IMAGES[nameLower] || SUBCATEGORY_IMAGES[cat.name] || null;

    // If subcategory has an image already (from the step above), use it
    if (!imageUrl && cat.image) {
      imageUrl = cat.image;
    }

    // If still no image, try parent category
    if (!imageUrl && cat.parent_id) {
      const parent = categoryMap[cat.parent_id];
      if (parent?.image) {
        imageUrl = parent.image;
      }
    }

    if (imageUrl) {
      const { error: updateError } = await supabase
        .from('services')
        .update({ image: imageUrl })
        .eq('id', srv.id);

      if (updateError) {
        console.error(`  ✗ ${srv.name}: ${updateError.message}`);
      } else {
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} service images. Skipped ${skipped} (already had images).`);
}

async function main() {
  console.log('Starting Serva-S image migration...\n');
  await updateCategoryImages();
  await updateServiceImages();

  // Final stats
  const { data: withImg } = await supabase
    .from('services')
    .select('id', { count: 'exact' })
    .eq('status', 'active')
    .not('image', 'is', null);

  const { data: withoutImg } = await supabase
    .from('services')
    .select('id', { count: 'exact' })
    .eq('status', 'active')
    .is('image', null);

  console.log(`\n=== Final Stats ===`);
  console.log(`Services with images: ${withImg?.length || 0}`);
  console.log(`Services without images: ${withoutImg?.length || 0}`);
  console.log('Done!');
}

main().catch(console.error);
