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

-- 검색 인덱스
CREATE INDEX idx_photos_bib ON photos(bib_number);
CREATE INDEX idx_photos_name ON photos(participant_name);
CREATE INDEX idx_photos_event ON photos(event_id);

-- 잠금해제 기록 테이블
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

-- RLS 활성화
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_records ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책 (대회, 사진 미리보기)
CREATE POLICY "events_public_read" ON events FOR SELECT USING (true);
CREATE POLICY "photos_public_read" ON photos FOR SELECT USING (true);

-- 본인 잠금해제 기록만 접근
CREATE POLICY "unlock_own" ON unlock_records
  FOR ALL USING (auth.uid()::text = user_id);

-- 샘플 데이터
INSERT INTO events (name, date, location, type, photo_count, drive_folder_id) VALUES
  ('2025 홍천그란폰도', '2025-09-14', '강원도 홍천', 'granfondo', 0, 'FOLDER_ID_HERE'),
  ('2025 손기정평화마라톤', '2025-03-02', '서울 마포구', 'marathon', 0, 'FOLDER_ID_HERE'),
  ('2024 서울국제마라톤', '2024-03-17', '서울 광화문', 'marathon', 0, 'FOLDER_ID_HERE');
