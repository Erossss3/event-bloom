
-- Storage policies (open read + insert for event content; anyone can read, anyone can upload)
CREATE POLICY "public read covers" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'covers');
CREATE POLICY "auth upload covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'covers');
CREATE POLICY "auth manage covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'covers');
CREATE POLICY "auth delete covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'covers');

CREATE POLICY "public read gallery" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'gallery');
CREATE POLICY "anyone upload gallery" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'gallery');
CREATE POLICY "auth delete gallery" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'gallery');

CREATE POLICY "public read memories" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'memories');
CREATE POLICY "anyone upload memories" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'memories');
CREATE POLICY "auth delete memories" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'memories');

CREATE POLICY "public read avatars" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');
CREATE POLICY "anyone upload avatars" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "auth delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "public read exports" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'exports');
CREATE POLICY "auth upload exports" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exports');
CREATE POLICY "auth delete exports" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exports');
