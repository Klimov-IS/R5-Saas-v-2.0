'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager';
  email: string;
  display_name: string | null;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface Store {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
};

export default function TeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager'>('manager');
  const [isInviting, setIsInviting] = useState(false);

  // Store assignment modal
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberStores, setMemberStores] = useState<string[]>([]);
  const [isSavingStores, setIsSavingStores] = useState(false);

  const [feedback, setFeedback] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/org/members'),
        fetch('/api/org/invites'),
      ]);

      if (membersRes.status === 401 || membersRes.status === 403) {
        router.push('/login');
        return;
      }

      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();

      setMembers(membersData.members || []);
      setInvites(invitesData.invites || []);
    } catch {
      setError('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create invite
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setFeedback('');

    try {
      const res = await fetch('/api/org/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || 'Ошибка');
        return;
      }

      setFeedback(`Приглашение создано! Ссылка: ${window.location.origin}${data.registrationUrl}`);
      setInviteEmail('');
      setShowInviteForm(false);
      fetchData();
    } catch {
      setFeedback('Ошибка сети');
    } finally {
      setIsInviting(false);
    }
  };

  // Remove member
  const handleRemove = async (member: Member) => {
    if (!confirm(`Удалить ${member.display_name || member.email}?`)) return;

    try {
      const res = await fetch(`/api/org/members/${member.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch {}
  };

  // Change role
  const handleRoleChange = async (member: Member, newRole: 'admin' | 'manager') => {
    try {
      const res = await fetch(`/api/org/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) fetchData();
    } catch {}
  };

  // Open store assignment
  const openStoreAssignment = async (member: Member) => {
    setEditingMember(member);
    try {
      // Load stores list + current assignment
      const [storesRes, accessRes] = await Promise.all([
        fetch('/api/stores'),
        fetch(`/api/org/members/${member.id}/stores`),
      ]);
      const storesData = await storesRes.json();
      const accessData = await accessRes.json();

      setStores(storesData.stores || storesData || []);
      setMemberStores(accessData.storeIds || []);
    } catch {}
  };

  // Save store assignment
  const saveStoreAssignment = async () => {
    if (!editingMember) return;
    setIsSavingStores(true);

    try {
      await fetch(`/api/org/members/${editingMember.id}/stores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeIds: memberStores }),
      });
      setEditingMember(null);
    } catch {} finally {
      setIsSavingStores(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Команда</h1>
          <p className="text-sm text-muted-foreground">Управление сотрудниками и ролями</p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + Пригласить
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className="mb-4 p-3 bg-muted rounded-lg text-sm break-all">
          {feedback}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div className="mb-6 p-4 border rounded-xl bg-background">
          <h3 className="font-semibold mb-3">Новое приглашение</h3>
          <form onSubmit={handleInvite} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium block mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Роль</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'manager')}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="admin">Администратор</option>
                <option value="manager">Менеджер</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isInviting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {isInviting ? '...' : 'Отправить'}
            </button>
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="px-4 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-muted"
            >
              Отмена
            </button>
          </form>
        </div>
      )}

      {/* Members list */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Сотрудник</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Роль</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Добавлен</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map(member => (
              <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-sm">{member.display_name || '—'}</div>
                  <div className="text-xs text-muted-foreground">{member.email}</div>
                </td>
                <td className="px-4 py-3">
                  {member.role === 'owner' ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                      {ROLE_LABELS[member.role]}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member, e.target.value as 'admin' | 'manager')}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border-none cursor-pointer ${ROLE_COLORS[member.role]}`}
                    >
                      <option value="admin">Администратор</option>
                      <option value="manager">Менеджер</option>
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(member.created_at).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {member.role === 'manager' && (
                      <button
                        onClick={() => openStoreAssignment(member)}
                        className="text-xs px-2 py-1 border rounded hover:bg-muted transition-colors"
                      >
                        Магазины
                      </button>
                    )}
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(member)}
                        className="text-xs px-2 py-1 text-destructive border border-destructive/30 rounded hover:bg-destructive/10 transition-colors"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.filter(i => !i.used_at).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Ожидающие приглашения</h2>
          <div className="space-y-2">
            {invites.filter(i => !i.used_at).map(invite => (
              <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                <div>
                  <span className="text-sm font-medium">{invite.email}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[invite.role]}`}>
                    {ROLE_LABELS[invite.role]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(invite.expires_at) > new Date()
                    ? `Действует до ${new Date(invite.expires_at).toLocaleDateString('ru-RU')}`
                    : 'Истекло'
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store assignment modal */}
      {editingMember && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setEditingMember(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl border shadow-lg p-6 w-full max-w-md z-50">
            <h3 className="font-semibold text-lg mb-1">
              Магазины: {editingMember.display_name || editingMember.email}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Выберите магазины, к которым у менеджера будет доступ
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stores.map(store => (
                <label
                  key={store.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={memberStores.includes(store.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setMemberStores([...memberStores, store.id]);
                      } else {
                        setMemberStores(memberStores.filter(id => id !== store.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{store.name}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-muted"
              >
                Отмена
              </button>
              <button
                onClick={saveStoreAssignment}
                disabled={isSavingStores}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {isSavingStores ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
