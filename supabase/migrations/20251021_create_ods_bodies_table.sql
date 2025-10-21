-- Migration: Create ODS Bodies table for DSA Art. 21 Out-of-Court Dispute Settlement
-- Implements: Certified ODS body directory with eligibility criteria and quality metrics
--
-- DSA Compliance: Art. 21 (Out-of-court dispute settlement)
--
-- Requirements: 4.8, 13.1

-- ============================================================================
-- ODS Bodies (DSA Art. 21 Certified Dispute Resolution Providers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ods_bodies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Organization details
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  
  -- Certification
  certification_number TEXT NOT NULL UNIQUE,
  certified_by TEXT NOT NULL, -- e.g., 'European Commission'
  certification_date TIMESTAMPTZ NOT NULL,
  expiration_date TIMESTAMPTZ,
  
  -- Specialization and jurisdiction
  languages TEXT[] NOT NULL DEFAULT '{}', -- ISO 639-1 codes (e.g., ['en', 'de', 'fr'])
  jurisdictions TEXT[] NOT NULL DEFAULT '{}', -- ISO 3166-1 alpha-2 codes (e.g., ['DE', 'AT', 'EU'])
  specialization TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['content_moderation', 'account_suspension']
  
  -- Status
  status TEXT NOT NULL DEFAULT 'certified' CHECK (status IN ('certified', 'suspended', 'revoked')),
  
  -- Contact and submission process
  submission_url TEXT NOT NULL,
  submission_instructions TEXT NOT NULL,
  
  -- Performance metrics (for user guidance)
  average_resolution_days INTEGER NOT NULL DEFAULT 90,
  
  -- Processing fee (optional)
  processing_fee_amount DECIMAL(10,2),
  processing_fee_currency TEXT, -- ISO 4217 code
  processing_fee_description TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for efficient filtering and querying
CREATE INDEX IF NOT EXISTS idx_ods_bodies_status 
  ON public.ods_bodies (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ods_bodies_certification 
  ON public.ods_bodies (certification_number) WHERE status = 'certified';

CREATE INDEX IF NOT EXISTS idx_ods_bodies_jurisdictions 
  ON public.ods_bodies USING GIN (jurisdictions);

CREATE INDEX IF NOT EXISTS idx_ods_bodies_languages 
  ON public.ods_bodies USING GIN (languages);

CREATE INDEX IF NOT EXISTS idx_ods_bodies_specialization 
  ON public.ods_bodies USING GIN (specialization);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ods_bodies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ods_bodies_updated_at
  BEFORE UPDATE ON public.ods_bodies
  FOR EACH ROW
  EXECUTE FUNCTION update_ods_bodies_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.ods_bodies IS 'DSA Art. 21 certified out-of-court dispute settlement bodies with specialization, jurisdiction, and quality metrics';
COMMENT ON COLUMN public.ods_bodies.certification_number IS 'Unique certification identifier issued by certifying authority';
COMMENT ON COLUMN public.ods_bodies.languages IS 'Supported languages for dispute resolution (ISO 639-1 codes)';
COMMENT ON COLUMN public.ods_bodies.jurisdictions IS 'Geographic jurisdictions covered (ISO 3166-1 alpha-2 codes)';
COMMENT ON COLUMN public.ods_bodies.specialization IS 'Types of disputes handled (e.g., content_moderation, account_suspension, geo_restriction)';
COMMENT ON COLUMN public.ods_bodies.average_resolution_days IS 'Average time to resolve disputes in days (used for user guidance)';
COMMENT ON COLUMN public.ods_bodies.status IS 'Certification status: certified (active), suspended (temporarily inactive), revoked (permanently inactive)';

-- ============================================================================
-- Initial seed data (example certified ODS bodies)
-- ============================================================================

-- Note: These are placeholder examples. In production, insert actual certified ODS bodies
-- from the European Commission's registry or other certifying authorities.

INSERT INTO public.ods_bodies (
  name,
  website,
  email,
  certification_number,
  certified_by,
  certification_date,
  languages,
  jurisdictions,
  specialization,
  submission_url,
  submission_instructions,
  average_resolution_days,
  status
) VALUES 
(
  'Example European Dispute Resolution Center',
  'https://example-ods-eu.org',
  'disputes@example-ods-eu.org',
  'EU-ODS-2025-001',
  'European Commission',
  '2025-01-01 00:00:00+00',
  ARRAY['en', 'de', 'fr'],
  ARRAY['EU', 'DE', 'FR', 'AT'],
  ARRAY['content_moderation', 'account_suspension', 'geo_restriction'],
  'https://example-ods-eu.org/submit',
  'Complete the online dispute form with your appeal reference number and supporting evidence. Include a detailed explanation of why you believe the platform decision should be reversed.',
  75,
  'certified'
)
ON CONFLICT (certification_number) DO NOTHING;
