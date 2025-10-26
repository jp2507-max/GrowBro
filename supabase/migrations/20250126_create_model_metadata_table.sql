-- Create model_metadata table for tracking model versions and rollout
-- Requirements: 10.1, 10.2 (Model lifecycle management and remote config)

CREATE TABLE IF NOT EXISTS public.model_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  model_type TEXT NOT NULL DEFAULT 'plant_classifier',
  
  -- Model file information
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  
  -- Model architecture details
  architecture TEXT, -- e.g., 'EfficientNet-Lite0', 'MobileNetV3-Small'
  quantization TEXT, -- e.g., 'INT8', 'FP16', 'FP32'
  input_shape JSONB, -- e.g., [1, 224, 224, 3]
  
  -- Execution providers
  supported_providers JSONB, -- e.g., ['xnnpack', 'nnapi', 'coreml']
  
  -- Rollout configuration
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  shadow_mode BOOLEAN NOT NULL DEFAULT false,
  shadow_percentage INTEGER DEFAULT 0 CHECK (shadow_percentage >= 0 AND shadow_percentage <= 100),
  
  -- Rollback configuration
  rollback_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.15 CHECK (rollback_threshold >= 0 AND rollback_threshold <= 1),
  is_stable BOOLEAN NOT NULL DEFAULT false,
  previous_stable_version TEXT,
  
  -- Performance metrics
  target_latency_ms INTEGER,
  min_app_version TEXT,
  
  -- Status and lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'active', 'deprecated', 'archived')),
  deployed_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  
  -- Metadata
  description TEXT,
  release_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_model_metadata_version ON public.model_metadata(version);
CREATE INDEX IF NOT EXISTS idx_model_metadata_status ON public.model_metadata(status);
CREATE INDEX IF NOT EXISTS idx_model_metadata_is_stable ON public.model_metadata(is_stable);
CREATE INDEX IF NOT EXISTS idx_model_metadata_created_at ON public.model_metadata(created_at DESC);

-- Enable RLS
ALTER TABLE public.model_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active/testing models (for client-side model config)
CREATE POLICY "Public read access to active models"
  ON public.model_metadata
  FOR SELECT
  USING (status IN ('active', 'testing'));

-- Policy: Only authenticated users can read all models
CREATE POLICY "Authenticated users can read all models"
  ON public.model_metadata
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can insert/update/delete
-- (Model management should be done via admin tools or CI/CD)
CREATE POLICY "Service role can manage models"
  ON public.model_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_model_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_model_metadata_updated_at
  BEFORE UPDATE ON public.model_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_model_metadata_updated_at();

-- Insert default model version (v1.0.0)
INSERT INTO public.model_metadata (
  version,
  model_type,
  file_path,
  file_size_bytes,
  checksum_sha256,
  architecture,
  quantization,
  input_shape,
  supported_providers,
  rollout_percentage,
  is_stable,
  status,
  description
) VALUES (
  'v1.0.0',
  'plant_classifier',
  'models/plant_classifier_v1.0.0.ort',
  5242880, -- 5MB placeholder
  'placeholder_checksum_replace_with_actual',
  'EfficientNet-Lite0',
  'INT8',
  '{"shape": [1, 224, 224, 3]}'::jsonb,
  '["xnnpack", "nnapi", "coreml"]'::jsonb,
  100,
  true,
  'active',
  'Initial baseline model for plant health assessment'
) ON CONFLICT (version) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.model_metadata IS 'Stores metadata for ML model versions including rollout configuration and performance metrics';
