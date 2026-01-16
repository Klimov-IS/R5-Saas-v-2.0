# Component Library — Когда использовать shadcn/ui vs Custom Components

**Цель**: Четкие правила выбора между готовыми компонентами shadcn/ui и кастомными компонентами.

---

## 🎯 Общая философия

### Используй shadcn/ui когда:
✅ Нужен стандартный UI паттерн (Button, Input, Select)
✅ Требуется accessibility из коробки
✅ Нужна консистентность с другими страницами
✅ Компонент используется в нескольких местах

### Создавай Custom компонент когда:
✅ Нужна специфичная бизнес-логика
✅ shadcn/ui компонент не подходит по дизайну
✅ Требуется уникальная визуальная стилизация
✅ Нужна обертка над shadcn с дополнительной логикой

---

## 📦 shadcn/ui Components

### Button
**Когда использовать**: Всегда для любых кнопок
**Варианты**: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`
**Размеры**: `default`, `sm`, `lg`, `icon`

```tsx
import { Button } from '@/components/ui/button';

{/* Primary action */}
<Button>Отправить</Button>

{/* Secondary action */}
<Button variant="outline">Отменить</Button>

{/* Icon only */}
<Button size="icon" variant="ghost">
  <RefreshCw className="w-4 h-4" />
</Button>
```

**❌ НЕ создавай кастомный Button** - всегда используй shadcn Button с пропами.

---

### Input
**Когда использовать**: Для всех текстовых полей ввода
**Типы**: `text`, `email`, `password`, `number`, `search`

```tsx
import { Input } from '@/components/ui/input';

<Input
  type="text"
  placeholder="Поиск по клиенту..."
  className="border-slate-200 focus:border-blue-500"
