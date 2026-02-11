/**
 * One-time setup script: Create organization for Ivan + set password
 * Run on server after migration 010:
 *   cd /var/www/wb-reputation && node scripts/setup-auth-data.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const IVAN_EMAIL = 'itsklimovworkspace@gmail.com';
const IVAN_PASSWORD_HASH = '$2b$10$zZSFfLSiqGwc2mVMmgj/JuhaC0c6T56wP3Q8YJC6TFOFDU.OlW25u';
const IVAN_DISPLAY_NAME = 'Иван';
const ORG_NAME = 'R5 Team';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get Ivan's user ID
    const userRes = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [IVAN_EMAIL]
    );
    if (!userRes.rows[0]) throw new Error(`User ${IVAN_EMAIL} not found`);
    const userId = userRes.rows[0].id;
    console.log('✅ User ID:', userId);

    // 2. Check if org already exists
    const existingOrg = await client.query(
      'SELECT id FROM organizations WHERE owner_id = $1',
      [userId]
    );
    if (existingOrg.rows[0]) {
      console.log('⚠️  Organization already exists:', existingOrg.rows[0].id);
      console.log('Skipping org creation. Updating password only.');

      await client.query(
        'UPDATE users SET password_hash = $1, display_name = $2 WHERE id = $3',
        [IVAN_PASSWORD_HASH, IVAN_DISPLAY_NAME, userId]
      );
      console.log('✅ Password updated');

      await client.query('COMMIT');
      return;
    }

    // 3. Create organization
    const orgRes = await client.query(
      "INSERT INTO organizations (id, name, owner_id) VALUES (gen_random_uuid()::text, $1, $2) RETURNING id",
      [ORG_NAME, userId]
    );
    const orgId = orgRes.rows[0].id;
    console.log('✅ Organization created:', orgId);

    // 4. Add Ivan as owner
    await client.query(
      "INSERT INTO org_members (id, org_id, user_id, role) VALUES (gen_random_uuid()::text, $1, $2, 'owner')",
      [orgId, userId]
    );
    console.log('✅ Added as owner');

    // 5. Set password and display name
    await client.query(
      'UPDATE users SET password_hash = $1, display_name = $2 WHERE id = $3',
      [IVAN_PASSWORD_HASH, IVAN_DISPLAY_NAME, userId]
    );
    console.log('✅ Password set');

    // 6. Link all stores to organization
    const storesRes = await client.query(
      'UPDATE stores SET org_id = $1 WHERE owner_id = $2',
      [orgId, userId]
    );
    console.log('✅ Stores linked:', storesRes.rowCount);

    // 7. Create user_settings if missing
    await client.query(
      "INSERT INTO user_settings (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [userId]
    );

    await client.query('COMMIT');
    console.log('\n🎉 Setup complete! Ivan can now login at /login');
    console.log('   Email:', IVAN_EMAIL);
    console.log('   Password: Fallen2026!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ ERROR:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();
