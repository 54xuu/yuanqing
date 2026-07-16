import type { UserRole } from './db';

/** Permission keys for fine-grained access (extensible). */
export const PERMISSIONS = {
  notesRead: 'notes:read',
  notesWrite: 'notes:write',
  memoriesRead: 'memories:read',
  skillsRead: 'skills:read',
  skillsWrite: 'skills:write',
  apiKeysManage: 'api-keys:manage',
  usersManage: 'users:manage',
  settingsManage: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  user: [
    PERMISSIONS.notesRead,
    PERMISSIONS.notesWrite,
    PERMISSIONS.memoriesRead,
    PERMISSIONS.skillsRead,
    PERMISSIONS.skillsWrite,
    PERMISSIONS.apiKeysManage,
    PERMISSIONS.settingsManage,
  ],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin';
}
