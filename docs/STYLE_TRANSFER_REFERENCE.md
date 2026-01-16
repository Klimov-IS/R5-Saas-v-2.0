# Style Transfer Reference — CSS → Tailwind Mapping

**Цель**: Быстрый справочник для конвертации CSS стилей в Tailwind классы.

---

## 🎨 Layout & Display

### Display
| CSS | Tailwind | Notes |
|-----|----------|-------|
| `display: flex;` | `flex` | Flexbox container |
| `display: inline-flex;` | `inline-flex` | Inline flexbox |
| `display: grid;` | `grid` | Grid container |
| `display: block;` | `block` | Block element |
| `display: inline-block;` | `inline-block` | Inline block |
| `display: none;` | `hidden` | Hide element |

### Flex Direction
| CSS | Tailwind |
|-----|----------|
| `flex-direction: row;` | `flex-row` (default) |
| `flex-direction: column;` | `flex-col` |
| `flex-direction: row-reverse;` | `flex-row-reverse` |
| `flex-direction: column-reverse;` | `flex-col-reverse` |

### Flex Wrap
| CSS | Tailwind |
|-----|----------|
| `flex-wrap: wrap;` | `flex-wrap` |
| `flex-wrap: nowrap;` | `flex-nowrap` |

### Justify Content
| CSS | Tailwind |
|-----|----------|
| `justify-content: flex-start;` | `justify-start` |
| `justify-content: flex-end;` | `justify-end` |
| `justify-content: center;` | `justify-center` |
| `justify-content: space-between;` | `justify-between` |
| `justify-content: space-around;` | `justify-around` |

### Align Items
| CSS | Tailwind |
|-----|----------|
| `align-items: flex-start;` | `items-start` |
| `align-items: flex-end;` | `items-end` |
| `align-items: center;` | `items-center` |
| `align-items: baseline;` | `items-baseline` |
| `align-items: stretch;` | `items-stretch` |

### Gap
| CSS | Tailwind | Size |
|-----|----------|------|
| `gap: 4px;` | `gap-1` | 0.25rem |
| `gap: 8px;` | `gap-2` | 0.5rem |
| `gap: 12px;` | `gap-3` | 0.75rem |
| `gap: 16px;` | `gap-4` | 1rem |
| `gap: 24px;` | `gap-6` | 1.5rem |
| `gap: 32px;` | `gap-8` | 2rem |

---

## 📏 Spacing (Padding & Margin)

### System: 4px base unit

| CSS Value | Tailwind Token | rem | px |
|-----------|----------------|-----|-----|
| `0` | `0` | 0 | 0 |
| `2px` | `0.5` | 0.125rem | 2px |
| `4px` | `1` | 0.25rem | 4px |
| `6px` | `1.5` | 0.375rem | 6px |
| `8px` | `2` | 0.5rem | 8px |
| `12px` | `3` | 0.75rem | 12px |
| `16px` | `4` | 1rem | 16px |
| `20px` | `5` | 1.25rem | 20px |
| `24px` | `6` | 1.5rem | 24px |
| `32px` | `8` | 2rem | 32px |
| `48px` | `12` | 3rem | 48px |
| `64px` | `16` | 4rem | 64px |

### Padding
| CSS | Tailwind |
|-----|----------|
| `padding: 8px;` | `p-2` |
| `padding: 12px;` | `p-3` |
| `padding: 16px;` | `p-4` |
| `padding-left: 12px; padding-right: 12px;` | `px-3` |
| `padding-top: 6px; padding-bottom: 6px;` | `py-1.5` |
| `padding-left: 12px;` | `pl-3` |
| `padding-right: 12px;` | `pr-3` |
| `padding-top: 6px;` | `pt-1.5` |
| `padding-bottom: 6px;` | `pb-1.5` |

### Margin
| CSS | Tailwind |
|-----|----------|
| `margin: 8px;` | `m-2` |
| `margin: 12px;` | `m-3` |
| `margin: 16px;` | `m-4` |
| `margin-left: auto; margin-right: auto;` | `mx-auto` |
| `margin-bottom: 16px;` | `mb-4` |
| `margin-top: 24px;` | `mt-6` |

---

