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
  access_received: 'Получены доступы',
  cabinet_connected: 'Кабинет подключён',
  complaints_submitted: 'Поданы жалобы',
  chats_opened: 'Открыты чаты',
  monitoring: 'Текущий контроль',
  client_paused: 'Клиент на паузе',
  client_lost: 'Клиент потерян',
};
