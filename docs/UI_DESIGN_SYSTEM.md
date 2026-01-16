# UI Design System — WB Reputation Manager

**Цель**: Обеспечить визуальную консистентность между HTML-прототипами и React-реализацией.

---

## 📐 Layout & Spacing

### Основная сетка
- **Базовый unit**: `4px` (0.25rem в Tailwind)
- **Стандартные отступы**:
  - `xs`: 2px (0.5)
  - `sm`: 8px (2)
  - `md`: 12px (3)
  - `lg`: 16px (4)
  - `xl`: 24px (6)
  - `2xl`: 32px (8)

### Container
- **Max width**: `1400px` для dashboard
- **Padding**: `16px` (4) на мобильных, `24px` (6) на десктопе

---

## 🎨 Color Palette

### Primary Colors
```css
/* Blue - Primary brand color */
--primary-50:  #eff6ff;
--primary-100: #dbeafe;
--primary-500: #3b82f6;  /* Main */
--primary-600: #2563eb;
--primary-700: #1d4ed8;

/* Tailwind: bg-blue-500, text-blue-600, border-blue-500 */
```

### Secondary Colors
```css
/* Purple - Accent */
--purple-500: #8b5cf6;
--purple-600: #7c3aed;
--purple-700: #6d28d9;

/* Used for avatars, badges */
/* Tailwind: bg-purple-500, from-purple-500 to-purple-700 */
```

### Semantic Colors
```css
/* Success - Green */
--success-50:  #f0fdf4;
--success-500: #22c55e;
--success-600: #16a34a;

/* Warning - Yellow */
--warning-50:  #fffbeb;
--warning-500: #eab308;
--warning-600: #ca8a04;

/* Error - Red */
--error-50:  #fef2f2;
--error-500: #ef4444;
--error-600: #dc2626;

/* Info - Cyan */
--info-50:  #ecfeff;
--info-500: #06b6d4;
--info-600: #0891b2;
```

### Neutral Colors (Slate)
```css
/* Text & Backgrounds */
--slate-50:  #f8fafc;  /* Light backgrounds */
--slate-100: #f1f5f9;  /* Secondary backgrounds */
--slate-200: #e2e8f0;  /* Borders */
--slate-300: #cbd5e1;  /* Disabled borders */
--slate-400: #94a3b8;  /* Placeholder text */
--slate-500: #64748b;  /* Secondary text */
--slate-600: #475569;  /* Body text */
--slate-700: #334155;  /* Headings */
--slate-800: #1e293b;
--slate-900: #0f172a;  /* Dark headings */

/* Tailwind: bg-slate-50, text-slate-600, border-slate-200 */
```

---

## 🔤 Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```
**Tailwind**: `font-sans` (default)

### Font Sizes
```css
--text-xs:   0.75rem (12px)  - line-height: 1rem
--text-sm:   0.875rem (14px) - line-height: 1.25rem
--text-base: 1rem (16px)     - line-height: 1.5rem
--text-lg:   1.125rem (18px) - line-height: 1.75rem
--text-xl:   1.25rem (20px)  - line-height: 1.75rem
--text-2xl:  1.5rem (24px)   - line-height: 2rem
```

**Tailwind classes**: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`

### Font Weights
```css
--font-normal:   400  /* Regular text */
--font-medium:   500  /* Labels, buttons */
--font-semibold: 600  /* Headings, emphasis */
--font-bold:     700  /* Strong emphasis */
```

**Tailwind classes**: `font-normal`, `font-medium`, `font-semibold`, `font-bold`

### Usage
- **Page titles**: `text-2xl font-bold text-slate-900`
- **Section headings**: `text-lg font-semibold text-slate-700`
- **Card titles**: `text-base font-semibold text-slate-900`
- **Body text**: `text-sm text-slate-600`
- **Secondary text**: `text-xs text-slate-500`
- **Labels**: `text-sm font-medium text-slate-700`

---

## 🧩 Components Styling

### Buttons

#### Primary Button
```tsx
<Button className="bg-blue-500 hover:bg-blue-600 text-white">
  Отправить
</Button>
```

#### Secondary Button (Outline)
```tsx
<Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
  Отменить
</Button>
```

#### Destructive Button
```tsx
<Button variant="destructive" className="bg-red-500 hover:bg-red-600">
  Удалить
</Button>
```

#### Icon Button
```tsx
<Button size="icon" variant="ghost">
  <RefreshCw className="w-4 h-4" />
</Button>
```

### Input Fields
```tsx
<Input
  className="border-slate-200 focus:border-blue-500 focus:ring-blue-500"
  placeholder="Поиск..."
/>
```

### Cards
```tsx
<div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
  {/* Content */}
</div>
```

### Badges
```tsx
{/* Success */}
<span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-semibold">
  Активный
</span>

{/* Warning */}
<span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded-full text-xs font-semibold">
  Ожидание
</span>

