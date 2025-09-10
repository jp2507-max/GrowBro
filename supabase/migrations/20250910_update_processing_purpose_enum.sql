-- Update processing_purpose_enum to split aiDiagnosis into aiInference and aiTraining
-- Safe to apply since no existing records use aiDiagnosis

-- Add new enum values
ALTER TYPE processing_purpose_enum ADD VALUE 'aiInference';
ALTER TYPE processing_purpose_enum ADD VALUE 'aiTraining';

-- Note: In PostgreSQL, we cannot directly remove enum values that might be used,
-- but since we verified no records exist with aiDiagnosis, we could remove it.
-- However, for safety, we'll leave it for now and handle removal in a future migration
-- if needed after confirming no references exist in application code.