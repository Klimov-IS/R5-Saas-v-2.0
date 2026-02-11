/**
 * Auth & Organization Database Helpers
 *
 * CRUD for organizations, org_members, invites, member_store_access.
 * Used by auth API routes and middleware.
 */

import { query, transaction } from './client';

// ============================================================================
// Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager';
  created_at: string;
}

export interface OrgMemberWithUser extends OrgMember {
  email: string;
  display_name: string | null;
}

export interface Invite {
  id: string;
  org_id: string;
  email: string;
  role: 'admin' | 'manager';
  token: string;
  invited_by: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface MemberStoreAccess {
  id: string;
  member_id: string;
  store_id: string;
}

// ============================================================================
// Users (auth-related queries)
// ============================================================================

export async function getUserByEmail(email: string) {
  const result = await query<{
    id: string;
    email: string;
    password_hash: string | null;
    display_name: string | null;
    is_approved: boolean;
  }>(
    'SELECT id, email, password_hash, display_name, is_approved FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

export async function getUserById(userId: string) {
  const result = await query<{
    id: string;
    email: string;
    display_name: string | null;
    is_approved: boolean;
  }>(
    'SELECT id, email, display_name, is_approved FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO users (id, email, password_hash, display_name, is_approved)
     VALUES (gen_random_uuid()::text, $1, $2, $3, TRUE)
     RETURNING id`,
    [data.email, data.passwordHash, data.displayName]
  );
  return result.rows[0].id;
}

export async function setUserPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, userId]
  );
}

// ============================================================================
// Organizations
// ============================================================================

export async function createOrganization(name: string, ownerId: string): Promise<Organization> {
  const result = await query<Organization>(
    `INSERT INTO organizations (id, name, owner_id)
     VALUES (gen_random_uuid()::text, $1, $2)
     RETURNING *`,
    [name, ownerId]
  );
  return result.rows[0];
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const result = await query<Organization>(
    'SELECT * FROM organizations WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// ============================================================================
// Organization Members
// ============================================================================

export async function addOrgMember(
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'manager'
): Promise<OrgMember> {
  const result = await query<OrgMember>(
    `INSERT INTO org_members (id, org_id, user_id, role)
     VALUES (gen_random_uuid()::text, $1, $2, $3)
     RETURNING *`,
    [orgId, userId, role]
  );
  return result.rows[0];
}

export async function getOrgMemberByUserId(userId: string): Promise<(OrgMember & { org_name: string }) | null> {
  const result = await query<OrgMember & { org_name: string }>(
    `SELECT om.*, o.name as org_name
     FROM org_members om
     JOIN organizations o ON om.org_id = o.id
     WHERE om.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function getOrgMembers(orgId: string): Promise<OrgMemberWithUser[]> {
  const result = await query<OrgMemberWithUser>(
    `SELECT om.*, u.email, u.display_name
     FROM org_members om
     JOIN users u ON om.user_id = u.id
     WHERE om.org_id = $1
     ORDER BY
       CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 END,
       om.created_at`,
    [orgId]
  );
  return result.rows;
}

export async function updateMemberRole(
  memberId: string,
  role: 'admin' | 'manager'
): Promise<OrgMember | null> {
  const result = await query<OrgMember>(
    `UPDATE org_members SET role = $1 WHERE id = $2 AND role != 'owner' RETURNING *`,
    [role, memberId]
  );
  return result.rows[0] || null;
}

export async function removeMember(memberId: string): Promise<boolean> {
  // Can't remove owner
  const result = await query(
    `DELETE FROM org_members WHERE id = $1 AND role != 'owner'`,
    [memberId]
  );
  return (result.rowCount || 0) > 0;
}

// ============================================================================
// Member Store Access (for managers)
// ============================================================================

export async function getMemberStoreAccess(memberId: string): Promise<string[]> {
  const result = await query<{ store_id: string }>(
    'SELECT store_id FROM member_store_access WHERE member_id = $1',
    [memberId]
  );
  return result.rows.map(r => r.store_id);
}

export async function setMemberStoreAccess(memberId: string, storeIds: string[]): Promise<void> {
  await transaction(async (client) => {
    await client.query('DELETE FROM member_store_access WHERE member_id = $1', [memberId]);
    for (const storeId of storeIds) {
      await client.query(
        `INSERT INTO member_store_access (id, member_id, store_id)
         VALUES (gen_random_uuid()::text, $1, $2)`,
        [memberId, storeId]
      );
    }
  });
}

/**
 * Get store IDs accessible by a user, considering their role.
 * Owner/Admin: all org stores. Manager: only assigned stores.
 */
export async function getAccessibleStoreIds(userId: string): Promise<string[]> {
  const member = await getOrgMemberByUserId(userId);
  if (!member) return [];

  if (member.role === 'owner' || member.role === 'admin') {
    // All stores in the organization
    const result = await query<{ id: string }>(
      'SELECT id FROM stores WHERE org_id = $1',
      [member.org_id]
    );
    return result.rows.map(r => r.id);
  }

  // Manager: only assigned stores
  return getMemberStoreAccess(member.id);
}

// ============================================================================
// Invites
// ============================================================================

export async function createInvite(data: {
  orgId: string;
  email: string;
  role: 'admin' | 'manager';
  token: string;
  invitedBy: string;
}): Promise<Invite> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const result = await query<Invite>(
    `INSERT INTO invites (id, org_id, email, role, token, invited_by, expires_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.orgId, data.email, data.role, data.token, data.invitedBy, expiresAt.toISOString()]
  );
  return result.rows[0];
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  const result = await query<Invite>(
    'SELECT * FROM invites WHERE token = $1',
    [token]
  );
  return result.rows[0] || null;
}

export async function getOrgInvites(orgId: string): Promise<Invite[]> {
  const result = await query<Invite>(
    `SELECT * FROM invites WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );
  return result.rows;
}

export async function markInviteUsed(inviteId: string): Promise<void> {
  await query(
    'UPDATE invites SET used_at = NOW() WHERE id = $1',
    [inviteId]
  );
}

/**
 * Register a new user from an invite (transactional).
 * Creates user, org_member, user_settings, marks invite as used.
 */
export async function registerFromInvite(data: {
  invite: Invite;
  displayName: string;
  passwordHash: string;
}): Promise<{ userId: string; memberId: string }> {
  return transaction(async (client) => {
    // 1. Create user
    const userResult = await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, is_approved)
       VALUES (gen_random_uuid()::text, $1, $2, $3, TRUE)
       RETURNING id`,
      [data.invite.email, data.passwordHash, data.displayName]
    );
    const userId = userResult.rows[0].id;

    // 2. Create user_settings (required for the system to work)
    await client.query(
      `INSERT INTO user_settings (id, deepseek_api_key)
       VALUES ($1, '')`,
      [userId]
    );

    // 3. Add to org_members
    const memberResult = await client.query(
      `INSERT INTO org_members (id, org_id, user_id, role)
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       RETURNING id`,
      [data.invite.org_id, userId, data.invite.role]
    );
    const memberId = memberResult.rows[0].id;

    // 4. Mark invite as used
    await client.query(
      'UPDATE invites SET used_at = NOW() WHERE id = $1',
      [data.invite.id]
    );

    return { userId, memberId };
  });
}
