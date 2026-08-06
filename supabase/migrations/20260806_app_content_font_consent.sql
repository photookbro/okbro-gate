-- font_size column removed — per-block sizes live inside content JSON.
-- Keep 3 editable consent checkbox labels.
ALTER TABLE app_content
  ADD COLUMN IF NOT EXISTS consent_label_1 text NOT NULL DEFAULT '링크 공유 금지 및 타인 사진 다운로드 금지에 동의합니다',
  ADD COLUMN IF NOT EXISTS consent_label_2 text NOT NULL DEFAULT '내용을 확인했습니다',
  ADD COLUMN IF NOT EXISTS consent_label_3 text NOT NULL DEFAULT '촬영 및 저작권 안내를 확인했습니다';

-- Replace earlier single consent_label column if it exists
ALTER TABLE app_content DROP COLUMN IF EXISTS consent_label;

UPDATE app_content
SET
  consent_label_1 = COALESCE(
    NULLIF(trim(consent_label_1), ''),
    '링크 공유 금지 및 타인 사진 다운로드 금지에 동의합니다'
  ),
  consent_label_2 = COALESCE(
    NULLIF(trim(consent_label_2), ''),
    '내용을 확인했습니다'
  ),
  consent_label_3 = COALESCE(
    NULLIF(trim(consent_label_3), ''),
    '촬영 및 저작권 안내를 확인했습니다'
  )
WHERE key = 'onboarding_guide_consent';
