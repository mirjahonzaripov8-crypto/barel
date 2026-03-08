
CREATE TABLE public.telegram_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  company_key text,
  user_login text,
  state text NOT NULL DEFAULT 'IDLE',
  data jsonb DEFAULT '{}'::jsonb,
  current_fuel_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chat_id)
);

ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on telegram_sessions" ON public.telegram_sessions FOR ALL USING (true) WITH CHECK (true);
