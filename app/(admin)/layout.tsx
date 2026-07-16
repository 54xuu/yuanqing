import AntdProvider from '../providers/AntdProvider';
import AdminShell from './AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AntdProvider>
      <AdminShell>{children}</AdminShell>
    </AntdProvider>
  );
}
