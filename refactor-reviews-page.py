#!/usr/bin/env python3
"""
Скрипт для автоматической модификации Reviews page:
1. Удаление кнопок "Сохранить"
2. Добавление auto-save
3. Исправление синхронизации state
4. Подключение массовых действий
"""

import re

FILE_PATH = 'src/app/stores/[storeId]/reviews/page.tsx'

def refactor_page():
    print(f"Читаем {FILE_PATH}...")
    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    print("Шаг 1: Обновляем импорты...")
    # Удалить Save из импортов
    content = content.replace(
        "import {\n  RefreshCw, Search, Filter, ChevronDown, Star, ThumbsUp,\n  CornerDownRight, Trash2, Bot, Save, Send, Flag\n} from 'lucide-react';",
        "import {\n  RefreshCw, Search, Filter, ChevronDown, Star, ThumbsUp,\n  CornerDownRight, Trash2, Bot, Send, Flag\n} from 'lucide-react';"
    )

    # Добавить импорты компонентов
    content = content.replace(
        "import { useParams } from 'next/navigation';",
        """import { useParams } from 'next/navigation';
import { useAutoSave } from '@/components/reviews/useAutoSave';
import { useBulkActions } from '@/components/reviews/useBulkActions';
import { BulkActionsBar } from '@/components/reviews/BulkActionsBar';"""
    )

    print("Шаг 2: Удаляем state для savingReply и savingComplaint...")
    # Удалить savingReply и savingComplaint state
    content = re.sub(
        r"  const \[savingReply, setSavingReply\] = useState<Record<string, boolean>>\(\{\}\);\n",
        "",
        content
    )
    content = re.sub(
        r"  const \[savingComplaint, setSavingComplaint\] = useState<Record<string, boolean>>\(\{\}\);\n",
        "",
        content
    )

    print("Шаг 3: Добавляем hooks...")
    # Найти место после других useState и добавить hooks
    hook_insertion_point = "const [markingComplaint, setMarkingComplaint] = useState<Record<string, boolean>>({});"
    content = content.replace(
        hook_insertion_point,
        f"""{hook_insertion_point}

  // Auto-save hook
  const {{ scheduleReplyAutoSave, scheduleComplaintAutoSave }} = useAutoSave(storeId);

  // Bulk actions hook
  const {{
    bulkGeneratingReplies,
    bulkGeneratingComplaints,
    bulkClearingDrafts,
    handleBulkGenerateReplies,
    handleBulkGenerateComplaints,
    handleBulkClearDrafts
  }} = useBulkActions(storeId);"""
    )

    print("Шаг 4: Удаляем функции handleSaveReply и handleSaveComplaint...")
    # Удалить handleSaveReply функцию полностью
    content = re.sub(
        r"  // Сохранение черновика ответа\n  const handleSaveReply = async \(reviewId: string\) => \{.*?\n  \};\n\n",
        "",
        content,
        flags=re.DOTALL
    )

    # Удалить handleSaveComplaint функцию полностью
    content = re.sub(
        r"  // Сохранение черновика жалобы\n  const handleSaveComplaint = async \(reviewId: string\) => \{.*?\n  \};\n\n",
        "",
        content,
        flags=re.DOTALL
    )

    print("Шаг 5: Добавляем обработчики изменения textarea...")
    # Добавить обработчики изменения после handleSyncReviews
    handle_change_code = """
  // Обработчики изменения с auto-save
  const handleReplyChange = (reviewId: string, value: string) => {
    setReplyDrafts(prev => ({ ...prev, [reviewId]: value }));
    scheduleReplyAutoSave(reviewId, value);
  };

  const handleComplaintChange = (reviewId: string, value: string) => {
    setComplaintDrafts(prev => ({ ...prev, [reviewId]: value }));
    scheduleComplaintAutoSave(reviewId, value);
  };
"""

    content = content.replace(
        "  // AI генерация ответа\n  const handleGenerateReply",
        f"{handle_change_code}\n  // AI генерация ответа\n  const handleGenerateReply"
    )

    print("Шаг 6: Исправляем handleGenerateReply (удаляем local state после генерации)...")
    # Исправить handleGenerateReply
    content = re.sub(
        r"      const \{ draftReply \} = await response\.json\(\);\n      setReplyDrafts\(prev => \(\{ \.\.\.prev, \[reviewId\]: draftReply \}\)\);\n      await refetch\(\);",
        """      const { draftReply } = await response.json();

      // Удаляем local state чтобы показывался draft_reply из БД
      setReplyDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();""",
        content
    )

    print("Шаг 7: Исправляем handleGenerateComplaint...")
    content = re.sub(
        r"      const \{ complaintText \} = await response\.json\(\);\n      setComplaintDrafts\(prev => \(\{ \.\.\.prev, \[reviewId\]: complaintText \}\)\);\n      await refetch\(\);",
        """      const { complaintText } = await response.json();

      // Удаляем local state чтобы показывался complaint_text из БД
      setComplaintDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();""",
        content
    )

    print("Шаг 8: Исправляем handleSendReply (удаляем local state)...")
    content = re.sub(
        r"      await refetch\(\);\n      setReplyDrafts\(prev => \(\{ \.\.\.prev, \[reviewId\]: '' \}\)\);",
        """      // Удаляем local state
      setReplyDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();""",
        content
    )

    print("Шаг 9: Исправляем handleMarkComplaintSent...")
    content = content.replace(
        "      await refetch();\n      alert('Жалоба отмечена как отправленной');",
        """      // Удаляем local state
      setComplaintDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();
      alert('Жалоба отмечена как отправленной');"""
    )

    print("Шаг 10: Заменяем массовые кнопки на BulkActionsBar компонент...")
    # Найти и заменить массовые кнопки
    bulk_buttons_old = """      {/* Массовые действия */}
      {selectedReviews.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-md)',
          background: 'var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <button className="btn btn-primary btn-sm btn-icon">
            <Bot size={16} />
            Сгенерировать ответы
          </button>
          <button className="btn btn-outline btn-sm btn-icon">
            <Flag size={16} />
            Сгенерировать жалобы
          </button>
          <button className="btn btn-outline btn-sm">
            Очистить черновики
          </button>
        </div>
      )}"""

    bulk_buttons_new = """      {/* Массовые действия */}
      <BulkActionsBar
        selectedCount={selectedReviews.length}
        onGenerateReplies={() => handleBulkGenerateReplies(selectedReviews, () => {
          refetch();
          setSelectedReviews([]);
        })}
        onGenerateComplaints={() => handleBulkGenerateComplaints(selectedReviews, () => {
          refetch();
          setSelectedReviews([]);
        })}
        onClearDrafts={() => handleBulkClearDrafts(selectedReviews, () => {
          setReplyDrafts({});
          setComplaintDrafts({});
          refetch();
          setSelectedReviews([]);
        })}
        isGeneratingReplies={bulkGeneratingReplies}
        isGeneratingComplaints={bulkGeneratingComplaints}
        isClearingDrafts={bulkClearingDrafts}
      />"""

    content = content.replace(bulk_buttons_old, bulk_buttons_new)

    print("Шаг 11: Заменяем onChange для textarea ответов...")
    content = re.sub(
        r"onChange=\{\(e\) => setReplyDrafts\(prev => \(\{ \.\.\.prev, \[review\.id\]: e\.target\.value \}\)\)\}",
        "onChange={(e) => handleReplyChange(review.id, e.target.value)}",
        content
    )

    print("Шаг 12: Заменяем onChange для textarea жалоб...")
    content = re.sub(
        r"onChange=\{\(e\) => setComplaintDrafts\(prev => \(\{ \.\.\.prev, \[review\.id\]: e\.target\.value \}\)\)\}",
        "onChange={(e) => handleComplaintChange(review.id, e.target.value)}",
        content
    )

    print("Шаг 13: Удаляем кнопки 'Сохранить' для ответов...")
    # Удалить кнопку "Сохранить" для ответов (между "Сгенерировать" и "Отправить")
    content = re.sub(
        r"                    <button\n                      className=\"btn btn-outline btn-sm btn-icon\"\n                      onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleSaveReply\(review\.id\); \}\}\n                      disabled=\{savingReply\[review\.id\]\}\n                    >\n                      <Save size=\{14\} />\n                      \{savingReply\[review\.id\] \? 'Сохранение\.\.\.' : 'Сохранить'\}\n                    </button>\n",
        "",
        content
    )

    print("Шаг 14: Удаляем кнопки 'Сохранить' для жалоб...")
    # Удалить кнопку "Сохранить" для жалоб
    content = re.sub(
        r"                    <button\n                      className=\"btn btn-outline btn-sm btn-icon\"\n                      onClick=\{\(e\) => \{ e\.stopPropagation\(\); handleSaveComplaint\(review\.id\); \}\}\n                      disabled=\{savingComplaint\[review\.id\]\}\n                    >\n                      <Save size=\{14\} />\n                      \{savingComplaint\[review\.id\] \? 'Сохранение\.\.\.' : 'Сохранить'\}\n                    </button>\n",
        "",
        content
    )

    print("Шаг 15: Добавляем индикатор автосохранения...")
    # Добавить индикатор автосохранения для ответов
    content = content.replace(
        '<h4 className="review-detail-title">Ответ на отзыв</h4>',
        """<h4 className="review-detail-title">Ответ на отзыв</h4>
                                {replyDrafts[review.id] !== undefined && (
                                  <span style={{ fontSize: '10px', color: '#10b981' }}>✓ Автосохранение</span>
                                )}"""
    )

    # Добавить индикатор автосохранения для жалоб
    content = content.replace(
        '<h4 className="review-detail-title">Жалоба на отзыв</h4>',
        """<h4 className="review-detail-title">Жалоба на отзыв</h4>
                                {complaintDrafts[review.id] !== undefined && (
                                  <span style={{ fontSize: '10px', color: '#10b981' }}>✓ Автосохранение</span>
                                )}"""
    )

    print(f"Сохраняем изменения в {FILE_PATH}...")
    with open(FILE_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

    print("✅ Рефакторинг завершен!")
    print("\nИзменения:")
    print("  ✅ Удалены кнопки 'Сохранить'")
    print("  ✅ Добавлено автосохранение с debounce 2 сек")
    print("  ✅ Исправлена синхронизация local state")
    print("  ✅ Подключены массовые действия")
    print("  ✅ Добавлены индикаторы автосохранения")

if __name__ == '__main__':
    refactor_page()
