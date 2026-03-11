-- Migration 031: Add Store Lifecycle Stage
--
-- Adds business lifecycle stage to stores table to track client progress.
--
-- Problem: Current stores.status (active/paused/stopped) is not informative.
-- Does not show WHERE client is in workflow (contract → access → setup → work → monitoring).
--
-- Solution: Add stores.stage field with 8 lifecycle stages:
--   1. contract — договор подписан, доступов нет
--   2. access_received — получили API-ключи
--   3. cabinet_connected — кабинет подключён, данные синхронизированы
--   4. complaints_submitted — начали подавать жалобы
--   5. chats_opened — открыли чаты с покупателями
--   6. monitoring — текущий контроль (штатный режим)
--   7. client_paused — временная пауза по запросу клиента
--   8. client_lost — клиент потерян (churn)
--
-- Future plan (Sprint-007): migrate entire system from status to stage.
--
-- Refs:
--   - docs/domains/store-lifecycle.md (domain logic)
--   - docs/sprints/Sprint-006/BACKLOG.md (implementation plan)

-- Step 1: Add stage column with default value
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS stage VARCHAR(50) DEFAULT 'cabinet_connected';

-- Step 2: Add CHECK constraint for valid enum values
ALTER TABLE stores
  ADD CONSTRAINT stores_stage_check
    CHECK (stage IN (
      'contract',
      'access_received',
      'cabinet_connected',
      'complaints_submitted',
      'chats_opened',
      'monitoring',
      'client_paused',
      'client_lost'
    ));

-- Step 3: Create index for filtering and sorting by stage
CREATE INDEX IF NOT EXISTS idx_stores_stage ON stores(stage)
  WHERE stage IS NOT NULL;

-- Step 4: Add column comment
COMMENT ON COLUMN stores.stage IS 'Этап работы с клиентом (business lifecycle stage). Управляется вручную менеджером.';

-- ROLLBACK:
-- To rollback this migration, run:
--   ALTER TABLE stores DROP CONSTRAINT stores_stage_check;
--   DROP INDEX IF EXISTS idx_stores_stage;
--   ALTER TABLE stores DROP COLUMN stage;
