import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

import { query } from '../src/db/client';

async function getStores() {
  const result = await query('SELECT id, name FROM stores ORDER BY name LIMIT 10');
  console.log('\nДоступные магазины:\n');
  result.rows.forEach((store: any, i: number) => {
    console.log(`${i + 1}. ${store.name}`);
    console.log(`   ID: ${store.id}\n`);
  });
  process.exit(0);
}

getStores();
