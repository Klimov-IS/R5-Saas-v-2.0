import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { query } from '../src/db/client';

async function checkStatuses() {
  const result = await query('SELECT DISTINCT review_status_wb FROM reviews WHERE review_status_wb IS NOT NULL ORDER BY review_status_wb');
  console.log('Distinct review_status_wb values:');
  result.rows.forEach(r => console.log(`  - "${r.review_status_wb}"`));
  process.exit(0);
}

checkStatuses().catch(e => {
  console.error(e);
  process.exit(1);
});
