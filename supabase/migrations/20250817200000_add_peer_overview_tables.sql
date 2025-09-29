-- Create peer companies table
CREATE TABLE IF NOT EXISTS public.peer_companies (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    country TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create geographic mix table
CREATE TABLE IF NOT EXISTS public.peer_geographic_mix (
    id SERIAL PRIMARY KEY,
    company_ticker TEXT NOT NULL REFERENCES peer_companies(ticker) ON DELETE CASCADE,
    region TEXT NOT NULL,
    percentage DECIMAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_ticker, region)
);

-- Create segment mix table
CREATE TABLE IF NOT EXISTS public.peer_segment_mix (
    id SERIAL PRIMARY KEY,
    company_ticker TEXT NOT NULL REFERENCES peer_companies(ticker) ON DELETE CASCADE,
    segment TEXT NOT NULL,
    percentage DECIMAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_ticker, segment)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_peer_companies_ticker ON peer_companies(ticker);
CREATE INDEX IF NOT EXISTS idx_peer_geographic_mix_company ON peer_geographic_mix(company_ticker);
CREATE INDEX IF NOT EXISTS idx_peer_segment_mix_company ON peer_segment_mix(company_ticker);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_peer_companies_updated_at
    BEFORE UPDATE ON peer_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_peer_geographic_mix_updated_at
    BEFORE UPDATE ON peer_geographic_mix
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_peer_segment_mix_updated_at
    BEFORE UPDATE ON peer_segment_mix
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE peer_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_geographic_mix ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_segment_mix ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users for peer_companies"
    ON peer_companies FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow read access to all authenticated users for peer_geographic_mix"
    ON peer_geographic_mix FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow read access to all authenticated users for peer_segment_mix"
    ON peer_segment_mix FOR SELECT
    TO authenticated
    USING (true);

-- Allow service role to manage all operations
CREATE POLICY "Allow service role to manage peer_companies"
    ON peer_companies FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role to manage peer_geographic_mix"
    ON peer_geographic_mix FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role to manage peer_segment_mix"
    ON peer_segment_mix FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true); 