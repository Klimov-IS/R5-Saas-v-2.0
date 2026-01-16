# HTML → React — Пошаговый гайд по переносу дизайна

**Цель**: Избежать потери дизайна при переносе HTML-прототипа в React-компоненты.

---

## 🎯 Проблема

**Ситуация**: Создали HTML-прототип с идеальным дизайном → перенесли в React → дизайн "слетел"

**Причины**:
1. HTML использует inline стили → React использует Tailwind CSS
2. HTML структура простая → React использует shadcn/ui с вложенными компонентами
3. Не учли семантику компонентов (Collapsible скрывает контент!)
4. Потеряли детали при переносе (spacing, colors, hover states)

---

## ✅ Пошаговый процесс

### Этап 1: Анализ HTML-прототипа (5 минут)

#### 1.1. Открой HTML в браузере и сделай скриншот
- Полный view всей страницы
- Отдельные скриншоты ключевых секций
- Hover states (если есть)
- Mobile view (если адаптивный)

#### 1.2. Проанализируй структуру
```html
<!-- Пример: Filters в HTML -->
<div class="filters-toggle" onclick="toggleFilters()">
  <span>Фильтры по тегам</span>
  <span class="filters-toggle-icon">▼</span>
</div>

<div class="filters" id="filtersPanel">
  <label class="filter-label">
    <input type="checkbox" checked>
    <span>🟢 Активные</span>
    <span class="filter-count">23</span>
  </label>
</div>
```

**Запиши**:
- ✅ Есть toggle (сворачивается/разворачивается)
- ✅ По умолчанию: развернуто или свернуто?
- ✅ Layout: vertical list или horizontal chips?
- ✅ Spacing между элементами
- ✅ Colors: background, borders, text

#### 1.3. Извлеки все CSS стили
Открой DevTools → Elements → Computed → скопируй ключевые стили:
```css
/* Пример для filter-label */
padding: 8px 12px;
background: #ffffff;
border: 1px solid #e2e8f0;
border-radius: 6px;
font-size: 14px;
color: #334155;
```

---

### Этап 2: Планирование React структуры (10 минут)

#### 2.1. Определи компоненты
```
HTML: <div class="filters">
  └─ <label class="filter-label">
      └─ <input type="checkbox">
      └─ <span>Label</span>
      └─ <span class="count">Count</span>

React:
FilterPanel.tsx
  └─ FilterChip.tsx
      └─ <Checkbox /> (shadcn)
      └─ <span>Label</span>
      └─ <Badge>Count</Badge> (custom)
```

#### 2.2. Выбери shadcn vs Custom
Используй [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) для решения:

| HTML Element | React Component | Тип |
|--------------|-----------------|-----|
| `<button>` | `<Button>` | shadcn |
| `<input type="text">` | `<Input>` | shadcn |
| `<input type="checkbox">` | `<Checkbox>` | shadcn |
| `<select>` | `<Select>` | shadcn |
| Custom chip/badge | `<FilterChip>` | Custom |

#### 2.3. Проверь семантику компонентов
⚠️ **ВАЖНО**: Не используй `Collapsible` если контент должен быть всегда видимым!

```tsx
// ❌ ПЛОХО - фильтры скрыты по умолчанию
<Collapsible>
  <CollapsibleTrigger>Фильтры</CollapsibleTrigger>
  <CollapsibleContent>
    <FilterChip ... />
  </CollapsibleContent>
</Collapsible>

// ✅ ХОРОШО - фильтры всегда видимы
<div>
  <h3>Фильтры по тегам</h3>
  <div className="flex gap-2">
    <FilterChip ... />
  </div>
</div>
```

---

### Этап 3: Перенос стилей (15-20 минут)

#### 3.1. Составь таблицу соответствий CSS → Tailwind
Используй [STYLE_TRANSFER_REFERENCE.md](./STYLE_TRANSFER_REFERENCE.md)

Пример:
```css
/* HTML CSS */
.filter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.filter-label:hover {
  background: #f8fafc;
}
```

