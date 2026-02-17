/**
 * Default auto-sequence message templates
 *
 * Used when user_settings.no_reply_messages is empty.
 * 14 messages across 3 conversational phases:
 *   Day 1-4:   Discovery — soft questions, learn what happened
 *   Day 5-9:   Understanding — show empathy, offer to help
 *   Day 10-14: Resolution — offer compensation, final reminders
 */

export interface SequenceMessage {
  day: number;
  text: string;
}

/**
 * Default trigger phrase for detecting initial outreach message.
 * When seller sends a message containing this phrase, the chat is tagged
 * as deletion_candidate and auto-sequence is created.
 * Overridden by user_settings.no_reply_trigger_phrase if set.
 */
export const DEFAULT_TRIGGER_PHRASE = 'Здравствуйте! Мы увидели ваш отзыв и хотели бы узнать подробнее — расскажите, пожалуйста, что именно вас расстроило?';

/**
 * Default stop message sent when sequence completes (14 days without reply).
 * Overridden by user_settings.no_reply_stop_message if set.
 */
export const DEFAULT_STOP_MESSAGE = `Здравствуйте! Мы так и не получили от вас ответа, но хотим, чтобы вы знали — ваш отзыв не остался без внимания.

Мы уже учли обратную связь по этому товару и работаем над улучшениями. Если в будущем захотите вернуться к разговору — мы всегда на связи.

Спасибо, что нашли время поделиться впечатлениями. Хорошего дня!`;

/**
 * Default stop message for 4-star sequence completion (14 days without reply).
 * Overridden by user_settings.no_reply_stop_message2 if set.
 */
export const DEFAULT_STOP_MESSAGE_4STAR = `Здравствуйте! Видим, что вы не смогли ответить — ничего страшного.

Мы рады, что в целом товар вам понравился, и благодарны за честную оценку. Если когда-нибудь захотите рассказать, чего не хватило — пишите, мы всегда открыты.

Хорошего дня!`;

/**
 * Default follow-up templates for 4-star reviews.
 * Focus: learn what was missing for 5 stars, offer to help.
 * Used when user_settings.no_reply_messages2 is empty.
 */
export const DEFAULT_FOLLOWUP_TEMPLATES_4STAR: SequenceMessage[] = [
  // Phase 1: Discovery — gentle curiosity (Day 1-4)
  {
    day: 1,
    text: 'Здравствуйте! Спасибо за вашу оценку! Нам интересно — чего не хватило до идеала? Может, что-то можно было сделать лучше?',
  },
  {
    day: 2,
    text: 'Добрый день! Мы видим, что товар вам скорее понравился, но что-то всё же смутило. Расскажете? Нам правда важно это понять.',
  },
  {
    day: 3,
    text: 'Здравствуйте! Возможно, дело в упаковке, комплектации или чём-то ещё? Мы хотим разобраться, чтобы стать лучше.',
  },
  {
    day: 4,
    text: 'Добрый день! Мы не торопим — просто хотели напомнить, что нам интересно ваше мнение. Что бы вы улучшили?',
  },

  // Phase 2: Understanding — warmth + offer to help (Day 5-9)
  {
    day: 5,
    text: 'Здравствуйте! Мы ценим, что вы нашли время оставить отзыв. Если что-то в товаре не устроило — мы готовы помочь это исправить.',
  },
  {
    day: 6,
    text: 'Добрый день! Хотели сказать — мы серьёзно относимся к каждому отзыву. Если есть что-то, что мы можем сделать для вас — напишите.',
  },
  {
    day: 7,
    text: 'Здравствуйте! Мы по-прежнему на связи. Если обнаружите, что с товаром что-то не так — обращайтесь, мы поможем.',
  },
  {
    day: 8,
    text: 'Добрый день! Просто напоминаем, что мы готовы бесплатно помочь с любым вопросом по товару. Ваше мнение для нас важно.',
  },
  {
    day: 9,
    text: 'Здравствуйте! Если у вас не было времени ответить — ничего страшного. Мы подождём, когда будет удобно.',
  },

  // Phase 3: Resolution — gentle closing (Day 10-14)
  {
    day: 10,
    text: 'Добрый день! Мы всё ещё рады помочь, если что-то в товаре можно улучшить. Напишите — и мы предложим решение.',
  },
  {
    day: 11,
    text: 'Здравствуйте! Наше предложение помочь по-прежнему в силе. Мы хотим, чтобы вы остались довольны покупкой.',
  },
  {
    day: 12,
    text: 'Добрый день! Скоро мы закроем это обращение, но если вы захотите обсудить товар — мы будем рады.',
  },
  {
    day: 13,
    text: 'Здравствуйте! Это предпоследнее сообщение от нас. Если есть что сказать — мы внимательно слушаем.',
  },
  {
    day: 14,
    text: 'Добрый день! Мы закрываем обращение, но если в будущем захотите вернуться к разговору — пишите. Спасибо за ваше время!',
  },
];

