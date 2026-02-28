/**
 * backfill-auto-sequences-30d.mjs
 *
 * Creates 30-day auto-sequences for existing review-linked chats that:
 * 1. Have review_chat_links with chat_id populated
 * 2. Have review_rating <= 4 (skip 5★)
 * 3. Have NO buyer messages (buyer_messages_count == 0)
 * 4. Have NO active/completed sequence in the same family
 * 5. Chat is not closed
 *
 * Usage:
 *   node scripts/backfill-auto-sequences-30d.mjs --dry-run     # preview only
 *   node scripts/backfill-auto-sequences-30d.mjs               # execute
 *   node scripts/backfill-auto-sequences-30d.mjs --limit 100   # limit batch size
 */

import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const BATCH_LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : 2000;

// 30-day templates (must match auto-sequence-templates.ts)
const TEMPLATES_NEGATIVE = [
  { day: 0, text: "placeholder" }, // 15 messages — actual text loaded from DB or hardcoded
];
// We only need day/count info for the sequence creation, actual text comes from templates file
// But since this is an .mjs script without TS imports, we set max_steps and use the template count

const SEND_SLOTS = [
  { hour: 10, minute: 0 },
  { hour: 11, minute: 30 },
  { hour: 13, minute: 0 },
  { hour: 14, minute: 30 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 0 },
];

function getNextSlotTime() {
  const now = new Date();
  const mskOffset = 3 * 60; // UTC+3
  const mskTime = new Date(now.getTime() + mskOffset * 60 * 1000);
  const mskHour = mskTime.getUTCHours();

  // If past 17:00 MSK, schedule for tomorrow
  let daysAhead = mskHour >= 17 ? 1 : 0;

  const slot = SEND_SLOTS[Math.floor(Math.random() * SEND_SLOTS.length)];
  const target = new Date();
  target.setDate(target.getDate() + daysAhead);
  target.setUTCHours(slot.hour - 3, slot.minute, Math.floor(Math.random() * 60), 0);

  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }

  return target.toISOString();
}

async function main() {
  const client = await pool.connect();

  try {
    console.log(`\n=== Backfill 30-day Auto-Sequences ===`);
    console.log(`Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "EXECUTE"}`);
    console.log(`Batch limit: ${BATCH_LIMIT}\n`);

    // Find eligible chats
    const findQuery = `
      SELECT
        rcl.chat_id,
        rcl.store_id,
        rcl.review_rating,
        c.owner_id,
        c.status,
        c.tag,
        c.client_name,
        c.product_name
      FROM review_chat_links rcl
      JOIN chats c ON c.id = rcl.chat_id AND c.store_id = rcl.store_id
      JOIN stores s ON s.id = rcl.store_id AND s.status = 'active'
      LEFT JOIN reviews r ON rcl.review_id = r.id
      WHERE rcl.chat_id IS NOT NULL
        AND rcl.review_rating <= 4
        AND c.status != 'closed'
        -- No buyer messages
        AND NOT EXISTS (
          SELECT 1 FROM chat_messages cm
          WHERE cm.chat_id = rcl.chat_id AND cm.sender = 'client'
        )
        -- No active/completed sequence in family
        AND NOT EXISTS (
          SELECT 1 FROM chat_auto_sequences cas
          WHERE cas.chat_id = rcl.chat_id
            AND cas.status IN ('active', 'completed')
            AND (
              cas.sequence_type LIKE 'no_reply_followup%'
            )
        )
        -- Review not resolved (complaint approved / excluded from rating)
        AND (r.id IS NULL OR (
          COALESCE(r.complaint_status, 'not_sent') != 'approved'
          AND COALESCE(r.review_status_wb, 'visible') NOT IN ('excluded', 'unpublished', 'temporarily_hidden', 'deleted')
          AND COALESCE(r.rating_excluded, false) = false
        ))
      ORDER BY rcl.created_at DESC
      LIMIT $1
    `;

    const candidates = await client.query(findQuery, [BATCH_LIMIT]);
    console.log(`Found ${candidates.rows.length} eligible chats\n`);

    if (candidates.rows.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    // Load template counts (we need to know how many messages per type)
    // 1-3★: 15 messages, 4★: 10 messages
    const NEGATIVE_MSG_COUNT = 15;
    const FOURSTAR_MSG_COUNT = 10;

    // Stats
    let created = 0;
    let skipped = 0;
    const byRating = { 1: 0, 2: 0, 3: 0, 4: 0 };

    // Preview table header
    if (DRY_RUN) {
      console.log("Chat ID                              | Rating | Store | Client | Status");
      console.log("-".repeat(90));
    }

    for (const row of candidates.rows) {
      const { chat_id, store_id, review_rating, owner_id, status, tag, client_name } = row;

      const is4Star = review_rating === 4;
      const seqType = is4Star ? "no_reply_followup_4star_30d" : "no_reply_followup_30d";
      const msgCount = is4Star ? FOURSTAR_MSG_COUNT : NEGATIVE_MSG_COUNT;

      if (DRY_RUN) {
        console.log(
          `${chat_id.padEnd(38)}| ${review_rating}★     | ${store_id.substring(0, 8)}... | ${(client_name || "").substring(0, 15).padEnd(15)} | ${status}`
        );
        byRating[review_rating]++;
        created++;
        continue;
      }

      // Create sequence — we need to store actual templates
      // Since we can't import TS from .mjs, we store a placeholder messages array
      // The cron processor reads messages from the sequence record
      // We need to fetch the actual templates... or embed them here
      // For simplicity: store minimal template with day numbers, cron will use them
      try {
        const nextSendAt = getNextSlotTime();

        // We need actual message texts. Since this is a standalone script,
        // we'll query if there's already a sequence of same type to copy templates from,
        // otherwise use a placeholder that the processor can handle
        const existingSeq = await client.query(
          `SELECT messages FROM chat_auto_sequences
           WHERE sequence_type = $1 LIMIT 1`,
          [seqType]
        );

        let messages;
        if (existingSeq.rows[0]) {
          // Reuse templates from an existing sequence of same type
          messages = existingSeq.rows[0].messages;
          if (typeof messages === "string") messages = JSON.parse(messages);
        } else {
          // No existing sequence to copy from — skip this chat
          // Templates will be available after at least one auto-launch runs
          console.warn(`No template source for ${seqType}, skipping backfill. Run auto-launch first.`);
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO chat_auto_sequences
            (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [chat_id, store_id, owner_id, seqType, JSON.stringify(messages), msgCount, nextSendAt]
        );

        // Update chat tag and status
        await client.query(
          `UPDATE chats SET tag = 'deletion_candidate', status = 'awaiting_reply',
           status_updated_at = NOW() WHERE id = $1`,
          [chat_id]
        );

        byRating[review_rating]++;
        created++;
      } catch (err) {
        console.error(`Error for chat ${chat_id}:`, err.message);
        skipped++;
      }
    }

    console.log(`\n=== Results ===`);
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`By rating: 1★=${byRating[1]}, 2★=${byRating[2]}, 3★=${byRating[3]}, 4★=${byRating[4]}`);
    if (DRY_RUN) {
      console.log(`\n(DRY RUN — no changes made. Run without --dry-run to execute.)`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
