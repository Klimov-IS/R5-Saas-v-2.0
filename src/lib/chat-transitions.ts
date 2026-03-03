/**
 * Chat Transition Guards
 *
 * Validates status transitions and protects deletion workflow tags
 * from being overwritten by automated processes (dialogue sync, AI classification).
 *
 * This is NOT a full FSM — it's a lightweight guard layer on top of the existing
 * 2D model (4 statuses x 12 tags). The 2D model is intentionally preserved
 * because status and tag are orthogonal dimensions.
 */

import type { ChatStatus, ChatTag } from '@/types/chats';

// ============================================================================
// Status Transition Validation
// ============================================================================

/**
 * Valid status transitions. Any transition not listed here is rejected.
 *
 * Key rules:
 * - `closed` can only reopen to `inbox` (not directly to in_progress/awaiting_reply)
 * - All active statuses can transition to `closed`
 * - `inbox` is the entry point for new/reopened chats
 */
const VALID_TRANSITIONS: Record<ChatStatus, ChatStatus[]> = {
  inbox: ['in_progress', 'awaiting_reply', 'closed'],
  in_progress: ['inbox', 'awaiting_reply', 'closed'],
  awaiting_reply: ['inbox', 'in_progress', 'closed'],
  closed: ['inbox', 'in_progress', 'awaiting_reply'],
};

/**
 * Check if a status transition is valid.
 * Same-status transitions are always allowed (no-op).
 */
export function isValidTransition(from: ChatStatus, to: ChatStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validate a status transition, returning an error message if invalid.
 * Returns null if the transition is valid.
 */
export function validateTransition(
  from: ChatStatus,
  to: ChatStatus
): string | null {
  if (isValidTransition(from, to)) return null;
  return `Invalid transition: ${from} → ${to}`;
}

// ============================================================================
// Tag Protection (Deletion Workflow)
// ============================================================================

/**
 * Tags that represent active deletion workflow stages.
 * These should NOT be overwritten by automated AI classification
 * with non-workflow tags (e.g., 'active', 'no_reply').
 *
 * AI CAN progress these forward (candidate → offered → agreed → confirmed)
 * but CANNOT move them backward (agreed → candidate).
 */
const DELETION_WORKFLOW_TAGS: ChatTag[] = [
  'deletion_candidate',
  'deletion_offered',
  'deletion_agreed',
  'deletion_confirmed',
  'refund_requested',
];

/**
 * Directional order for deletion workflow tags.
 * AI auto-classification can only move tags FORWARD (higher number),
 * never backward. This prevents AI from accidentally downgrading
 * a tag that a manager or previous classification already advanced.
 *
 * refund_requested is a lateral branch at level 1 (same as offered).
 */
const DELETION_TAG_ORDER: Record<string, number> = {
  deletion_candidate: 0,
  deletion_offered: 1,
  refund_requested: 1,  // lateral branch from candidate
  deletion_agreed: 2,
  deletion_confirmed: 3,
};

/**
 * Tags that can always be set regardless of current tag.
 * These represent terminal or administrative states.
 */
const ALWAYS_ALLOWED_TAGS: ChatTag[] = ['spam', 'successful', 'unsuccessful'];

/**
 * Check if an automated process (AI classification, dialogue sync)
 * can overwrite the current tag with a new one.
 *
 * Rules:
 * - Deletion workflow tags are protected from downgrade by AI
 * - spam/successful/unsuccessful can always be set (terminal states)
 * - Manual tag changes from UI are NOT checked by this function
 *   (managers should be able to override anything)
 */
export function canAutoOverwriteTag(
  currentTag: ChatTag | null,
  newTag: ChatTag
): boolean {
  if (!currentTag) return true;
  if (currentTag === newTag) return true;

  // Terminal states can always be set
  if (ALWAYS_ALLOWED_TAGS.includes(newTag)) return true;

  // Protect deletion workflow tags from being overwritten by non-workflow tags
  if (DELETION_WORKFLOW_TAGS.includes(currentTag)) {
    // Allow FORWARD progression within deletion workflow only
    if (DELETION_WORKFLOW_TAGS.includes(newTag)) {
      const currentOrder = DELETION_TAG_ORDER[currentTag] ?? 0;
      const newOrder = DELETION_TAG_ORDER[newTag] ?? 0;
      // Only allow forward or same-level transitions
      return newOrder >= currentOrder;
    }
    // Block AI from overwriting deletion workflow with basic tags
    return false;
  }

  return true;
}

/**
 * Check if a tag represents an active deletion workflow stage.
 */
export function isDeletionWorkflowTag(tag: ChatTag | null): boolean {
  if (!tag) return false;
  return DELETION_WORKFLOW_TAGS.includes(tag);
}
