-- Convert guide content to JSON block array; drop unused global font_size.
-- Legacy plain markdown becomes one block (font_size 16, or previous column value).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_content'
      AND column_name = 'font_size'
  ) THEN
    EXECUTE $sql$
      UPDATE app_content
      SET content = jsonb_build_array(
        jsonb_build_object(
          'text', content,
          'font_size',
          CASE
            WHEN font_size IN (14, 16, 18, 20, 24) THEN font_size
            ELSE 16
          END
        )
      )::text
      WHERE key = 'onboarding_guide_consent'
        AND content IS NOT NULL
        AND left(trim(content), 1) <> '['
    $sql$;
  ELSE
    UPDATE app_content
    SET content = jsonb_build_array(
      jsonb_build_object('text', content, 'font_size', 16)
    )::text
    WHERE key = 'onboarding_guide_consent'
      AND content IS NOT NULL
      AND left(trim(content), 1) <> '[';
  END IF;
END $$;

ALTER TABLE app_content DROP COLUMN IF EXISTS font_size;
