ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS operational_report_email text,
  ADD COLUMN IF NOT EXISTS operational_report_mode text NOT NULL DEFAULT 'disabled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_operational_report_mode_check'
      AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_operational_report_mode_check
      CHECK (operational_report_mode IN ('disabled', 'daily', 'issues_only'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_id_unique
  ON public.user_settings (user_id);

CREATE TABLE IF NOT EXISTS public.operational_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily', 'issues')),
  report_date date NOT NULL,
  issue_signature text NOT NULL DEFAULT '',
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS operational_report_deliveries_daily_unique
  ON public.operational_report_deliveries (user_id, report_date, report_type)
  WHERE report_type = 'daily';

CREATE UNIQUE INDEX IF NOT EXISTS operational_report_deliveries_issue_unique
  ON public.operational_report_deliveries (user_id, report_type, issue_signature)
  WHERE report_type = 'issues';

ALTER TABLE public.operational_report_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'operational_report_deliveries'
      AND policyname = 'Users can view their own operational report deliveries'
  ) THEN
    CREATE POLICY "Users can view their own operational report deliveries"
      ON public.operational_report_deliveries
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;
