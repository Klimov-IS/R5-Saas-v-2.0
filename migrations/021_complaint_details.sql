-- ============================================
-- Migration 021: Create complaint_details table
-- Date: 2026-02-20
-- Description: Source of truth for actually filed & approved complaints.
--              Mirrors Google Sheets "Жалобы V 2.0" data.
--              Used for: AI training, billing, client reporting.
--              Populated by Chrome Extension via POST /api/extension/complaint-details.
-- ============================================

CREATE TABLE IF NOT EXISTS complaint_details (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Mirror of Google Sheets "Жалобы V 2.0" columns (A–M)
  check_date            DATE NOT NULL,                     -- A: Дата проверки
  cabinet_name          TEXT NOT NULL,                     -- B: Кабинет (WB store name)
  articul               TEXT NOT NULL,                     -- C: Артикул WB (nmId)
  review_ext_id         TEXT,                              -- D: ID отзыва (reserved, currently empty)
  feedback_rating       INTEGER NOT NULL,                  -- E: Рейтинг отзыва (1-5)
  feedback_date         TEXT NOT NULL,                     -- F: Дата отзыва (WB original format, e.g. "18 февр. 2026 г. в 21:45")
  complaint_submit_date TEXT,                              -- G: Дата подачи жалобы (DD.MM.YYYY or DD.MM)
  status                TEXT NOT NULL DEFAULT 'approved',  -- H: Статус (always "approved" for now)
  has_screenshot        BOOLEAN NOT NULL DEFAULT TRUE,     -- I: Скриншот (always true)
  file_name             TEXT NOT NULL,                     -- J: Имя файла скриншота
  drive_link            TEXT,                              -- K: Ссылка Google Drive
  complaint_category    TEXT NOT NULL,                     -- L: Категория жалобы
  complaint_text        TEXT NOT NULL,                     -- M: Полный текст жалобы

  -- Derived fields
  filed_by              TEXT,                              -- 'r5' | 'seller' (derived from complaint_text prefix)

  -- Optional links to internal entities (for future async matching)
  review_id             TEXT REFERENCES reviews(id) ON DELETE SET NULL,
  review_complaint_id   TEXT REFERENCES review_complaints(id) ON DELETE SET NULL,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Dedup: same store + product + review date + screenshot file = same record
  UNIQUE(store_id, articul, feedback_date, file_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cd_store ON complaint_details(store_id);
CREATE INDEX IF NOT EXISTS idx_cd_store_date ON complaint_details(store_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_cd_articul ON complaint_details(store_id, articul);
CREATE INDEX IF NOT EXISTS idx_cd_category ON complaint_details(complaint_category);
CREATE INDEX IF NOT EXISTS idx_cd_filed_by ON complaint_details(filed_by) WHERE filed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cd_review ON complaint_details(review_id) WHERE review_id IS NOT NULL;

-- Comments
COMMENT ON TABLE complaint_details IS 'Source of truth for actually filed & WB-approved complaints. Mirrors Google Sheets "Жалобы V 2.0". Populated by Chrome Extension.';
COMMENT ON COLUMN complaint_details.feedback_date IS 'WB original locale format string (e.g. "18 февр. 2026 г. в 21:45"). Stored as-is, not parsed.';
COMMENT ON COLUMN complaint_details.filed_by IS 'Who filed: r5 (complaint_text starts with "Жалоба от:") or seller (otherwise)';
COMMENT ON COLUMN complaint_details.review_id IS 'Async match to internal reviews table (nullable, populated later)';
COMMENT ON COLUMN complaint_details.review_complaint_id IS 'Link to AI-generated draft in review_complaints (nullable)';