```tsx
// React + Tailwind
<label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md cursor-pointer transition-colors duration-200 hover:bg-slate-50">
  {/* Content */}
</label>
```

#### 3.2. Используй Design Tokens
Из [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md):

| CSS Value | Tailwind Token | Design Token |
|-----------|----------------|--------------|
| `#e2e8f0` | `border-slate-200` | Border color |
| `#f8fafc` | `bg-slate-50` | Hover background |
| `8px` | `gap-2` | Spacing (0.5rem) |
| `12px` | `px-3` | Padding (0.75rem) |
| `14px` | `text-sm` | Font size |

#### 3.3. Проверь все состояния
- ✅ Default state
- ✅ Hover state
- ✅ Active/Selected state
- ✅ Disabled state
- ✅ Focus state (для accessibility)

---

### Этап 4: Реализация в React (20-30 минут)

#### 4.1. Начни с создания Custom компонентов (если нужны)
```tsx
// src/components/chats/FilterChip.tsx
'use client';

import { Checkbox } from '@/components/ui/checkbox';

interface FilterChipProps {
  icon: string;
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}

export function FilterChip({ icon, label, count, checked, onChange }: FilterChipProps) {
  return (
    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all duration-200 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        className="accent-blue-500"
      />
      <span className="flex items-center gap-1.5">
        <span>{icon}</span>
        <span className="font-medium text-slate-700">{label}</span>
      </span>
      <span className="ml-1 px-2 py-0.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
        {count}
      </span>
    </label>
  );
}
```

#### 4.2. Используй компоненты в родительском компоненте
```tsx
// src/components/chats/FilterPanel.tsx
'use client';

import { FilterChip } from './FilterChip';

export function FilterPanel({ storeId, tagStats }) {
  const { tagFilter, setTagFilter } = useChatsStore();

  return (
    <div className="px-4 pb-4">
      {/* Filters - Always visible */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Фильтры по тегам
        </h3>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            icon="🟢"
            label="Активные"
            count={tagStats?.active || 0}
            checked={tagFilter === 'active'}
            onChange={() => setTagFilter(tagFilter === 'active' ? 'all' : 'active')}
          />
          {/* More chips */}
        </div>
      </div>
    </div>
  );
}
```

---

### Этап 5: Визуальная проверка (10 минут)

#### 5.1. Side-by-side сравнение
Открой:
- Левое окно: HTML-прототип в браузере
- Правое окно: React-реализация в браузере

Сравни пиксель-в-пиксель:
- ✅ Layout (positioning, alignment)
- ✅ Spacing (margins, paddings, gaps)
- ✅ Colors (backgrounds, borders, text)
- ✅ Typography (font sizes, weights)
- ✅ Borders & Shadows
- ✅ Border radius

#### 5.2. Проверь интерактивность
- ✅ Hover states
- ✅ Click states
- ✅ Animations/Transitions
- ✅ Focus states (Tab navigation)

#### 5.3. Используй Design Review Checklist
См. [prototypes/DESIGN_REVIEW_CHECKLIST.md](../prototypes/DESIGN_REVIEW_CHECKLIST.md)

---

## 🚨 Частые ошибки и как их избежать

### Ошибка 1: Использование Collapsible для всегда видимого контента
**Симптом**: Фильтры/действия скрыты по умолчанию, пользователь не видит их сразу

❌ **Плохо**:
```tsx
<Collapsible>
  <CollapsibleTrigger>Фильтры</CollapsibleTrigger>
  <CollapsibleContent>
    {/* Filters */}
  </CollapsibleContent>
</Collapsible>
```

✅ **Хорошо**:
```tsx
<div>
  <h3>Фильтры по тегам</h3>
  <div className="flex gap-2">
    {/* Filters always visible */}
  </div>
</div>
```

---

### Ошибка 2: Потеря spacing при переносе
**Симптом**: Элементы слиплись вместе или слишком далеко друг от друга

❌ **Плохо**:
```tsx
// Забыли gap
<div className="flex">
  <FilterChip ... />
  <FilterChip ... />
</div>
```

