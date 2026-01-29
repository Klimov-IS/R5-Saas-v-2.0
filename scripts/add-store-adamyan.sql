-- Add store "ИП Адамян" to database
-- Generated: 2026-01-27

-- Generate a unique store ID (Firebase-style 20-char ID)
-- Using a UUID-based approach for uniqueness
INSERT INTO stores (
  id,
  name,
  api_token,
  owner_id,
  status,
  total_reviews,
  total_chats,
  created_at,
  updated_at
)
SELECT
  'ihMDtYWEY7IXkR3Lm9Pq', -- Generated Firebase-style ID
  'ИП Адамян',
  'eyJhbGciOiJFUzI1NiIsImtpZCI6IjIwMjUwOTA0djEiLCJ0eXAiOiJKV1QifQ.eyJhY2MiOjEsImVudCI6MSwiZXhwIjoxNzgzODk5NDM2LCJpZCI6IjAxOWJhY2Q4LWEwZjYtN2ViZC04YTdjLWE2MWRlMDE1ZGEwMCIsImlpZCI6NTg5Nzg1MzksIm9pZCI6MzI2MzYwLCJzIjo2NDIsInNpZCI6ImE1YzgzNzc5LWVhZTMtNGM1ZC1hOTA2LTg5ODczN2I1ZWU5YiIsInQiOmZhbHNlLCJ1aWQiOjU4OTc4NTM5fQ.OstvGdmgi_GSK-jAMXbLDPns6PFW-6YJrsLJXnFc9bBUYRWOG1q4w5kS7eVn3oaZ-lg_T0a_egLCtJcDlGPpAw',
  (SELECT id FROM users LIMIT 1), -- Get first user as owner
  'active',
  0,
  0,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'ИП Адамян');

-- Verify the store was created
SELECT
  id,
  name,
  status,
  created_at,
  (SELECT email FROM users WHERE users.id = stores.owner_id) as owner_email
FROM stores
WHERE name = 'ИП Адамян';