/>
```

**✅ Создавай обертку когда**:
- Нужен label + error + helper text в одном компоненте
- Требуется специфичная валидация

```tsx
// Custom FormInput.tsx
export function FormInput({ label, error, ...props }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Input {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

---

### Select
**Когда использовать**: Для выпадающих списков с выбором

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<Select value={tag} onValueChange={setTag}>
  <SelectTrigger className="w-48">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="active">🟢 Активный</SelectItem>
    <SelectItem value="successful">🔵 Успешный</SelectItem>
  </SelectContent>
</Select>
```

**❌ НЕ используй** если:
- Нужен multi-select (создай Custom с Combobox)
- Требуется inline toggle (используй Radio Group или Tabs)

---

### Checkbox
**Когда использовать**: Для boolean выбора

```tsx
import { Checkbox } from '@/components/ui/checkbox';

<Checkbox
  checked={isChecked}
  onCheckedChange={setIsChecked}
  className="accent-blue-500"
/>
```

**✅ Создавай обертку для**:
- Filter chips с checkbox + label + count
- Bulk selection с indeterminate state

---

### Dialog / Modal
**Когда использовать**: Для модальных окон

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Открыть</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Заголовок</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

**❌ НЕ используй** если:
- Нужен side drawer (используй Sheet)
- Требуется tooltip (используй Tooltip)

---

### Tabs
**Когда использовать**: Для переключения между разделами контента

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="table">📋 Таблица</TabsTrigger>
    <TabsTrigger value="messenger">💬 Мессенджер</TabsTrigger>
  </TabsList>
  <TabsContent value="table">{/* Table view */}</TabsContent>
  <TabsContent value="messenger">{/* Messenger view */}</TabsContent>
</Tabs>
```

---

### Collapsible
**Когда использовать**: Для сворачиваемого контента
**⚠️ ВАЖНО**: Не используй если контент должен быть всегда видимым!

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

<Collapsible>
  <CollapsibleTrigger>Показать больше</CollapsibleTrigger>
  <CollapsibleContent>
    {/* Hidden content */}
  </CollapsibleContent>
</Collapsible>
```

**❌ НЕ используй для**:
- Фильтров, которые должны быть всегда видимыми
- Действий, к которым нужен быстрый доступ
- Критичной информации, которую пользователь должен видеть сразу

**✅ Используй для**:
- Дополнительных настроек
- Расширенных фильтров (Advanced filters)
- FAQ списков

---

### Tooltip
**Когда использовать**: Для подсказок при наведении

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button size="icon" variant="ghost">
        <HelpCircle className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Справочная информация</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 🎨 Custom Components

### FilterChip
**Почему custom**: Специфичный дизайн с emoji + label + count + checkbox

```tsx
// src/components/chats/FilterChip.tsx
export function FilterChip({ icon, label, count, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span>{icon} {label}</span>
      <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs font-semibold">
        {count}
      </span>
    </label>
  );
}
```

**Использует внутри**: `Checkbox` из shadcn/ui

---

### MessageBubble
**Почему custom**: Специфичный дизайн чат-интерфейса

```tsx
// src/components/chats/MessageBubble.tsx
export function MessageBubble({ message }) {
  const isClient = message.sender === 'client';

  return (
    <div className={`flex ${isClient ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`max-w-md px-4 py-2 rounded-lg ${
        isClient
          ? 'bg-white border border-slate-200'
          : 'bg-blue-500 text-white'
      }`}>
        <p className="text-sm">{message.text}</p>
        <span className="text-xs opacity-70">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
```

**Не использует shadcn**: Полностью кастомный дизайн

---

### ChatItem
**Почему custom**: Специфичный дизайн элемента списка чатов

```tsx
// src/components/chats/ChatItem.tsx
export function ChatItem({ chat, isActive, onClick }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 border-b cursor-pointer ${
        isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'
      }`}
      onClick={onClick}
    >
      <Checkbox checked={isSelected} />
      <div className="flex-1">
        <div className="font-semibold">{chat.clientName}</div>
        <div className="text-sm text-slate-600">{chat.lastMessageText}</div>
      </div>
    </div>
  );
}
```

**Использует внутри**: `Checkbox` из shadcn/ui

---

## 🔄 Когда создавать обертки

### Паттерн: Form Field Wrapper
```tsx
// Custom wrapper над shadcn Input
export function FormField({ label, error, helperText, ...inputProps }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <Input {...inputProps} className={error ? 'border-red-500' : ''} />
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

### Паттерн: Icon Button Wrapper
```tsx
// Custom wrapper для icon-only кнопок с tooltip
export function IconButton({ icon: Icon, tooltip, ...props }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" {...props}>
            <Icon className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

---

## 📋 Decision Tree

```
Нужен UI компонент?
│
├─ Стандартный паттерн (кнопка, input, select)?
│  └─ ✅ Используй shadcn/ui
│
├─ Нужна бизнес-логика или уникальный дизайн?
│  │
│  ├─ Можно использовать shadcn внутри?
│  │  └─ ✅ Создай Custom компонент + используй shadcn внутри
│  │
│  └─ Нужен полностью уникальный компонент?
│     └─ ✅ Создай полностью Custom компонент
│
└─ Нужна обертка с дополнительной логикой?
   └─ ✅ Создай Wrapper компонент над shadcn
```

---

## ⚠️ Ошибки, которых нужно избегать

### ❌ DON'T: Переписывать shadcn компоненты
```tsx
// НЕ делай так!
export function MyButton({ children, ...props }) {
  return <button className="px-4 py-2 bg-blue-500 rounded">{children}</button>;
}
```

### ✅ DO: Используй shadcn Button с пропами
```tsx
// Делай так!
import { Button } from '@/components/ui/button';

<Button className="bg-blue-500">{children}</Button>
```

---

### ❌ DON'T: Использовать Collapsible для критичных UI элементов
```tsx
// НЕ делай так для фильтров, которые должны быть видимыми!
<Collapsible>
  <CollapsibleTrigger>Фильтры</CollapsibleTrigger>
  <CollapsibleContent>
    {/* Filters */}
  </CollapsibleContent>
</Collapsible>
```

### ✅ DO: Показывай важные фильтры всегда
```tsx
// Делай так!
<div>
  <h3>Фильтры по тегам</h3>
  <div className="flex gap-2">
    <FilterChip ... />
    <FilterChip ... />
  </div>
</div>
```

---

## 📚 Полный список shadcn/ui компонентов

Установленные в проекте:
- ✅ `Button` - кнопки
- ✅ `Input` - текстовые поля
- ✅ `Select` - выпадающие списки
- ✅ `Checkbox` - чекбоксы
- ✅ `Dialog` - модальные окна
- ✅ `Tabs` - табы
- ✅ `Collapsible` - сворачиваемый контент
- ✅ `Tooltip` - подсказки
- ✅ `Card` - карточки
- ✅ `Badge` - бейджи
- ✅ `Label` - лейблы
- ✅ `Textarea` - многострочные поля
- ✅ `RadioGroup` - радио кнопки
- ✅ `Switch` - переключатели
- ✅ `Dropdown Menu` - выпадающие меню
- ✅ `Sheet` - боковые панели

Используй [shadcn/ui docs](https://ui.shadcn.com/) для деталей.

---

**Last Updated**: 2026-01-16
**Version**: 1.0
**Maintained by**: Frontend Team
