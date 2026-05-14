import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  FileText, 
  Cpu, 
  Settings,
  FlaskConical,
  UserPlus,
  CreditCard,
  TestTube,
  FileCheck,
  BarChart3,
  Shield,
  LucideIcon,
  LogOut,
  Calculator,
  FileEdit,
  BookOpen,
  Printer,
  FileBarChart,
  Stethoscope,
  Tag,
  UserRoundCog,
  Pill,
  Package,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/lis';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Shield, label: 'Staff & Roles' },
    { to: '/admin/patients', icon: Users, label: 'Patients' },
    { to: '/admin/orders', icon: ClipboardList, label: 'Clinical Orders' },
    { to: '/admin/payments', icon: CreditCard, label: 'Billing & Payments' },
    { to: '/inventory', icon: Package, label: 'Inventory Status' },
    { to: '/admin/doctors', icon: UserRoundCog, label: 'Doctors' },
    { to: '/admin/reports', icon: BarChart3, label: 'Revenue Reports' },
    { to: '/admin/daily-report', icon: FileBarChart, label: 'Daily Summary' },
    { to: '/admin/reconciliation', icon: Calculator, label: 'Cash Reconciliation' },
    { to: '/admin/audit-logs', icon: FileCheck, label: 'Audit Logs' },
    { to: '/admin/test-catalog', icon: FlaskConical, label: 'Lab Test Pricing' },
    { to: '/admin/results', icon: FileText, label: 'Released Lab Results' },
    { to: '/admin/report-template', icon: FileEdit, label: 'Report Templates' },
    { to: '/admin/machines', icon: Cpu, label: 'Lab Machines' },
    { to: '/admin/printers', icon: Printer, label: 'Printers' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
  ],
  receptionist: [
    { to: '/reception', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/reception/register', icon: UserPlus, label: 'Register Patient' },
    { to: '/reception/visit-registration', icon: ClipboardCheck, label: 'Create Visit' },
    { to: '/reception/patients', icon: Users, label: 'Patients' },
    { to: '/reception/payments', icon: CreditCard, label: 'Billing & Payments' },
    { to: '/reception', icon: ClipboardList, label: 'Vitals & Queue' },
    { to: '/reception/price-list', icon: Tag, label: 'Service Pricing' },
    { to: '/reception/doctors', icon: UserRoundCog, label: 'Doctor Directory' },
    { to: '/reception/daily-report', icon: FileBarChart, label: 'Daily Summary' },
    { to: '/reception/reconciliation', icon: Calculator, label: 'Cash Reconciliation' },
    { to: '/reception/printer', icon: Printer, label: 'Printer Setup' },
  ],
  lab_tech: [
    { to: '/lab', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/lab/match-results', icon: FlaskConical, label: 'Match Results' },
    { to: '/lab/pending', icon: ClipboardList, label: 'Paid Lab Queue' },
    { to: '/lab/collect', icon: TestTube, label: 'Sample Collection' },
    { to: '/lab/processing', icon: FlaskConical, label: 'Enter Results' },
    { to: '/lab/completed-orders', icon: FileEdit, label: 'Released Results' },
    { to: '/lab/patients', icon: Users, label: 'Patients' },
    { to: '/lab/machines', icon: Cpu, label: 'Lab Machines' },
    { to: '/lab/test-catalog', icon: BookOpen, label: 'Lab Test Catalog' },
  ],
  doctor: [
    { to: '/doctor', icon: Stethoscope, label: 'Consultations' },
    { to: '/patient/search', icon: Users, label: 'Patient History' },
  ],
  specialist: [
    { to: '/doctor', icon: Stethoscope, label: 'Consultations' },
    { to: '/patient/search', icon: Users, label: 'Patient History' },
  ],
  nurse: [
    { to: '/nurse', icon: ClipboardCheck, label: 'Triage & Admissions' },
    { to: '/patient/search', icon: Users, label: 'Patients' },
  ],
  pharmacist: [
    { to: '/pharmacy', icon: Pill, label: 'Dispensing' },
    { to: '/pharmacy/inventory', icon: Package, label: 'Inventory' },
  ],
  inventory_manager: [
    { to: '/inventory', icon: Package, label: 'Inventory Dashboard' },
  ],
};

interface RoleSidebarProps {
  role: UserRole;
  userName?: string;
  onClose?: () => void;
}

export function RoleSidebar({ role, userName, onClose }: RoleSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const navItems = roleNavItems[role];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-screen">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/harbour-emr-logo.svg" 
              alt="Harbour EMR Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>
          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* User Info */}
      {userName && (
        <div className="px-6 py-3 border-b border-sidebar-border bg-sidebar-accent/30">
          <p className="text-xs text-sidebar-foreground/60">Logged in as</p>
          <p className="font-medium text-sm">{userName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                isActive 
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/25 font-semibold' 
                  : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium'
              )}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </Button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/50">
          <p>Harbour EMR v1.0.0</p>
          <p>HL7 • ASTM • FHIR Compatible</p>
        </div>
      </div>
    </aside>
  );
}