## 🎨 Colors

### Backgrounds
| CSS | Tailwind | Use Case |
|-----|----------|----------|
| `background: #ffffff;` | `bg-white` | White backgrounds |
| `background: #f8fafc;` | `bg-slate-50` | Light section backgrounds |
| `background: #f1f5f9;` | `bg-slate-100` | Card backgrounds |
| `background: #3b82f6;` | `bg-blue-500` | Primary buttons |
| `background: #2563eb;` | `bg-blue-600` | Primary button hover |
| `background: #8b5cf6;` | `bg-purple-500` | Accent colors |
| `background: #22c55e;` | `bg-green-500` | Success states |
| `background: #ef4444;` | `bg-red-500` | Error states |

### Text Colors
| CSS | Tailwind | Use Case |
|-----|----------|----------|
| `color: #0f172a;` | `text-slate-900` | Headings |
| `color: #334155;` | `text-slate-700` | Subheadings |
| `color: #475569;` | `text-slate-600` | Body text |
| `color: #64748b;` | `text-slate-500` | Secondary text |
| `color: #94a3b8;` | `text-slate-400` | Placeholder text |
| `color: #3b82f6;` | `text-blue-500` | Links |
| `color: #ef4444;` | `text-red-500` | Error messages |
| `color: #ffffff;` | `text-white` | White text on dark bg |

### Borders
| CSS | Tailwind | Use Case |
|-----|----------|----------|
| `border: 1px solid #e2e8f0;` | `border border-slate-200` | Default borders |
| `border: 1px solid #cbd5e1;` | `border border-slate-300` | Stronger borders |
| `border: 2px solid #3b82f6;` | `border-2 border-blue-500` | Active/Selected |
| `border-bottom: 1px solid #e2e8f0;` | `border-b border-slate-200` | Bottom only |
| `border-left: 4px solid #3b82f6;` | `border-l-4 border-l-blue-500` | Left accent |

---

## 🔤 Typography

### Font Sizes
| CSS | Tailwind | rem | px | Line Height |
|-----|----------|-----|-----|-------------|
| `font-size: 12px;` | `text-xs` | 0.75rem | 12px | 1rem |
| `font-size: 14px;` | `text-sm` | 0.875rem | 14px | 1.25rem |
| `font-size: 16px;` | `text-base` | 1rem | 16px | 1.5rem |
| `font-size: 18px;` | `text-lg` | 1.125rem | 18px | 1.75rem |
| `font-size: 20px;` | `text-xl` | 1.25rem | 20px | 1.75rem |
| `font-size: 24px;` | `text-2xl` | 1.5rem | 24px | 2rem |
| `font-size: 30px;` | `text-3xl` | 1.875rem | 30px | 2.25rem |

### Font Weights
| CSS | Tailwind | Weight |
|-----|----------|--------|
| `font-weight: 400;` | `font-normal` | Normal |
| `font-weight: 500;` | `font-medium` | Medium |
| `font-weight: 600;` | `font-semibold` | Semi-bold |
| `font-weight: 700;` | `font-bold` | Bold |

### Text Alignment
| CSS | Tailwind |
|-----|----------|
| `text-align: left;` | `text-left` |
| `text-align: center;` | `text-center` |
| `text-align: right;` | `text-right` |

### Text Transform
| CSS | Tailwind |
|-----|----------|
| `text-transform: uppercase;` | `uppercase` |
| `text-transform: lowercase;` | `lowercase` |
| `text-transform: capitalize;` | `capitalize` |

### Text Decoration
| CSS | Tailwind |
|-----|----------|
| `text-decoration: none;` | `no-underline` |
| `text-decoration: underline;` | `underline` |

---

## 📐 Sizing

### Width
| CSS | Tailwind | Value |
|-----|----------|-------|
| `width: 100%;` | `w-full` | 100% |
| `width: 50%;` | `w-1/2` | 50% |
| `width: 33.333%;` | `w-1/3` | 33.333% |
| `width: 200px;` | `w-[200px]` | 200px (arbitrary) |
| `width: auto;` | `w-auto` | Auto |
| `max-width: 1200px;` | `max-w-6xl` | 72rem |
| `max-width: 100%;` | `max-w-full` | 100% |
| `min-width: 0;` | `min-w-0` | 0 |

