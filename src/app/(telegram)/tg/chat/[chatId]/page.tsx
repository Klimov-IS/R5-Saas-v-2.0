'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTelegramAuth } from '@/lib/telegram-auth-context';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'client' | 'seller';
  timestamp: string;
  isAutoReply?: boolean;
  downloadId?: string | null;
}

interface ChatDetail {
  id: string;
  storeId: string;
  storeName: string;
  marketplace?: string;
  clientName: string;
  productName: string | null;
  productNmId?: string | null;
  status: string;
  tag: string | null;
  draftReply: string | null;
  draftReplyGeneratedAt?: string | null;
  // Review & product rules
  reviewRating?: number | null;
  reviewDate?: string | null;
  complaintStatus?: string | null;
  reviewStatusWb?: string | null;
  productStatus?: string | null;
  offerCompensation?: boolean | null;
  maxCompensation?: string | null;
  compensationType?: string | null;
  compensationBy?: string | null;
  chatStrategy?: string | null;
  reviewText?: string | null;
  chatUrl?: string | null;
}

interface SequenceInfo {
  id: string;
  sequenceType: string;
  status: string;
  currentStep: number;
  maxSteps: number;
  stopReason: string | null;
  nextSendAt: string | null;
  lastSentAt: string | null;
  startedAt: string;
  createdAt: string;
}

const COMPLETION_REASONS = [
  // Frequent (manual) — sorted by real usage frequency
  { value: 'not_our_issue', label: 'Не наш вопрос', icon: '❓' },
  { value: 'no_reply', label: 'Нет ответа', icon: '🔇' },
  { value: 'negative', label: 'Негатив', icon: '😠' },
  { value: 'refusal', label: 'Отказ', icon: '✋' },
  // Success outcomes
  { value: 'review_deleted', label: 'Отзыв удален', icon: '🗑️' },
  { value: 'review_upgraded', label: 'Отзыв дополнен', icon: '⭐' },
  { value: 'review_resolved', label: 'Не влияет на рейтинг', icon: '✅' },
  { value: 'temporarily_hidden', label: 'Временно скрыт', icon: '👻' },
  // Rare
  { value: 'spam', label: 'Спам', icon: '🚫' },
  { value: 'old_dialog', label: 'Старый диалог', icon: '⏰' },
  { value: 'other', label: 'Другое', icon: '📋' },
];

const RATING_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#84cc16', 5: '#22c55e',
};

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  purchased: 'Выкуп', refused: 'Отказ', returned: 'Возврат',
  return_requested: 'Запрошен возврат', not_specified: 'Не указан',
};

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  not_sent: 'Не отправлена', draft: 'Черновик', sent: 'Отправлена',
  approved: 'Одобрена', rejected: 'Отклонена', pending: 'На рассмотрении',
  reconsidered: 'Пересмотрена', not_applicable: 'Нельзя подать',
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  visible: 'Видимый', unpublished: 'Снят с публикации',
  excluded: 'Исключён', temporarily_hidden: 'Временно скрыт', deleted: 'Удалён',
};

const STRATEGY_LABELS: Record<string, string> = {
  upgrade_to_5: 'Повышение до 5', delete: 'Удаление', both: 'Обе стратегии',
};

const TAG_LABELS: Record<string, string> = {
  deletion_candidate: 'Кандидат',
  deletion_offered: 'Оффер отправлен',
  deletion_agreed: 'Клиент согласен',
  deletion_confirmed: 'Отзыв удалён',
};

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  deletion_candidate: { bg: '#FEF3C7', color: '#92400E' },
  deletion_offered: { bg: 'rgba(37,99,235,0.1)', color: '#1E40AF' },
  deletion_agreed: { bg: '#D1FAE5', color: '#065F46' },
  deletion_confirmed: { bg: '#D1FAE5', color: '#065F46' },
};

/** Workflow steps in order */
const WORKFLOW_STEPS = ['deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed'];

/** Tag progression: current tag → next tag */
const TAG_NEXT: Record<string, { tag: string; label: string }> = {
  deletion_candidate: { tag: 'deletion_offered', label: 'Оффер отправлен' },
  deletion_offered: { tag: 'deletion_agreed', label: 'Клиент согласен' },
  deletion_agreed: { tag: 'deletion_confirmed', label: 'Отзыв удалён' },
};

