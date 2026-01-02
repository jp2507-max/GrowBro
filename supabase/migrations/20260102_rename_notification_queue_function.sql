-- Migration: Rename notification queue trigger function to match repo
-- Fixes naming inconsistency where production has update_push_notification_queue_updated_at
-- but repo defines update_notification_queue_updated_at

-- Rename the function
ALTER FUNCTION public.update_push_notification_queue_updated_at() 
  RENAME TO update_notification_queue_updated_at;

-- Update the trigger to reference the renamed function
DROP TRIGGER IF EXISTS trigger_notification_queue_updated_at ON notification_queue;
CREATE TRIGGER trigger_notification_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_queue_updated_at();
