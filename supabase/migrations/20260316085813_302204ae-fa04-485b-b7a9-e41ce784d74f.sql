
-- Create storage bucket for plomba media (videos and photos)
INSERT INTO storage.buckets (id, name, public) VALUES ('plomba-media', 'plomba-media', true) ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read plomba media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'plomba-media');

-- Allow anyone to upload (since we don't use supabase auth)
CREATE POLICY "Public insert plomba media" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'plomba-media');

-- Allow anyone to delete
CREATE POLICY "Public delete plomba media" ON storage.objects FOR DELETE TO public USING (bucket_id = 'plomba-media');
