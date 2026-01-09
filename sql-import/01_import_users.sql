-- Import users (7 records)
-- Generated: 2026-01-05T07:11:27.390Z

BEGIN;

INSERT INTO users (id, email, is_approved, created_at, updated_at)
VALUES
  ('01GqorxTFvTIheh8UygHFBlILTn2', 'info@march-code.tech', TRUE, '2026-01-05T06:27:23.802Z', '2026-01-05T06:27:23.802Z'),
  ('aRFFsWngmnaYcz4D1LBfA6CpYmx2', 'andrey.valyuk.04@mail.ru', FALSE, '2026-01-05T06:27:23.802Z', '2026-01-05T06:27:23.802Z'),
  ('coB0H0vb3SVWzGtljD3QyH2nVRx1', 'vladon03101993@gmail.com', FALSE, '2026-01-05T06:27:23.803Z', '2026-01-05T06:27:23.803Z'),
  ('gmxPAUpStZR0jL8wUC1MpIwpceg2', 'olshevskyeu@yandex.ru', FALSE, '2026-01-05T06:27:23.803Z', '2026-01-05T06:27:23.803Z'),
  ('iN5qw8KH6dZwaPc3nACTdCidEMo1', 'itsklimovworkspace@gmail.com', TRUE, '2026-01-05T06:27:23.803Z', '2026-01-05T06:27:23.803Z'),
  ('jE0wwN31jaSR22Z9K6Oj5B7McLx1', 'e.olshevsky@march-code.tech', TRUE, '2026-01-05T06:27:23.803Z', '2026-01-05T06:27:23.803Z'),
  ('tt5TPsIcPJfSUCDh6OF6HJ2WbwQ2', 'test@march-code.tech', FALSE, '2026-01-05T06:27:23.803Z', '2026-01-05T06:27:23.803Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  is_approved = EXCLUDED.is_approved,
  updated_at = EXCLUDED.updated_at;

COMMIT;

-- Verify
SELECT COUNT(*) as imported_users FROM users;
