/**
 * One-time script to auto-discover and sync images from Serva-S
 * Run: node scripts/sync-provider-images.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rxiukzmqoiknlehxctbs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('Fetching local categories...');
  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, slug, image')
    .not('name', 'is', null);

  if (error) {
    console.error('Error fetching categories:', error.message);
    return;
  }

  let updated = 0;

  for (const cat of categories) {
    // Generate possible slugs for the image
    const slug1 = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug2 = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const slug3 = cat.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]+/g, '');

    const possibleSlugs = [...new Set([slug1, slug2, slug3])].filter(s => s && s.length > 1);
    
    let foundUrl = null;

    for (const slug of possibleSlugs) {
      const testUrl = `https://serva-s.com/assets/images/groups/${slug}.png`;
      try {
        const res = await fetch(testUrl, { method: 'HEAD' });
        // Make sure it's actually an image (not a 404 page returning 200)
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('image')) {
          foundUrl = testUrl;
          break;
        }
      } catch (err) {
        // Ignore fetch errors
      }
    }

    if (foundUrl) {
      const proxiedUrl = `/api/img?url=${encodeURIComponent(foundUrl)}`;
      
      // Update only if it doesn't already have this image
      if (cat.image !== proxiedUrl && cat.image !== foundUrl) {
        console.log(`✅ Found image for category "${cat.name}": ${foundUrl}`);
        
        const { error: updateError } = await supabase
          .from('categories')
          .update({ image: proxiedUrl })
          .eq('id', cat.id);
          
        if (updateError) {
          console.error(`❌ Failed to update category ${cat.name}:`, updateError.message);
        } else {
          updated++;
        }
      } else {
        console.log(`⏭️ Category "${cat.name}" already has the correct image.`);
      }
    } else {
      console.log(`⚠️ No Serva-S image found for "${cat.name}"`);
    }
  }

  console.log(`\nDone! Updated ${updated} categories.`);
}

main().catch(console.error);
