-- Add 'failed' status to account_deletion_requests table
-- This allows the process-deletion-cascade function to properly mark failed deletions

-- Drop the existing check constraint
ALTER TABLE public.account_deletion_requests
DROP CONSTRAINT IF EXISTS account_deletion_requests_status_check;

-- Add new check constraint with 'failed' status
ALTER TABLE public.account_deletion_requests
ADD CONSTRAINT account_deletion_requests_status_check
CHECK (status IN ('pending', 'cancelled', 'completed', 'failed'));

-- Update the comment to reflect the new status
COMMENT ON COLUMN public.account_deletion_requests.status IS 'pending: awaiting grace period expiry, cancelled: user restored account, completed: deletion executed successfully, failed: deletion process failed';
