import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20250817200000_add_peer_overview_tables.sql');
    const migrationSql = readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      query: migrationSql
    });

    if (error) throw error;

    console.log('Successfully applied peer overview tables migration');

    // Insert sample data for testing
    const sampleData = {
      companies: [
        {
          ticker: 'GOOGL',
          name: 'Alphabet Inc.',
          country: 'United States',
          description: 'Alphabet offers diverse products and platforms globally, including Google Services and Cloud.',
          geographicMix: [
            { region: 'US', percentage: 47 },
            { region: 'EMEA', percentage: 31 },
            { region: 'Asia Pacific', percentage: 16 },
            { region: 'Other', percentage: 6 }
          ],
          segmentMix: [
            { segment: 'Google search & other', percentage: 50 },
            { segment: 'google Properties', percentage: 10 },
            { segment: 'google Network', percentage: 10 },
            { segment: 'Other', percentage: 30 }
          ]
        }
      ]
    };

    // Insert sample data using the new API endpoint
    const response = await fetch(`${supabaseUrl}/api/competitors/overview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(sampleData)
    });

    if (!response.ok) {
      throw new Error(`Failed to insert sample data: ${response.statusText}`);
    }

    console.log('Successfully inserted sample data');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration(); 