/**
 * Time slots for distributed message sending (MSK hours → weight).
 * Total weight = 100%. Messages are spread across the day to avoid
 * overwhelming managers with responses arriving all at once.
 */
const SEND_SLOTS: { hour: number; weight: number }[] = [
  { hour: 10, weight: 15 },
  { hour: 11, weight: 15 },
  { hour: 12, weight: 15 },
  { hour: 13, weight: 15 },
  { hour: 14, weight: 10 },
  { hour: 15, weight: 10 },
  { hour: 16, weight: 10 },
  { hour: 17, weight: 10 },
];

/**
 * Pick a random time slot for tomorrow based on weighted distribution.
 * Returns ISO string for a specific time tomorrow (MSK converted to UTC).
 */
export function getNextSlotTime(): string {
  const totalWeight = SEND_SLOTS.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * totalWeight;
  let selectedHour = SEND_SLOTS[0].hour;

  for (const slot of SEND_SLOTS) {
    rand -= slot.weight;
    if (rand <= 0) {
      selectedHour = slot.hour;
      break;
    }
  }

  // Random minute within the hour (0-59) for scatter
  const randomMinute = Math.floor(Math.random() * 60);

  // Build tomorrow's date at selectedHour MSK
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // MSK = UTC+3, so UTC hour = MSK hour - 3
  const utcHour = selectedHour - 3;
  tomorrow.setUTCHours(utcHour, randomMinute, 0, 0);

  return tomorrow.toISOString();
}

/**
 * OZON-specific stop messages (separate exports for marketplace-specific customization)
 */
export const DEFAULT_OZON_STOP_MESSAGE = DEFAULT_STOP_MESSAGE;
export const DEFAULT_OZON_STOP_MESSAGE_4STAR = DEFAULT_STOP_MESSAGE_4STAR;

/**
 * OZON-specific follow-up templates for negative reviews (1-3 stars).
 * 3-phase model: discovery → understanding → resolution.
 * Separate export for future OZON-specific customization.
 */
export const DEFAULT_OZON_FOLLOWUP_TEMPLATES: SequenceMessage[] = [
  // Phase 1: Discovery — questions and curiosity (Day 1-4)
  { day: 1, text: 'Здравствуйте! Мы увидели ваш отзыв и хотели бы разобраться. Расскажите, пожалуйста, что именно пошло не так?' },
  { day: 2, text: 'Добрый день! Нам важно понять вашу ситуацию. Что именно вас расстроило в товаре? Мы хотим помочь.' },
  { day: 3, text: 'Здравствуйте! Мы не торопим с ответом — просто хотим убедиться, что вы знаете: мы готовы разобраться в ситуации.' },
  { day: 4, text: 'Добрый день! Мы по-прежнему хотим понять, что произошло. Ваша обратная связь поможет нам стать лучше.' },
  // Phase 2: Understanding — empathy and care (Day 5-9)
  { day: 5, text: 'Здравствуйте! Мы видим, что вы не смогли ответить — ничего страшного. Если товар не оправдал ожиданий, мы хотим это исправить.' },
  { day: 6, text: 'Добрый день! Мы относимся к каждому отзыву серьёзно. Если есть проблема — мы готовы предложить решение.' },
  { day: 7, text: 'Здравствуйте! Мы по-прежнему на связи и хотим помочь. Напишите, когда будет удобно — мы подстроимся.' },
  { day: 8, text: 'Добрый день! Мы понимаем, что у всех свои дела. Просто знайте — мы готовы помочь в любой момент.' },
  { day: 9, text: 'Здравствуйте! Напоминаем о себе. Мы по-прежнему хотим найти решение, которое вас устроит.' },
  // Phase 3: Resolution — offer and closing (Day 10-14)
  { day: 10, text: 'Добрый день! Мы готовы предложить компенсацию за доставленные неудобства. Напишите — и мы обсудим детали.' },
  { day: 11, text: 'Здравствуйте! Наше предложение помочь по-прежнему актуально. Мы хотим исправить ситуацию со своей стороны.' },
  { day: 12, text: 'Добрый день! Скоро мы закроем это обращение. Если хотите обсудить компенсацию — напишите нам.' },
  { day: 13, text: 'Здравствуйте! Это предпоследнее сообщение. Мы по-прежнему готовы к диалогу и хотим помочь.' },
  { day: 14, text: 'Добрый день! Мы закрываем обращение. Если в будущем захотите вернуться к разговору — мы на связи. Спасибо!' },
];

/**
 * OZON-specific follow-up templates for 4-star reviews.
 * 3-phase model: discovery → understanding → resolution.
 * Separate export for future OZON-specific customization.
 */