### Height
| CSS | Tailwind | Value |
|-----|----------|-------|
| `height: 100%;` | `h-full` | 100% |
| `height: 100vh;` | `h-screen` | 100vh |
| `height: 40px;` | `h-10` | 2.5rem |
| `height: auto;` | `h-auto` | Auto |
| `min-height: 100vh;` | `min-h-screen` | 100vh |

### Specific Sizes
| CSS | Tailwind | rem | px |
|-----|----------|-----|-----|
| `width: 16px; height: 16px;` | `w-4 h-4` | 1rem | 16px |
| `width: 20px; height: 20px;` | `w-5 h-5` | 1.25rem | 20px |
| `width: 24px; height: 24px;` | `w-6 h-6` | 1.5rem | 24px |
| `width: 40px; height: 40px;` | `w-10 h-10` | 2.5rem | 40px |
| `width: 48px; height: 48px;` | `w-12 h-12` | 3rem | 48px |

---

## 🔲 Borders & Radius

### Border Width
| CSS | Tailwind |
|-----|----------|
| `border: 1px solid;` | `border` |
| `border: 2px solid;` | `border-2` |
| `border: 4px solid;` | `border-4` |
| `border-bottom: 1px solid;` | `border-b` |
| `border-left: 4px solid;` | `border-l-4` |

### Border Radius
| CSS | Tailwind | Value |
|-----|----------|-------|
| `border-radius: 4px;` | `rounded` | 0.25rem |
| `border-radius: 6px;` | `rounded-md` | 0.375rem |
| `border-radius: 8px;` | `rounded-lg` | 0.5rem |
| `border-radius: 12px;` | `rounded-xl` | 0.75rem |
| `border-radius: 9999px;` | `rounded-full` | Full circle |
| `border-top-left-radius: 8px;` | `rounded-tl-lg` | Top-left only |

---

## 🌑 Shadows

| CSS | Tailwind | Use Case |
|-----|----------|----------|
| `box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);` | `shadow-sm` | Subtle cards |
| `box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);` | `shadow` | Cards |
| `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);` | `shadow-md` | Raised elements |
| `box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);` | `shadow-lg` | Modals |
| `box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);` | `shadow-xl` | Dropdowns |
| `box-shadow: none;` | `shadow-none` | No shadow |

---

## 🔄 Transitions & Animations

### Transition Property
| CSS | Tailwind |
|-----|----------|
| `transition: all 0.2s;` | `transition-all duration-200` |
| `transition: background 0.2s;` | `transition-colors duration-200` |
| `transition: transform 0.2s;` | `transition-transform duration-200` |
| `transition: opacity 0.3s;` | `transition-opacity duration-300` |

### Transition Duration
| CSS | Tailwind |
|-----|----------|
| `transition-duration: 75ms;` | `duration-75` |
| `transition-duration: 100ms;` | `duration-100` |
| `transition-duration: 200ms;` | `duration-200` |
| `transition-duration: 300ms;` | `duration-300` |
| `transition-duration: 500ms;` | `duration-500` |

### Transition Timing
| CSS | Tailwind |
|-----|----------|
| `transition-timing-function: ease;` | `ease` (default) |
| `transition-timing-function: linear;` | `ease-linear` |
| `transition-timing-function: ease-in;` | `ease-in` |
| `transition-timing-function: ease-out;` | `ease-out` |

---

## 🎯 Position & Z-Index

### Position
| CSS | Tailwind |
|-----|----------|
| `position: relative;` | `relative` |
| `position: absolute;` | `absolute` |
| `position: fixed;` | `fixed` |
| `position: sticky;` | `sticky` |

### Positioning
| CSS | Tailwind |
|-----|----------|
| `top: 0;` | `top-0` |
| `right: 0;` | `right-0` |
| `bottom: 0;` | `bottom-0` |
| `left: 0;` | `left-0` |
| `top: 50%; transform: translateY(-50%);` | `top-1/2 -translate-y-1/2` |

