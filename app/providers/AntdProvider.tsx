'use client';

import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, useState } from 'react';

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const current = el.getAttribute('data-theme');
    setIsDark(current === 'dark');
    const observer = new MutationObserver(() => {
      setIsDark(el.getAttribute('data-theme') === 'dark');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return (
    <AntdRegistry>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#1677ff',
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
