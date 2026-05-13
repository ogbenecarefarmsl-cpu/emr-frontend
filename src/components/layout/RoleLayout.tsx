import { ReactNode, useState } from 'react';
import { RoleSidebar } from './RoleSidebar';
import { Header } from './Header';
import { UpdateBanner } from './UpdateBanner';
import { UserRole } from '@/types/lis';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  role: UserRole;
  userName?: string;
}

export function RoleLayout({ children, title, subtitle, role, userName }: RoleLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on lg+ */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <RoleSidebar role={role} userName={userName} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Mobile header bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-card border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-9 w-9">
            <Menu className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:block">
          <Header title={title} subtitle={subtitle} />
        </div>

        <UpdateBanner />

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
