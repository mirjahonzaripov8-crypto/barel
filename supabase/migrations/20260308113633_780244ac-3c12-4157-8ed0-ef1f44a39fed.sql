
CREATE TABLE public.telegram_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL UNIQUE,
  chat_id text,
  enabled boolean DEFAULT false,
  daily_report_time text DEFAULT '20:00',
  live_notifications boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on telegram_settings"
  ON public.telegram_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);
