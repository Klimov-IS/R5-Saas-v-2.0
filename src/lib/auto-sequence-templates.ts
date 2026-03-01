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
 * Pick a random time slot for a future day based on weighted distribution.
 * @param daysAhead - number of days in the future (default 1 = tomorrow).
 *   daysAhead=0 means "today if still within business hours (before 17:00 MSK),
 *   otherwise tomorrow". Used for Day 0 in 30-day sequences.
 * Returns ISO string for that day at a random business hour (MSK → UTC).
 */
export function getNextSlotTime(daysAhead: number = 1): string {
  // Day 0 support: today if before 17:00 MSK, else tomorrow
  if (daysAhead === 0) {
    const nowMSK = new Date().getUTCHours() + 3; // approximate MSK hour
    const lastSlotHour = SEND_SLOTS[SEND_SLOTS.length - 1].hour; // 17
    if (nowMSK >= lastSlotHour) {
      daysAhead = 1; // too late today → tomorrow
    }
  }

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

  // Build target date at selectedHour MSK
  const target = new Date();
  target.setDate(target.getDate() + daysAhead);
  // MSK = UTC+3, so UTC hour = MSK hour - 3
  const utcHour = selectedHour - 3;
  target.setUTCHours(utcHour, randomMinute, 0, 0);

  // For daysAhead=0: ensure slot is in the future (not already passed today)
  if (daysAhead === 0 && target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1); // fallback to tomorrow
  }

  return target.toISOString();
}

/**
 * Calculate days until next message based on template schedule.
 * Used by 30-day cadence (every 2 days) vs default 14-day (daily).
 *
 * @param templates - the message templates with day field
 * @param currentStep - current step (0-indexed, just completed)
 * @returns days until next message, or 0 if sequence is complete
 */
