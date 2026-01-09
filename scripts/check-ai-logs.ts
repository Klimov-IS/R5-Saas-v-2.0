/**
 * Check AI logs in database
 */

import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(process.cwd(), '.env.local') });

import { query, closePool } from '../src/db/client';

async function checkAILogs() {
  try {
    console.log('[CHECK-AI-LOGS] Fetching latest AI logs...\n');

    const result = await query(`
      SELECT
        id,
        action,
        entity_type,
        entity_id,
        model,
        tokens_used,
        cost,
        error,
        LEFT(prompt, 80) as prompt_preview,
        LEFT(response, 80) as response_preview,
        created_at
      FROM ai_logs
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (result.rows.length === 0) {
      console.log('No AI logs found in database');
      return;
    }

    console.log(`Found ${result.rows.length} recent AI logs:\n`);

    result.rows.forEach((log, index) => {
      console.log(`--- Log #${index + 1} ---`);
      console.log(`ID: ${log.id}`);
      console.log(`Action: ${log.action}`);
      console.log(`Entity: ${log.entity_type}/${log.entity_id}`);
      console.log(`Model: ${log.model}`);
      console.log(`Tokens: ${log.tokens_used || 'N/A'}`);
      console.log(`Cost: $${log.cost || 'N/A'}`);
      console.log(`Error: ${log.error || 'None'}`);
      console.log(`Prompt: ${log.prompt_preview}...`);
      console.log(`Response: ${log.response_preview}...`);
      console.log(`Created: ${log.created_at}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('[CHECK-AI-LOGS] Error:', error.message);
    throw error;
  } finally {
    await closePool();
  }
}

checkAILogs().catch(console.error);
