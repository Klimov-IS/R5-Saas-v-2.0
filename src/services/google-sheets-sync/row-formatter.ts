/**
 * Row Formatter
 * Converts product rules to Google Sheets table rows
 */

import type { Product, ProductRule, Store, WorkStatus } from '@/db/helpers';

// Table headers matching the planned format
export const TABLE_HEADERS = [
  'Магазин',
  'Артикул WB',
  'Название товара',
  'Статус товара',
  // Жалобы
  'Жалобы',
  '⭐1',
  '⭐2',
  '⭐3',
  '⭐4',
  // Чаты
  'Чаты',
  '⭐1 ',  // Note: extra space to distinguish from complaints
  '⭐2 ',
  '⭐3 ',
  '⭐4 ',
  'Стратегия чатов',
  // Компенсация
  'Компенсация',
  'Тип',
  'Макс, ₽',
  'Кто платит',
  // Мета
  'Обновлено'
];

/**
 * Format work status for display
 */
function formatWorkStatus(status: WorkStatus | undefined): string {
  switch (status) {
    case 'active': return '✅ Активен';
    case 'paused': return '⏸️ Пауза';
    case 'completed': return '✔️ Завершен';
    case 'not_working': return '⏹️ Не работаем';
    default: return '—';
  }
}

/**
 * Format boolean as emoji
 */
function formatBool(value: boolean | undefined): string {
  return value ? '✅' : '❌';
}

/**
 * Format chat strategy for display
 */
function formatChatStrategy(strategy: string | undefined): string {
  switch (strategy) {
    case 'upgrade_to_5': return 'На 5⭐';
    case 'delete': return 'Удаление';
    case 'both': return 'Удаление + на 5⭐';
    default: return '—';
  }
}

/**
 * Format compensation type for display
 */
function formatCompensationType(type: string | null | undefined): string {
  switch (type) {
    case 'cashback': return 'Кэшбек';
    case 'refund': return 'Возврат на WB';
    case 'certificate': return 'Сертификат';
    case 'money': return 'Деньги';
    case 'product': return 'Товар';
    case 'discount': return 'Скидка';
    case 'gift': return 'Подарок';
    default: return type || '—';
  }
}

/**
 * Format compensation payer for display
 */
function formatCompensationBy(by: string | null | undefined): string {
  switch (by) {
    case 'r5': return 'R5';
    case 'seller': return 'Продавец';
    case 'brand': return 'Бренд';
    case 'marketplace': return 'Маркетплейс';
    case 'client': return 'Клиент';
    default: return by || '—';
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

export interface ProductWithRule {
  product: Product;
  rule: ProductRule | null;
}

/**
 * Format a single product with its rule to a table row
 */
export function formatProductRow(
  storeName: string,
  product: Product,
  rule: ProductRule | null
): string[] {
  return [
    storeName,
    product.wb_product_id || product.vendor_code || '—',
    product.name || '—',
    formatWorkStatus(product.work_status),
    // Жалобы
    formatBool(rule?.submit_complaints),
    formatBool(rule?.complaint_rating_1),
    formatBool(rule?.complaint_rating_2),
    formatBool(rule?.complaint_rating_3),
    formatBool(rule?.complaint_rating_4),
    // Чаты
    formatBool(rule?.work_in_chats),
    formatBool(rule?.chat_rating_1),
    formatBool(rule?.chat_rating_2),
    formatBool(rule?.chat_rating_3),
    formatBool(rule?.chat_rating_4),
    formatChatStrategy(rule?.chat_strategy),
    // Компенсация
    formatBool(rule?.offer_compensation),
    formatCompensationType(rule?.compensation_type),
    rule?.max_compensation || '—',
    formatCompensationBy(rule?.compensation_by),
    // Мета
    formatDate(rule?.updated_at || product.updated_at)
  ];
}

/**
 * Format multiple products to table rows
 */
export function formatAllProductRows(
  stores: Array<{ store: Store; products: Array<Product & { rule: ProductRule | null }> }>
): string[][] {
  const rows: string[][] = [];

  for (const { store, products } of stores) {
    for (const product of products) {
      rows.push(formatProductRow(store.name, product, product.rule));
    }
  }

  return rows;
}
