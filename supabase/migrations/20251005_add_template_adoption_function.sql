-- Migration: Add function to increment template adoption count
-- This function safely increments the adoption count for a template

CREATE OR REPLACE FUNCTION public.increment_template_adoption(template_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.community_playbook_templates
  SET adoption_count = adoption_count + 1
  WHERE id = template_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_template_adoption(UUID) TO authenticated;
