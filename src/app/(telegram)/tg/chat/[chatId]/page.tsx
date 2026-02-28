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
}

interface ChatDetail {
  id: string;
  storeId: string;
  storeName: string;
  marketplace?: string;
  clientName: string;
  productName: string | null;
  status: string;
  draftReply: string | null;
  // Review & product rules
  reviewRating?: number | null;
  reviewDate?: string | null;
  complaintStatus?: string | null;
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
  { value: 'review_deleted', label: 'Отзыв удален', icon: '🗑️' },
  { value: 'review_upgraded', label: 'Отзыв дополнен', icon: '⭐' },
  { value: 'no_reply', label: 'Нет ответа', icon: '🔇' },
  { value: 'old_dialog', label: 'Старый диалог', icon: '⏰' },
  { value: 'not_our_issue', label: 'Не наш вопрос', icon: '❓' },
  { value: 'spam', label: 'Спам', icon: '🚫' },
  { value: 'negative', label: 'Негатив', icon: '😠' },
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

const STRATEGY_LABELS: Record<string, string> = {
  upgrade_to_5: 'Повышение до 5', delete: 'Удаление', both: 'Обе стратегии',
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
  const [showDetails, setShowDetails] = useState(false);
  const [reviewTextExpanded, setReviewTextExpanded] = useState(false);
  const [sequence, setSequence] = useState<SequenceInfo | null>(null);
  const [seqLoading, setSeqLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Haptic feedback helper
  const haptic = useCallback((type: 'success' | 'error' | 'warning') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch {}
  }, []);

  // Navigate to next chat in queue (or back to queue if none)
  const goToNextChat = useCallback(() => {
    try {
      const queueOrder = JSON.parse(sessionStorage.getItem('tg_queue_order') || '[]') as Array<{ id: string; storeId: string }>;
      const currentIndex = queueOrder.findIndex(item => item.id === chatId);

      // Add current to skipped so it sorts to end
      const skipped = JSON.parse(sessionStorage.getItem('tg_skipped_chats') || '[]');
      if (!skipped.includes(chatId)) skipped.push(chatId);
      sessionStorage.setItem('tg_skipped_chats', JSON.stringify(skipped));

      // Find next non-skipped chat
      const skippedSet = new Set(skipped);
      let nextItem = null;
      for (let i = currentIndex + 1; i < queueOrder.length; i++) {
        if (!skippedSet.has(queueOrder[i].id)) {
          nextItem = queueOrder[i];
          break;
        }
      }
      // If nothing found after current, wrap around from start
      if (!nextItem) {
        for (let i = 0; i < currentIndex; i++) {
          if (!skippedSet.has(queueOrder[i].id)) {
            nextItem = queueOrder[i];
            break;
          }
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
      // Prefer server draft, then local backup (unsaved user edits), then empty
      const serverDraft = data.chat.draftReply || '';
      try {
        const localDraft = localStorage.getItem(`tg_draft_${chatId}`);
        setDraftText(localDraft ?? serverDraft);
      } catch {
        setDraftText(serverDraft);
      }
    } catch (err: any) {
      setFeedback('Ошибка загрузки чата');
    } finally {
      setIsLoading(false);
    }
  }, [chatId, apiFetch]);

  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [messageSent, setMessageSent] = useState(false);

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
      if (!response.ok) throw new Error('Failed to send');
      // Optimistic update: show sent message immediately without waiting for sync
      setMessages(prev => [...prev, {
        id: `optimistic-${Date.now()}`,
        text: sentText,
        sender: 'seller' as const,
        timestamp: new Date().toISOString(),
      }]);
      haptic('success');
      setFeedback('✅ Отправлено');
      setMessageSent(true);
      setDraftText('');
      try { localStorage.removeItem(`tg_draft_${chatId}`); } catch {}
    } catch {
      haptic('error');
      setFeedback('❌ Ошибка отправки');
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
      setFeedback('❌ Ошибка генерации');
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
      if (!response.ok) throw new Error('Failed to close');
      haptic('success');
      setFeedback('✅ Чат закрыт');
      setTimeout(() => router.back(), 800);
    } catch {
      haptic('error');
      setFeedback('❌ Ошибка закрытия');
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

  useEffect(() => {
    fetchSequence();
  }, [fetchSequence]);

  // Start sequence
  const handleStartSequence = async () => {
    setSeqLoading(true);
    try {
      const res = await apiFetch(`/api/telegram/chats/${chatId}/sequence/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const err = await res.json();
        haptic('error');
        setFeedback(err.error || 'Ошибка запуска рассылки');
      } else {
        haptic('success');
        setFeedback('Рассылка запущена');
        fetchSequence();
      }
    } catch {
      haptic('error');
      setFeedback('Ошибка запуска рассылки');
    } finally {
      setSeqLoading(false);
    }
  };

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
        setFeedback('Ошибка остановки рассылки');
      } else {
        haptic('success');
        setFeedback('Рассылка остановлена');
        fetchSequence();
      }
    } catch {
      haptic('error');
      setFeedback('Ошибка остановки рассылки');
    } finally {
      setSeqLoading(false);
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F7F8FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontSize: '14px' }}>Загрузка чата...</div>
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
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #E6E8EC',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 10px',
            borderRadius: '8px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
          }}>
            {chat.storeName}
          </span>
          {chat.marketplace === 'ozon' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '8px',
              backgroundColor: '#005bff',
              color: '#fff',
            }}>
              OZON
            </span>
          )}
        </div>
        {/* Client name + review rating & date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{chat.clientName}</span>
          {chat.reviewRating != null && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '6px',
              backgroundColor: RATING_COLORS[chat.reviewRating] || '#9ca3af',
              color: '#fff',
              flexShrink: 0,
              lineHeight: '16px',
            }}>
              {'★'.repeat(chat.reviewRating)}
            </span>
          )}
          {chat.reviewDate && (
            <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, flexShrink: 0 }}>
              {new Date(chat.reviewDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          )}
        </div>
        {chat.productName && (
          <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{chat.productName}</div>
        )}

        {/* Expandable details section */}
        {(chat.productStatus || chat.complaintStatus || chat.chatStrategy || chat.offerCompensation || chat.reviewText || chat.chatUrl) && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                marginTop: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 600,
                border: showDetails ? '1px solid rgba(37,99,235,0.15)' : '1px solid #E6E8EC',
                borderRadius: '10px',
                backgroundColor: showDetails ? '#EEF2FF' : 'transparent',
                color: showDetails ? '#2563EB' : '#6B7280',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease-out',
              }}
            >
              {showDetails ? '▲ Скрыть' : '▼ Детали'}
            </button>
            {showDetails && (
              <div style={{
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}>
                {chat.productStatus && chat.productStatus !== 'unknown' && chat.productStatus !== 'not_specified' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '100px',
                    backgroundColor: chat.productStatus === 'refused' ? '#FEE2E2' :
                      chat.productStatus === 'purchased' ? '#D1FAE5' : '#F3F4F6',
                    color: chat.productStatus === 'refused' ? '#991B1B' :
                      chat.productStatus === 'purchased' ? '#065F46' : '#6B7280',
                  }}>
                    {PRODUCT_STATUS_LABELS[chat.productStatus] || chat.productStatus}
                  </span>
                )}
                {chat.complaintStatus && chat.complaintStatus !== 'not_sent' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '100px',
                    backgroundColor: chat.complaintStatus === 'rejected' ? '#FEE2E2' :
                      chat.complaintStatus === 'approved' ? '#D1FAE5' : '#FEF3C7',
                    color: chat.complaintStatus === 'rejected' ? '#991B1B' :
                      chat.complaintStatus === 'approved' ? '#065F46' : '#92400E',
                  }}>
                    Жалоба: {COMPLAINT_STATUS_LABELS[chat.complaintStatus] || chat.complaintStatus}
                  </span>
                )}
                {chat.chatStrategy && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '100px',
                    backgroundColor: '#EEF2FF', color: '#1E40AF',
                  }}>
                    {STRATEGY_LABELS[chat.chatStrategy] || chat.chatStrategy}
                  </span>
                )}
                {chat.offerCompensation && chat.maxCompensation && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '100px',
                    backgroundColor: '#EDE9FE', color: '#5B21B6',
                  }}>
                    Кешбек {chat.maxCompensation}₽ {chat.compensationBy === 'r5' ? '(R5)' : chat.compensationBy === 'seller' ? '(продавец)' : ''}
                  </span>
                )}
                {chat.chatUrl && (
                  <a
                    href={chat.chatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '100px',
                      backgroundColor: '#EEF2FF', color: '#2563EB',
                      textDecoration: 'none', transition: 'all 0.15s ease-out',
                    }}
                  >
                    Открыть в WB
                  </a>
                )}
                {chat.reviewText && (
                  <div style={{ width: '100%', marginTop: '4px' }}>
                    <button
                      onClick={() => setReviewTextExpanded(!reviewTextExpanded)}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#6B7280',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                      }}
                    >
                      {reviewTextExpanded ? '▲ Скрыть отзыв' : '▼ Текст отзыва'}
                    </button>
                    {reviewTextExpanded && (
                      <div style={{
                        marginTop: '6px',
                        padding: '8px 12px',
                        backgroundColor: '#F7F8FA',
                        borderRadius: '12px',
                        border: '1px solid rgba(230,232,236,0.5)',
                        fontSize: '12px',
                        color: '#111827',
                        lineHeight: '1.5',
                        maxHeight: '120px',
                        overflowY: 'auto',
                      }}>
                        {chat.reviewText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Auto-sequence section */}
        {(sequence || chat.status !== 'closed') && (
          <div style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {sequence?.status === 'active' ? (
              <>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(37,99,235,0.1)',
                  color: '#2563EB',
                }}>
                  Авто {sequence.currentStep}/{sequence.maxSteps}
                </span>
                <button
                  onClick={handleStopSequence}
                  disabled={seqLoading}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '10px',
                    border: '1px solid #EF4444',
                    backgroundColor: 'transparent',
                    color: '#EF4444',
                    cursor: 'pointer',
                    opacity: seqLoading ? 0.5 : 1,
                    transition: 'all 0.15s ease-out',
                  }}
                >
                  Стоп
                </button>
              </>
            ) : sequence?.status === 'completed' ? (
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '10px',
                backgroundColor: '#F3F4F6',
                color: '#6B7280',
              }}>
                Рассылка завершена
              </span>
            ) : sequence?.status === 'stopped' ? (
              <>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                }}>
                  Остановлена ({sequence.currentStep}/{sequence.maxSteps})
                </span>
                <button
                  onClick={handleStartSequence}
                  disabled={seqLoading}
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '10px',
                    border: '1px solid #2563EB',
                    backgroundColor: 'transparent',
                    color: '#2563EB',
                    cursor: 'pointer',
                    opacity: seqLoading ? 0.5 : 1,
                    transition: 'all 0.15s ease-out',
                  }}
                >
                  Запустить
                </button>
              </>
            ) : chat.status !== 'closed' ? (
              <button
                onClick={handleStartSequence}
                disabled={seqLoading}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  border: '1px solid #2563EB',
                  backgroundColor: 'transparent',
                  color: '#2563EB',
                  cursor: 'pointer',
                  opacity: seqLoading ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease-out',
                }}
              >
                Запустить рассылку
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        backgroundColor: '#F7F8FA',
      }}>
        {messages.slice(-15).map(msg => (
          <div
            key={msg.id}
            style={{
              maxWidth: '85%',
              marginLeft: msg.sender === 'seller' ? 'auto' : '0',
              marginRight: msg.sender === 'client' ? 'auto' : '0',
              marginBottom: '8px',
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
            }}
          >
            {msg.text}
            <div style={{
              fontSize: '10px',
              opacity: 0.6,
              marginTop: '6px',
              textAlign: msg.sender === 'seller' ? 'right' : 'left',
              color: msg.sender === 'seller' ? 'rgba(255,255,255,0.6)' : '#6B7280',
            }}>
              {msg.timestamp ? new Date(msg.timestamp).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit',
              }) : ''}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Draft area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #E6E8EC',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
      }}>
        {isGenerating ? (
          <div style={{
            textAlign: 'center',
            padding: '16px',
            color: '#6B7280',
            fontSize: '14px',
          }}>
            ⏳ Генерация ИИ-ответа...
          </div>
        ) : (
          <>
            <textarea
              value={draftText}
              onChange={e => {
                setDraftText(e.target.value);
                try { localStorage.setItem(`tg_draft_${chatId}`, e.target.value); } catch {}
              }}
              placeholder="Текст ответа..."
              style={{
                width: '100%',
                minHeight: '80px',
                maxHeight: '150px',
                padding: '10px 14px',
                border: '1px solid #E6E8EC',
                borderRadius: '12px',
                fontSize: '14px',
                lineHeight: 1.5,
                resize: 'vertical',
                backgroundColor: '#F7F8FA',
                color: '#111827',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
            />
            <div style={{
              textAlign: 'right',
              fontSize: '11px',
              marginTop: '4px',
              fontWeight: 500,
              color: draftText.length > 900 ? '#EF4444' : '#6B7280',
            }}>
              {draftText.length}/1000
            </div>
          </>
        )}

        {/* Feedback */}
        {feedback && (
          <div style={{ textAlign: 'center', fontSize: '13px', padding: '4px 0', fontWeight: 500, color: '#111827' }}>
            {feedback}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        padding: '10px 16px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E6E8EC',
        flexShrink: 0,
      }}>
        {!messageSent ? (
          <>
            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!draftText.trim() || isSending || isGenerating}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: (!draftText.trim() || isSending || isGenerating) ? '#D1D5DB' : '#10B981',
                color: '#fff',
                opacity: isSending ? 0.7 : 1,
                transition: 'all 0.15s ease-out',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {isSending ? '⏳...' : 'Отправить'}
            </button>

            {/* AI reply */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isSending}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                color: '#FFFFFF',
                opacity: isGenerating ? 0.7 : 1,
                transition: 'all 0.15s ease-out',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {isGenerating ? '⏳...' : 'AI ответ'}
            </button>

            {/* Close */}
            <button
              onClick={() => setShowReasons(true)}
              disabled={isSending || isGenerating}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid rgba(239,68,68,0.2)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: 'rgba(254,226,226,0.5)',
                color: '#EF4444',
                transition: 'all 0.15s ease-out',
              }}
            >
              Закрыть
            </button>

            {/* Next dialog */}
            <button
              onClick={goToNextChat}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid #E6E8EC',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: '#FFFFFF',
                color: '#6B7280',
                transition: 'all 0.15s ease-out',
              }}
            >
              След. диалог
            </button>
          </>
        ) : (
          <>
            {/* After send: close or next */}
            <button
              onClick={() => setShowReasons(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid rgba(239,68,68,0.2)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: 'rgba(254,226,226,0.5)',
                color: '#EF4444',
                transition: 'all 0.15s ease-out',
              }}
            >
              Закрыть диалог
            </button>

            <button
              onClick={goToNextChat}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '12px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                color: '#FFFFFF',
                transition: 'all 0.15s ease-out',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              След. диалог
            </button>
          </>
        )}
      </div>

      {/* Completion reason bottom sheet */}
      {showReasons && (
        <>
          <div
            onClick={() => setShowReasons(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            borderRadius: '20px 20px 0 0',
            padding: '16px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            zIndex: 101,
            maxHeight: '60vh',
            overflowY: 'auto',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
            borderTop: '1px solid #E6E8EC',
          }}>
            {/* Handle bar */}
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
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  marginBottom: '6px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#F7F8FA',
                  color: '#111827',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease-out',
                }}
              >
                <span style={{ fontSize: '16px' }}>{r.icon}</span>
                <span>{r.label}</span>
              </button>
            ))}
            <button
              onClick={() => setShowReasons(false)}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '8px',
                borderRadius: '12px',
                border: '2px solid #E6E8EC',
                backgroundColor: '#FFFFFF',
                color: '#6B7280',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
              }}
            >
              Отмена
            </button>
          </div>
        </>
      )}
    </div>
  );
}