export const DEFAULT_OZON_FOLLOWUP_TEMPLATES_4STAR: SequenceMessage[] = [
  // Phase 1: Discovery — gentle curiosity (Day 1-4)
  { day: 1, text: 'Здравствуйте! Спасибо за вашу оценку! Нам интересно — чего не хватило до идеала? Может, что-то можно было сделать лучше?' },
  { day: 2, text: 'Добрый день! Мы видим, что товар вам скорее понравился, но что-то всё же смутило. Расскажете? Нам правда важно это понять.' },
  { day: 3, text: 'Здравствуйте! Возможно, дело в упаковке, комплектации или чём-то ещё? Мы хотим разобраться, чтобы стать лучше.' },
  { day: 4, text: 'Добрый день! Мы не торопим — просто хотели напомнить, что нам интересно ваше мнение. Что бы вы улучшили?' },
  // Phase 2: Understanding — warmth + offer to help (Day 5-9)
  { day: 5, text: 'Здравствуйте! Мы ценим, что вы нашли время оставить отзыв. Если что-то в товаре не устроило — мы готовы помочь это исправить.' },
  { day: 6, text: 'Добрый день! Хотели сказать — мы серьёзно относимся к каждому отзыву. Если есть что-то, что мы можем сделать для вас — напишите.' },
  { day: 7, text: 'Здравствуйте! Мы по-прежнему на связи. Если обнаружите, что с товаром что-то не так — обращайтесь, мы поможем.' },
  { day: 8, text: 'Добрый день! Просто напоминаем, что мы готовы бесплатно помочь с любым вопросом по товару. Ваше мнение для нас важно.' },
  { day: 9, text: 'Здравствуйте! Если у вас не было времени ответить — ничего страшного. Мы подождём, когда будет удобно.' },
  // Phase 3: Resolution — gentle closing (Day 10-14)
  { day: 10, text: 'Добрый день! Мы всё ещё рады помочь, если что-то в товаре можно улучшить. Напишите — и мы предложим решение.' },
  { day: 11, text: 'Здравствуйте! Наше предложение помочь по-прежнему в силе. Мы хотим, чтобы вы остались довольны покупкой.' },
  { day: 12, text: 'Добрый день! Скоро мы закроем это обращение, но если вы захотите обсудить товар — мы будем рады.' },
  { day: 13, text: 'Здравствуйте! Это предпоследнее сообщение от нас. Если есть что сказать — мы внимательно слушаем.' },
  { day: 14, text: 'Добрый день! Мы закрываем обращение, но если в будущем захотите вернуться к разговору — пишите. Спасибо за ваше время!' },
];

/**
 * Default follow-up templates for negative reviews (1-3 stars).
 * 3-phase model: discovery → understanding → resolution.
 * Used when user_settings.no_reply_messages is empty.
 */
export const DEFAULT_FOLLOWUP_TEMPLATES: SequenceMessage[] = [
  // Phase 1: Discovery — questions and curiosity (Day 1-4)
  {
    day: 1,
    text: 'Здравствуйте! Мы увидели ваш отзыв и хотели бы разобраться. Расскажите, пожалуйста, что именно пошло не так?',
  },
  {
    day: 2,
    text: 'Добрый день! Нам важно понять вашу ситуацию. Что именно вас расстроило в товаре? Мы хотим помочь.',
  },
  {
    day: 3,
    text: 'Здравствуйте! Мы не торопим с ответом — просто хотим убедиться, что вы знаете: мы готовы разобраться в ситуации.',
  },
  {
    day: 4,
    text: 'Добрый день! Мы по-прежнему хотим понять, что произошло. Ваша обратная связь поможет нам стать лучше.',
  },

  // Phase 2: Understanding — empathy and care (Day 5-9)
  {
    day: 5,
    text: 'Здравствуйте! Мы видим, что вы не смогли ответить — ничего страшного. Если товар не оправдал ожиданий, мы хотим это исправить.',
  },
  {
    day: 6,
    text: 'Добрый день! Мы относимся к каждому отзыву серьёзно. Если есть проблема — мы готовы предложить решение.',
  },
  {
    day: 7,
    text: 'Здравствуйте! Мы по-прежнему на связи и хотим помочь. Напишите, когда будет удобно — мы подстроимся.',
  },
  {
    day: 8,
    text: 'Добрый день! Мы понимаем, что у всех свои дела. Просто знайте — мы готовы помочь в любой момент.',
  },
  {
    day: 9,
    text: 'Здравствуйте! Напоминаем о себе. Мы по-прежнему хотим найти решение, которое вас устроит.',
  },

  // Phase 3: Resolution — offer and closing (Day 10-14)
  {
    day: 10,
    text: 'Добрый день! Мы готовы предложить компенсацию за доставленные неудобства. Напишите — и мы обсудим детали.',
  },
  {
    day: 11,
    text: 'Здравствуйте! Наше предложение помочь по-прежнему актуально. Мы хотим исправить ситуацию со своей стороны.',
  },
  {
    day: 12,
    text: 'Добрый день! Скоро мы закроем это обращение. Если хотите обсудить компенсацию — напишите нам.',
  },
  {
    day: 13,
    text: 'Здравствуйте! Это предпоследнее сообщение. Мы по-прежнему готовы к диалогу и хотим помочь.',
  },
  {
    day: 14,
    text: 'Добрый день! Мы закрываем обращение. Если в будущем захотите вернуться к разговору — мы на связи. Спасибо!',
  },
];
