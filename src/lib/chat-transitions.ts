/**
 * Chat Transition Guards
 *
 * Validates status transitions and protects deletion workflow tags
 * from being downgraded by automated processes.
 *
 * 2D model: 4 statuses x 4 tags (+ null). Status and tag are orthogonal.
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
 * All tags are deletion workflow stages (simplified from 12 to 4).
 * Tags can only progress forward: candidate → offered → agreed → confirmed.
 */
const DELETION_WORKFLOW_TAGS: ChatTag[] = [
  'deletion_candidate',
  'deletion_offered',
  'deletion_agreed',
  'deletion_confirmed',
];

/**
 * Directional order for deletion workflow tags.
 * Auto-processes can only move tags FORWARD (higher number), never backward.
 */
const DELETION_TAG_ORDER: Record<string, number> = {
  deletion_candidate: 0,
  deletion_offered: 1,
  deletion_agreed: 2,
  deletion_confirmed: 3,
};

/**
 * Check if an automated process can overwrite the current tag with a new one.
 *
 * Rules:
 * - null → any tag: always allowed
 * - Workflow tags: only forward progression (candidate → offered → agreed → confirmed)
 * - Manual tag changes from UI are NOT checked by this function
 */
export function canAutoOverwriteTag(
  currentTag: ChatTag | null,
  newTag: ChatTag
): boolean {
  if (!currentTag) return true;
  if (currentTag === newTag) return true;

  // All tags are workflow tags — only allow forward progression
  const currentOrder = DELETION_TAG_ORDER[currentTag] ?? 0;
  const newOrder = DELETION_TAG_ORDER[newTag] ?? 0;
  return newOrder >= currentOrder;
}

/**
 * Check if a tag represents an active deletion workflow stage.
 */
export function isDeletionWorkflowTag(tag: ChatTag | null): boolean {
  if (!tag) return false;
  return DELETION_WORKFLOW_TAGS.includes(tag);
}