{/* Error */}
<span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
  Неуспешный
</span>
```

### Filter Chips
```tsx
<FilterChip
  icon="🟢"
  label="Активные"
  count={23}
  checked={true}
  onChange={() => {}}
/>
```
**Стиль**: `inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50`

---

## 🎯 Chat Tags (Messenger View)

### Tag Colors
```tsx
const TAG_COLORS = {
  active: '🟢',       // Green circle
  no_reply: '🟡',     // Yellow circle
  successful: '🔵',   // Blue circle
  unsuccessful: '🔴', // Red circle
  untagged: '⚪',     // White circle
  completed: '✅',    // Checkmark
};
```

### Tag Labels
```tsx
const TAG_LABELS = {
  active: '🟢 Активный',
  no_reply: '🟡 Нет ответа',
  successful: '🔵 Успешный',
  unsuccessful: '🔴 Неуспешный',
  untagged: '⚪ Не размечено',
  completed: '✅ Завершён',
};
```

---

## 📱 Responsive Breakpoints

```css
/* Tailwind breakpoints */
sm:  640px   @media (min-width: 640px)
md:  768px   @media (min-width: 768px)
lg:  1024px  @media (min-width: 1024px)
xl:  1280px  @media (min-width: 1280px)
2xl: 1536px  @media (min-width: 1536px)
```

### Usage Examples
```tsx
{/* Mobile-first approach */}
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Full width on mobile, 50% on tablet, 33% on desktop */}
</div>

<Button size="sm" className="md:size-default lg:size-lg">
  {/* Small on mobile, default on tablet, large on desktop */}
</Button>
```

---

## 🌑 Shadows

```css
/* Tailwind shadow utilities */
shadow-sm:   0 1px 2px 0 rgb(0 0 0 / 0.05)        /* Subtle cards */
shadow:      0 1px 3px 0 rgb(0 0 0 / 0.1)         /* Cards */
shadow-md:   0 4px 6px -1px rgb(0 0 0 / 0.1)      /* Raised cards */
shadow-lg:   0 10px 15px -3px rgb(0 0 0 / 0.1)    /* Modals */
shadow-xl:   0 20px 25px -5px rgb(0 0 0 / 0.1)    /* Dropdowns */
```

### Usage
- **Cards**: `shadow-sm`
- **Hover states**: `hover:shadow-md`
- **Modals/Dialogs**: `shadow-lg`
- **Dropdowns/Menus**: `shadow-xl`

---

## 🔄 Transitions & Animations

### Standard Transitions
```css
/* Tailwind classes */
transition-all      /* All properties */
transition-colors   /* Colors only */
transition-transform /* Transform only */

duration-75   /* 75ms  - Very fast */
duration-100  /* 100ms - Fast */
duration-200  /* 200ms - Default */
duration-300  /* 300ms - Slow */
duration-500  /* 500ms - Very slow */
```

### Common Patterns
```tsx
{/* Hover effects */}
<div className="transition-all duration-200 hover:bg-slate-50 hover:shadow-md">
  Content
</div>

{/* Button interactions */}
<Button className="transition-colors duration-150 hover:bg-blue-600 active:bg-blue-700">
  Click me
</Button>

{/* Rotating icons */}
<ChevronDown className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
```

---

## ✅ Accessibility

### Focus States
```tsx
{/* Always include focus styles */}
<Input className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
<Button className="focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" />
```

### ARIA Labels
```tsx
{/* Icon-only buttons */}
<Button size="icon" aria-label="Обновить данные">
  <RefreshCw className="w-4 h-4" />
</Button>

{/* Status indicators */}
<span className="sr-only">Непрочитанное сообщение</span>
<span className="w-2 h-2 bg-red-500 rounded-full" aria-hidden="true" />
```

### Color Contrast
- **WCAG AA compliant**: Ensure 4.5:1 contrast ratio for normal text
- **Body text**: `text-slate-600` on white background ✅
- **Headings**: `text-slate-900` on white background ✅
- **Links**: `text-blue-600` on white background ✅

---

## 🚫 Common Mistakes to Avoid

### ❌ Don't
```tsx
{/* Using arbitrary values without reason */}
<div className="p-[13px] text-[15px]" />

{/* Mixing inline styles with Tailwind */}
<div className="bg-blue-500" style={{backgroundColor: '#3b82f6'}} />

{/* Not using semantic color names */}
<div className="bg-[#3b82f6]" />
```

### ✅ Do
```tsx
{/* Use design system values */}
<div className="p-3 text-base" />

{/* Use Tailwind only */}
<div className="bg-blue-500" />

{/* Use semantic names */}
<div className="bg-blue-500" />
```

---

## 📚 References

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)
- [WCAG Color Contrast](https://webaim.org/resources/contrastchecker/)

---

**Last Updated**: 2026-01-16
**Version**: 1.0
**Maintained by**: Frontend Team
