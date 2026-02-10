'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Pencil, Check, X, Loader2, Save, BookOpen, ChevronDown, ChevronUp, ListChecks, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AI_INSTRUCTION_TEMPLATES } from '@/lib/ai-instruction-templates';
import { FAQ_TEMPLATE_GROUPS } from '@/lib/faq-templates';
import { GUIDE_TEMPLATES, type GuideTemplate } from '@/lib/guide-templates';

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

type GuideEntry = {
  id: string;
  store_id: string;
  title: string;
  content: string;
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

async function fetchGuides(storeId: string): Promise<{ entries: GuideEntry[] }> {
  const res = await fetch(`/api/stores/${storeId}/guides`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error('Failed to fetch guides');
  return res.json();
}

async function createGuideEntry(storeId: string, title: string, content: string) {
  const res = await fetch(`/api/stores/${storeId}/guides`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error('Failed to create guide');
  return res.json();
}

async function updateGuideEntry(storeId: string, guideId: string, fields: Partial<GuideEntry>) {
  const res = await fetch(`/api/stores/${storeId}/guides/${guideId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update guide');
  return res.json();
}

async function deleteGuideEntry(storeId: string, guideId: string) {
  const res = await fetch(`/api/stores/${storeId}/guides/${guideId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error('Failed to delete guide');
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

  // FAQ templates
  const [showTemplates, setShowTemplates] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [addingTemplates, setAddingTemplates] = useState(false);

  // Guides state
  const [showGuideForm, setShowGuideForm] = useState(false);
  const [newGuideTitle, setNewGuideTitle] = useState('');
  const [newGuideContent, setNewGuideContent] = useState('');
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null);
  const [editGuideTitle, setEditGuideTitle] = useState('');
  const [editGuideContent, setEditGuideContent] = useState('');
  const [showGuideTemplates, setShowGuideTemplates] = useState(false);
  const [selectedGuideTemplates, setSelectedGuideTemplates] = useState<Set<string>>(new Set());
  const [addingGuideTemplates, setAddingGuideTemplates] = useState(false);
  const [addingDefaults, setAddingDefaults] = useState(false);

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

  // Fetch Guides
  const { data: guidesData, isLoading: loadingGuides } = useQuery({
    queryKey: ['store-guides', storeId],
    queryFn: () => fetchGuides(storeId),
  });

  const guideEntries = guidesData?.entries || [];

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

  // Guide mutations
  const createGuideMutation = useMutation({
    mutationFn: () => createGuideEntry(storeId, newGuideTitle, newGuideContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-guides', storeId] });
      setNewGuideTitle('');
      setNewGuideContent('');
      setShowGuideForm(false);
      toast({ title: 'Инструкция добавлена' });
    },
    onError: () => toast({ title: 'Ошибка создания', variant: 'destructive' }),
  });

  const updateGuideMutation = useMutation({
    mutationFn: ({ guideId, fields }: { guideId: string; fields: Partial<GuideEntry> }) =>
      updateGuideEntry(storeId, guideId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-guides', storeId] });
      setEditingGuideId(null);
    },
    onError: () => toast({ title: 'Ошибка обновления', variant: 'destructive' }),
  });

  const deleteGuideMutation = useMutation({
    mutationFn: (guideId: string) => deleteGuideEntry(storeId, guideId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-guides', storeId] });
      toast({ title: 'Инструкция удалена' });
    },
    onError: () => toast({ title: 'Ошибка удаления', variant: 'destructive' }),
  });

  // FAQ template handlers
  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  };

  const toggleGroup = (groupId: string) => {
    const group = FAQ_TEMPLATE_GROUPS.find(g => g.id === groupId);
    if (!group) return;
    const allIds = group.templates.map(t => t.id);
    const allSelected = allIds.every(id => selectedTemplates.has(id));
    setSelectedTemplates(prev => {
      const next = new Set(prev);
      allIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const addSelectedTemplates = async () => {
    const allTemplates = FAQ_TEMPLATE_GROUPS.flatMap(g => g.templates);
    const toAdd = allTemplates.filter(t => selectedTemplates.has(t.id));
    if (toAdd.length === 0) return;

    setAddingTemplates(true);
    let added = 0;
    for (const t of toAdd) {
      try {
        await createFaqEntry(storeId, t.question, t.answer);
        added++;
      } catch { /* skip failed */ }
    }
    queryClient.invalidateQueries({ queryKey: ['store-faq', storeId] });
    setSelectedTemplates(new Set());
    setShowTemplates(false);
    setAddingTemplates(false);
    toast({ title: `Добавлено ${added} из ${toAdd.length} FAQ` });
  };

  // Guide template handlers
  const toggleGuideTemplate = (id: string) => {
    setSelectedGuideTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedGuideTemplates = async () => {
    const toAdd = GUIDE_TEMPLATES.filter(t => selectedGuideTemplates.has(t.id));
    if (toAdd.length === 0) return;

    setAddingGuideTemplates(true);
    let added = 0;
    for (const t of toAdd) {
      try {
        await createGuideEntry(storeId, t.title, t.content);
        added++;
      } catch { /* skip failed */ }
    }
    queryClient.invalidateQueries({ queryKey: ['store-guides', storeId] });
    setSelectedGuideTemplates(new Set());
    setShowGuideTemplates(false);
    setAddingGuideTemplates(false);
    toast({ title: `Добавлено ${added} из ${toAdd.length} инструкций` });
  };

  // Default guides handler — adds 3 essential guides
  const DEFAULT_GUIDE_IDS = ['delete-review-browser', 'supplement-review', 'return-defect'];

  const addDefaultGuides = async () => {
    const toAdd = GUIDE_TEMPLATES.filter(t => DEFAULT_GUIDE_IDS.includes(t.id));
    const existingTitles = new Set(guideEntries.map(e => e.title.toLowerCase().trim()));

    const filtered = toAdd.filter(t => !existingTitles.has(t.title.toLowerCase().trim()));
    if (filtered.length === 0) {
      toast({ title: 'Все базовые инструкции уже добавлены' });
      return;
    }

    setAddingDefaults(true);
    let added = 0;
    for (const t of filtered) {
      try {
        await createGuideEntry(storeId, t.title, t.content);
        added++;
      } catch { /* skip failed */ }
    }
    queryClient.invalidateQueries({ queryKey: ['store-guides', storeId] });
    setAddingDefaults(false);
    toast({ title: `Добавлено ${added} базовых инструкций` });
  };

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

  const startGuideEdit = (entry: GuideEntry) => {
    setEditingGuideId(entry.id);
    setEditGuideTitle(entry.title);
    setEditGuideContent(entry.content);
  };

  const saveGuideEdit = () => {
    if (editingGuideId && editGuideTitle.trim() && editGuideContent.trim()) {
      updateGuideMutation.mutate({ guideId: editingGuideId, fields: { title: editGuideTitle, content: editGuideContent } });
    }
  };

  const toggleGuideActive = (entry: GuideEntry) => {
    updateGuideMutation.mutate({ guideId: entry.id, fields: { is_active: !entry.is_active } });
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

        {/* Action buttons */}
        <div className="faq-top-actions">
          {!showAddForm && (
            <button className="ai-btn-add" onClick={() => setShowAddForm(true)}>
              <Plus style={{ width: 16, height: 16 }} /> Добавить вопрос
            </button>
          )}
          <button
            className={`ai-btn-add faq-btn-templates ${showTemplates ? 'active' : ''}`}
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <ListChecks style={{ width: 16, height: 16 }} />
            {showTemplates ? 'Скрыть шаблоны' : 'Выбрать из шаблонов'}
          </button>
        </div>

        {/* FAQ Templates Picker */}
        {showTemplates && (
          <div className="faq-templates-panel">
            <div className="faq-templates-header">
              <p className="faq-templates-desc">
                Выберите готовые вопросы из категорий (на основе анализа реальных диалогов). Нажмите «Добавить выбранные», чтобы добавить их в FAQ.
              </p>
              {selectedTemplates.size > 0 && (
                <button
                  className="ai-btn-save has-changes"
                  onClick={addSelectedTemplates}
                  disabled={addingTemplates}
                >
                  {addingTemplates ? (
                    <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Добавление...</>
                  ) : (
                    <><Check style={{ width: 16, height: 16 }} /> Добавить выбранные ({selectedTemplates.size})</>
                  )}
                </button>
              )}
            </div>

            <div className="faq-template-groups">
              {FAQ_TEMPLATE_GROUPS.map((group) => {
                const isExpanded = expandedGroup === group.id;
                const groupSelected = group.templates.filter(t => selectedTemplates.has(t.id)).length;
                const existingQuestions = new Set(faqEntries.map(e => e.question.toLowerCase().trim()));

                return (
                  <div key={group.id} className="faq-template-group">
                    <button
                      className="faq-template-group-header"
                      onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                    >
                      <div className="faq-template-group-info">
                        <span className="faq-template-group-icon">{group.icon}</span>
                        <span className="faq-template-group-label">{group.label}</span>
                        <span className="faq-template-group-count">{group.templates.length} шт.</span>
                        {groupSelected > 0 && (
                          <span className="faq-template-group-selected">{groupSelected} выбрано</span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp style={{ width: 16, height: 16, opacity: 0.5 }} />
                      ) : (
                        <ChevronDown style={{ width: 16, height: 16, opacity: 0.5 }} />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="faq-template-group-items">
                        <button className="faq-template-select-all" onClick={() => toggleGroup(group.id)}>
                          {group.templates.every(t => selectedTemplates.has(t.id)) ? 'Снять все' : 'Выбрать все'}
                        </button>
                        {group.templates.map((tmpl) => {
                          const isSelected = selectedTemplates.has(tmpl.id);
                          const alreadyExists = existingQuestions.has(tmpl.question.toLowerCase().trim());

                          return (
                            <label
                              key={tmpl.id}
                              className={`faq-template-item ${isSelected ? 'selected' : ''} ${alreadyExists ? 'exists' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleTemplate(tmpl.id)}
                                disabled={alreadyExists}
                              />
                              <div className="faq-template-item-content">
                                <div className="faq-template-item-q">В: {tmpl.question}</div>
                                <div className="faq-template-item-a">О: {tmpl.answer}</div>
                                {alreadyExists && <span className="faq-template-item-badge">Уже добавлен</span>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* Section 3: Guides — Step-by-step instructions */}
      <section className="ai-section">
        <div className="ai-section-header">
          <div className="ai-section-title">
            <FileText style={{ width: 20, height: 20 }} />
            <h2>Инструкции для клиентов</h2>
          </div>
          <p className="ai-section-desc">
            Пошаговые инструкции: как удалить отзыв, как оформить возврат, как получить компенсацию.
            AI будет ссылаться на них при общении с клиентами.
          </p>
        </div>

        {/* Action buttons */}
        <div className="faq-top-actions">
          {!showGuideForm && (
            <button className="ai-btn-add" onClick={() => setShowGuideForm(true)}>
              <Plus style={{ width: 16, height: 16 }} /> Добавить инструкцию
            </button>
          )}
          <button
            className={`ai-btn-add faq-btn-templates ${showGuideTemplates ? 'active' : ''}`}
            onClick={() => setShowGuideTemplates(!showGuideTemplates)}
          >
            <ListChecks style={{ width: 16, height: 16 }} />
            {showGuideTemplates ? 'Скрыть шаблоны' : 'Выбрать из шаблонов'}
          </button>
        </div>

        {/* Guide Templates Picker */}
        {showGuideTemplates && (
          <div className="faq-templates-panel">
            <div className="faq-templates-header">
              <p className="faq-templates-desc">
                Готовые пошаговые инструкции на основе анализа реальных диалогов продавцов.
                Выберите нужные и добавьте в базу знаний магазина.
              </p>
              {selectedGuideTemplates.size > 0 && (
                <button
                  className="ai-btn-save has-changes"
                  onClick={addSelectedGuideTemplates}
                  disabled={addingGuideTemplates}
                >
                  {addingGuideTemplates ? (
                    <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Добавление...</>
                  ) : (
                    <><Check style={{ width: 16, height: 16 }} /> Добавить выбранные ({selectedGuideTemplates.size})</>
                  )}
                </button>
              )}
            </div>

            <div className="faq-template-group-items" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button
                className="faq-template-select-all"
                onClick={() => {
                  const allIds = GUIDE_TEMPLATES.map(t => t.id);
                  const allSelected = allIds.every(id => selectedGuideTemplates.has(id));
                  setSelectedGuideTemplates(allSelected ? new Set() : new Set(allIds));
                }}
              >
                {GUIDE_TEMPLATES.every(t => selectedGuideTemplates.has(t.id)) ? 'Снять все' : 'Выбрать все'}
              </button>
              {GUIDE_TEMPLATES.map((tmpl) => {
                const isSelected = selectedGuideTemplates.has(tmpl.id);
                const existingTitles = new Set(guideEntries.map(e => e.title.toLowerCase().trim()));
                const alreadyExists = existingTitles.has(tmpl.title.toLowerCase().trim());

                return (
                  <label
                    key={tmpl.id}
                    className={`faq-template-item ${isSelected ? 'selected' : ''} ${alreadyExists ? 'exists' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleGuideTemplate(tmpl.id)}
                      disabled={alreadyExists}
                    />
                    <div className="faq-template-item-content">
                      <div className="faq-template-item-q">{tmpl.title}</div>
                      <div className="faq-template-item-a guide-preview">{tmpl.content}</div>
                      {alreadyExists && <span className="faq-template-item-badge">Уже добавлен</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Add guide form */}
        {showGuideForm && (
          <div className="faq-add-form">
            <input
              type="text"
              className="faq-input"
              placeholder="Название (например: Как удалить отзыв)"
              value={newGuideTitle}
              onChange={(e) => setNewGuideTitle(e.target.value)}
            />
            <textarea
              className="faq-textarea guide-content-textarea"
              placeholder={"Пошаговая инструкция, например:\n1. Зайдите на сайт WB через браузер\n2. Откройте профиль → «Отзывы и вопросы»\n3. Найдите отзыв → три точки → «Удалить»"}
              value={newGuideContent}
              onChange={(e) => setNewGuideContent(e.target.value)}
              rows={6}
            />
            <div className="faq-add-actions">
              <button
                className="ai-btn-save has-changes"
                onClick={() => createGuideMutation.mutate()}
                disabled={!newGuideTitle.trim() || !newGuideContent.trim() || createGuideMutation.isPending}
              >
                {createGuideMutation.isPending ? (
                  <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Добавление...</>
                ) : (
                  <><Check style={{ width: 16, height: 16 }} /> Добавить</>
                )}
              </button>
              <button className="ai-btn-cancel" onClick={() => { setShowGuideForm(false); setNewGuideTitle(''); setNewGuideContent(''); }}>
                <X style={{ width: 16, height: 16 }} /> Отмена
              </button>
            </div>
          </div>
        )}

        {/* Guide list */}
        {loadingGuides ? (
          <div className="ai-loading"><Loader2 className="animate-spin" style={{ width: 20, height: 20 }} /> Загрузка инструкций...</div>
        ) : guideEntries.length === 0 && !showGuideForm ? (
          <div className="guides-defaults-banner">
            <div className="guides-defaults-info">
              <strong>Рекомендуем начать с базовых инструкций</strong>
              <p>Добавьте 3 ключевых инструкции, которые чаще всего нужны клиентам: удаление отзыва, дополнение до 5 звёзд, возврат по браку.</p>
            </div>
            <button
              className="ai-btn-save has-changes"
              onClick={addDefaultGuides}
              disabled={addingDefaults}
            >
              {addingDefaults ? (
                <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Добавление...</>
              ) : (
                <><Plus style={{ width: 16, height: 16 }} /> Добавить 3 базовых</>
              )}
            </button>
          </div>
        ) : (
          <div className="faq-list">
            {guideEntries.map((entry) => (
              <div key={entry.id} className={`faq-card guide-card ${!entry.is_active ? 'faq-card-inactive' : ''}`}>
                {editingGuideId === entry.id ? (
                  <div className="faq-edit-form">
                    <input
                      type="text"
                      className="faq-input"
                      value={editGuideTitle}
                      onChange={(e) => setEditGuideTitle(e.target.value)}
                    />
                    <textarea
                      className="faq-textarea guide-content-textarea"
                      value={editGuideContent}
                      onChange={(e) => setEditGuideContent(e.target.value)}
                      rows={8}
                    />
                    <div className="faq-edit-actions">
                      <button className="ai-btn-save has-changes" onClick={saveGuideEdit} disabled={updateGuideMutation.isPending}>
                        <Check style={{ width: 14, height: 14 }} /> Сохранить
                      </button>
                      <button className="ai-btn-cancel" onClick={() => setEditingGuideId(null)}>
                        <X style={{ width: 14, height: 14 }} /> Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="faq-card-content">
                      <div className="guide-title">{entry.title}</div>
                      <div className="guide-content">{entry.content}</div>
                    </div>
                    <div className="faq-card-actions">
                      <button
                        className={`faq-toggle ${entry.is_active ? 'active' : ''}`}
                        onClick={() => toggleGuideActive(entry)}
                        title={entry.is_active ? 'Отключить' : 'Включить'}
                      >
                        {entry.is_active ? 'Вкл' : 'Выкл'}
                      </button>
                      <button className="faq-action-btn" onClick={() => startGuideEdit(entry)} title="Редактировать">
                        <Pencil style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        className="faq-action-btn faq-action-delete"
                        onClick={() => {
                          if (confirm('Удалить эту инструкцию?')) {
                            deleteGuideMutation.mutate(entry.id);
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
