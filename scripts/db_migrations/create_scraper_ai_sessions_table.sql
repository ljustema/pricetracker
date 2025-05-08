-- Create scraper_ai_sessions table to track the multi-phase AI scraper generation process
CREATE TABLE IF NOT EXISTS scraper_ai_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_phase TEXT NOT NULL CHECK (current_phase IN ('analysis', 'url-collection', 'data-extraction', 'assembly', 'complete')),
  analysis_data JSONB DEFAULT '{}'::jsonb,
  url_collection_data JSONB DEFAULT '{}'::jsonb,
  data_extraction_data JSONB DEFAULT '{}'::jsonb,
  assembly_data JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_scraper_ai_sessions_user_id ON scraper_ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scraper_ai_sessions_competitor_id ON scraper_ai_sessions(competitor_id);
CREATE INDEX IF NOT EXISTS idx_scraper_ai_sessions_current_phase ON scraper_ai_sessions(current_phase);

-- Add comment to explain the purpose of the table
COMMENT ON TABLE scraper_ai_sessions IS 'Stores session data for the multi-phase AI scraper generation process';

-- Create tables for individual phases if they don't exist yet

-- Create scraper_analysis table to store site analysis results
CREATE TABLE IF NOT EXISTS scraper_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  url TEXT NOT NULL,
  base_url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  title TEXT,
  sitemap_urls TEXT[] DEFAULT '{}',
  brand_pages TEXT[] DEFAULT '{}',
  category_pages TEXT[] DEFAULT '{}',
  product_listing_pages TEXT[] DEFAULT '{}',
  api_endpoints JSONB DEFAULT '[]'::jsonb,
  proposed_strategy TEXT NOT NULL,
  strategy_description TEXT,
  html_sample TEXT,
  product_selectors JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraper_url_collection table to store URL collection results
CREATE TABLE IF NOT EXISTS scraper_url_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  analysis_id UUID REFERENCES scraper_analysis(id),
  urls TEXT[] DEFAULT '{}',
  total_count INTEGER DEFAULT 0,
  sample_urls TEXT[] DEFAULT '{}',
  execution_log TEXT[] DEFAULT '{}',
  generated_code TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraper_data_extraction table to store data extraction results
CREATE TABLE IF NOT EXISTS scraper_data_extraction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  url_collection_id UUID REFERENCES scraper_url_collection(id),
  products JSONB DEFAULT '[]'::jsonb,
  execution_log TEXT[] DEFAULT '{}',
  generated_code TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraper_script_assembly table to store script assembly results
CREATE TABLE IF NOT EXISTS scraper_script_assembly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  competitor_id UUID REFERENCES competitors(id) NOT NULL,
  data_extraction_id UUID REFERENCES scraper_data_extraction(id),
  assembled_script TEXT,
  validation_result JSONB,
  scraper_id UUID REFERENCES scrapers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies to the tables
ALTER TABLE scraper_ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_url_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_data_extraction ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_script_assembly ENABLE ROW LEVEL SECURITY;

-- Create policies for scraper_ai_sessions
CREATE POLICY "Users can view their own scraper AI sessions"
  ON scraper_ai_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scraper AI sessions"
  ON scraper_ai_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraper AI sessions"
  ON scraper_ai_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraper AI sessions"
  ON scraper_ai_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for scraper_analysis
CREATE POLICY "Users can view their own scraper analysis"
  ON scraper_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scraper analysis"
  ON scraper_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraper analysis"
  ON scraper_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraper analysis"
  ON scraper_analysis FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for scraper_url_collection
CREATE POLICY "Users can view their own scraper URL collection"
  ON scraper_url_collection FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scraper URL collection"
  ON scraper_url_collection FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraper URL collection"
  ON scraper_url_collection FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraper URL collection"
  ON scraper_url_collection FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for scraper_data_extraction
CREATE POLICY "Users can view their own scraper data extraction"
  ON scraper_data_extraction FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scraper data extraction"
  ON scraper_data_extraction FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraper data extraction"
  ON scraper_data_extraction FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraper data extraction"
  ON scraper_data_extraction FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for scraper_script_assembly
CREATE POLICY "Users can view their own scraper script assembly"
  ON scraper_script_assembly FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scraper script assembly"
  ON scraper_script_assembly FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scraper script assembly"
  ON scraper_script_assembly FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scraper script assembly"
  ON scraper_script_assembly FOR DELETE
  USING (auth.uid() = user_id);
