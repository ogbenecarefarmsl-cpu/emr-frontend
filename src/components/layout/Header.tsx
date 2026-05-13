import { Bell, Search, Menu } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OfflineIndicator } from '@/components/offline/OfflineIndicator';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="bg-card/80 backdrop-blur-sm border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
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
            className="pl-10 w-64 h-9 bg-muted/50 border-transparent focus:border-border focus:bg-card transition-colors"
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
