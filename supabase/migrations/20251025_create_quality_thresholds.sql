BEGIN;

-- Create platform enum if it does not exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quality_platform_enum') THEN
    CREATE TYPE quality_platform_enum AS ENUM ('ios', 'android', 'universal');
  END IF;
END $$;

-- Ensure helper trigger exists for updated_at maintenance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = timezone('utc', now());
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS quality_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform quality_platform_enum NOT NULL DEFAULT 'universal',
  device_tier text,
  blur_min_variance double precision NOT NULL,
  blur_severe_variance double precision NOT NULL,
  blur_weight double precision NOT NULL,
  exposure_under_max_ratio double precision NOT NULL,
  exposure_over_max_ratio double precision NOT NULL,
  exposure_range_min double precision NOT NULL,
  exposure_range_max double precision NOT NULL,
  exposure_weight double precision NOT NULL,
  white_balance_max_deviation double precision NOT NULL,
  white_balance_severe_deviation double precision NOT NULL,
  white_balance_weight double precision NOT NULL,
  composition_min_plant_coverage double precision NOT NULL,
  composition_min_center_coverage double precision NOT NULL,
  composition_weight double precision NOT NULL,
  acceptable_score integer NOT NULL,
  borderline_score integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  rollout_percentage integer NOT NULL DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure device_tier uniqueness per platform/version
CREATE UNIQUE INDEX IF NOT EXISTS quality_thresholds_platform_tier_version_idx
  ON quality_thresholds (platform, COALESCE(device_tier, 'default'), version);

-- Speed up platform lookups
CREATE INDEX IF NOT EXISTS quality_thresholds_platform_idx
  ON quality_thresholds (platform, device_tier, version);

-- Maintain updated_at on row updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'quality_thresholds_set_updated_at'
  ) THEN
    CREATE TRIGGER quality_thresholds_set_updated_at
      BEFORE UPDATE ON quality_thresholds
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Seed default thresholds mirroring on-device defaults
INSERT INTO quality_thresholds (
  platform,
  device_tier,
  blur_min_variance,
  blur_severe_variance,
  blur_weight,
  exposure_under_max_ratio,
  exposure_over_max_ratio,
  exposure_range_min,
  exposure_range_max,
  exposure_weight,
  white_balance_max_deviation,
  white_balance_severe_deviation,
  white_balance_weight,
  composition_min_plant_coverage,
  composition_min_center_coverage,
  composition_weight,
  acceptable_score,
  borderline_score,
  version,
  rollout_percentage
)
VALUES (
  'universal',
  NULL,
  100,
  60,
  0.35,
  0.18,
  0.18,
  0.25,
  0.75,
  0.25,
  0.15,
  0.25,
  0.2,
  0.38,
  0.22,
  0.2,
  75,
  60,
  1,
  100
)
ON CONFLICT DO NOTHING;

COMMIT;
