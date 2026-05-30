/**
 * Run Supabase migrations via the Management API.
 * 
 * Usage: node db/_run_migration.js <migration_file>
 * 
 * Reads the SQL file and executes it against the Supabase project
 * using the Management API (requires SUPABASE_ACCESS_TOKEN env var)
 * or falls back to the PostgREST /rpc endpoint with service_role key.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'rxiukzmqoiknlehxctbs';

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.sql');
  
  // Try Management API first
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  
  if (!accessToken) {
    console.error('ERROR: SUPABASE_ACCESS_TOKEN environment variable is required.');
    console.error('');
    console.error('To get your access token:');
    console.error('1. Go to https://supabase.com/dashboard/account/tokens');
    console.error('2. Generate a new access token');
    console.error('3. Set it: set SUPABASE_ACCESS_TOKEN=your_token_here');
    console.error('');
    console.error('Alternatively, you can run the SQL directly in the Supabase SQL Editor:');
    console.error('https://supabase.com/dashboard/project/' + PROJECT_ID + '/sql/new');
    process.exit(1);
  }

  console.log(`Applying migration: ${fileName}`);
  console.log(`SQL length: ${sql.length} characters`);
  console.log('');

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    const text = await res.text();
    
    if (res.ok) {
      console.log('SUCCESS: Migration applied successfully!');
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) {
          console.log('Result:', JSON.stringify(data, null, 2));
        }
      } catch {
        if (text.trim()) console.log('Response:', text.substring(0, 500));
      }
    } else {
      console.error(`FAILED: HTTP ${res.status}`);
      console.error('Response:', text.substring(0, 1000));
      process.exit(1);
    }
  } catch (err) {
    console.error('Network error:', err.message);
    process.exit(1);
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node db/_run_migration.js <migration_file.sql>');
  process.exit(1);
}

const fullPath = path.resolve(migrationFile);
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

runMigration(fullPath);
