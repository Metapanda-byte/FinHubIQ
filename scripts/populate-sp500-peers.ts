import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Company {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
  description?: string;
}

async function fetchSP500Companies(): Promise<Company[]> {
  // Note: You'll need to provide the actual S&P 500 data source
  // This is a placeholder for the data fetching logic
  const companies: Company[] = [];
  
  // Example: Reading from a CSV file
  return new Promise((resolve, reject) => {
    const parser = parse({ columns: true });
    const records: Company[] = [];

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        records.push({
          symbol: record.Symbol,
          name: record.Name,
          sector: record.Sector,
          subIndustry: record.SubIndustry,
        });
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve(records));

    createReadStream('data/sp500.csv').pipe(parser);
  });
}

async function createPeerGroup(sector: string, subIndustry: string) {
  const { data: existingGroup, error: queryError } = await supabase
    .from('peer_groups')
    .select('id')
    .eq('sector', sector)
    .eq('sub_industry', subIndustry)
    .maybeSingle();

  if (queryError) throw queryError;
  if (existingGroup) return existingGroup.id;

  const { data: newGroup, error: insertError } = await supabase
    .from('peer_groups')
    .insert({
      name: `${sector} - ${subIndustry}`,
      sector,
      sub_industry: subIndustry
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return newGroup.id;
}

async function addCompanyToPeerGroup(
  company: Company,
  groupId: number,
  isPrimary: boolean = true
) {
  const { error } = await supabase
    .from('peer_group_members')
    .upsert({
      group_id: groupId,
      company_ticker: company.symbol,
      sector: company.sector,
      is_primary: isPrimary,
      source: 'sp500',
      metadata: {
        sp500: true,
        addedAt: new Date().toISOString()
      }
    });

  if (error) throw error;
}

async function populatePeerGroups() {
  try {
    console.log('Fetching S&P 500 companies...');
    const companies = await fetchSP500Companies();

    // Group companies by sector and sub-industry
    const groupedCompanies = companies.reduce((acc, company) => {
      const key = `${company.sector}|${company.subIndustry}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(company);
      return acc;
    }, {} as Record<string, Company[]>);

    // Create peer groups and add companies
    for (const [key, companies] of Object.entries(groupedCompanies)) {
      const [sector, subIndustry] = key.split('|');
      console.log(`Processing ${sector} - ${subIndustry} (${companies.length} companies)`);

      // Create peer group
      const groupId = await createPeerGroup(sector, subIndustry);

      // Add companies to group
      for (const company of companies) {
        await addCompanyToPeerGroup(company, groupId);
      }

      // Add cross-industry relationships for large tech companies
      if (sector === 'Technology') {
        // Add relationships to digital advertising companies
        if (subIndustry === 'Internet Services') {
          const adTechGroupId = await createPeerGroup('Communication_Services', 'Digital Advertising');
          for (const company of companies) {
            if (['GOOGL', 'META'].includes(company.symbol)) {
              await addCompanyToPeerGroup(company, adTechGroupId, false);
            }
          }
        }
      }
    }

    console.log('Successfully populated peer groups');
  } catch (error) {
    console.error('Error populating peer groups:', error);
    process.exit(1);
  }
}

// Run the population script
populatePeerGroups();





