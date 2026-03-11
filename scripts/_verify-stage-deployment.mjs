/**
 * Quick verification script for stage field deployment
 */
import fs from 'fs';
import pg from 'pg';

const productionEnvPath = '/var/www/wb-reputation/.env.production';
if (fs.existsSync(productionEnvPath)) {
  const envFile = fs.readFileSync(productionEnvPath, 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  });
}

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

try {
  // Check stage distribution
  const { rows } = await pool.query(`
    SELECT stage, COUNT(*) as count
    FROM stores
    GROUP BY stage
    ORDER BY count DESC
  `);

  console.log('\n✅ Stage field verified in production DB:');
  console.log('\nStage distribution:');
  rows.forEach(r => console.log(`  ${r.stage.padEnd(25)}: ${r.count}`));

  // Check a few sample stores
  const samples = await pool.query(`
    SELECT name, marketplace, stage
    FROM stores
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('\nSample stores:');
  samples.rows.forEach(s => {
    console.log(`  [${s.marketplace.toUpperCase()}] ${s.name.padEnd(40)} → ${s.stage}`);
  });

  console.log('\n✅ Phase 1 deployment verified successfully!');
} catch (err) {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
