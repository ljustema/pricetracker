CREATE OR REPLACE FUNCTION public.claim_next_integration_job()
RETURNS SETOF public.integration_runs
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  claimed_job_id uuid;
BEGIN
  SELECT ir.id
  INTO claimed_job_id
  FROM public.integration_runs ir
  JOIN public.integrations i ON i.id = ir.integration_id
  WHERE ir.status = 'pending'
    AND i.is_active = true
  ORDER BY ir.created_at
  LIMIT 1
  FOR UPDATE OF ir SKIP LOCKED;

  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.integration_runs ir
  SET status = 'processing', started_at = now()
  WHERE ir.id = claimed_job_id
    AND ir.status = 'pending'
  RETURNING ir.*;
END;
$function$;