export function getDaysUntilNextMessage(
  templates: SequenceMessage[],
  currentStep: number
): number {
  const nextStep = currentStep; // currentStep has already been incremented by advanceSequence
  if (nextStep >= templates.length) return 0; // sequence complete

  const currentDay = currentStep > 0 ? templates[currentStep - 1].day : 0;
  const nextDay = templates[nextStep].day;
  return Math.max(1, nextDay - currentDay);
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

// ============================================================================
// 30-Day Cadence Templates (every 2 days, 15 messages)
// ============================================================================

/**
 * 30-day follow-up templates for negative reviews (1-2-3 stars).
 * 15 messages over 30 days, every 2 days.
 * Message #15 (Day 30) IS the stop message — closes chat, no separate stop needed.
 * 4-phase model: discovery → understanding → offer → closing.
 * Sequence type: 'no_reply_followup_30d'
 *
 * REPLACES the old 14-day daily mailing for new sequences.
 */
export const DEFAULT_FOLLOWUP_TEMPLATES_30D: SequenceMessage[] = [
  // Phase 1: Discovery — soft questions, learn what happened (Day 0-6)
  { day: 0, text: 'Мы увидели ваш отзыв и немного переживаем, что покупка вас расстроила. Подскажите, пожалуйста, что именно пошло не так?' },
  { day: 2, text: 'Возвращаемся к вам — нам правда важно понять ситуацию. Иногда детали помогают нам многое исправить.' },
  { day: 4, text: 'Если найдётся минутка, расскажите, что именно вам не понравилось. Мы внимательно читаем каждую обратную связь.' },
  { day: 6, text: 'Не хотим быть навязчивыми — просто хотим понять, можем ли мы как-то помочь или исправить впечатление.' },

  // Phase 2: Understanding — empathy, transition to resolution (Day 8-14)
  { day: 8, text: 'Если ситуация всё ещё актуальна, мы готовы предложить вариант решения, чтобы сгладить неприятный момент.' },
  { day: 10, text: 'Иногда сообщение теряется в уведомлениях — аккуратно напоминаем о себе. Нам важно не оставить это без внимания.' },
  { day: 12, text: 'Если покупка действительно вас расстроила, мы можем предложить компенсацию за доставленные неудобства.' },
  { day: 14, text: 'Мы дорабатываем товары именно благодаря таким отзывам. Ваше мнение для нас — не формальность.' },

  // Phase 3: Offer — compensation + bonus (Day 16-22)
  { day: 16, text: 'Если будет желание обсудить ситуацию — готовы согласовать для вас бонус.' },
  { day: 18, text: 'Мы правда хотим оставить у вас более приятное впечатление. Напишите, и найдём решение вместе!' },
  { day: 20, text: 'Компенсация по вашему заказу по-прежнему возможна — главное, чтобы мы понимали, что именно произошло.' },
  { day: 22, text: 'Если вопрос уже не актуален — можно просто написать «всё ок». Если актуален — мы на связи.' },

  // Phase 4: Closing — final reminders + stop (Day 24-30)
  { day: 24, text: 'Скоро будем закрывать обращение, но не хотим делать это, не дав вам возможность вернуться к разговору.' },
  { day: 26, text: 'Если захотите воспользоваться бонусом или обсудить вариант решения — напишите. Мы всё ещё здесь.' },
  { day: 30, text: 'Закрываем обращение. Спасибо за ваш отзыв — даже если он был строгим, он помогает нам становиться лучше. Если когда-нибудь захотите вернуться к разговору — будем рады.' },
];

/**
 * 30-day follow-up templates for 4-star reviews.
 * 10 messages over 30 days, every 3 days.
 * Message #10 (Day 30) IS the stop message — closes chat, no separate stop needed.
 * Focus: understand what was missing for 5 stars, gather feedback.
 * Sequence type: 'no_reply_followup_4star_30d'
 *
 * REPLACES the old 14-day daily 4-star mailing for new sequences.
 */
export const DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D: SequenceMessage[] = [
  // Phase 1: Discovery — gentle curiosity (Day 0-6)
  { day: 0, text: 'Мы увидели ваш отзыв и хотим понять, всё ли в целом устроило в товаре. Если есть детали, которыми хочется поделиться — будем рады.' },
  { day: 3, text: 'Нам важно понять, что можно сделать ещё лучше. Чего, на ваш взгляд, не хватило до идеального опыта?' },
  { day: 6, text: 'Пользуетесь ли сейчас товаром? Нам интересно, как он показывает себя со временем.' },

  // Phase 2: Understanding — warmth + feedback (Day 9-15)
  { day: 9, text: 'Иногда 4★ — это «в целом хорошо, но…». Если есть это «но» — будем рады услышать.' },
  { day: 12, text: 'Мы собираем честную обратную связь от покупателей, чтобы дорабатывать продукт. Ваше мнение правда помогает.' },
  { day: 15, text: 'Если есть пожелания или идеи по улучшению — смело пишите. Мы передаём это напрямую команде.' },

  // Phase 3: Follow-up — check experience over time (Day 18-24)
  { day: 18, text: 'Интересно, изменилось ли ваше впечатление спустя время использования?' },
  { day: 21, text: 'Бывает, что первые впечатления отличаются от дальнейшего опыта. Поделитесь, если это ваш случай.' },
  { day: 24, text: 'Если вопрос уже не актуален — можно просто написать «всё устраивает». Нам важно понимать картину.' },

  // Phase 4: Closing — stop (Day 30)
  { day: 30, text: 'Спасибо за честную оценку. Даже 4★ помогают нам становиться лучше. Если появятся мысли или пожелания — будем рады диалогу.' },
];

/**
 * OZON 30-day follow-up templates for 4-star reviews.
 * Same 10-message cadence as WB. Separate export for future OZON-specific customization.
 */
export const DEFAULT_OZON_FOLLOWUP_TEMPLATES_4STAR_30D: SequenceMessage[] = [
  { day: 0, text: 'Мы увидели ваш отзыв и хотим понять, всё ли в целом устроило в товаре. Если есть детали, которыми хочется поделиться — будем рады.' },
  { day: 3, text: 'Нам важно понять, что можно сделать ещё лучше. Чего, на ваш взгляд, не хватило до идеального опыта?' },
  { day: 6, text: 'Пользуетесь ли сейчас товаром? Нам интересно, как он показывает себя со временем.' },
  { day: 9, text: 'Иногда 4★ — это «в целом хорошо, но…». Если есть это «но» — будем рады услышать.' },
  { day: 12, text: 'Мы собираем честную обратную связь от покупателей, чтобы дорабатывать продукт. Ваше мнение правда помогает.' },
  { day: 15, text: 'Если есть пожелания или идеи по улучшению — смело пишите. Мы передаём это напрямую команде.' },
  { day: 18, text: 'Интересно, изменилось ли ваше впечатление спустя время использования?' },
  { day: 21, text: 'Бывает, что первые впечатления отличаются от дальнейшего опыта. Поделитесь, если это ваш случай.' },
  { day: 24, text: 'Если вопрос уже не актуален — можно просто написать «всё устраивает». Нам важно понимать картину.' },
  { day: 30, text: 'Спасибо за честную оценку. Даже 4★ помогают нам становиться лучше. Если появятся мысли или пожелания — будем рады диалогу.' },
];

/**
 * OZON 30-day follow-up templates for negative reviews (1-2-3 stars).
 * Same 15-message cadence as WB. Separate export for future OZON-specific customization.
 */
// ============================================================================
// Tag-Based Funnel Templates (short follow-up sequences)
// ============================================================================

/**
 * Offer Reminder templates for `deletion_offered` tag.
 * 5 messages over 14 days, every 3 days.
 * Use case: seller sent compensation offer → buyer went silent.
 * Sequence type: 'offer_reminder'
 */
export const DEFAULT_OFFER_REMINDER_TEMPLATES: SequenceMessage[] = [
  { day: 3, text: 'Здравствуйте! Хотели уточнить — вы видели наше предложение? Будем рады обсудить детали.' },
  { day: 6, text: 'Наше предложение по компенсации всё ещё актуально. Если есть вопросы — напишите, ответим быстро.' },
  { day: 9, text: 'Понимаем, что сейчас может быть не до этого. Но мы по-прежнему готовы помочь и обсудить удобный вариант.' },
  { day: 12, text: 'Напоминаем о нашем предложении. Мы можем адаптировать условия — просто напишите.' },
  { day: 14, text: 'Закрываем обращение по предложению. Если передумаете — мы всегда на связи.' },
];

/**
 * Agreement Follow-up templates for `deletion_agreed` tag.
 * 4 messages over 10 days, every 2-3 days.
 * Use case: buyer agreed to delete/change review → went silent.
 * Sequence type: 'agreement_followup'
 */
export const DEFAULT_AGREEMENT_FOLLOWUP_TEMPLATES: SequenceMessage[] = [
  { day: 3, text: 'Здравствуйте! Удалось ли удалить/изменить отзыв? Если нужна инструкция — с удовольствием отправим ещё раз.' },
  { day: 6, text: 'Проверили — отзыв пока на месте. Может, нужна помощь с процессом? Можем пошагово подсказать.' },
  { day: 8, text: 'Компенсация готова к отправке сразу после изменения/удаления отзыва. Напишите, если что-то не получается.' },
  { day: 10, text: 'Закрываем обращение. Если решите вернуться к вопросу — мы здесь.' },
];

/**
 * Refund Follow-up templates for `refund_requested` tag.
 * 3 messages over 7 days, every 2-3 days.
 * Use case: buyer wants a refund, process started → buyer went silent.
 * Sequence type: 'refund_followup'
 */
export const DEFAULT_REFUND_FOLLOWUP_TEMPLATES: SequenceMessage[] = [
  { day: 3, text: 'Здравствуйте! Хотели узнать — получилось ли оформить возврат? Если нужна помощь — подскажем.' },
  { day: 5, text: 'Мы можем проверить статус возврата с нашей стороны. Напишите номер заказа, если удобно.' },
  { day: 7, text: 'Надеемся, что вопрос с возвратом решился. Если что-то ещё потребуется — обращайтесь.' },
];

/**
 * Maps chat tag → sequence type + templates for tag-based sequences.
 * Only includes tags that have dedicated follow-up sequences.
 * The base `deletion_candidate` tag uses the existing 30-day sequence (not in this map).
 */
export const TAG_SEQUENCE_CONFIG: Record<string, {
  sequenceType: string;
  templates: SequenceMessage[];
  familyPrefix: string;
  label: string;
}> = {
  deletion_offered: {
    sequenceType: 'offer_reminder',
    templates: DEFAULT_OFFER_REMINDER_TEMPLATES,
    familyPrefix: 'offer_reminder',
    label: 'Напомнить об оффере',
  },
  deletion_agreed: {
    sequenceType: 'agreement_followup',
    templates: DEFAULT_AGREEMENT_FOLLOWUP_TEMPLATES,
    familyPrefix: 'agreement_followup',
    label: 'Напомнить об инструкции',
  },
  refund_requested: {
    sequenceType: 'refund_followup',
    templates: DEFAULT_REFUND_FOLLOWUP_TEMPLATES,
    familyPrefix: 'refund_followup',
    label: 'Follow-up по возврату',
  },
};

export const DEFAULT_OZON_FOLLOWUP_TEMPLATES_30D: SequenceMessage[] = [
  // Phase 1: Discovery (Day 0-6)
  { day: 0, text: 'Мы увидели ваш отзыв и немного переживаем, что покупка вас расстроила. Подскажите, пожалуйста, что именно пошло не так?' },
  { day: 2, text: 'Возвращаемся к вам — нам правда важно понять ситуацию. Иногда детали помогают нам многое исправить.' },
  { day: 4, text: 'Если найдётся минутка, расскажите, что именно вам не понравилось. Мы внимательно читаем каждую обратную связь.' },
  { day: 6, text: 'Не хотим быть навязчивыми — просто хотим понять, можем ли мы как-то помочь или исправить впечатление.' },
  // Phase 2: Understanding (Day 8-14)
  { day: 8, text: 'Если ситуация всё ещё актуальна, мы готовы предложить вариант решения, чтобы сгладить неприятный момент.' },
  { day: 10, text: 'Иногда сообщение теряется в уведомлениях — аккуратно напоминаем о себе. Нам важно не оставить это без внимания.' },
  { day: 12, text: 'Если покупка действительно вас расстроила, мы можем предложить компенсацию за доставленные неудобства.' },
  { day: 14, text: 'Мы дорабатываем товары именно благодаря таким отзывам. Ваше мнение для нас — не формальность.' },
  // Phase 3: Offer (Day 16-22)
  { day: 16, text: 'Если будет желание обсудить ситуацию — готовы согласовать для вас бонус.' },
  { day: 18, text: 'Мы правда хотим оставить у вас более приятное впечатление. Напишите, и найдём решение вместе!' },
  { day: 20, text: 'Компенсация по вашему заказу по-прежнему возможна — главное, чтобы мы понимали, что именно произошло.' },
  { day: 22, text: 'Если вопрос уже не актуален — можно просто написать «всё ок». Если актуален — мы на связи.' },
  // Phase 4: Closing (Day 24-30)
  { day: 24, text: 'Скоро будем закрывать обращение, но не хотим делать это, не дав вам возможность вернуться к разговору.' },
  { day: 26, text: 'Если захотите воспользоваться бонусом или обсудить вариант решения — напишите. Мы всё ещё здесь.' },
  { day: 30, text: 'Закрываем обращение. Спасибо за ваш отзыв — даже если он был строгим, он помогает нам становиться лучше. Если когда-нибудь захотите вернуться к разговору — будем рады.' },
];
