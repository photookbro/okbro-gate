-- 대회 테이블
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  type TEXT CHECK (type IN ('marathon', 'granfondo', 'cycling', 'other')) DEFAULT 'marathon',
  photo_count INTEGER DEFAULT 0,
  cover_image_url TEXT,
  drive_folder_id TEXT NOT NULL,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_radius_meters INTEGER DEFAULT 200,
  gps_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사진 테이블
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  bib_number TEXT,
  participant_name TEXT,
  taken_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_bib ON photos(bib_number);
CREATE INDEX idx_photos_name ON photos(participant_name);
CREATE INDEX idx_photos_event ON photos(event_id);

-- 잠금해제 기록
CREATE TABLE unlock_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  photo_id UUID REFERENCES photos(id),
  order_number TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('naver', 'coupang')) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, photo_id)
);

-- GPS 통과 로그
CREATE TABLE gps_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_id UUID REFERENCES events(id),
  passed_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT false
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_public_read" ON events FOR SELECT USING (true);
CREATE POLICY "photos_public_read" ON photos FOR SELECT USING (true);
CREATE POLICY "unlock_own" ON unlock_records
  FOR ALL USING (auth.uid()::text = user_id);
CREATE POLICY "유저 본인 select" ON gps_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "유저 본인 insert" ON gps_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
