
-- Enums
CREATE TYPE public.event_status AS ENUM ('draft','published','live','finished','archived');
CREATE TYPE public.rsvp_status AS ENUM ('confirmed','declined','pending');
CREATE TYPE public.media_kind AS ENUM ('photo','video','audio');
CREATE TYPE public.moderation_status AS ENUM ('pending','approved','rejected');

-- Trigger util
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Auto crear profile al registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  event_type TEXT,
  location_name TEXT,
  location_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/Argentina/Buenos_Aires',
  status public.event_status NOT NULL DEFAULT 'draft',
  theme_color TEXT DEFAULT '#B8946A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_owner ON public.events(owner_id);
CREATE INDEX idx_events_slug ON public.events(slug);
CREATE INDEX idx_events_status ON public.events(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view non-draft events" ON public.events FOR SELECT TO anon, authenticated
  USING (status <> 'draft' OR owner_id = auth.uid());
CREATE POLICY "owner insert event" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update event" ON public.events FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete event" ON public.events FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Helper: es owner del evento
CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND owner_id = auth.uid());
$$;

-- Helper: evento acepta interacciones públicas
CREATE OR REPLACE FUNCTION public.event_accepts_public(_event_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND status IN ('published','live','finished'));
$$;

-- EVENT_SETTINGS
CREATE TABLE public.event_settings (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  allow_guest_uploads BOOLEAN NOT NULL DEFAULT true,
  moderate_photos BOOLEAN NOT NULL DEFAULT false,
  moderate_messages BOOLEAN NOT NULL DEFAULT false,
  allow_rsvp BOOLEAN NOT NULL DEFAULT true,
  allow_messages BOOLEAN NOT NULL DEFAULT true,
  allow_memories BOOLEAN NOT NULL DEFAULT true,
  music_url TEXT,
  slideshow_duration_seconds INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_settings TO authenticated;
GRANT SELECT ON public.event_settings TO anon;
GRANT ALL ON public.event_settings TO service_role;
ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings visible with event" ON public.event_settings FOR SELECT TO anon, authenticated
  USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
CREATE POLICY "owner manage settings" ON public.event_settings FOR ALL TO authenticated
  USING (public.is_event_owner(event_id)) WITH CHECK (public.is_event_owner(event_id));
CREATE TRIGGER trg_event_settings_updated BEFORE UPDATE ON public.event_settings FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Crear settings al crear evento
CREATE OR REPLACE FUNCTION public.tg_create_event_settings()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_settings(event_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_events_create_settings AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_create_event_settings();

-- GUESTS (sin cuenta)
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, device_token)
);
CREATE INDEX idx_guests_event ON public.guests(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.guests TO anon;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can view guests of accessible event" ON public.guests FOR SELECT TO anon, authenticated
  USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
CREATE POLICY "public can join event" ON public.guests FOR INSERT TO anon, authenticated
  WITH CHECK (public.event_accepts_public(event_id));
CREATE POLICY "public can update own guest row" ON public.guests FOR UPDATE TO anon, authenticated
  USING (public.event_accepts_public(event_id));
CREATE POLICY "owner delete guests" ON public.guests FOR DELETE TO authenticated
  USING (public.is_event_owner(event_id));
CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- RSVPS
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  status public.rsvp_status NOT NULL DEFAULT 'pending',
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  dietary TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rsvps_event ON public.rsvps(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rsvps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rsvps TO anon;
GRANT ALL ON public.rsvps TO service_role;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public view rsvps of event" ON public.rsvps FOR SELECT TO anon, authenticated
  USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
CREATE POLICY "public create rsvp" ON public.rsvps FOR INSERT TO anon, authenticated
  WITH CHECK (public.event_accepts_public(event_id));
CREATE POLICY "public update rsvp" ON public.rsvps FOR UPDATE TO anon, authenticated
  USING (public.event_accepts_public(event_id));
CREATE TRIGGER trg_rsvps_updated BEFORE UPDATE ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- GALLERY
CREATE TABLE public.gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  uploaded_by_owner BOOLEAN NOT NULL DEFAULT false,
  kind public.media_kind NOT NULL DEFAULT 'photo',
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INT,
  height INT,
  caption TEXT,
  moderation public.moderation_status NOT NULL DEFAULT 'approved',
  featured BOOLEAN NOT NULL DEFAULT false,
  ai_score REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gallery_event ON public.gallery(event_id);
CREATE INDEX idx_gallery_created ON public.gallery(event_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery TO authenticated;
GRANT SELECT, INSERT ON public.gallery TO anon;
GRANT ALL ON public.gallery TO service_role;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public view approved gallery" ON public.gallery FOR SELECT TO anon, authenticated
  USING ((public.event_accepts_public(event_id) AND moderation = 'approved') OR public.is_event_owner(event_id));
CREATE POLICY "public upload to event" ON public.gallery FOR INSERT TO anon, authenticated
  WITH CHECK (public.event_accepts_public(event_id));
CREATE POLICY "owner update gallery" ON public.gallery FOR UPDATE TO authenticated
  USING (public.is_event_owner(event_id));
CREATE POLICY "owner delete gallery" ON public.gallery FOR DELETE TO authenticated
  USING (public.is_event_owner(event_id));

-- GALLERY REACTIONS
CREATE TABLE public.gallery_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.gallery(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  emoji TEXT NOT NULL DEFAULT '❤️',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reactions_gallery ON public.gallery_reactions(gallery_id);
GRANT SELECT, INSERT, DELETE ON public.gallery_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.gallery_reactions TO anon;
GRANT ALL ON public.gallery_reactions TO service_role;
ALTER TABLE public.gallery_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view reactions" ON public.gallery_reactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anyone react" ON public.gallery_reactions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone delete own reactions" ON public.gallery_reactions FOR DELETE TO anon, authenticated USING (true);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  emoji TEXT,
  moderation public.moderation_status NOT NULL DEFAULT 'approved',
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_event ON public.messages(event_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.messages TO anon;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public view approved messages" ON public.messages FOR SELECT TO anon, authenticated
  USING ((public.event_accepts_public(event_id) AND moderation='approved') OR public.is_event_owner(event_id));
CREATE POLICY "public post message" ON public.messages FOR INSERT TO anon, authenticated
  WITH CHECK (public.event_accepts_public(event_id) AND length(body) BETWEEN 1 AND 1000);
CREATE POLICY "owner update messages" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_event_owner(event_id));
CREATE POLICY "owner delete messages" ON public.messages FOR DELETE TO authenticated
  USING (public.is_event_owner(event_id));

-- MEMORIES
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  text_content TEXT,
  media_url TEXT,
  media_kind public.media_kind,
  moderation public.moderation_status NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_memories_event ON public.memories(event_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT SELECT, INSERT ON public.memories TO anon;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public view memories" ON public.memories FOR SELECT TO anon, authenticated
  USING ((public.event_accepts_public(event_id) AND moderation='approved') OR public.is_event_owner(event_id));
CREATE POLICY "public create memory" ON public.memories FOR INSERT TO anon, authenticated
  WITH CHECK (public.event_accepts_public(event_id));
CREATE POLICY "owner update memories" ON public.memories FOR UPDATE TO authenticated USING (public.is_event_owner(event_id));
CREATE POLICY "owner delete memories" ON public.memories FOR DELETE TO authenticated USING (public.is_event_owner(event_id));

-- SLIDESHOWS
CREATE TABLE public.slideshows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Slideshow',
  duration_seconds INT NOT NULL DEFAULT 5,
  music_url TEXT,
  transition TEXT DEFAULT 'fade',
  auto_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slideshows TO authenticated;
GRANT SELECT ON public.slideshows TO anon;
GRANT ALL ON public.slideshows TO service_role;
ALTER TABLE public.slideshows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view slideshows" ON public.slideshows FOR SELECT TO anon, authenticated
  USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
CREATE POLICY "owner manage slideshows" ON public.slideshows FOR ALL TO authenticated
  USING (public.is_event_owner(event_id)) WITH CHECK (public.is_event_owner(event_id));
CREATE TRIGGER trg_slideshows_updated BEFORE UPDATE ON public.slideshows FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.slideshow_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slideshow_id UUID NOT NULL REFERENCES public.slideshows(id) ON DELETE CASCADE,
  gallery_id UUID NOT NULL REFERENCES public.gallery(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_slideshow_items ON public.slideshow_items(slideshow_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slideshow_items TO authenticated;
GRANT SELECT ON public.slideshow_items TO anon;
GRANT ALL ON public.slideshow_items TO service_role;
ALTER TABLE public.slideshow_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view slideshow items" ON public.slideshow_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner manage items" ON public.slideshow_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.slideshows s WHERE s.id = slideshow_id AND public.is_event_owner(s.event_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.slideshows s WHERE s.id = slideshow_id AND public.is_event_owner(s.event_id)));

-- VIDEOS
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  style TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'horizontal',
  status TEXT NOT NULL DEFAULT 'pending',
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view videos" ON public.videos FOR SELECT TO anon, authenticated
  USING (public.event_accepts_public(event_id) OR public.is_event_owner(event_id));
CREATE POLICY "owner manage videos" ON public.videos FOR ALL TO authenticated
  USING (public.is_event_owner(event_id)) WITH CHECK (public.is_event_owner(event_id));
CREATE TRIGGER trg_videos_updated BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- EVENT_VISITS
CREATE TABLE public.event_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visits_event ON public.event_visits(event_id, visited_at DESC);
GRANT SELECT, INSERT ON public.event_visits TO authenticated;
GRANT SELECT, INSERT ON public.event_visits TO anon;
GRANT ALL ON public.event_visits TO service_role;
ALTER TABLE public.event_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner view visits" ON public.event_visits FOR SELECT TO authenticated USING (public.is_event_owner(event_id));
CREATE POLICY "record visit" ON public.event_visits FOR INSERT TO anon, authenticated
  WITH CHECK (public.event_accepts_public(event_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guests;
