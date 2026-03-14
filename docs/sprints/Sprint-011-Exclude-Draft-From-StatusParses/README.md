# Sprint 011 — Исключить из statusParses отзывы с draft-жалобами

**Дата:** 2026-03-14
**Статус:** Done
**Предыдущий:** Sprint 010 (work_from_date Filter)

---

## Цель

При подключении кабинета бэкенд сразу генерирует жалобы на все подходящие отзывы. Расширение затем идёт на страницу WB подавать жалобу и при этом автоматически парсит все видимые отзывы на странице (побочный эффект).

Ставить задачу statusParses на отзывы, по которым уже есть draft-жалоба — избыточно: расширение и так зайдёт на эту страницу ради подачи жалобы и спарсит статус.

## Изменения

Добавлено условие во все statusParses-запросы:

```sql
AND NOT EXISTS (
  SELECT 1 FROM review_complaints rc
  WHERE rc.review_id = r.id AND rc.status = 'draft'
)
```

## Файлы

| Файл | Изменение |
|------|-----------|
| `src/app/api/extension/stores/[storeId]/tasks/route.ts` | Query A + Query E: exclude draft complaints |
| `src/app/api/extension/stores/route.ts` | Q2: exclude draft complaints |

## Поведение

| Состояние отзыва | statusParses | complaints |
|------------------|:------------:|:----------:|
| Непарсен, нет жалобы | Да | Нет |
| Непарсен, есть draft-жалоба | **Нет** (новое) | Да |
| Жалоба подана, chat_status неизвестен | Да | Нет |
| Спарсен, жалоба rejected | Нет | Нет |
