
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL,
  company_name text,
  amount bigint NOT NULL DEFAULT 0,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  receipt_base64 text,
  approved_until text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
