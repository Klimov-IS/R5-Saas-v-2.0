/**
 * Tests for regex-based tag classifier
 *
 * Run: npx tsx tests/tag-classifier.test.ts
 */

import {
  classifyTagFromMessages,
  isOfferMessage,
  isAgreementMessage,
  isConfirmationMessage,
  type ChatMessageForClassification,
} from '../src/lib/tag-classifier';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
  }
}

// ============================================================================
// DELETION_OFFERED tests
// ============================================================================

console.log('\n=== DELETION_OFFERED (seller messages) ===');

assert(isOfferMessage('Предлагаем компенсацию 500 рублей в обмен на удаление отзыва'), 'compensation + amount');
assert(isOfferMessage('Готовы предложить кешбэк 300₽ за изменение оценки'), 'cashback with amount');
assert(isOfferMessage('Можем вернуть полную стоимость товара'), 'return full cost');
assert(isOfferMessage('Компенсировать стоимость товара'), 'compensate cost');
assert(isOfferMessage('Дополните отзыв до 5 звёзд'), 'ask supplement to 5');
assert(isOfferMessage('изменив оценку на 5 звёзд'), 'change rating to 5');
assert(isOfferMessage('Готовы вернуть деньги за товар'), 'ready to return money');
assert(isOfferMessage('Перечислим на карту 1000 рублей'), 'transfer to card');
assert(isOfferMessage('Предлагаем компенсацию за неудобства'), 'offer compensation generic');
assert(isOfferMessage('Просим пересмотреть оценку'), 'ask reconsider');
assert(isOfferMessage('кэшбек в обмен на удаление'), 'cashback for deletion');
assert(isOfferMessage('Измените свой отзыв'), 'ask change review');
assert(isOfferMessage('Удалите свой отзыв'), 'ask delete review');

// Negatives
assert(!isOfferMessage('Здравствуйте, чем можем помочь?'), 'generic greeting = not offer');
assert(!isOfferMessage('Спасибо за обращение'), 'thanks = not offer');
assert(!isOfferMessage('Товар отправлен'), 'shipping info = not offer');

// ============================================================================
// DELETION_AGREED tests
// ============================================================================

console.log('\n=== DELETION_AGREED (buyer messages) ===');

assert(isAgreementMessage('Удалю отзыв'), 'will delete review');
assert(isAgreementMessage('Хорошо, удалю'), 'ok will delete');
assert(isAgreementMessage('Согласна удалить отзыв'), 'agree to delete');
assert(isAgreementMessage('Как удалить отзыв?'), 'how to delete');
assert(isAgreementMessage('Подскажите как удалить отзыв'), 'tell how to delete');
assert(isAgreementMessage('Могу удалить'), 'can delete');
assert(isAgreementMessage('Попробую удалить отзыв'), 'will try delete');
assert(isAgreementMessage('Давайте, я удалю'), 'lets delete');
assert(isAgreementMessage('Сейчас удалю'), 'now will delete');
assert(isAgreementMessage('Ок, удалю отзыв сегодня'), 'ok delete today');
assert(isAgreementMessage('Изменю отзыв'), 'will change review');
assert(isAgreementMessage('Поставлю 5 звёзд'), 'will set 5 stars');
assert(isAgreementMessage('Что нужно сделать?'), 'what to do');
assert(isAgreementMessage('Согласна изменить'), 'agree to modify');
assert(isAgreementMessage('Сотру отзыв'), 'will erase');

// Anti-patterns (should NOT match)
assert(!isAgreementMessage('Не буду удалять отзыв'), 'refusal: wont delete');
assert(!isAgreementMessage('Не удалю!'), 'refusal: no delete');
assert(!isAgreementMessage('Не хочу менять отзыв'), 'refusal: dont want change');

// ============================================================================
// DELETION_CONFIRMED tests
// ============================================================================

console.log('\n=== DELETION_CONFIRMED (buyer + seller) ===');

// Buyer confirms
assert(isConfirmationMessage('Удалил отзыв', 'client'), 'buyer: deleted review');
assert(isConfirmationMessage('Удалила', 'client'), 'buyer: deleted (feminine) — direct');
assert(isConfirmationMessage('Отзыв удалён', 'client'), 'buyer: review deleted');
assert(isConfirmationMessage('Изменила отзыв', 'client'), 'buyer: changed review');
assert(isConfirmationMessage('Дополнила отзыв', 'client'), 'buyer: supplemented review');
assert(isConfirmationMessage('Всё исправила', 'client'), 'buyer: fixed everything');
assert(isConfirmationMessage('Поставила 5 звёзд', 'client'), 'buyer: set 5 stars');
assert(isConfirmationMessage('Оставила положительный отзыв', 'client'), 'buyer: left positive review');
assert(isConfirmationMessage('Отзыв изменён', 'client'), 'buyer: review modified');

