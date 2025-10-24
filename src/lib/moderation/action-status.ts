/**
 * Action Status - Queries execution status of moderation actions
 */

import { supabase } from '../supabase';

/**
 * Gets action execution status
 */
export async function getExecutionStatus(executionId: string): Promise<{
  executed: boolean;
  expires_at?: Date;
  active: boolean;
}> {
  const { data, error } = await supabase
    .from('action_executions')
    .select('executed_at, expires_at')
    .eq('id', executionId)
    .single();

  if (error || !data) {
    return { executed: false, active: false };
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;
  const active = expiresAt ? expiresAt > new Date() : true;

  return {
    executed: true,
    expires_at: expiresAt,
    active,
  };
}
