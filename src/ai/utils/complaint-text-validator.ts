/**
 * @fileOverview Complaint text validation and truncation utilities
 * Ensures complaint text stays within WB limits
 */

/**
 * WB жёсткий лимит для текста жалобы
 * Превышение этого лимита не позволит подать жалобу
 */
export const COMPLAINT_HARD_LIMIT = 1000;

/**
 * Рекомендуемый лимит для качества
 * Слишком длинные жалобы могут быть менее эффективны
 */
export const COMPLAINT_SOFT_LIMIT = 800;

/**
 * Результат валидации длины текста
 */
export interface ValidationResult {
  /** Текст в пределах жёсткого лимита (< 1000) */
  isValid: boolean;
  /** Текст в пределах рекомендуемого лимита (< 800) */
  isOptimal: boolean;
  /** Текущая длина текста */
  length: number;
  /** На сколько символов превышен жёсткий лимит (0 если не превышен) */
  overflow: number;
}

/**
 * Результат обрезки текста
 */
export interface TruncateResult {
  /** Обработанный текст */
  text: string;
  /** Был ли текст обрезан */
  wasTruncated: boolean;
  /** Оригинальная длина текста */
  originalLength: number;
}

/**
 * Проверяет длину текста жалобы
 *
 * @param text - Текст жалобы для проверки
 * @returns Результат валидации
 */
export function validateComplaintLength(text: string): ValidationResult {
  const length = text.length;

  return {
    isValid: length <= COMPLAINT_HARD_LIMIT,
    isOptimal: length <= COMPLAINT_SOFT_LIMIT,
    length,
    overflow: Math.max(0, length - COMPLAINT_HARD_LIMIT),
  };
}

/**
 * Обрезает текст жалобы до указанного лимита
 * Старается обрезать по последнему полному предложению
 *
 * @param text - Текст жалобы
 * @param maxLength - Максимальная длина (по умолчанию 1000)
 * @returns Результат обрезки
 */
export function truncateComplaintText(
  text: string,
  maxLength: number = COMPLAINT_HARD_LIMIT
): TruncateResult {
  const originalLength = text.length;

  // Если текст в пределах лимита - возвращаем как есть
  if (originalLength <= maxLength) {
    return {
      text,
      wasTruncated: false,
      originalLength,
    };
  }

  // Обрезаем до maxLength
  const truncated = text.slice(0, maxLength);

  // Ищем последнее полное предложение (точка, !, ?)
  // Ищем паттерн ". " или "! " или "? " чтобы не обрезать на сокращениях типа "т.е."
  const sentenceEndings = [
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('!\n'),
    truncated.lastIndexOf('?\n'),
  ];

  const lastSentenceEnd = Math.max(...sentenceEndings);

  // Если нашли конец предложения и он покрывает минимум 70% текста
  if (lastSentenceEnd > maxLength * 0.7) {
    return {
      text: truncated.slice(0, lastSentenceEnd + 1).trim(),
      wasTruncated: true,
      originalLength,
    };
  }

  // Fallback: ищем последнее слово (пробел)
  const lastSpace = truncated.lastIndexOf(' ');

  // Если нашли пробел и он покрывает минимум 80% текста
  if (lastSpace > maxLength * 0.8) {
    return {
      text: truncated.slice(0, lastSpace).trim(),
      wasTruncated: true,
      originalLength,
    };
  }

  // Крайний случай: просто обрезаем
  return {
    text: truncated.trim(),
    wasTruncated: true,
    originalLength,
  };
}

/**
 * Форматирует сообщение для лога об обрезке текста
 *
 * @param entityType - Тип сущности (review, complaint)
 * @param entityId - ID сущности
 * @param originalLength - Оригинальная длина
 * @param newLength - Новая длина после обрезки
 * @returns Форматированное сообщение для лога
 */
export function formatTruncationLog(
  entityType: string,
  entityId: string,
  originalLength: number,
  newLength: number
): string {
  return `[COMPLAINT] ${entityType} ${entityId}: Text truncated from ${originalLength} to ${newLength} chars (WB limit ${COMPLAINT_HARD_LIMIT})`;
}