✅ **Хорошо**:
```tsx
// Добавили gap-2 (8px)
<div className="flex gap-2">
  <FilterChip ... />
  <FilterChip ... />
</div>
```

**Fix**: Всегда проверяй gap/space между элементами в DevTools HTML-прототипа

---

### Ошибка 3: Неправильный layout (flex vs grid vs block)
**Симптом**: Элементы расположены вертикально вместо горизонтально (или наоборот)

HTML:
```html
<!-- Горизонтальный layout -->
<div style="display: flex; gap: 8px;">
  <label>Filter 1</label>
  <label>Filter 2</label>
</div>
```

❌ **Плохо** (vertical):
```tsx
<div className="flex flex-col gap-2">
  <FilterChip ... />
  <FilterChip ... />
</div>
```

✅ **Хорошо** (horizontal):
```tsx
<div className="flex gap-2">
  <FilterChip ... />
  <FilterChip ... />
</div>
```

---

### Ошибка 4: Забыли border-radius
**Симптом**: Компоненты квадратные вместо скругленных

❌ **Плохо**:
```tsx
<div className="border border-slate-200">
  {/* No rounding */}
</div>
```

✅ **Хорошо**:
```tsx
<div className="border border-slate-200 rounded-md">
  {/* Rounded corners */}
</div>
```

---

### Ошибка 5: Неправильные hover states
**Симптом**: Нет визуального feedback при наведении

❌ **Плохо**:
```tsx
<label className="bg-white border border-slate-200 cursor-pointer">
  {/* No hover state */}
</label>
```

✅ **Хорошо**:
```tsx
<label className="bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors duration-200">
  {/* Smooth hover transition */}
</label>
```

---

## 📋 Pre-Implementation Checklist

Перед началом переноса:
- [ ] Сделал скриншоты HTML-прототипа
- [ ] Извлек все CSS стили из DevTools
- [ ] Проанализировал структуру компонентов
- [ ] Определил, какие компоненты shadcn использовать
- [ ] Определил, какие Custom компоненты нужно создать
- [ ] Проверил, нужен ли Collapsible или контент всегда видимый
- [ ] Составил таблицу CSS → Tailwind mappings
- [ ] Прочитал UI_DESIGN_SYSTEM.md и COMPONENT_LIBRARY.md

---

## 📋 Post-Implementation Checklist

После реализации:
- [ ] Side-by-side сравнение с HTML-прототипом
- [ ] Проверил spacing (margins, paddings, gaps)
- [ ] Проверил colors (backgrounds, borders, text)
- [ ] Проверил typography (sizes, weights)
- [ ] Проверил borders & shadows
- [ ] Проверил hover states
- [ ] Проверил focus states (Tab navigation)
- [ ] Проверил transitions/animations
- [ ] Протестировал на разных разрешениях экрана
- [ ] Заполнил Design Review Checklist

---

## 🛠️ Инструменты для проверки

### Browser DevTools
```
1. Открой HTML-прототип
2. F12 → Elements → Inspect element
3. Computed tab → скопируй все стили
4. Сравни с React-реализацией
```

### VS Code Extensions
- **Tailwind CSS IntelliSense** - автокомплит Tailwind классов
- **Headwind** - автосортировка Tailwind классов

### Online Tools
- [Tailwind CSS Viewer](https://tailwind-css-viewer.vercel.app/) - смотреть все Tailwind утилиты
- [CSS to Tailwind Converter](https://transform.tools/css-to-tailwind) - конвертер CSS → Tailwind

---

## 📚 См. также

- [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) - Design tokens и цветовая палитра
- [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md) - Когда использовать shadcn vs Custom
- [STYLE_TRANSFER_REFERENCE.md](./STYLE_TRANSFER_REFERENCE.md) - CSS → Tailwind mappings
- [prototypes/DESIGN_REVIEW_CHECKLIST.md](../prototypes/DESIGN_REVIEW_CHECKLIST.md) - Чеклист для проверки

---

**Last Updated**: 2026-01-16
**Version**: 1.0
**Maintained by**: Frontend Team