// Seller confirms
assert(isConfirmationMessage('Видим что отзыв был удалён', 'seller'), 'seller: sees deletion');
assert(isConfirmationMessage('Отзыв был дополнен', 'seller'), 'seller: review supplemented');
assert(isConfirmationMessage('Спасибо за удаление отзыва', 'seller'), 'seller: thanks for deletion');
assert(isConfirmationMessage('Отзыв больше не отображается', 'seller'), 'seller: review not visible');

// ============================================================================
// Full conversation classification tests
// ============================================================================

console.log('\n=== Full conversation classification ===');

// Scenario 1: Seller offers compensation → tag = deletion_offered
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Здравствуйте! Увидели ваш отзыв.' },
    { sender: 'client', text: 'Да, товар пришёл с браком.' },
    { sender: 'seller', text: 'Предлагаем компенсацию 500 рублей в обмен на удаление отзыва.' },
  ];
  const result = classifyTagFromMessages(msgs);
  assert(result.tag === 'deletion_offered', 'scenario 1: seller offers → deletion_offered');
  assert(result.confidence >= 0.90, 'scenario 1: high confidence');
}

// Scenario 2: Buyer agrees after offer → tag = deletion_agreed
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Предлагаем компенсацию 500 рублей.' },
    { sender: 'client', text: 'Хорошо, удалю отзыв.' },
  ];
  const result = classifyTagFromMessages(msgs);
  assert(result.tag === 'deletion_agreed', 'scenario 2: buyer agrees → deletion_agreed');
}

// Scenario 3: Buyer confirms deletion → tag = deletion_confirmed
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Предлагаем компенсацию 500 рублей.' },
    { sender: 'client', text: 'Хорошо, удалю отзыв.' },
    { sender: 'client', text: 'Удалила отзыв.' },
  ];
  const result = classifyTagFromMessages(msgs);
  assert(result.tag === 'deletion_confirmed', 'scenario 3: buyer confirms → deletion_confirmed');
}

// Scenario 4: Seller confirms seeing deletion → tag = deletion_confirmed
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Предлагаем компенсацию 500 рублей.' },
    { sender: 'client', text: 'Хорошо, удалю.' },
    { sender: 'seller', text: 'Видим что отзыв был удалён. Спасибо!' },
  ];
  const result = classifyTagFromMessages(msgs);
  assert(result.tag === 'deletion_confirmed', 'scenario 4: seller confirms → deletion_confirmed');
}

// Scenario 5: No relevant content → tag = null
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Здравствуйте, чем можем помочь?' },
    { sender: 'client', text: 'Когда будет доставка?' },
    { sender: 'seller', text: 'Товар отправлен вчера.' },
  ];
  const result = classifyTagFromMessages(msgs);
  assert(result.tag === null, 'scenario 5: generic conversation → null');
}

// Scenario 6: Buyer refuses → tag = null (anti-pattern)
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Предлагаем компенсацию 500 рублей.' },
    { sender: 'client', text: 'Не буду удалять отзыв!' },
  ];
  const result = classifyTagFromMessages(msgs);
  // Should still detect the offer, but not the agreement
  assert(result.tag === 'deletion_offered', 'scenario 6: refusal → stays at deletion_offered');
}

// Scenario 7: Forward-only guard
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Предлагаем компенсацию 500 рублей.' },
  ];
  const result = classifyTagFromMessages(msgs, 'deletion_agreed');
  assert(result.tag === 'deletion_agreed', 'scenario 7: forward guard prevents downgrade');
  assert(result.triggers.includes('forward_guard'), 'scenario 7: has forward_guard trigger');
}

// Scenario 8: Empty messages → null
{
  const result = classifyTagFromMessages([]);
  assert(result.tag === null, 'scenario 8: empty messages → null');
}

// Scenario 9: Buyer asks "how to delete" = implicit agreement
{
  const msgs: ChatMessageForClassification[] = [
    { sender: 'seller', text: 'Компенсация 500 рублей в обмен на удаление.' },
    { sender: 'client', text: 'Как удалить отзыв? Не нашла кнопку.' },
  ];
  const result = classifyTagFromMessages(msgs);
  assert(result.tag === 'deletion_agreed', 'scenario 9: how to delete = implicit agreement');
}

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.error('\nSOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
}
