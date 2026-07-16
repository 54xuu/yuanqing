'use client';

import { ProLayout } from '@ant-design/pro-components';
import {
  AppstoreOutlined,
  BookOutlined,
  BulbOutlined,
  KeyOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Dropdown, Spin } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_VERSION_LABEL } from '@/lib/version';
import { getMenuForRole } from '@/lib/menu';

const ICON_MAP: Record<string, React.ReactNode> = {
  BookOutlined: <BookOutlined />,
  BulbOutlined: <BulbOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  KeyOutlined: <KeyOutlined />,
  TeamOutlined: <TeamOutlined />,
  SettingOutlined: <SettingOutlined />,
};

type CurrentUser = {
  id: string;
  username: string;
  role: 'admin' | 'user';
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as
      | 'light'
      | 'dark'
      | null;
    if (current) setTheme(current);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, [router, pathname]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }, [router]);

  const menuRoutes = useMemo(() => {
    if (!user) return [];
    return getMenuForRole(user.role).map((item) => ({
      path: item.path,
      name: item.name,
      icon: item.icon ? ICON_MAP[item.icon] : undefined,
    }));
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!user) return null;

  return (
    <ProLayout
      title="源清 YuanQing"
      logo={false}
      layout="mix"
      fixSiderbar
      location={{ pathname: pathname || '/' }}
      route={{ path: '/', routes: menuRoutes }}
      menuItemRender={(item, dom) => {
        if (item.path) {
          return <Link href={item.path}>{dom}</Link>;
        }
        return dom;
      }}
      avatarProps={{
        title: user.username,
        render: (_props, dom) => (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'theme',
                  icon: theme === 'light' ? <MoonOutlined /> : <SunOutlined />,
                  label: theme === 'light' ? '深色模式' : '浅色模式',
                  onClick: toggleTheme,
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: logout,
                },
              ],
            }}
          >
            {dom}
          </Dropdown>
        ),
      }}
      headerContentRender={() => (
        <span style={{ marginLeft: 16, opacity: 0.65, fontSize: 12 }}>{APP_VERSION_LABEL}</span>
      )}
      contentStyle={{ margin: 0, padding: 0, minHeight: 'calc(100vh - 56px)' }}
    >
      {children}
    </ProLayout>
  );
}
