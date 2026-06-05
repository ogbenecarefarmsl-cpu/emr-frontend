import { Search, PanelLeftClose, PanelLeftOpen, Stethoscope } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/components/offline/OfflineIndicator';
import { UserRole } from '@/types/lis';

interface HeaderProps {
  title: string;
  subtitle?: string;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  role?: UserRole;
}

export function Header({ title, subtitle, sidebarCollapsed, onToggleSidebar, role }: HeaderProps) {
  return (
    <header className="bg-card border-b px-4 h-14 flex items-center justify-between sticky top-0 z-30">
      <div className="min-w-0 flex items-center gap-3">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex h-9 w-9 rounded-full"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-normal text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="clinical-label mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {role === 'nurse' && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            On duty
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Connection status */}
        <div className="hidden md:block">
          <OfflineIndicator />
        </div>

        {/* Search */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patients, orders..."
            className="pl-10 w-64 h-9 rounded-full bg-muted/50 border-border focus:bg-card transition-colors"
          />
        </div>

        {/* Mobile search trigger */}
        <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
          <Search className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
