'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Pencil, Check, X, Loader2, Save, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AI_INSTRUCTION_TEMPLATES } from '@/lib/ai-instruction-templates';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

type FaqEntry = {
  id: string;
  store_id: string;
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---- API functions ----

async function fetchAIInstructions(storeId: string) {
  const res = await fetch(`/api/stores/${storeId}/ai-instructions`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error('Failed to fetch AI instructions');
  return res.json();
}

async function saveAIInstructions(storeId: string, instructions: string | null) {
  const res = await fetch(`/api/stores/${storeId}/ai-instructions`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instructions }),
  });
  if (!res.ok) throw new Error('Failed to save AI instructions');
  return res.json();
}

async function fetchFaq(storeId: string): Promise<{ entries: FaqEntry[] }> {
  const res = await fetch(`/api/stores/${storeId}/faq`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error('Failed to fetch FAQ');
  return res.json();
}

async function createFaqEntry(storeId: string, question: string, answer: string) {
  const res = await fetch(`/api/stores/${storeId}/faq`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer }),
  });
  if (!res.ok) throw new Error('Failed to create FAQ entry');
  return res.json();
}

async function updateFaqEntry(storeId: string, faqId: string, fields: Partial<FaqEntry>) {
  const res = await fetch(`/api/stores/${storeId}/faq/${faqId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update FAQ entry');
  return res.json();
}

async function deleteFaqEntry(storeId: string, faqId: string) {
  const res = await fetch(`/api/stores/${storeId}/faq/${faqId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error('Failed to delete FAQ entry');
  return res.json();
}

// ---- Component ----

export default function AISettingsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Instructions state
  const [instructions, setInstructions] = useState('');
  const [savedInstructions, setSavedInstructions] = useState('');
  const hasChanges = instructions !== savedInstructions;

  // FAQ add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // FAQ editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  // Fetch AI instructions
  const { data: aiData, isLoading: loadingInstructions } = useQuery({
    queryKey: ['ai-instructions', storeId],
    queryFn: () => fetchAIInstructions(storeId),
  });

  useEffect(() => {
    if (aiData) {
      const val = aiData.ai_instructions || '';
      setInstructions(val);
      setSavedInstructions(val);
    }
  }, [aiData]);

  // Fetch FAQ
  const { data: faqData, isLoading: loadingFaq } = useQuery({
    queryKey: ['store-faq', storeId],
    queryFn: () => fetchFaq(storeId),
  });

  const faqEntries = faqData?.entries || [];

  // Save instructions mutation
  const saveMutation = useMutation({
    mutationFn: () => saveAIInstructions(storeId, instructions || null),
    onSuccess: () => {
      setSavedInstructions(instructions);
      queryClient.invalidateQueries({ queryKey: ['ai-instructions', storeId] });
      toast({ title: 'Инструкции сохранены' });
    },
    onError: () => toast({ title: 'Ошибка сохранения', variant: 'destructive' }),
  });

  // FAQ mutations
  const createMutation = useMutation({
    mutationFn: () => createFaqEntry(storeId, newQuestion, newAnswer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-faq', storeId] });
      setNewQuestion('');
      setNewAnswer('');
      setShowAddForm(false);
      toast({ title: 'FAQ добавлен' });
    },
    onError: () => toast({ title: 'Ошибка создания', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ faqId, fields }: { faqId: string; fields: Partial<FaqEntry> }) =>
      updateFaqEntry(storeId, faqId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-faq', storeId] });
      setEditingId(null);
    },
    onError: () => toast({ title: 'Ошибка обновления', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (faqId: string) => deleteFaqEntry(storeId, faqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-faq', storeId] });
      toast({ title: 'FAQ удалён' });
    },
    onError: () => toast({ title: 'Ошибка удаления', variant: 'destructive' }),
  });

  const handleTemplateClick = (template: string) => {
    if (instructions.trim() && !confirm('Текущие инструкции будут заменены. Продолжить?')) {
      return;
    }
    setInstructions(template);
  };

  const startEdit = (entry: FaqEntry) => {
    setEditingId(entry.id);
    setEditQuestion(entry.question);
    setEditAnswer(entry.answer);
  };

  const saveEdit = () => {
    if (editingId && editQuestion.trim() && editAnswer.trim()) {
      updateMutation.mutate({ faqId: editingId, fields: { question: editQuestion, answer: editAnswer } });
    }
  };

  const toggleActive = (entry: FaqEntry) => {
    updateMutation.mutate({ faqId: entry.id, fields: { is_active: !entry.is_active } });
  };

  return (
    <div className="ai-settings-page">
      {/* Section 1: AI Instructions */}
      <section className="ai-section">
        <div className="ai-section-header">
          <div className="ai-section-title">
            <Sparkles style={{ width: 20, height: 20 }} />
            <h2>Инструкции AI-агента</h2>
          </div>
          <p className="ai-section-desc">
            Опишите правила, тон общения, условия возврата и запреты для AI.
            Эти инструкции применяются ко всем AI-ответам этого магазина.
          </p>
        </div>

        {/* Template chips */}
        <div className="ai-templates">
          <span className="ai-templates-label">Шаблоны:</span>
          {AI_INSTRUCTION_TEMPLATES.map((t) => (
            <button
              key={t.id}
              className="ai-template-chip"
              onClick={() => handleTemplateClick(t.template)}
              title={`Применить шаблон "${t.label}"`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Textarea */}
        {loadingInstructions ? (
          <div className="ai-loading"><Loader2 className="animate-spin" style={{ width: 20, height: 20 }} /> Загрузка...</div>
        ) : (
          <textarea
            className="ai-instructions-textarea"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={`Пример:\nТон: дружелюбный, обращение на "вы"\nУсловия возврата: 14 дней через WB\nКомпенсация: кэшбек до 500₽\nЗапреты: не давать медицинских советов`}
            rows={10}
          />
        )}

        {/* Save button */}
        <div className="ai-instructions-actions">
          <button
            className={`ai-btn-save ${hasChanges ? 'has-changes' : ''}`}
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Сохранение...</>
            ) : (
              <><Save style={{ width: 16, height: 16 }} /> {hasChanges ? 'Сохранить' : 'Сохранено'}</>
            )}
          </button>
          {instructions.trim() && (
            <span className="ai-char-count">{instructions.length} символов</span>
          )}
        </div>
      </section>

      {/* Section 2: FAQ */}
      <section className="ai-section">
        <div className="ai-section-header">
          <div className="ai-section-title">
            <BookOpen style={{ width: 20, height: 20 }} />
            <h2>FAQ — База знаний</h2>
          </div>
          <p className="ai-section-desc">
            Добавьте частые вопросы и ответы. AI будет использовать их для более точных ответов клиентам.
          </p>
        </div>

        {/* Add button */}
        {!showAddForm && (
          <button className="ai-btn-add" onClick={() => setShowAddForm(true)}>
            <Plus style={{ width: 16, height: 16 }} /> Добавить вопрос
          </button>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="faq-add-form">
            <input
              type="text"
              className="faq-input"
              placeholder="Вопрос (например: Как вернуть товар?)"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
            />
            <textarea
              className="faq-textarea"
              placeholder="Ответ (например: Возврат через WB в течение 14 дней)"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              rows={3}
            />
            <div className="faq-add-actions">
              <button
                className="ai-btn-save has-changes"
                onClick={() => createMutation.mutate()}
                disabled={!newQuestion.trim() || !newAnswer.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Добавление...</>
                ) : (
                  <><Check style={{ width: 16, height: 16 }} /> Добавить</>
                )}
              </button>
              <button className="ai-btn-cancel" onClick={() => { setShowAddForm(false); setNewQuestion(''); setNewAnswer(''); }}>
                <X style={{ width: 16, height: 16 }} /> Отмена
              </button>
            </div>
          </div>
        )}

        {/* FAQ list */}
        {loadingFaq ? (
          <div className="ai-loading"><Loader2 className="animate-spin" style={{ width: 20, height: 20 }} /> Загрузка FAQ...</div>
        ) : faqEntries.length === 0 && !showAddForm ? (
          <div className="faq-empty">
            Нет записей FAQ. Добавьте частые вопросы, чтобы AI давал более точные ответы.
          </div>
        ) : (
          <div className="faq-list">
            {faqEntries.map((entry) => (
              <div key={entry.id} className={`faq-card ${!entry.is_active ? 'faq-card-inactive' : ''}`}>
                {editingId === entry.id ? (
                  /* Edit mode */
                  <div className="faq-edit-form">
                    <input
                      type="text"
                      className="faq-input"
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                    />
                    <textarea
                      className="faq-textarea"
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      rows={3}
                    />
                    <div className="faq-edit-actions">
                      <button className="ai-btn-save has-changes" onClick={saveEdit} disabled={updateMutation.isPending}>
                        <Check style={{ width: 14, height: 14 }} /> Сохранить
                      </button>
                      <button className="ai-btn-cancel" onClick={() => setEditingId(null)}>
                        <X style={{ width: 14, height: 14 }} /> Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <div className="faq-card-content">
                      <div className="faq-question">В: {entry.question}</div>
                      <div className="faq-answer">О: {entry.answer}</div>
                    </div>
                    <div className="faq-card-actions">
                      <button
                        className={`faq-toggle ${entry.is_active ? 'active' : ''}`}
                        onClick={() => toggleActive(entry)}
                        title={entry.is_active ? 'Отключить' : 'Включить'}
                      >
                        {entry.is_active ? 'Вкл' : 'Выкл'}
                      </button>
                      <button className="faq-action-btn" onClick={() => startEdit(entry)} title="Редактировать">
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        className="faq-action-btn faq-action-delete"
                        onClick={() => {
                          if (confirm('Удалить эту запись FAQ?')) {
                            deleteMutation.mutate(entry.id);
                          }
                        }}
                        title="Удалить"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
