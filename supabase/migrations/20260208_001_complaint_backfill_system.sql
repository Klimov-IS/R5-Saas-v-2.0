-- ============================================================================
-- TASK-004: Auto Backfill System for Complaints
-- ============================================================================
-- Создаёт систему автоматической догенерации жалоб при активации товара
--
-- Таблицы:
-- 1. complaint_backfill_jobs - очередь задач на догенерацию
-- 2. complaint_daily_limits - отслеживание дневных лимитов
--
-- @date 2026-02-08
-- ============================================================================

-- ============================================================================
-- 1. Таблица для отслеживания backfill jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaint_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  product_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'paused', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0, -- higher = more urgent

  -- Progress tracking
  total_reviews INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ,

  -- Daily limit tracking (per job)
  daily_generated INTEGER NOT NULL DEFAULT 0,
  daily_limit_date DATE,

  -- Error handling
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,

  -- Metadata
  triggered_by TEXT, -- 'product_activation', 'store_activation', 'manual', 'rules_change'
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Комментарии
COMMENT ON TABLE complaint_backfill_jobs IS 'Очередь задач на массовую генерацию жалоб';
COMMENT ON COLUMN complaint_backfill_jobs.status IS 'pending=ожидает, in_progress=выполняется, completed=завершено, paused=приостановлено (лимит), failed=ошибка';
COMMENT ON COLUMN complaint_backfill_jobs.priority IS 'Приоритет обработки (выше = раньше)';
COMMENT ON COLUMN complaint_backfill_jobs.triggered_by IS 'Причина создания: product_activation, store_activation, manual, rules_change';

-- Индексы
CREATE INDEX IF NOT EXISTS idx_backfill_status
  ON complaint_backfill_jobs(status);

CREATE INDEX IF NOT EXISTS idx_backfill_store
  ON complaint_backfill_jobs(store_id);

CREATE INDEX IF NOT EXISTS idx_backfill_product
  ON complaint_backfill_jobs(product_id);

CREATE INDEX IF NOT EXISTS idx_backfill_priority_created
  ON complaint_backfill_jobs(priority DESC, created_at ASC)
  WHERE status IN ('pending', 'in_progress');

-- Уникальный индекс: только одна активная задача на товар
CREATE UNIQUE INDEX IF NOT EXISTS idx_backfill_product_active
  ON complaint_backfill_jobs(product_id)
  WHERE status IN ('pending', 'in_progress', 'paused');

-- ============================================================================
-- 2. Таблица для отслеживания дневных лимитов
-- ============================================================================

CREATE TABLE IF NOT EXISTS complaint_daily_limits (
  store_id TEXT NOT NULL,
  date DATE NOT NULL,
  generated INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (store_id, date)
);

-- Комментарии
COMMENT ON TABLE complaint_daily_limits IS 'Отслеживание дневных лимитов генерации жалоб по магазинам';
COMMENT ON COLUMN complaint_daily_limits.limit_value IS 'Дневной лимит (по умолчанию 2000)';

-- Индекс для очистки старых записей
CREATE INDEX IF NOT EXISTS idx_daily_limits_date
  ON complaint_daily_limits(date);

-- ============================================================================
-- 3. Функция для автоматического обновления updated_at
-- ============================================================================

-- Триггер для updated_at (если не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггер к complaint_daily_limits
DROP TRIGGER IF EXISTS update_complaint_daily_limits_updated_at ON complaint_daily_limits;
CREATE TRIGGER update_complaint_daily_limits_updated_at
  BEFORE UPDATE ON complaint_daily_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Функция для получения оставшегося дневного лимита
-- ============================================================================

CREATE OR REPLACE FUNCTION get_remaining_daily_limit(p_store_id TEXT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
  v_limit INTEGER;
  v_generated INTEGER;
BEGIN
  SELECT limit_value, generated
  INTO v_limit, v_generated
  FROM complaint_daily_limits
  WHERE store_id = p_store_id AND date = p_date;

  IF NOT FOUND THEN
    RETURN 2000; -- Дефолтный лимит
  END IF;

  RETURN GREATEST(0, v_limit - v_generated);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Функция для инкремента дневного счётчика
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_daily_limit(p_store_id TEXT, p_count INTEGER, p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
  v_new_generated INTEGER;
BEGIN
  INSERT INTO complaint_daily_limits (store_id, date, generated, limit_value)
  VALUES (p_store_id, p_date, p_count, 2000)
  ON CONFLICT (store_id, date)
  DO UPDATE SET
    generated = complaint_daily_limits.generated + p_count,
    updated_at = NOW()
  RETURNING generated INTO v_new_generated;

  RETURN v_new_generated;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. View для мониторинга backfill
-- ============================================================================

CREATE OR REPLACE VIEW v_backfill_status AS
SELECT
  j.id,
  j.product_id,
  j.store_id,
  j.status,
  j.priority,
  j.total_reviews,
  j.processed,
  j.failed,
  j.skipped,
  j.total_reviews - j.processed - j.skipped as remaining,
  CASE
    WHEN j.total_reviews > 0
    THEN ROUND(100.0 * j.processed / j.total_reviews, 1)
    ELSE 0
  END as progress_percent,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.last_processed_at,
  j.daily_generated,
  j.triggered_by,
  j.last_error,
  j.retry_count,
  COALESCE(dl.generated, 0) as store_daily_generated,
  2000 - COALESCE(dl.generated, 0) as store_daily_remaining
FROM complaint_backfill_jobs j
LEFT JOIN complaint_daily_limits dl
  ON j.store_id = dl.store_id AND dl.date = CURRENT_DATE
ORDER BY
  CASE j.status
    WHEN 'in_progress' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'paused' THEN 3
    ELSE 4
  END,
  j.priority DESC,
  j.created_at ASC;

COMMENT ON VIEW v_backfill_status IS 'Статус всех backfill задач с прогрессом и дневными лимитами';

-- ============================================================================
-- Done
-- ============================================================================
