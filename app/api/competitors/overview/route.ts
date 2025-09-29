import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { handleApiError } from '@/lib/api/error-handler';
import { rateLimit } from '@/lib/api/rate-limit';
import { supabaseUrl, supabaseKey } from '@/lib/supabase/config';

// Types for peer overview data
interface PeerCompany {
  ticker: string;
  name: string;
  country: string;
  description: string;
  geographicMix: Array<{ region: string; percentage: number }>;
  segmentMix: Array<{ segment: string; percentage: number }>;
}

interface GeographicMix {
  company_ticker: string;
  region: string;
  percentage: number;
}

interface SegmentMix {
  company_ticker: string;
  segment: string;
  percentage: number;
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    // Apply rate limiting
    await rateLimit();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tickers = searchParams.get('tickers')?.split(',') || [];

    if (!tickers.length) {
      return new NextResponse('No tickers provided', { status: 400 });
    }

    // Fetch peer companies data
    const { data: companies, error: companiesError } = await supabase
      .from('peer_companies')
      .select('*')
      .in('ticker', tickers);

    if (companiesError) throw companiesError;

    // Fetch geographic mix data
    const { data: geoMix, error: geoError } = await supabase
      .from('peer_geographic_mix')
      .select('*')
      .in('company_ticker', tickers);

    if (geoError) throw geoError;

    // Fetch segment mix data
    const { data: segMix, error: segError } = await supabase
      .from('peer_segment_mix')
      .select('*')
      .in('company_ticker', tickers);

    if (segError) throw segError;

    // Combine the data
    const peerOverview: PeerCompany[] = (companies || []).map(company => ({
      ticker: company.ticker,
      name: company.name,
      country: company.country,
      description: company.description,
      geographicMix: (geoMix || [])
        .filter((g: GeographicMix) => g.company_ticker === company.ticker)
        .map((g: GeographicMix) => ({ region: g.region, percentage: g.percentage })),
      segmentMix: (segMix || [])
        .filter((s: SegmentMix) => s.company_ticker === company.ticker)
        .map((s: SegmentMix) => ({ segment: s.segment, percentage: s.percentage }))
    }));

    return NextResponse.json({ peerOverview });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    // Apply rate limiting
    await rateLimit();

    const body = await request.json();
    const { companies } = body as { companies: PeerCompany[] };

    if (!Array.isArray(companies)) {
      return new NextResponse('Invalid request body', { status: 400 });
    }

    // Process each company
    for (const company of companies) {
      // Upsert company data
      const { error: companyError } = await supabase
        .from('peer_companies')
        .upsert({
          ticker: company.ticker,
          name: company.name,
          country: company.country,
          description: company.description
        }, {
          onConflict: 'ticker'
        });

      if (companyError) throw companyError;

      // Upsert geographic mix
      if (company.geographicMix?.length) {
        const { error: geoError } = await supabase
          .from('peer_geographic_mix')
          .upsert(
            company.geographicMix.map((g) => ({
              company_ticker: company.ticker,
              region: g.region,
              percentage: g.percentage
            })),
            { onConflict: 'company_ticker,region' }
          );

        if (geoError) throw geoError;
      }

      // Upsert segment mix
      if (company.segmentMix?.length) {
        const { error: segError } = await supabase
          .from('peer_segment_mix')
          .upsert(
            company.segmentMix.map((s) => ({
              company_ticker: company.ticker,
              segment: s.segment,
              percentage: s.percentage
            })),
            { onConflict: 'company_ticker,segment' }
          );

        if (segError) throw segError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
} 