### Z-Index
| CSS | Tailwind |
|-----|----------|
| `z-index: 10;` | `z-10` |
| `z-index: 20;` | `z-20` |
| `z-index: 50;` | `z-50` |

---

## 🖱️ Interactivity

### Cursor
| CSS | Tailwind |
|-----|----------|
| `cursor: pointer;` | `cursor-pointer` |
| `cursor: not-allowed;` | `cursor-not-allowed` |
| `cursor: default;` | `cursor-default` |

### Pointer Events
| CSS | Tailwind |
|-----|----------|
| `pointer-events: none;` | `pointer-events-none` |
| `pointer-events: auto;` | `pointer-events-auto` |

### User Select
| CSS | Tailwind |
|-----|----------|
| `user-select: none;` | `select-none` |
| `user-select: text;` | `select-text` |
| `user-select: all;` | `select-all` |

---

## 🎭 Pseudo-classes & States

### Hover
```css
/* CSS */
.element:hover {
  background: #f8fafc;
}

/* Tailwind */
<div className="hover:bg-slate-50">
```

### Focus
```css
/* CSS */
.element:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Tailwind */
<div className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
```

### Active
```css
/* CSS */
.element:active {
  background: #1d4ed8;
}

/* Tailwind */
<div className="active:bg-blue-700">
```

### Disabled
```css
/* CSS */
.element:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Tailwind */
<div className="disabled:opacity-50 disabled:cursor-not-allowed">
```

---

## 📱 Responsive Design

### Breakpoint Modifiers
| Breakpoint | Min Width | Tailwind Prefix |
|------------|-----------|-----------------|
| Mobile | - | (no prefix) |
| Small | 640px | `sm:` |
| Medium | 768px | `md:` |
| Large | 1024px | `lg:` |
| XLarge | 1280px | `xl:` |
| 2XLarge | 1536px | `2xl:` |

### Example
```css
/* CSS */
@media (min-width: 768px) {
  .element {
    width: 50%;
  }
}

/* Tailwind */
<div className="w-full md:w-1/2">
```

---

## 🧩 Common Patterns

### Card
```css
/* CSS */
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

/* Tailwind */
<div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
```

### Button Primary
```css
/* CSS */
.btn-primary {
  background: #3b82f6;
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: background 0.2s;
}
.btn-primary:hover {
  background: #2563eb;
}

/* Tailwind */
<button className="bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 hover:bg-blue-600">
```

### Centered Container
```css
/* CSS */
.container {
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 16px;
  padding-right: 16px;
}

/* Tailwind */
<div className="max-w-6xl mx-auto px-4">
```

### Flex Center
```css
/* CSS */
.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Tailwind */
<div className="flex justify-center items-center">
```

---

## 🔍 Quick Lookup Table

### Most Common Conversions

| CSS | Tailwind | Category |
|-----|----------|----------|
| `display: flex;` | `flex` | Layout |
| `gap: 8px;` | `gap-2` | Spacing |
| `padding: 12px;` | `p-3` | Spacing |
| `margin-bottom: 16px;` | `mb-4` | Spacing |
| `background: #f8fafc;` | `bg-slate-50` | Color |
| `color: #475569;` | `text-slate-600` | Color |
| `border: 1px solid #e2e8f0;` | `border border-slate-200` | Border |
| `border-radius: 6px;` | `rounded-md` | Border |
| `font-size: 14px;` | `text-sm` | Typography |
| `font-weight: 600;` | `font-semibold` | Typography |
| `cursor: pointer;` | `cursor-pointer` | Interactivity |
| `transition: all 0.2s;` | `transition-all duration-200` | Animation |

---

## 📚 Tools & Resources

### Online Converters
- [Transform Tools - CSS to Tailwind](https://transform.tools/css-to-tailwind)
- [Tailwind Color Shades Generator](https://tailwind-color-shades.netlify.app/)

### VS Code Extensions
- **Tailwind CSS IntelliSense** - Autocomplete for Tailwind classes
- **Headwind** - Auto-sort Tailwind classes

### Cheat Sheets
- [Official Tailwind Docs](https://tailwindcss.com/docs)
- [Tailwind Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet)

---

**Last Updated**: 2026-01-16
**Version**: 1.0
**Maintained by**: Frontend Team
