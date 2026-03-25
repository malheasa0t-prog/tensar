const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://phwsgpceksjplkbhtpri.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBod3NncGNla3NqcGxrYmh0cHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTMwMzIsImV4cCI6MjA4NjIyOTAzMn0.volcnhVx6lg7LeZbwVZ6Cx-cdY4tI7Z3FQUnGNWNDCw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixRLS() {
    // Try to add a public read policy using RPC or just test the query
    console.log("Testing services table access...");
    const { data, error } = await supabase.from('services').select('*').limit(1);
    
    if (error) {
        console.error("ERROR:", error.code, error.message);
        console.log("\nThe 'services' table has RLS enabled but no SELECT policy for the 'anon' role.");
        console.log("To fix this, go to your Supabase Dashboard > SQL Editor and run:\n");
        console.log("ALTER TABLE services ENABLE ROW LEVEL SECURITY;");
        console.log("CREATE POLICY \"Allow public read access\" ON services FOR SELECT USING (true);");
        console.log("CREATE POLICY \"Allow public insert\" ON services FOR INSERT WITH CHECK (true);");
        console.log("CREATE POLICY \"Allow public update\" ON services FOR UPDATE USING (true);");
        console.log("CREATE POLICY \"Allow public delete\" ON services FOR DELETE USING (true);");
    } else {
        console.log("SUCCESS! Services table accessible. Found:", data.length, "records");
    }
}

fixRLS();
