/**
 * Store lifecycle stage types and labels
 * Sprint 006 - Store Lifecycle Management
 *
 * Separated from db/helpers.ts to allow client-side imports
 */

export type StoreStage =
  | 'contract'
  | 'access_received'
  | 'cabinet_connected'
  | 'complaints_submitted'
  | 'chats_opened'
  | 'monitoring'
  | 'client_paused'
  | 'client_lost';

/**
 * Russian labels for store lifecycle stages
 */
export const STORE_STAGE_LABELS: Record<StoreStage, string> = {
  contract: 'Договор',
  access_received: 'Доступ получен',
  cabinet_connected: 'Кабинет подключён',
  complaints_submitted: 'Подаем жалобы',
  chats_opened: 'Открываем чаты',
  monitoring: 'Кабинет на контроле',
  client_paused: 'На паузе',
  client_lost: 'Потеря',
};

/**
 * Stage ordering for lifecycle progression checks.
 * client_paused and client_lost are special states (not in the main funnel).
 */
const STAGE_ORDER: Record<StoreStage, number> = {
  contract: 0,
  access_received: 1,
  cabinet_connected: 2,
  complaints_submitted: 3,
  chats_opened: 4,
  monitoring: 5,
  client_paused: -1,
  client_lost: -1,
};

/**
 * Check if a store's current stage is at or past the required stage.
 * Returns false for client_paused / client_lost (special states).
 */
export function isStageAtLeast(current: StoreStage, required: StoreStage): boolean {
  const c = STAGE_ORDER[current];
  const r = STAGE_ORDER[required];
  return c >= 0 && r >= 0 && c >= r;
}

/** Stages where chat work is allowed */
export const CHAT_ALLOWED_STAGES: StoreStage[] = ['chats_opened', 'monitoring'];

/** Stages where review sync is needed (complaints require reviews) */
export const REVIEW_SYNC_STAGES: StoreStage[] = ['complaints_submitted', 'chats_opened', 'monitoring'];

/** Stages where dialogue (chat) sync is needed */
export const DIALOGUE_SYNC_STAGES: StoreStage[] = ['chats_opened', 'monitoring'];
