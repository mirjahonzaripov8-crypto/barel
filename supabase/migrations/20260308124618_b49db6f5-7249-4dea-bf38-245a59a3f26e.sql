CREATE TABLE public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL,
  company_name text,
  login text NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'OPERATOR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_key, login)
);

ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on company_users" ON public.company_users FOR ALL USING (true) WITH CHECK (true);