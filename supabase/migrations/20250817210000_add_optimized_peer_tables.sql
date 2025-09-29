-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For text search optimization
CREATE EXTENSION IF NOT EXISTS btree_gin;  -- For GIN index support

-- Create enum for industry sectors
CREATE TYPE industry_sector AS ENUM (
    'Technology',
    'Healthcare',
    'Financial_Services',
    'Consumer_Discretionary',
    'Consumer_Staples',
    'Industrials',
    'Energy',
    'Materials',
    'Utilities',
    'Real_Estate',
    'Communication_Services'
);

-- Create peer groups table
CREATE TABLE IF NOT EXISTS public.peer_groups (
    id SERIAL PRIMARY KEY,
    name TEXT,
    sector industry_sector NOT NULL,
    sub_industry TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create peer group members table (partitioned by sector)
CREATE TABLE IF NOT EXISTS public.peer_group_members (
    group_id INTEGER NOT NULL,
    company_ticker TEXT NOT NULL,
    sector industry_sector NOT NULL,
    similarity_score DECIMAL,
    is_primary BOOLEAN DEFAULT true,
    source TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_group FOREIGN KEY (group_id) REFERENCES peer_groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_company FOREIGN KEY (company_ticker) REFERENCES peer_companies(ticker) ON DELETE CASCADE,
    PRIMARY KEY (sector, group_id, company_ticker)
) PARTITION BY LIST (sector);

-- Create partitions for each sector
DO $$
DECLARE
    s industry_sector;
BEGIN
    FOR s IN SELECT unnest(enum_range(NULL::industry_sector))
    LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS peer_group_members_%s PARTITION OF peer_group_members FOR VALUES IN (%L)',
            s,
            s
        );
    END LOOP;
END $$;

-- Create materialized view for fast peer lookups
CREATE MATERIALIZED VIEW peer_company_details AS
WITH company_metrics AS (
    SELECT 
        pgm.company_ticker,
        pgm.sector,
        pg.sub_industry,
        pgm.similarity_score,
        pgm.is_primary,
        pc.name,
        pc.country,
        pc.description,
        jsonb_agg(DISTINCT jsonb_build_object(
            'region', geo.region,
            'percentage', geo.percentage
        )) FILTER (WHERE geo.region IS NOT NULL) as geographic_mix,
        jsonb_agg(DISTINCT jsonb_build_object(
            'segment', seg.segment,
            'percentage', seg.percentage
        )) FILTER (WHERE seg.segment IS NOT NULL) as segment_mix,
        pgm.metadata
    FROM peer_group_members pgm
    JOIN peer_groups pg ON pg.id = pgm.group_id
    JOIN peer_companies pc ON pc.ticker = pgm.company_ticker
    LEFT JOIN peer_geographic_mix geo ON geo.company_ticker = pgm.company_ticker
    LEFT JOIN peer_segment_mix seg ON seg.company_ticker = pgm.company_ticker
    GROUP BY 
        pgm.company_ticker, 
        pgm.sector,
        pg.sub_industry,
        pgm.similarity_score,
        pgm.is_primary,
        pc.name,
        pc.country,
        pc.description,
        pgm.metadata
)
SELECT * FROM company_metrics;

-- Create indexes for optimized queries
CREATE INDEX idx_peer_groups_sector ON peer_groups(sector);
CREATE INDEX idx_peer_groups_sub_industry ON peer_groups(sub_industry);
CREATE INDEX idx_peer_groups_name_trgm ON peer_groups USING gin (name gin_trgm_ops);

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_peer_company_details_ticker ON peer_company_details(company_ticker);
CREATE INDEX idx_peer_company_details_sector ON peer_company_details(sector);
CREATE INDEX idx_peer_company_details_sub_industry ON peer_company_details(sub_industry);
CREATE INDEX idx_peer_company_details_similarity ON peer_company_details(similarity_score DESC);
CREATE INDEX idx_peer_company_details_metadata ON peer_company_details USING gin (metadata);

-- Add RLS policies
ALTER TABLE peer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_group_members ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to peer_groups"
    ON peer_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to peer_group_members"
    ON peer_group_members FOR SELECT TO authenticated USING (true);

-- Allow service role to manage all operations
CREATE POLICY "Allow service role to manage peer_groups"
    ON peer_groups FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role to manage peer_group_members"
    ON peer_group_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create function to refresh materialized view concurrently
CREATE OR REPLACE FUNCTION refresh_peer_company_details()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY peer_company_details;
END;
$$;

-- Create trigger function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_peer_company_details_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Queue the refresh to happen after the transaction commits
    PERFORM pg_notify('refresh_peer_company_details', '');
    RETURN NULL;
END;
$$;

-- Create triggers to refresh materialized view
CREATE TRIGGER refresh_peer_company_details_on_group_change
    AFTER INSERT OR UPDATE OR DELETE ON peer_groups
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_peer_company_details_trigger();

CREATE TRIGGER refresh_peer_company_details_on_member_change
    AFTER INSERT OR UPDATE OR DELETE ON peer_group_members
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_peer_company_details_trigger();





