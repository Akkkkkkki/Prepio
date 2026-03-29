-- Fix RPC parameter names to match edge function progress-tracker.ts
DROP FUNCTION IF EXISTS update_search_progress(UUID, TEXT, TEXT, SMALLINT, TEXT);
CREATE OR REPLACE FUNCTION update_search_progress(
  search_uuid UUID,
  new_status TEXT DEFAULT NULL,
  new_step TEXT DEFAULT NULL,
  new_percentage SMALLINT DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE searches SET
    status         = COALESCE(new_status, status),
    progress_step  = COALESCE(new_step, progress_step),
    progress_pct   = COALESCE(new_percentage, progress_pct),
    error_message  = COALESCE(error_msg, error_message),
    started_at     = CASE WHEN new_status = 'processing' AND started_at IS NULL
                     THEN now() ELSE started_at END,
    completed_at   = CASE WHEN new_status IN ('completed','failed')
                     THEN now() ELSE completed_at END,
    updated_at     = now()
  WHERE id = search_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
