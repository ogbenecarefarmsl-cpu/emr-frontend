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
  ShieldOff,
  LucideIcon,
  LogOut,
  Calculator,
  FileEdit,
  BookOpen,
  Printer,
  FileBarChart,
  Stethoscope,
  Clock,
  Tag,
  UserRoundCog,
  Pill,
  Package,
  ClipboardCheck,
  BedDouble,
  HeartPulse,
  Building2,
  Receipt,
  ArrowLeftToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIS_LOGO_ALT, LIS_LOGO_URL } from '@/lib/branding';
import { UserRole } from '@/types/lis';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Shield, label: 'Staff & Roles' },
    { to: '/admin/branches', icon: Building2, label: 'Branches & APIs' },
    { to: '/admin/service-pricing', icon: Tag, label: 'Service Pricing' },
    { to: '/admin/patients', icon: Users, label: 'Patients' },
    { to: '/admin/orders', icon: ClipboardList, label: 'Clinical Orders' },
    { to: '/admin/payments', icon: CreditCard, label: 'Billing & Payments' },
    { to: '/admin/insurance', icon: Shield, label: 'Insurance Programs' },
    { to: '/admin/insurance-claims', icon: FileCheck, label: 'Insurance Claims' },
    { to: '/admin/insurance-blocks', icon: ShieldOff, label: 'Insurance Block List' },
    { to: '/admin/doctors', icon: UserRoundCog, label: 'Doctors' },
    { to: '/admin/rooms', icon: BedDouble, label: 'Rooms & Beds' },
    { to: '/admin/management-kpis', icon: BarChart3, label: 'Management KPIs' },
    { to: '/admin/reconciliation', icon: Calculator, label: 'Cash Reconciliation' },
    { to: '/admin/results', icon: FileText, label: 'Released Lab Results' },
    { to: '/admin/report-template', icon: FileEdit, label: 'Report Templates' },
    { to: '/admin/printers', icon: Printer, label: 'Printers' },
    { to: '/admin/audit-logs', icon: FileCheck, label: 'Audit Logs' },
    { to: '/admin/connection-settings', icon: Settings, label: 'Settings' },
  ],
  receptionist: [
    { to: '/reception', icon: LayoutDashboard, label: 'Reception Home' },
    { to: '/reception/register', icon: UserPlus, label: 'Register Patient' },
    { to: '/reception/visit-registration', icon: ClipboardCheck, label: 'Start Visit' },
    { to: '/reception/patients', icon: Users, label: 'Find Patient' },
    { to: '/reception/payments', icon: CreditCard, label: 'Collect Payments' },
    { to: '/reception/walk-in-receipt', icon: Receipt, label: 'Walk-in Sale' },
    { to: '/reception/treatment-plans', icon: ClipboardList, label: 'Plan Payments' },
    { to: '/reception/orders', icon: ClipboardList, label: 'Order Payments' },
    { to: '/reception/dispensing', icon: Pill, label: 'Give Medicines' },
    { to: '/reception/lab-reports', icon: FileText, label: 'Print Results' },
    { to: '/reception/referral-letters', icon: FileCheck, label: 'Print Referrals' },
    { to: '/reception/price-list', icon: Tag, label: 'Price List' },
    { to: '/reception/doctors', icon: UserRoundCog, label: 'Doctors' },
    { to: '/reception/daily-report', icon: FileBarChart, label: 'End-of-Day Report' },
    { to: '/reception/reconciliation', icon: Calculator, label: 'Close Cash' },
    { to: '/reception/printer', icon: Printer, label: 'Printer' },
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
    { to: '/doctor/treatment-plans', icon: ClipboardList, label: 'Treatment Plans' },
    { to: '/patient/search', icon: Users, label: 'Patient History' },
  ],
  specialist: [
    { to: '/doctor', icon: Stethoscope, label: 'Consultations' },
    { to: '/doctor/treatment-plans', icon: ClipboardList, label: 'Treatment Plans' },
    { to: '/patient/search', icon: Users, label: 'Patient History' },
  ],
  nurse: [
    { to: '/nurse', icon: LayoutDashboard, label: 'Nurse Station' },
    { to: '/nurse/triage', icon: ClipboardCheck, label: 'Triage' },
    { to: '/nurse/admissions', icon: BedDouble, label: 'Admissions' },
    { to: '/nurse/lab-requests', icon: FlaskConical, label: 'Test Orders' },
    { to: '/nurse/prescriptions', icon: Pill, label: 'Prescriptions' },
    { to: '/nurse/treatment-plans', icon: ClipboardList, label: 'Treatment Plans' },
    { to: '/nurse/mar', icon: Pill, label: 'MAR' },
    { to: '/nurse/observation', icon: HeartPulse, label: 'Observation' },
    { to: '/nurse/procedures', icon: ClipboardList, label: 'Procedures' },
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

// Grouped navigation for receptionist role
const receptionistGroupedNav: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/reception', icon: LayoutDashboard, label: 'Reception Home' },
    ],
  },
  {
    label: 'Patient Care',
    items: [
      { to: '/reception/register', icon: UserPlus, label: 'Register Patient' },
      { to: '/reception/visit-registration', icon: ClipboardCheck, label: 'Start Visit' },
      { to: '/reception/patients', icon: Users, label: 'Find Patient' },
      { to: '/reception/doctors', icon: UserRoundCog, label: 'Doctors' },
    ],
  },
  {
    label: 'Payments',
    items: [
      { to: '/reception/payments', icon: CreditCard, label: 'Collect Payments' },
      { to: '/reception/walk-in-receipt', icon: Receipt, label: 'Walk-in Sale' },
      { to: '/reception/treatment-plans', icon: ClipboardList, label: 'Treatment Plans' },
      { to: '/reception/orders', icon: ClipboardList, label: 'Clinical Orders' },
    ],
  },
  {
    label: 'Documents',
    items: [
      { to: '/reception/dispensing', icon: Pill, label: 'Give Medicines' },
      { to: '/reception/lab-reports', icon: FileText, label: 'Lab Reports' },
      { to: '/reception/referral-letters', icon: FileCheck, label: 'Referral Letters' },
      { to: '/reception/price-list', icon: Tag, label: 'Price List' },
    ],
  },
  {
    label: 'End of Day',
    items: [
      { to: '/reception/daily-report', icon: FileBarChart, label: 'Daily Report' },
      { to: '/reception/reconciliation', icon: Calculator, label: 'Cash Reconciliation' },
      { to: '/reception/printer', icon: Printer, label: 'Printer Setup' },
    ],
  },
];

