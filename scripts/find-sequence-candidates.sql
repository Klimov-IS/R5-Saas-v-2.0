-- ============================================================================
-- Diagnostic: Find auto-sequence candidates
-- Date: 2026-02-09
-- Purpose: Find chats where seller sent trigger message but client hasn't
--          replied. Groups by active stores with active products.
--
-- Trigger phrase: "Мы увидели ваш отзыв и очень хотим разобраться"
-- ============================================================================

-- Query 1: Summary by store
-- Shows total chats with trigger, no-reply candidates, and already-replied

WITH trigger_messages AS (
  SELECT
    cm.chat_id,
    cm.store_id,
    cm.timestamp AS trigger_sent_at
  FROM chat_messages cm
  WHERE cm.sender = 'seller'
    AND cm.text LIKE '%Мы увидели ваш отзыв и очень хотим разобраться%'
),
latest_trigger AS (
  SELECT DISTINCT ON (chat_id)
    chat_id, store_id, trigger_sent_at
  FROM trigger_messages
  ORDER BY chat_id, trigger_sent_at DESC
),
client_replies AS (
  SELECT
    lt.chat_id,
    COUNT(*) AS reply_count
  FROM latest_trigger lt
  JOIN chat_messages cm ON cm.chat_id = lt.chat_id
    AND cm.sender = 'client'
    AND cm.timestamp > lt.trigger_sent_at
  GROUP BY lt.chat_id
)
SELECT
  s.name AS store_name,
  COUNT(lt.chat_id) AS total_with_trigger,
  COUNT(CASE WHEN cr.reply_count IS NULL THEN 1 END) AS no_reply_candidates,
  COUNT(CASE WHEN cr.reply_count > 0 THEN 1 END) AS already_replied
FROM latest_trigger lt
JOIN chats c ON c.id = lt.chat_id
JOIN stores s ON s.id = lt.store_id
LEFT JOIN products p ON p.wb_product_id = c.product_nm_id AND p.store_id = s.id
LEFT JOIN product_rules pr ON pr.product_id = p.id
LEFT JOIN client_replies cr ON cr.chat_id = lt.chat_id
WHERE s.status = 'active'
  AND (pr.work_in_chats = TRUE OR pr.id IS NULL)
GROUP BY s.id, s.name
ORDER BY no_reply_candidates DESC;


-- ============================================================================
-- Query 2: Detailed list of no-reply candidates
-- Shows individual chats that are candidates for auto-sequence mailing
-- ============================================================================

WITH trigger_messages AS (
  SELECT cm.chat_id, cm.store_id, cm.timestamp AS trigger_sent_at
  FROM chat_messages cm
  WHERE cm.sender = 'seller'
    AND cm.text LIKE '%Мы увидели ваш отзыв и очень хотим разобраться%'
),
latest_trigger AS (
  SELECT DISTINCT ON (chat_id) chat_id, store_id, trigger_sent_at
  FROM trigger_messages
  ORDER BY chat_id, trigger_sent_at DESC
)
SELECT
  s.name AS store_name,
  c.id AS chat_id,
  c.client_name,
  c.product_name,
  c.tag,
  c.status,
  lt.trigger_sent_at,
  c.last_message_sender,
  c.last_message_date,
  AGE(NOW(), lt.trigger_sent_at) AS days_since_trigger
FROM latest_trigger lt
JOIN chats c ON c.id = lt.chat_id
JOIN stores s ON s.id = lt.store_id
LEFT JOIN products p ON p.wb_product_id = c.product_nm_id AND p.store_id = s.id
LEFT JOIN product_rules pr ON pr.product_id = p.id
WHERE s.status = 'active'
  AND (pr.work_in_chats = TRUE OR pr.id IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM chat_messages cm
    WHERE cm.chat_id = lt.chat_id
      AND cm.sender = 'client'
      AND cm.timestamp > lt.trigger_sent_at
  )
ORDER BY s.name, lt.trigger_sent_at;
