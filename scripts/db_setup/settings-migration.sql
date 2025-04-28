-- Settings Page Migration Script
-- This script adds the necessary database changes for the settings page

-- 1. Add new columns to next_auth.users table
ALTER TABLE next_auth.users 
ADD COLUMN IF NOT EXISTS language TEXT,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB,
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- 2. Create new companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES next_auth.users(id) NOT NULL,
  name TEXT,
  address TEXT,
  org_number TEXT,
  primary_currency TEXT CHECK (char_length(primary_currency) = 3),
  secondary_currencies TEXT[],
  currency_format TEXT,
  matching_rules JSONB,
  price_thresholds JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add RLS policies for companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;
CREATE POLICY "Users can view their own company"
  ON public.companies
  FOR SELECT
  USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can update their own company" ON public.companies;
CREATE POLICY "Users can update their own company"
  ON public.companies
  FOR UPDATE
  USING (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can insert their own company" ON public.companies;
CREATE POLICY "Users can insert their own company"
  ON public.companies
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = user_id);

DROP POLICY IF EXISTS "Users can delete their own company" ON public.companies;
CREATE POLICY "Users can delete their own company"
  ON public.companies
  FOR DELETE
  USING (auth.uid()::uuid = user_id);

-- 4. Update the create_profile_for_user trigger to sync changes
CREATE OR REPLACE FUNCTION update_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user_profile when next_auth.users is updated
  UPDATE public.user_profiles
  SET 
    name = NEW.name,
    avatar_url = NEW.image,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_user_profile_trigger ON next_auth.users;
CREATE TRIGGER update_user_profile_trigger
  AFTER UPDATE ON next_auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile();

-- 5. Create a function to get or create a company for a user
CREATE OR REPLACE FUNCTION get_or_create_company(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Check if the user already has a company
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If not, create a new company
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      user_id,
      primary_currency,
      currency_format,
      matching_rules,
      price_thresholds
    ) VALUES (
      p_user_id,
      'SEK',
      '#,##0.00',
      '{"ean_priority": true, "sku_brand_fallback": true}'::jsonb,
      '{"significant_increase": 10.0, "significant_decrease": 5.0}'::jsonb
    )
    RETURNING id INTO v_company_id;
  END IF;
  
  RETURN v_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
