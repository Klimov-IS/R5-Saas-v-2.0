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
