# WB Interface Rollback - Критичная проблема

**Дата**: 27 января 2026
**Статус**: BLOCKED - ожидание HTML от пользователя
**Приоритет**: P0 - CRITICAL
**Компонент**: Chrome Extension - PageParser

---

## Суть проблемы

**Wildberries откатил интерфейс продавца на старую версию.**

### Что произошло

1. **До отката** (декабрь 2025 - 26 января 2026):
   - WB запустил новый интерфейс страницы отзывов продавца
   - Мы обновили PageParser для работы с новой структурой HTML
   - PageParser v2 успешно парсил отзывы

2. **27 января 2026**:
   - WB откатил интерфейс на старую версию
   - PageParser v2 перестал работать
   - Расширение не может парсить отзывы

### Почему это критично

Chrome Extension - ключевой компонент для:
- Парсинга отзывов со страницы WB
- Поиска отзывов в базе данных R5
- Автоматической подачи жалоб на негативные отзывы

**Без работающего парсера весь workflow подачи жалоб остановлен.**

---

## Техническая информация

### Текущая реализация (PageParser v2)

**Файл**: `Extension/WB/src/contents/complaints/parsers/page.parser.js`

**Проблема**: Селекторы DOM рассчитаны на новую версию интерфейса

**Пример** (предположительно):
```javascript
// Парсинг отзывов из новой версии интерфейса
const reviewRows = document.querySelectorAll('.new-review-container');
```

После отката эти селекторы не находят элементы.

### Composite ID System

**Формат**: `{article}-{YYYYMMDD}-{HHMM}-{rating}`

**Пример**: `147369104-20260127-1230-5`

**Почему важно**: WB убрал ID отзывов из HTML, поэтому мы используем composite ID для уникальной идентификации.

### API Integration

**Endpoint**: `POST /api/extension/stores/{storeId}/reviews/find-by-data`

**Workflow**:
1. PageParser парсит отзывы со страницы → извлекает article, date, rating, text
2. Extension отправляет данные в API
3. API ищет отзыв в БД по composite данным
4. API возвращает полные данные отзыва, включая DB ID и статус жалобы

---

## Решение

### Dual-Version Parser

Создать парсер с поддержкой **обеих версий интерфейса**:

```javascript
window.WBPageParser = {
  /**
   * Автоматическое определение версии интерфейса
   */
  detectInterfaceVersion() {
    // Проверяет наличие специфичных селекторов
    if (document.querySelector('.new-interface-class')) {
      return 'v2'; // Новая версия
    } else if (document.querySelector('.old-interface-class')) {
      return 'v1'; // Старая версия
    }
    return 'unknown';
  },

  /**
   * Универсальный парсинг с автоопределением версии
   */
  parseReviews() {
    const version = this.detectInterfaceVersion();

    if (version === 'v2') {
      return this.parseReviewsV2(); // Текущая реализация
    } else if (version === 'v1') {
      return this.parseReviewsV1(); // НУЖНО РЕАЛИЗОВАТЬ
    } else {
      throw new Error('Unknown WB interface version');
    }
  },

  /**
   * Парсинг для старой версии интерфейса
   */
  parseReviewsV1() {
    // TODO: Реализовать после получения HTML
    const reviews = [];

    // Найти контейнеры отзывов (селекторы из старого HTML)
    const reviewRows = document.querySelectorAll('.old-review-selector');

    reviewRows.forEach(row => {
      const article = /* extract article */;
      const date = /* extract date */;
      const rating = /* extract rating */;
      const text = /* extract text */;

      reviews.push({
        article,
        date,
        rating,
        text,
        compositeId: `${article}-${formatDate(date)}-${rating}`
      });
    });

    return reviews;
  },

  /**
   * Парсинг для новой версии интерфейса (текущая)
   */
  parseReviewsV2() {
    // Существующая реализация
    // ...
  }
};
```

---

## Roadmap

### Phase 1: Получение HTML (BLOCKED)

**Что нужно от пользователя**:
1. Открыть страницу отзывов в интерфейсе WB: `https://seller.wildberries.ru/feedbacks/`
2. Сохранить HTML страницы (Ctrl+S или "Сохранить как...")
3. Передать HTML файл разработчику

**Альтернатива**: Скриншот DOM структуры из DevTools (F12 → Elements)

**ETA**: Зависит от пользователя

### Phase 2: Анализ HTML (1 день)

**Задачи**:
1. Сравнить старую и новую версии HTML
2. Определить ключевые селекторы для парсинга:
   - Контейнер отзыва
   - Артикул товара
   - Дата отзыва
   - Рейтинг (1-5 звезд)
   - Текст отзыва
3. Определить надежный способ определения версии интерфейса

**Deliverable**: Таблица различий между версиями

### Phase 3: Реализация parseReviewsV1() (1-2 дня)

**Задачи**:
1. Реализовать функцию `parseReviewsV1()`
2. Реализовать функцию `detectInterfaceVersion()`
3. Обновить `parseReviews()` для маршрутизации по версиям
4. Добавить fallback стратегии (если оба селектора не работают)

**Deliverable**: Обновленный `page.parser.js`

### Phase 4: Тестирование (1 день)

**Тесты**:
1. Открыть страницу отзывов в старой версии интерфейса
2. Выполнить `window.WBPageParser.parseReviews()` в консоли
3. Проверить корректность данных (article, date, rating, text)
4. Проверить корректность composite ID
5. Протестировать `/find-by-data` endpoint с реальными данными

**Тестовый магазин**: IP Adamyan (ID: `ihMDtYWEY7IXkR3Lm9Pq`)
- 15 товаров
- 1226 отзывов в БД

**Deliverable**: Подтверждение работоспособности парсера на обеих версиях

---

## Зависимости

### От пользователя

- ⏳ **HTML старой версии интерфейса WB** (или скриншот DOM структуры)

### От разработчика

- ✅ Endpoint `/find-by-data` уже реализован
- ✅ Composite ID система работает
- ✅ Тестовый магазин создан и синхронизирован

---

## Риски

### Риск 1: WB снова изменит интерфейс

**Вероятность**: Высокая (уже менял дважды)

**Mitigation**: Dual-version parser сделает систему устойчивой к откатам

### Риск 2: Селекторы DOM нестабильны

**Вероятность**: Средняя

**Mitigation**: Использовать fallback стратегии (множественные селекторы на каждый элемент)

**Пример**:
```javascript
// Попробовать несколько селекторов для артикула
const article =
  row.querySelector('.article-class-1')?.textContent ||
  row.querySelector('.article-class-2')?.textContent ||
  row.getAttribute('data-article') ||
  null;
```

### Риск 3: Composite ID может не быть уникальным

**Вероятность**: Низкая (но возможно при одинаковых отзывах в одну минуту)

**Mitigation**: Добавить fuzzy text matching в `/find-by-data` endpoint (уже реализовано частично)

---

## Связанная документация

- **Главная документация**: [CHROME_EXTENSION_INTEGRATION.md](./CHROME_EXTENSION_INTEGRATION.md)
- **Extension README**: [Extension/WB/README.md](../Extension/WB/README.md)
- **Task Management**: [TASK_MANAGEMENT_CENTER.md](./TASK_MANAGEMENT_CENTER.md)

---

## Контакты

**Ответственный**: R5 Development Team
**Дата создания**: 27 января 2026
**Последнее обновление**: 27 января 2026

---

**Следующий шаг**: Получить HTML старой версии интерфейса WB от пользователя.
