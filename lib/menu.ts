import type { UserRole } from './db';
import { PERMISSIONS, type Permission, roleHasPermission } from './permissions';

export type MenuItemDef = {
  path: string;
  name: string;
  icon?: string;
  permission: Permission;
  adminOnly?: boolean;
};

/** Central menu registry — add new features here. */
export const MENU_ITEMS: MenuItemDef[] = [
  {
    path: '/',
    name: '知识库',
    icon: 'BookOutlined',
    permission: PERMISSIONS.notesRead,
  },
  {
    path: '/memories',
    name: '记忆管理',
    icon: 'BulbOutlined',
    permission: PERMISSIONS.memoriesRead,
  },
  {
    path: '/skills',
    name: 'Skill 管理',
    icon: 'AppstoreOutlined',
    permission: PERMISSIONS.skillsRead,
  },
  {
    path: '/api-keys',
    name: 'API 密钥',
    icon: 'KeyOutlined',
    permission: PERMISSIONS.apiKeysManage,
  },
  {
    path: '/users',
    name: '用户管理',
    icon: 'TeamOutlined',
    permission: PERMISSIONS.usersManage,
    adminOnly: true,
  },
  {
    path: '/settings',
    name: '个人设置',
    icon: 'SettingOutlined',
    permission: PERMISSIONS.settingsManage,
  },
];

export function getMenuForRole(role: UserRole): MenuItemDef[] {
  return MENU_ITEMS.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false;
    return roleHasPermission(role, item.permission);
  });
}
