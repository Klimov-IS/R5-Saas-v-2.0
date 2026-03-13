-- Migration: Prevent duplicate active sequences per chat
--
-- Issue: Multiple processes were creating duplicate active sequences for same chat
-- Solution: Add unique constraint to prevent > 1 active sequence per chat
--
-- Date: 2026-03-13
-- Author: Emergency Response Team

BEGIN;

-- 1. Clean up existing duplicates (if any remain after emergency stop)
-- Keep only the earliest started sequence, stop the rest

WITH duplicates AS (
  SELECT
    chat_id,
    ARRAY_AGG(id ORDER BY started_at) AS sequence_ids
  FROM chat_auto_sequences
  WHERE status = 'active'
  GROUP BY chat_id
  HAVING COUNT(*) > 1
)
UPDATE chat_auto_sequences
SET
  status = 'stopped',
  stop_reason = 'duplicate_cleanup_migration',
  updated_at = NOW()
WHERE id IN (
  SELECT UNNEST(sequence_ids[2:]) -- Keep first, stop rest
  FROM duplicates
);

-- Log how many duplicates we cleaned up
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % duplicate active sequences', cleaned_count;
END $$;

-- 2. Add unique partial index - prevents multiple active sequences per chat
-- (Partial index: only applies WHERE status = 'active')

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_sequence_per_chat
ON chat_auto_sequences (chat_id)
WHERE status = 'active';

COMMENT ON INDEX idx_unique_active_sequence_per_chat IS
'Prevents multiple active sequences for same chat. Emergency fix 2026-03-13.';

-- 3. Add check for stale processing locks (optional cleanup)
-- Locks older than 30 minutes are considered stale and auto-released

UPDATE chat_auto_sequences
SET processing_locked_at = NULL
WHERE processing_locked_at < NOW() - INTERVAL '30 minutes';

-- Log how many stale locks we cleaned
DO $$
DECLARE
  unlocked_count INTEGER;
BEGIN
  GET DIAGNOSTICS unlocked_count = ROW_COUNT;
  RAISE NOTICE 'Released % stale processing locks (>30 min old)', unlocked_count;
END $$;

-- 4. Create helper function to safely start sequences (with automatic duplicate check)

CREATE OR REPLACE FUNCTION start_auto_sequence_safe(
  p_chat_id TEXT,
  p_store_id TEXT,
  p_owner_id TEXT,
  p_sequence_type TEXT,
  p_messages JSONB,
  p_max_steps INTEGER,
  p_next_send_at TIMESTAMPTZ
) RETURNS TABLE(
  sequence_id TEXT,
  created BOOLEAN,
  error TEXT
) AS $$
DECLARE
  v_sequence_id TEXT;
  v_existing_count INTEGER;
BEGIN
  -- Check if active sequence already exists
  SELECT COUNT(*) INTO v_existing_count
  FROM chat_auto_sequences
  WHERE chat_id = p_chat_id AND status = 'active';

  IF v_existing_count > 0 THEN
    -- Return existing sequence ID instead of creating duplicate
    SELECT id INTO v_sequence_id
    FROM chat_auto_sequences
    WHERE chat_id = p_chat_id AND status = 'active'
    LIMIT 1;

    RETURN QUERY SELECT v_sequence_id, FALSE, 'active_sequence_exists'::TEXT;
    RETURN;
  END IF;

  -- Safe to create new sequence
  v_sequence_id := 'seq_' || gen_random_uuid()::TEXT;

  INSERT INTO chat_auto_sequences (
    id, chat_id, store_id, owner_id, sequence_type,
    messages, max_steps, current_step, status,
    started_at, next_send_at, created_at, updated_at
  ) VALUES (
    v_sequence_id, p_chat_id, p_store_id, p_owner_id, p_sequence_type,
    p_messages, p_max_steps, 0, 'active',
    NOW(), p_next_send_at, NOW(), NOW()
  );

  RETURN QUERY SELECT v_sequence_id, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION start_auto_sequence_safe IS
'Safely start auto-sequence with automatic duplicate prevention. Returns existing sequence if already active.';

-- 5. Create monitoring view for duplicate detection

CREATE OR REPLACE VIEW v_duplicate_sequences AS
SELECT
  chat_id,
  COUNT(*) AS sequence_count,
  ARRAY_AGG(id ORDER BY started_at) AS sequence_ids,
  ARRAY_AGG(started_at ORDER BY started_at) AS start_times,
  ARRAY_AGG(sequence_type ORDER BY started_at) AS types
FROM chat_auto_sequences
WHERE status = 'active'
GROUP BY chat_id
HAVING COUNT(*) > 1;

COMMENT ON VIEW v_duplicate_sequences IS
'Monitoring view: Shows chats with multiple active sequences (should always be empty).';

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: Duplicate sequence prevention installed';
  RAISE NOTICE '📊 Unique index created: idx_unique_active_sequence_per_chat';
  RAISE NOTICE '🛡️  Helper function created: start_auto_sequence_safe()';
  RAISE NOTICE '👀 Monitoring view created: v_duplicate_sequences';
END $$;