/** Sequence button labels by tag (for overflow menu) */
const SEQUENCE_MENU_LABELS: Record<string, string> = {
  deletion_candidate: 'Запустить рассылку',
  deletion_offered: 'Напомнить об оффере',
  deletion_agreed: 'Напомнить об инструкции',
};

export default function TgChatPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chatId = params.chatId as string;
  const storeId = searchParams.get('storeId') || '';
  const { apiFetch } = useTelegramAuth();

  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftText, setDraftText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [sequence, setSequence] = useState<SequenceInfo | null>(null);
  const [seqLoading, setSeqLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tagLoading, setTagLoading] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Haptic feedback helper
  const haptic = useCallback((type: 'success' | 'error' | 'warning') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch {}
  }, []);

  // Show feedback with auto-hide
  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2500);
  }, []);

  // Navigate to next chat in queue
  const goToNextChat = useCallback(() => {
    try {
      const queueOrder = JSON.parse(sessionStorage.getItem('tg_queue_order') || '[]') as Array<{ id: string; storeId: string }>;
      const currentIndex = queueOrder.findIndex(item => item.id === chatId);
      const skipped = JSON.parse(sessionStorage.getItem('tg_skipped_chats') || '[]');
      if (!skipped.includes(chatId)) skipped.push(chatId);
      sessionStorage.setItem('tg_skipped_chats', JSON.stringify(skipped));
      const skippedSet = new Set(skipped);
      let nextItem = null;
      for (let i = currentIndex + 1; i < queueOrder.length; i++) {
        if (!skippedSet.has(queueOrder[i].id)) { nextItem = queueOrder[i]; break; }
      }
      if (!nextItem) {
        for (let i = 0; i < currentIndex; i++) {
          if (!skippedSet.has(queueOrder[i].id)) { nextItem = queueOrder[i]; break; }
        }
      }
      if (nextItem) {
        const devUser = new URLSearchParams(window.location.search).get('dev_user');
        router.replace(`/tg/chat/${nextItem.id}?storeId=${nextItem.storeId}${devUser ? `&dev_user=${devUser}` : ''}`);
      } else {
        router.back();
      }
    } catch {
      router.back();
    }
  }, [chatId, router]);

  // Back button
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.BackButton) {
      tg.BackButton.show();
      tg.BackButton.onClick(() => router.back());
      return () => { tg.BackButton.hide(); };
    }
  }, [router]);

  // Fetch chat data
  const fetchChat = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch(`/api/telegram/chats/${chatId}`);
      if (!response.ok) throw new Error('Failed to load chat');
      const data = await response.json();
      setChat(data.chat);
      setMessages(data.messages || []);
      const serverDraft = data.chat.draftReply || '';
      try {
        const localDraft = localStorage.getItem(`tg_draft_${chatId}`);
        setDraftText(localDraft ?? serverDraft);
      } catch {
        setDraftText(serverDraft);
      }
    } catch {
      showFeedback('Ошибка загрузки чата');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, apiFetch, showFeedback]);

  // Refresh chat without full loading spinner (pull-to-refresh feel)
  const refreshChat = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const response = await apiFetch(`/api/telegram/chats/${chatId}`);
      if (!response.ok) throw new Error('Failed to refresh');
      const data = await response.json();
      setChat(data.chat);
      setMessages(data.messages || []);
      haptic('success');
      showFeedback('Обновлено');
    } catch {
      haptic('error');
      showFeedback('Ошибка обновления');
    } finally {
      setIsRefreshing(false);
    }
  }, [chatId, apiFetch, haptic, showFeedback, isRefreshing]);

  useEffect(() => { fetchChat(); }, [fetchChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!draftText.trim() || isSending) return;
    const sentText = draftText.trim();
    setIsSending(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/telegram/chats/${chatId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: sentText }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send');
      }
      setMessages(prev => [...prev, {
        id: `optimistic-${Date.now()}`,
        text: sentText,
        sender: 'seller' as const,
        timestamp: new Date().toISOString(),
      }]);
      haptic('success');
      showFeedback('Отправлено');
      setMessageSent(true);
      setDraftText('');
      try { localStorage.removeItem(`tg_draft_${chatId}`); } catch {}
    } catch (err: any) {
      haptic('error');
      showFeedback(err.message?.includes('не принял чат')
        ? 'Покупатель ещё не принял чат'
        : 'Ошибка отправки');
    } finally {
      setIsSending(false);
    }
  };

  // Generate AI reply
  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/telegram/chats/${chatId}/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setDraftText(data.draftReply || '');
      haptic('success');
    } catch {
      haptic('error');
      showFeedback('Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  };

  // Close chat with reason
  const handleClose = async (reason: string) => {
    setShowReasons(false);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/telegram/chats/${chatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', completion_reason: reason }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Ошибка ${response.status}`);
      }
      haptic('success');
      showFeedback('Чат закрыт');
      setTimeout(() => router.replace('/tg'), 800);
    } catch (e) {
      haptic('error');
      showFeedback(e instanceof Error ? e.message : 'Ошибка закрытия');
    }
  };

  // Fetch sequence status
  const fetchSequence = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/telegram/chats/${chatId}/sequence`);
      if (res.ok) {
        const data = await res.json();
        setSequence(data.sequence || null);
      }
    } catch {}
  }, [chatId, apiFetch]);

  useEffect(() => { fetchSequence(); }, [fetchSequence]);

  // Stop sequence
  const handleStopSequence = async () => {
    setSeqLoading(true);
    try {
      const res = await apiFetch(`/api/telegram/chats/${chatId}/sequence/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        haptic('error');
        showFeedback('Ошибка остановки рассылки');
      } else {
        haptic('success');
        showFeedback('Рассылка остановлена');
        fetchSequence();
      }
    } catch {
      haptic('error');
      showFeedback('Ошибка остановки рассылки');
    } finally {
      setSeqLoading(false);
    }
  };

  // Change tag (deletion workflow progression)
  const handleTagChange = async (newTag: string) => {
    setTagLoading(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`/api/telegram/chats/${chatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: chat?.status || 'in_progress',
          tag: newTag,
        }),
      });
      if (!response.ok) throw new Error('Failed to change tag');
      haptic('success');
      showFeedback(`Этап: ${TAG_LABELS[newTag] || newTag}`);
      if (chat) setChat({ ...chat, tag: newTag });
      await fetchSequence();
    } catch {
      haptic('error');
      showFeedback('Ошибка смены тега');
    } finally {
      setTagLoading(false);
    }
  };

  // Start tag-specific sequence
  const handleStartTagSequence = async () => {
    setSeqLoading(true);
    setShowOverflow(false);
    setShowInfoSheet(false);
    try {
      const res = await apiFetch(`/api/telegram/chats/${chatId}/sequence/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceType: chat?.tag && chat.tag !== 'deletion_candidate' ? chat.tag : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        haptic('error');
        showFeedback(err.error || 'Ошибка запуска рассылки');
      } else {
        const data = await res.json();
        haptic('success');
        if (data.deferred) {
          showFeedback('Рассылка запущена, 1-е сообщение уйдёт завтра');
        } else if (data.immediateSent) {
          showFeedback('Рассылка запущена, 1-е сообщение отправлено');
          // Re-fetch chat + messages to show the sent message
          fetchChat();
        } else {
          showFeedback('Рассылка запущена');
        }
        fetchSequence();
      }
    } catch {
      haptic('error');
      showFeedback('Ошибка запуска рассылки');
    } finally {
      setSeqLoading(false);
    }
  };

  // Group messages by date for date separators
  const getDateLabel = (timestamp: string): string => {
    const d = new Date(timestamp);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Сегодня';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  // Workflow step index for step indicator
  const currentStepIndex = chat?.tag ? WORKFLOW_STEPS.indexOf(chat.tag) : -1;

  // Loading
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F7F8FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ fontSize: '14px' }}>Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', backgroundColor: '#F7F8FA', height: '100vh' }}>
        Чат не найден
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#F7F8FA' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* === COMPACT HEADER (~56px) === */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E6E8EC',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
      }}>
        {/* Row 1: Rating + Name + (i) button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {chat.reviewRating != null && (
              <span style={{
                fontSize: '14px',
                color: RATING_COLORS[chat.reviewRating] || '#9CA3AF',
                letterSpacing: '-1px',
                flexShrink: 0,
              }}>
                {'★'.repeat(chat.reviewRating)}
              </span>
            )}
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              {chat.clientName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={refreshChat}
              disabled={isRefreshing}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1.5px solid #E6E8EC',
                background: 'none',
                cursor: isRefreshing ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isRefreshing ? '#D1D5DB' : '#6B7280',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'all 0.15s',
                flexShrink: 0,
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
              title="Обновить диалог"
            >
              ↻
            </button>
            <button
              onClick={() => setShowInfoSheet(true)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: '1.5px solid #E6E8EC',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B7280',
                fontSize: '13px',
                fontWeight: 700,
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              i
            </button>
          </div>
        </div>
        {/* Row 2: Store + Tag badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>
            {chat.storeName}
          </span>
          {chat.marketplace === 'ozon' && (
            <span style={{
              fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px',
              backgroundColor: '#005bff', color: '#fff', letterSpacing: '0.5px',
            }}>
              OZ
            </span>
          )}
          {chat.tag && TAG_LABELS[chat.tag] && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: TAG_COLORS[chat.tag]?.bg || '#F3F4F6',
              color: TAG_COLORS[chat.tag]?.color || '#6B7280',
            }}>
              {TAG_LABELS[chat.tag]}
            </span>
          )}
        </div>
      </div>

      {/* === MESSAGES === */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        backgroundColor: '#F7F8FA',
      }}>
        {messages.map((msg, idx) => {
          // Date separator
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const currentDate = getDateLabel(msg.timestamp);
          const prevDate = prevMsg ? getDateLabel(prevMsg.timestamp) : null;
          const showDateSep = !prevMsg || currentDate !== prevDate;

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  margin: '16px 0', padding: '0 8px',
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#E6E8EC' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {currentDate}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#E6E8EC' }} />
                </div>
              )}
              <div style={{
                maxWidth: '85%',
                marginLeft: msg.sender === 'seller' ? 'auto' : '0',
                marginRight: msg.sender === 'client' ? 'auto' : '0',
                marginBottom: '8px',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'seller' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  ...(msg.sender === 'seller' ? {
                    background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                    color: '#FFFFFF',
                  } : {
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E6E8EC',
                    color: '#111827',
                  }),
                  fontSize: '14px',
                  lineHeight: 1.5,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}>
                  {msg.downloadId && (
                    <a
                      href={msg.downloadId.startsWith('http') ? msg.downloadId : `/api/telegram/chat-files/${msg.downloadId}?storeId=${chat?.storeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={msg.downloadId.startsWith('http') ? msg.downloadId : `/api/telegram/chat-files/${msg.downloadId}?storeId=${chat?.storeId}`}
                        alt="Вложение"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = document.getElementById(`fallback-${msg.id}`);
                          if (fallback) fallback.style.display = 'flex';
                        }}
                        style={{
                          maxWidth: '100%',
                          borderRadius: '8px',
                          marginBottom: msg.text && msg.text !== 'Вложение' ? '8px' : '0',
                        }}
                      />
                    </a>
                  )}
                  {msg.downloadId && (
                    <a
                      id={`fallback-${msg.id}`}
                      href={msg.downloadId.startsWith('http') ? msg.downloadId : `/api/telegram/chat-files/${msg.downloadId}?storeId=${chat?.storeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'none',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        opacity: 0.8,
                        textDecoration: 'underline',
                      }}
                    >
                      Скачать вложение
                    </a>
                  )}
                  {(!msg.downloadId || (msg.text && msg.text !== 'Вложение')) && msg.text}
                  <div style={{
                    fontSize: '10px',
                    opacity: msg.sender === 'seller' ? 0.6 : 1,
                    marginTop: '6px',
                    textAlign: msg.sender === 'seller' ? 'right' : 'left',
                    color: msg.sender === 'seller' ? 'rgba(255,255,255,0.6)' : '#6B7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: msg.sender === 'seller' ? 'flex-end' : 'flex-start',
                    gap: '4px',
                  }}>
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleString('ru-RU', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    }) : ''}
                    {msg.isAutoReply && (
                      <span style={{
                        fontSize: '9px', padding: '1px 4px', borderRadius: '4px',
                        background: msg.sender === 'seller' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
                      }}>
                        авто
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* === COMPOSER (sticky bottom) === */}
      <div style={{
        borderTop: '1px solid #E6E8EC',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
      }}>
        {/* Feedback toast */}
        {feedback && (
          <div style={{
            textAlign: 'center', fontSize: '13px', padding: '6px 0',
            fontWeight: 600, color: '#111827',
          }}>
            {feedback}
          </div>
        )}

        {messageSent ? (
          /* Post-send state: 2 full-width buttons */
          <div style={{ display: 'flex', gap: '8px', padding: '10px 16px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
            <button
              onClick={() => setShowReasons(true)}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px',
                border: '2px solid rgba(239,68,68,0.2)',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                backgroundColor: 'rgba(254,226,226,0.5)', color: '#EF4444',
                transition: 'all 0.15s ease-out',
              }}
            >
              Закрыть диалог
            </button>
            <button
              onClick={goToNextChat}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: '#FFFFFF',
                transition: 'all 0.15s ease-out',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              След. диалог →
            </button>
          </div>
        ) : (
          /* Normal state: textarea + 3 inline buttons */
          <>
            {isGenerating ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#6B7280', fontSize: '14px' }}>
                Генерация ИИ-ответа...
              </div>
            ) : (
              <div style={{ padding: '10px 16px 4px' }}>
                <textarea
                  value={draftText}
                  onChange={e => {
                    setDraftText(e.target.value);
                    try { localStorage.setItem(`tg_draft_${chatId}`, e.target.value); } catch {}
                  }}
                  placeholder="Текст ответа..."
                  style={{
                    width: '100%', minHeight: '60px', maxHeight: '120px',
                    padding: '10px 14px', border: '1px solid #E6E8EC', borderRadius: '12px',
                    fontSize: '14px', lineHeight: 1.5, resize: 'vertical',
                    backgroundColor: '#F7F8FA', color: '#111827', fontFamily: 'inherit',
                    boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s',
                  }}
                />
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '11px', marginTop: '2px', fontWeight: 500,
                }}>
                  <span style={{ color: '#9CA3AF' }}>
                    {chat.draftReplyGeneratedAt && draftText
                      ? `AI: ${new Date(chat.draftReplyGeneratedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </span>
                  <span style={{ color: draftText.length > 900 ? '#EF4444' : '#6B7280' }}>
                    {draftText.length}/1000
                  </span>
                </div>
              </div>
            )}

            {/* 3 inline action buttons */}
            <div style={{
              display: 'flex', gap: '8px', padding: '6px 16px 10px',
              paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
              position: 'relative',
            }}>
              {/* Send */}
              <button
                onClick={handleSend}
                disabled={!draftText.trim() || isSending || isGenerating}
                style={{
                  flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  backgroundColor: (!draftText.trim() || isSending || isGenerating) ? '#D1D5DB' : '#10B981',
                  color: '#fff', opacity: isSending ? 0.7 : 1,
                  transition: 'all 0.15s ease-out',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {isSending ? '...' : 'Отправить'}
              </button>
              {/* AI reply */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isSending}
                style={{
                  flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #2563EB, #3B82F6)', color: '#FFFFFF',
                  opacity: isGenerating ? 0.7 : 1,
                  transition: 'all 0.15s ease-out',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {isGenerating ? '...' : 'AI ответ'}
              </button>
              {/* Overflow menu button */}
              <button
                onClick={() => setShowOverflow(!showOverflow)}
                style={{
                  width: '44px', padding: '11px', borderRadius: '12px',
                  border: '2px solid #E6E8EC', fontSize: '16px', cursor: 'pointer',
                  backgroundColor: '#FFFFFF', color: '#6B7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease-out',
                }}
              >
                ⋮
              </button>

              {/* Overflow menu */}
              {showOverflow && (
                <div style={{
                  position: 'absolute', bottom: '100%', right: '16px', marginBottom: '8px',
                  background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E6E8EC',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: '220px',
                  padding: '6px', zIndex: 50,
                }}>
                  {/* Sequence button (tag-specific) */}
                  {chat.status !== 'closed' && (
                    <button
                      onClick={handleStartTagSequence}
                      disabled={seqLoading || sequence?.status === 'active'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '10px 12px', borderRadius: '10px', border: 'none',
                        background: 'none', width: '100%', fontSize: '14px', fontWeight: 500,
                        color: sequence?.status === 'active' ? '#9CA3AF' : '#111827',
                        cursor: sequence?.status === 'active' ? 'default' : 'pointer',
                        textAlign: 'left', transition: 'background 0.1s',
                      }}
                    >
                      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>📨</span>
                      <span>{SEQUENCE_MENU_LABELS[chat.tag || ''] || 'Запустить рассылку'}</span>
                    </button>
                  )}
                  {/* Next dialog */}
                  <button
                    onClick={() => { setShowOverflow(false); goToNextChat(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px', border: 'none',
                      background: 'none', width: '100%', fontSize: '14px', fontWeight: 500,
                      color: '#111827', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>→</span>
                    <span>След. диалог</span>
                  </button>
                  {/* Divider */}
                  <div style={{ height: '1px', background: '#E6E8EC', margin: '4px 8px' }} />
                  {/* Close */}
                  <button
                    onClick={() => { setShowOverflow(false); setShowReasons(true); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px', border: 'none',
                      background: 'none', width: '100%', fontSize: '14px', fontWeight: 500,
                      color: '#EF4444', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>✕</span>
                    <span>Закрыть чат</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* === INFO SHEET (bottom sheet) === */}
      {showInfoSheet && (
        <>
          <div
            onClick={() => setShowInfoSheet(false)}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: '#FFFFFF', borderRadius: '20px 20px 0 0',
            padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 101, maxHeight: '75vh', overflowY: 'auto',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
            borderTop: '1px solid #E6E8EC',
          }}>
            {/* Handle */}
            <div style={{
              width: '40px', height: '4px', backgroundColor: '#E6E8EC',
              borderRadius: '2px', margin: '0 auto 20px',
            }} />

            {/* Section: КОНТЕКСТ */}
            {(chat.chatStrategy || (chat.offerCompensation && chat.reviewRating != null && chat.reviewRating <= 3) ||
              (chat.complaintStatus && chat.complaintStatus !== 'not_sent') ||
              (chat.reviewStatusWb && chat.reviewStatusWb !== 'visible' && chat.reviewStatusWb !== 'unknown') ||
              (chat.productStatus && chat.productStatus !== 'unknown' && chat.productStatus !== 'not_specified')) && (
              <>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
                  Контекст
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                  {chat.chatStrategy && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '100px',
                      backgroundColor: '#EEF2FF', color: '#1E40AF',
                    }}>
                      {STRATEGY_LABELS[chat.chatStrategy] || chat.chatStrategy}
                    </span>
                  )}
                  {chat.offerCompensation && chat.maxCompensation && (chat.reviewRating == null || chat.reviewRating <= 3) && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '100px',
                      backgroundColor: '#EDE9FE', color: '#5B21B6',
                    }}>
                      Кешбек до {chat.maxCompensation}₽ {chat.compensationBy === 'r5' ? '(R5)' : chat.compensationBy === 'seller' ? '(продавец)' : ''}
                    </span>
                  )}
                  {chat.complaintStatus && chat.complaintStatus !== 'not_sent' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '100px',
                      backgroundColor: chat.complaintStatus === 'rejected' ? '#FEE2E2' :
                        chat.complaintStatus === 'approved' ? '#D1FAE5' : '#FEF3C7',
                      color: chat.complaintStatus === 'rejected' ? '#991B1B' :
                        chat.complaintStatus === 'approved' ? '#065F46' : '#92400E',
                    }}>
                      Жалоба: {COMPLAINT_STATUS_LABELS[chat.complaintStatus] || chat.complaintStatus}
                    </span>
                  )}
                  {chat.reviewStatusWb && chat.reviewStatusWb !== 'visible' && chat.reviewStatusWb !== 'unknown' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '100px',
                      backgroundColor: chat.reviewStatusWb === 'temporarily_hidden' ? '#EDE9FE' :
                        chat.reviewStatusWb === 'deleted' ? '#FEE2E2' : '#FEF3C7',
                      color: chat.reviewStatusWb === 'temporarily_hidden' ? '#5B21B6' :
                        chat.reviewStatusWb === 'deleted' ? '#991B1B' : '#92400E',
                    }}>
                      Отзыв: {REVIEW_STATUS_LABELS[chat.reviewStatusWb] || chat.reviewStatusWb}
                    </span>
                  )}
                  {chat.productStatus && chat.productStatus !== 'unknown' && chat.productStatus !== 'not_specified' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '100px',
                      backgroundColor: chat.productStatus === 'refused' ? '#FEE2E2' :
                        chat.productStatus === 'purchased' ? '#D1FAE5' : '#F3F4F6',
                      color: chat.productStatus === 'refused' ? '#991B1B' :
                        chat.productStatus === 'purchased' ? '#065F46' : '#6B7280',
                    }}>
                      {PRODUCT_STATUS_LABELS[chat.productStatus] || chat.productStatus}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Section: ВОРОНКА */}
            {currentStepIndex >= 0 && (
              <>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
                  Воронка
                </div>
                {/* Interactive step indicator — tap any step to change */}
                <div style={{ padding: '0 4px', marginBottom: '20px' }}>
                  {/* Dots + lines */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {WORKFLOW_STEPS.map((step, i) => {
                      const isCompleted = i < currentStepIndex;
                      const isActive = i === currentStepIndex;
                      const canTap = chat.status !== 'closed' && !tagLoading && i !== currentStepIndex;
                      return (
                        <div key={step} style={{ display: 'contents' }}>
                          <div
                            onClick={canTap ? () => handleTagChange(step) : undefined}
                            style={{
                              width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${isCompleted ? '#10B981' : isActive ? '#2563EB' : '#D1D5DB'}`,
                              background: isCompleted ? '#10B981' : isActive ? '#2563EB' : '#FFFFFF',
                              cursor: canTap ? 'pointer' : 'default',
                              transition: 'all 0.2s ease-out',
                            }}
                          />
                          {i < WORKFLOW_STEPS.length - 1 && (
                            <div style={{
                              flex: 1, height: '2px',
                              background: isCompleted ? '#10B981' : '#E6E8EC',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Labels — also tappable */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    {WORKFLOW_STEPS.map((step, i) => {
                      const isCompleted = i < currentStepIndex;
                      const isActive = i === currentStepIndex;
                      const canTap = chat.status !== 'closed' && !tagLoading && i !== currentStepIndex;
                      const labels = ['Кандидат', 'Оффер', 'Согласен', 'Удалён'];
                      return (
                        <span
                          key={step}
                          onClick={canTap ? () => handleTagChange(step) : undefined}
                          style={{
                            fontSize: '10px', fontWeight: isActive ? 700 : 600, textAlign: 'center',
                            width: '60px', padding: '4px 0',
                            color: isCompleted ? '#10B981' : isActive ? '#2563EB' : '#9CA3AF',
                            cursor: canTap ? 'pointer' : 'default',
                            transition: 'color 0.15s',
                          }}
                        >
                          {labels[i]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Section: РАССЫЛКА */}
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
              Рассылка
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', borderRadius: '12px', background: '#F7F8FA', marginBottom: '20px',
            }}>
              {sequence?.status === 'active' ? (
                <>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                      <span style={{ color: '#2563EB' }}>▶</span> Авто {sequence.currentStep}/{sequence.maxSteps}
                    </div>
                    {sequence.nextSendAt && (
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                        След: {new Date(sequence.nextSendAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} в {new Date(sequence.nextSendAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleStopSequence}
                    disabled={seqLoading}
                    style={{
                      padding: '6px 14px', borderRadius: '8px',
                      border: '1.5px solid #EF4444', background: 'none',
                      fontSize: '12px', fontWeight: 600, color: '#EF4444',
                      cursor: 'pointer', opacity: seqLoading ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    Стоп
                  </button>
                </>
              ) : sequence?.status === 'stopped' && sequence.stopReason === 'manual_reply' ? (
                <>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#92400E' }}>
                    Пауза ({sequence.currentStep}/{sequence.maxSteps})
                  </div>
                  <button
                    onClick={handleStartTagSequence}
                    disabled={seqLoading}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none',
                      background: '#2563EB', fontSize: '12px', fontWeight: 600,
                      color: 'white', cursor: 'pointer', opacity: seqLoading ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    Продолжить
                  </button>
                </>
              ) : sequence?.status === 'completed' ? (
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#9CA3AF' }}>
                  Завершена ({sequence.currentStep}/{sequence.maxSteps})
                </div>
              ) : chat.status !== 'closed' ? (
                <>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#9CA3AF' }}>
                    Нет активной рассылки
                  </div>
                  <button
                    onClick={handleStartTagSequence}
                    disabled={seqLoading}
                    style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none',
                      background: '#2563EB', fontSize: '12px', fontWeight: 600,
                      color: 'white', cursor: 'pointer', opacity: seqLoading ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {SEQUENCE_MENU_LABELS[chat.tag || '']?.replace('Запустить рассылку', 'Запустить') || 'Запустить'}
                  </button>
                </>
              ) : (
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#9CA3AF' }}>—</div>
              )}
            </div>

            {/* Section: СПРАВКА */}
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF', marginBottom: '8px' }}>
              Справка
            </div>
            <div style={{ borderRadius: '12px', background: '#F7F8FA', padding: '12px' }}>
              {chat.productName && (
                <div style={{ fontSize: '13px', color: '#6B7280', padding: '6px 0', display: 'flex', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#9CA3AF', minWidth: '70px', fontSize: '12px' }}>Продукт</span>
                  <span style={{ fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.productName}
                  </span>
                </div>
              )}
              {chat.productNmId && (
                <div style={{ fontSize: '13px', color: '#6B7280', padding: '6px 0', display: 'flex', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#9CA3AF', minWidth: '70px', fontSize: '12px' }}>Артикул</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>
                    {chat.productNmId}
                  </span>
                </div>
              )}
              {chat.reviewDate && (
                <div style={{ fontSize: '13px', color: '#6B7280', padding: '6px 0', display: 'flex', gap: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#9CA3AF', minWidth: '70px', fontSize: '12px' }}>Отзыв</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>
                    {new Date(chat.reviewDate).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {chat.reviewText && (
                <div style={{ fontSize: '13px', color: '#6B7280', padding: '6px 0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, color: '#9CA3AF', minWidth: '70px', fontSize: '12px' }}>Текст</span>
                  <span style={{
                    fontWeight: 500, color: '#6B7280', fontSize: '12px', lineHeight: 1.5,
                    maxHeight: '80px', overflowY: 'auto',
                  }}>
                    "{chat.reviewText}"
                  </span>
                </div>
              )}
              {chat.chatUrl && (
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={chat.chatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      fontSize: '12px', fontWeight: 600, color: '#2563EB', textDecoration: 'none',
                    }}
                  >
                    Открыть в {chat.marketplace === 'ozon' ? 'OZON' : 'WB'} →
                  </a>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* === COMPLETION REASON BOTTOM SHEET === */}
      {showReasons && (
        <>
          <div
            onClick={() => setShowReasons(false)}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: '#FFFFFF', borderRadius: '20px 20px 0 0',
            padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 101, maxHeight: '60vh', overflowY: 'auto',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
            borderTop: '1px solid #E6E8EC',
          }}>
            <div style={{
              width: '40px', height: '4px', backgroundColor: '#E6E8EC',
              borderRadius: '2px', margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#111827' }}>
              Причина закрытия
            </div>
            {COMPLETION_REASONS.map(r => (
              <button
                key={r.value}
                onClick={() => handleClose(r.value)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', marginBottom: '6px', borderRadius: '12px', border: 'none',
                  backgroundColor: '#F7F8FA', color: '#111827', fontSize: '14px', fontWeight: 500,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease-out',
                }}
              >
                <span style={{ fontSize: '16px' }}>{r.icon}</span>
                <span>{r.label}</span>
              </button>
            ))}
            <button
              onClick={() => setShowReasons(false)}
              style={{
                width: '100%', padding: '12px', marginTop: '8px', borderRadius: '12px',
                border: '2px solid #E6E8EC', backgroundColor: '#FFFFFF',
                color: '#6B7280', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease-out',
              }}
            >
              Отмена
            </button>
          </div>
        </>
      )}

      {/* Overflow menu backdrop (close on tap outside) */}
      {showOverflow && (
        <div
          onClick={() => setShowOverflow(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
        />
      )}
    </div>
  );
}
