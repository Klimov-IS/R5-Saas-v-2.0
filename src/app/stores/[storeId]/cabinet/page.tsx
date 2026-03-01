'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { CabinetData } from '@/db/cabinet-helpers';

// ── Fetch ──

async function fetchCabinet(storeId: string): Promise<{ data: CabinetData }> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
  const response = await fetch(`/api/stores/${storeId}/cabinet`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error('Failed to fetch cabinet data');
  return response.json();
}

// ── Helpers ──

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Нет данных';
  const date = new Date(dateString);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: 'Активен', className: 'status-active' },
  trial: { label: 'Триал', className: 'status-active' },
  paused: { label: 'Пауза', className: 'status-paused' },
  stopped: { label: 'Остановлен', className: 'status-stopped' },
  archived: { label: 'Архив', className: 'status-stopped' },
};

const strategyLabels: Record<string, string> = {
  upgrade_to_5: 'Вывод на 5 звёзд',
  delete: 'Удаление отзыва',
  both: 'Удаление + вывод на 5',
};

// ── Page ──

export default function CabinetPage() {
  const params = useParams();
  const storeId = params.storeId as string;

  const { data: result, isLoading, error } = useQuery({
    queryKey: ['cabinet', storeId],
    queryFn: () => fetchCabinet(storeId),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  if (error || !result?.data) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--color-error)' }}>
        Ошибка загрузки кабинета
      </div>
    );
  }

  const d = result.data;
  const { store, metrics, ratingBreakdown, complaints, rules, ai, telegram } = d;
  const statusInfo = statusLabels[store.status] || statusLabels.active;
  const totalReviews = Object.values(ratingBreakdown).reduce((a, b) => a + b, 0);
  const avgRating = totalReviews > 0
    ? (Object.entries(ratingBreakdown).reduce((s, [r, c]) => s + Number(r) * c, 0) / totalReviews).toFixed(1)
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 60 }}>

      {/* ═══ 1. STORE IDENTITY ═══ */}
      <div className="card" style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, fontWeight: 700, flexShrink: 0,
          }}>
            {store.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
              {store.name}
              {store.marketplace === 'ozon' && (
                <span style={{
                  display: 'inline-block', marginLeft: 8, padding: '1px 6px',
                  fontSize: 10, fontWeight: 700, color: 'white',
                  background: 'linear-gradient(135deg, #005BFF, #003399)',
                  borderRadius: 4, verticalAlign: 'middle', lineHeight: '16px',
                }}>OZON</span>
              )}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {store.marketplace === 'wb' ? 'Wildberries' : 'OZON'} · Подключен {new Date(store.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20,
            fontSize: 13, fontWeight: 600,
            ...(store.status === 'active' || store.status === 'trial'
              ? { background: '#d1fae5', color: '#059669' }
              : store.status === 'paused'
                ? { background: '#fef3c7', color: '#d97706' }
                : { background: '#fee2e2', color: '#ef4444' }
            ),
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: store.status === 'active' || store.status === 'trial' ? '#10b981'
                : store.status === 'paused' ? '#f59e0b' : '#ef4444',
            }} />
            {statusInfo.label}
          </span>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', textAlign: 'right', lineHeight: 1.6 }}>
            <SyncLine label="Товары" sync={store.syncs.products} />
            <SyncLine label="Отзывы" sync={store.syncs.reviews} />
            <SyncLine label="Чаты" sync={store.syncs.chats} />
          </div>
        </div>
      </div>

      {/* ═══ 2. KPI ROW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KPICard icon="📦" label="Товаров" value={formatNumber(metrics.products.total)}
          sub={`${formatNumber(metrics.products.active)} в работе (${metrics.products.total > 0 ? Math.round(metrics.products.active / metrics.products.total * 100) : 0}%)`}
          bgColor="var(--category-products-bg)" iconColor="var(--category-products-text)" />
        <KPICard icon="⭐" label="Отзывов 1-3★" value={formatNumber(metrics.reviews.negative)}
          sub={`из ${formatNumber(metrics.reviews.total)} всего`}
          bgColor="var(--category-reviews-bg)" iconColor="var(--category-reviews-text)" />
        <KPICard icon="💬" label="Чатов" value={formatNumber(metrics.chats.total)}
          sub={`${formatNumber(metrics.chats.active)} активных`}
          bgColor="var(--category-chats-bg)" iconColor="var(--category-chats-text)" />
        <KPICard icon="📋" label="Жалоб подано" value={formatNumber(complaints.filed)}
          sub={complaints.approvalRate > 0 ? `${complaints.approvalRate}% одобрено` : 'Нет данных'}
          subGreen={complaints.approvalRate >= 80}
          bgColor="#fce4ec" iconColor="#c62828" />
      </div>

      {/* ═══ 3. COMPLAINTS + RATING ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Complaints */}
        <SectionCard title="📋 Жалобы и удаления">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <StatBox value={formatNumber(complaints.filed)} label="Подано" color="var(--color-primary)" />
            <StatBox value={formatNumber(complaints.approved)} label="Одобрено" color="var(--color-success)" />
            <StatBox value={formatNumber(complaints.rejected)} label="Отклонено" color="var(--color-error)" />
          </div>
          {/* Approval bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--color-background)', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>Одобрение</span>
            <div style={{ flex: 1, height: 8, background: 'var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #10b981, #34d399)', width: `${complaints.approvalRate}%` }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', minWidth: 40, textAlign: 'right' }}>{complaints.approvalRate}%</span>
          </div>
          {/* Deleted */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', borderRadius: 8, border: '1px solid #e9d5ff' }}>
            <div>
              <div style={{ fontSize: 13, color: '#7c3aed', fontWeight: 500 }}>Удалено с WB</div>
              <div style={{ fontSize: 11, color: '#a78bfa' }}>Отзывы со статусом deleted</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>{formatNumber(metrics.deletions.total)}</div>
          </div>
        </SectionCard>

        {/* Rating Breakdown */}
        <SectionCard title="⭐ Распределение отзывов">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratingBreakdown[rating] || 0;
              const pct = totalReviews > 0 ? (count / totalReviews * 100) : 0;
              const colors = { 5: '#22c55e', 4: '#84cc16', 3: '#f59e0b', 2: '#f97316', 1: '#ef4444' };
              return (
                <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 16, textAlign: 'center', fontWeight: 600 }}>{rating}</span>
                  <span style={{ color: '#f59e0b', fontSize: 12 }}>★</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--color-border-light)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: colors[rating as keyof typeof colors], width: `${pct}%`, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ minWidth: 50, textAlign: 'right', color: 'var(--color-muted)', fontWeight: 500 }}>{formatNumber(count)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <MiniStat value={formatNumber(totalReviews)} label="Всего" bg="var(--color-background)" />
            <MiniStat value={formatNumber(metrics.reviews.negative)} label="Негативных" bg="#fef2f2" valueColor="#dc2626" />
            <MiniStat value={avgRating} label="Средний" bg="#f0fdf4" valueColor="#16a34a" />
          </div>
        </SectionCard>
      </div>

      {/* ═══ 4. RULES + AI ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Rules */}
        <SectionCard title="📝 Правила работы с отзывами">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <RuleItem icon="📋" text={<>
              <strong>Жалобы:</strong> подаём на отзывы <strong>{rules.complaintRatings.length > 0 ? rules.complaintRatings.join(', ') + ' ★' : 'не настроено'}</strong>
            </>} />
            <RuleItem icon="💬" text={<>
              <strong>Чаты:</strong> работаем с <strong>{rules.chatRatings.length > 0 ? rules.chatRatings.join(', ') + ' ★' : 'не настроено'}</strong>
              {rules.chatStrategy && <span style={{ color: 'var(--color-muted)' }}> — {strategyLabels[rules.chatStrategy] || rules.chatStrategy}</span>}
            </>} />
            <RuleItem icon="💰" text={
              rules.compensation.enabled
                ? <><strong>Компенсация:</strong> до <strong>{rules.compensation.maxAmount || '—'} ₽</strong> {rules.compensation.type === 'card' ? 'на карту' : rules.compensation.type || ''}</>
                : <><strong>Компенсация:</strong> <span style={{ color: 'var(--color-muted)' }}>не предусмотрена</span></>
            } />
            <RuleItem icon="🔄" text={<>
              <strong>Авто-цепочки:</strong> {rules.autoSequences.active > 0
                ? <><strong>{rules.autoSequences.active}</strong> активных из {rules.autoSequences.total}</>
                : <span style={{ color: 'var(--color-muted)' }}>нет активных</span>}
            </>} />
          </div>
        </SectionCard>

        {/* AI Config */}
        <SectionCard title="✨ AI конфигурация" actionLabel="Настроить →" actionHref={`/stores/${storeId}/ai`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AISummaryRow icon="📝" text={<>Инструкции: <strong>{ai.hasInstructions ? `Настроены (${ai.instructionsLength} симв.)` : 'Не настроены'}</strong></>} />
            <AISummaryRow icon="❓" text={<>FAQ: <strong>{ai.faqCount} записей</strong></>} />
            <AISummaryRow icon="📖" text={<>Гайды: <strong>{ai.guidesCount} гайдов</strong></>} />
          </div>
          {ai.hasInstructions && ai.instructionsPreview && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 500 }}>Выжимка из инструкций:</div>
              <div style={{ fontSize: 12, color: '#78716c', marginTop: 4, lineHeight: 1.5 }}>"{ai.instructionsPreview}"</div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ═══ 5. TELEGRAM + PLACEHOLDERS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Telegram */}
        <SectionCard title="📨 Telegram">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatusRow label="Подключён" value={telegram.connected ? 'Да' : 'Нет'} positive={telegram.connected} />
            <StatusRow label="Уведомления" value={telegram.notificationsEnabled ? 'Включены' : 'Выключены'} positive={telegram.notificationsEnabled} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-background)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Последнее уведомление</span>
              <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{formatRelativeDate(telegram.lastNotification)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-background)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Чатов в TG очереди</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{telegram.queueCount}</span>
            </div>
          </div>
        </SectionCard>

        {/* Placeholder — Phase 2 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <PlaceholderSection title="📂 Файлы Google Drive" />
          <PlaceholderSection title="🏢 Реквизиты компании" />
          <PlaceholderSection title="🗒️ Заметки по клиенту" />
        </div>
      </div>

      {/* ═══ 6. MORE PLACEHOLDERS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        <PlaceholderCard title="💬 Статус работы в чатах" phase="Phase 2" />
        <PlaceholderCard title="💰 Стоимость услуг" phase="Phase 3" />
        <PlaceholderCard title="📅 Лента событий" phase="Phase 4" />
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ──

function SyncLine({ label, sync }: { label: string; sync: { status: string | null; date: string | null } }) {
  const ok = sync.status === 'success';
  return (
    <div>
      <span style={{ color: ok ? '#10b981' : sync.status === 'error' ? '#ef4444' : '#64748b' }}>
        {ok ? '✓' : sync.status === 'error' ? '✗' : '○'}
      </span>{' '}
      {label}: {formatRelativeDate(sync.date)}
    </div>
  );
}

function KPICard({ icon, label, value, sub, subGreen, bgColor, iconColor }: {
  icon: string; label: string; value: string; sub: string;
  subGreen?: boolean; bgColor: string; iconColor: string;
}) {
  return (
    <div className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bgColor, color: iconColor, fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: subGreen ? 'var(--color-success)' : 'var(--color-muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, actionLabel, actionHref }: {
  title: string; children: React.ReactNode; actionLabel?: string; actionHref?: string;
}) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--color-border-light)' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        {actionLabel && actionHref && (
          <a href={actionHref} style={{ fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{actionLabel}</a>
        )}
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

function StatBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 16, borderRadius: 8, background: 'var(--color-background)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function MiniStat({ value, label, bg, valueColor }: { value: string; label: string; bg: string; valueColor?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: 12, background: bg, borderRadius: 8 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor || 'var(--color-foreground)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{label}</div>
    </div>
  );
}

function RuleItem({ icon, text }: { icon: string; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 8, background: 'var(--color-background)', fontSize: 13 }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function AISummaryRow({ icon, text }: { icon: string; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 8, background: 'var(--color-background)' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}

function StatusRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--color-background)', borderRadius: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 16,
        background: positive ? '#d1fae5' : '#fee2e2',
        color: positive ? '#059669' : '#ef4444',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: positive ? '#10b981' : '#ef4444' }} />
        {value}
      </span>
    </div>
  );
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border-light)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Будет доступно в Phase 2</div>
    </div>
  );
}

function PlaceholderCard({ title, phase }: { title: string; phase: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, border: '2px dashed var(--color-border)', borderRadius: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{phase}</div>
    </div>
  );
}
