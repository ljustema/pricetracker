-- process_custom_fields_from_raw_data expects this helper when auto-creating
-- product custom fields from integration/scraper raw data.

CREATE OR REPLACE FUNCTION public.detect_custom_field_type(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_value text;
BEGIN
  v_value := nullif(trim(p_value), '');

  IF v_value IS NULL THEN
    RETURN 'text';
  END IF;

  IF lower(v_value) IN ('true', 'false', 'yes', 'no') THEN
    RETURN 'boolean';
  END IF;

  IF v_value ~* '^https?://' THEN
    RETURN 'url';
  END IF;

  IF v_value ~ '^[+-]?([0-9]+([.][0-9]+)?|[.][0-9]+)$' THEN
    RETURN 'number';
  END IF;

  IF v_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR v_value ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN
    RETURN 'date';
  END IF;

  RETURN 'text';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.detect_custom_field_type(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_custom_field_type(text) TO service_role;
