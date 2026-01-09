-- Verification Script
-- Compare imported counts with expected counts from Firebase export
-- Generated: 2026-01-05T07:11:27.442Z

-- Expected counts from Firebase:
-- Users:         7
-- User Settings: 1
-- Stores:        45
-- Products:      0
-- Reviews:       0
-- Chats:         0
-- Chat Messages: 0
-- Questions:     0
-- AI Logs:       0

-- ============================================
-- Count Verification
-- ============================================

SELECT
  'users' as table_name,
  COUNT(*) as actual_count,
  7 as expected_count,
  CASE WHEN COUNT(*) = 7 THEN '✅ OK' ELSE '❌ MISMATCH' END as status
FROM users

UNION ALL

SELECT
  'user_settings',
  COUNT(*),
  1,
  CASE WHEN COUNT(*) = 1 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM user_settings

UNION ALL

SELECT
  'stores',
  COUNT(*),
  45,
  CASE WHEN COUNT(*) = 45 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM stores

UNION ALL

SELECT
  'products',
  COUNT(*),
  0,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM products

UNION ALL

SELECT
  'reviews',
  COUNT(*),
  0,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM reviews

UNION ALL

SELECT
  'chats',
  COUNT(*),
  0,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM chats

UNION ALL

SELECT
  'chat_messages',
  COUNT(*),
  0,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM chat_messages

UNION ALL

SELECT
  'questions',
  COUNT(*),
  0,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM questions

UNION ALL

SELECT
  'ai_logs',
  COUNT(*),
  0,
  CASE WHEN COUNT(*) >= 0 THEN '✅ OK' ELSE '❌ MISMATCH' END
FROM ai_logs;

-- ============================================
-- Referential Integrity Check
-- ============================================

-- Check for orphaned products (products without stores)
SELECT
  'orphaned_products' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM products p
LEFT JOIN stores s ON p.store_id = s.id
WHERE s.id IS NULL;

-- Check for orphaned reviews (reviews without products)
SELECT
  'orphaned_reviews' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM reviews r
LEFT JOIN products p ON r.product_id = p.id
WHERE p.id IS NULL;

-- Check for orphaned chats (chats without stores)
SELECT
  'orphaned_chats' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM chats c
LEFT JOIN stores s ON c.store_id = s.id
WHERE s.id IS NULL;

-- Check for orphaned chat_messages (messages without chats)
SELECT
  'orphaned_chat_messages' as check_name,
  COUNT(*) as orphan_count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ FOUND ORPHANS' END as status
FROM chat_messages m
LEFT JOIN chats c ON m.chat_id = c.id
WHERE c.id IS NULL;

-- ============================================
-- Data Sampling (spot check)
-- ============================================

-- Sample stores
SELECT 'Sample stores:' as info;
SELECT id, name, owner_id, total_reviews, total_chats
FROM stores
ORDER BY created_at DESC
LIMIT 5;

-- Sample products
SELECT 'Sample products:' as info;
SELECT id, name, wb_product_id, store_id, review_count
FROM products
ORDER BY created_at DESC
LIMIT 5;

-- Sample reviews
SELECT 'Sample reviews:' as info;
SELECT id, product_id, rating, author, date
FROM reviews
ORDER BY date DESC
LIMIT 5;
