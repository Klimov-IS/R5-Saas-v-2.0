# TASK-004: CRM — UI секции в кабинете

> **Статус:** Planning
> **Приоритет:** P1
> **Фаза:** Phase 2
> **Sprint:** 003
> **Зависимость:** TASK-003 (CRM Schema)

---

## Goal

Заменить placeholder-секции кабинета на полноценные редактируемые блоки:
- Реквизиты компании (inline edit)
- Google Drive ссылки (CRUD)
- Заметки менеджера (textarea + autosave)
- Статус работы в чатах (dropdowns + toggles)

## Scope

### UI Компоненты

**CompanyDetailsCard** — grid key-value с inline edit:
- Компания, ИНН, ОГРН, Контакт, Телефон, Email, Менеджер R5
- Кнопка "Редактировать" → поля становятся input

**StoreLinksCard** — список ссылок:
- Иконка по типу (sheets/docs/drive/custom)
- Кнопка "+ Добавить" → модал с title/url/type/description
- Drag-n-drop для sort_order (опционально)
- Delete с подтверждением

**InternalNotesCard** — textarea:
- Autosave через debounce (2 сек после последнего ввода)
- Индикатор "Сохранено ✓"

**ChatConfigCard** — статусные поля:
- Чаты согласованы: toggle
- Работаем в чатах: dropdown (not_started/active/paused/stopped)
- Опция в WB: dropdown (enabled/disabled/unknown)
- Всё через `PUT /api/stores/[storeId]/chat-config`

## Impact
- **UI:** Обновление `cabinet/page.tsx` — замена placeholders
- **Новые компоненты:** 4 штуки в `src/components/cabinet/`

## Estimated Effort
- ~4-5 часов