interface RoleSidebarProps {
  role: UserRole;
  userName?: string;
  onClose?: () => void;
  collapsed?: boolean;
  doctorMode?: boolean;
  onExitDoctorMode?: () => void;
}

export function RoleSidebar({ role, userName, onClose, collapsed = false, doctorMode, onExitDoctorMode }: RoleSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const navItems = roleNavItems[role];
  const isReceptionist = role === 'receptionist';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const openDoctorWorklist = (section: 'waiting' | 'active' | 'results') => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('doctor-worklist:open', { detail: { section } }));
    }
    onClose?.();
  };

  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground flex flex-col h-screen transition-[width] duration-200 overflow-hidden border-r border-sidebar-border",
      collapsed ? "lg:w-20 w-64" : "w-64"
    )}>
      {/* Logo */}
      <div className={cn("border-b border-sidebar-border", collapsed ? "lg:p-4 p-5" : "p-5")}>
        <div className={cn("flex items-center justify-between", collapsed && "lg:justify-center")}>
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src={LIS_LOGO_URL}
              alt={LIS_LOGO_ALT}
              className={cn("h-12 max-w-[190px] w-auto object-contain transition-all", collapsed && "lg:h-9 lg:max-w-12")}
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
      {userName && !collapsed && (
        <div className="px-5 py-3 border-b border-sidebar-border bg-sidebar-accent/40">
          <p className="clinical-label text-sidebar-foreground/60">Logged in as</p>
          <p className="font-medium text-sm">{userName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 py-4 space-y-0.5 overflow-y-auto", collapsed ? "lg:px-3 px-3" : "px-3")}>
        {isReceptionist && !collapsed ? (
          // Grouped navigation for receptionist
          <>
            {receptionistGroupedNav.map((group, groupIdx) => (
              <div key={group.label} className={cn(groupIdx > 0 && "pt-4 mt-4 border-t border-sidebar-border/50")}>
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ to, icon: Icon, label }) => {
                    const isActive = location.pathname === to;
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border-l-2 border-transparent',
                          isActive 
                            ? 'border-sidebar-primary bg-sidebar-primary/15 text-sidebar-foreground font-semibold'
                            : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium'
                        )}
                      >
                        <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
                        <span className="clinical-label text-current">{label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        ) : (
          // Flat navigation for other roles or collapsed receptionist
          <>
            {navItems.map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname === to;
              return (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border-l-2 border-transparent',
                    collapsed && 'lg:justify-center lg:px-2',
                    isActive 
                      ? 'border-sidebar-primary bg-sidebar-primary/15 text-sidebar-foreground font-semibold'
                      : 'hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium'
                  )}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
                  <span className={cn("clinical-label text-current", collapsed && "lg:hidden")}>{label}</span>
                </NavLink>
              );
            })}
          </>
        )}
        {(role === 'doctor' || role === 'specialist') && (
          <div className={cn("pt-3 mt-3 border-t border-sidebar-border/70 space-y-0.5", collapsed && "lg:pt-2 lg:mt-2")}>
            {!collapsed && (
              <p className="px-3 pb-1 clinical-label text-sidebar-foreground/50">Worklist</p>
            )}
            <button
              type="button"
              onClick={() => openDoctorWorklist('waiting')}
              title={collapsed ? 'Waiting Patients' : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium',
                collapsed && 'lg:justify-center lg:px-2'
              )}
            >
              <Clock className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
              <span className={cn("clinical-label text-current", collapsed && "lg:hidden")}>Waiting Patients</span>
            </button>
            <button
              type="button"
              onClick={() => openDoctorWorklist('active')}
              title={collapsed ? "Patients I'm Seeing" : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium',
                collapsed && 'lg:justify-center lg:px-2'
              )}
            >
              <Stethoscope className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
              <span className={cn("clinical-label text-current", collapsed && "lg:hidden")}>Patients I'm Seeing</span>
            </button>
            <button
              type="button"
              onClick={() => openDoctorWorklist('results')}
              title={collapsed ? 'Results Ready' : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium',
                collapsed && 'lg:justify-center lg:px-2'
              )}
            >
              <FlaskConical className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
              <span className={cn("clinical-label text-current", collapsed && "lg:hidden")}>Results Ready</span>
            </button>
          </div>
        )}
      </nav>

      {/* Exit Doctor Mode + Logout */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {doctorMode && onExitDoctorMode && (
          <Button
            onClick={onExitDoctorMode}
            variant="ghost"
            title={collapsed ? 'Exit Doctor Mode' : undefined}
            className={cn(
              "w-full gap-3 text-amber-600 hover:bg-amber-50 hover:text-amber-700",
              collapsed ? "lg:justify-center lg:px-2 justify-start" : "justify-start"
            )}
          >
            <ArrowLeftToLine className="w-5 h-5" />
            <span className={cn("font-medium", collapsed && "lg:hidden")}>Exit Doctor Mode</span>
          </Button>
        )}
        <Button
          onClick={handleLogout}
          variant="ghost"
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            "w-full gap-3 text-sidebar-foreground hover:bg-sidebar-accent",
            collapsed ? "lg:justify-center lg:px-2 justify-start" : "justify-start"
          )}
        >
          <LogOut className="w-5 h-5" />
          <span className={cn("font-medium", collapsed && "lg:hidden")}>Logout</span>
        </Button>
      </div>

      {/* Footer */}
      <div className={cn("p-4 border-t border-sidebar-border", collapsed && "lg:hidden")}>
        <div className="text-xs text-sidebar-foreground/50">
          <p>Harbour EMR v1.0.0</p>
          <p>HL7 • ASTM • FHIR Compatible</p>
        </div>
      </div>
    </aside>
  );
}
