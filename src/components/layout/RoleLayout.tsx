import { ReactNode, useState } from 'react';
import { RoleSidebar } from './RoleSidebar';
import { Header } from './Header';
import { UpdateBanner } from './UpdateBanner';
import { UserRole } from '@/types/lis';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  role: UserRole;
  userName?: string;
  doctorMode?: boolean;
  onExitDoctorMode?: () => void;
}

export function RoleLayout({ children, title, subtitle, role, userName, doctorMode, onExitDoctorMode }: RoleLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen clinical-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-[width,transform] duration-200 ease-in-out
        ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <RoleSidebar
          role={role}
          userName={userName}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          doctorMode={doctorMode}
          onExitDoctorMode={onExitDoctorMode}
        />
      </div>

      {/* Main content */}
      <div className={`
        min-h-screen flex flex-col transition-[margin] duration-200
        ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
      `}>
        {/* Mobile header bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-9 w-9 rounded-full">
            <Menu className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:block">
          <Header
            title={title}
            subtitle={subtitle}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
            role={role}
          />
        </div>

        <UpdateBanner />

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
