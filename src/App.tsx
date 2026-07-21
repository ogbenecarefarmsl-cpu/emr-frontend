import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { SyncProvider } from "./context/SyncContext";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { RoleGuard } from "./components/auth/RoleGuard";
import { Loader2 } from "lucide-react";

// Pages
//pages
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Reception Pages
import ReceptionDashboard from "./pages/reception/ReceptionDashboard";
import PatientDetails from "./pages/reception/PatientDetails";
import RegisterPatient from "./pages/reception/RegisterPatient";
import PatientsPage from "./pages/reception/PatientsPage";
import OrdersPage from "./pages/reception/OrdersPage";
import PaymentsPage from "./pages/reception/PaymentsPage";
import DailyReconciliation from "./pages/reception/DailyReconciliation";
import AccountsReceivable from "./pages/reception/AccountsReceivable";
import PaymentReceipt from "./pages/reception/PaymentReceipt";
import PrinterSetup from "./pages/reception/PrinterSetup";
import PriceListPage from "./pages/reception/PriceListPage";
import PrescriptionReceipt from "./pages/reception/PrescriptionReceipt";
import VisitReceipt from "./pages/reception/VisitReceipt";
import WalkInReceipt from "./pages/reception/WalkInReceipt";
import VisitRegistration from "./pages/reception/VisitRegistration";
import ReceptionDispensePage from "./pages/reception/ReceptionDispensePage";
import ReceptionDispensingQueue from "./pages/reception/ReceptionDispensingQueue";
import ReceptionTreatmentPlans from "./pages/reception/ReceptionTreatmentPlans";
import ExpendituresPage from "./pages/reception/ExpendituresPage";
import AppointmentsPage from "./pages/reception/AppointmentsPage";
import ReferralLettersPage from "./pages/reception/ReferralLettersPage";

// Lab Pages
import LabDashboardPage from "./pages/lab/LabDashboardPage";
import EnterManualResults from "./pages/lab/EnterManualResults";
import ResultVerification from "./pages/lab/ResultVerification";
import QCDataEntry from "./pages/lab/QCDataEntry";
import CollectSamplesPage from "./pages/lab/CollectSamplesPage";
import EnterResultsPage from "./pages/lab/EnterResultsPage";
import CompletedOrdersPage from "./pages/lab/CompletedOrdersPage";
import EditableResultReport from "./pages/lab/EditableResultReport";
import LabReportPage from "./pages/lab/LabReportPage";
import PublicLabReportPage from "./pages/lab/PublicLabReportPage";
import MatchResults from "./pages/lab/MatchResults";

// Admin Pages
import CommunicationLogs from "./pages/admin/CommunicationLogs";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagementPage from "./pages/admin/UserManagementPage";
import BranchManagementPage from "./pages/admin/BranchManagementPage";
import InsuranceManagementPage from "./pages/admin/InsuranceManagementPage";
import AdminInsuranceClaimsPage from "./pages/admin/AdminInsuranceClaimsPage";
import InsuranceBlockListPage from "./pages/admin/InsuranceBlockListPage";
import Reports from "./pages/admin/Reports";
import TestCatalogManagement from "./pages/admin/TestCatalogManagement";
import ReconciliationReview from "./pages/admin/ReconciliationReview";
import DailyReport from "./pages/admin/DailyReport";
import DoctorReferralReport from "./pages/admin/DoctorReferralReport";
import AuditLogViewer from "./pages/admin/AuditLogViewer";
import ReportTemplateEditor from "./pages/admin/ReportTemplateEditor";
import PrinterSettings from "./pages/admin/PrinterSettings";
import DoctorsPage from "./pages/admin/DoctorsPage";
import RoomsPage from "./pages/admin/RoomsPage";
import ConnectionSettings from "./pages/admin/ConnectionSettings";
import ManagementKpisPage from "./pages/admin/ManagementKpisPage";
import ServicePricingPage from "./pages/admin/ServicePricingPage";

// Doctor Pages
import DoctorDashboard from "./pages/doctor/DoctorDashboard";


// Nurse Pages
import NurseDashboard from "./pages/nurse/NurseDashboard";
import NurseAdmissionsPage from "./pages/nurse/NurseAdmissionsPage";
import NurseMarPage from "./pages/nurse/NurseMarPage";
import NurseLabRequestsPage from "./pages/nurse/NurseLabRequestsPage";
import NursePrescriptionPage from "./pages/nurse/NursePrescriptionPage";
import NurseObservationPage from "./pages/nurse/NurseObservationPage";
import NurseProceduresPage from "./pages/nurse/NurseProceduresPage";
import NurseTriagePage from "./pages/nurse/NurseTriagePage";
import NurseTreatmentPlanPage from "./pages/nurse/NurseTreatmentPlanPage";
import DoctorTreatmentPlanPage from "./pages/doctor/DoctorTreatmentPlanPage";

// Pharmacy Pages
import PharmacyDashboard from "./pages/pharmacy/PharmacyDashboard";
import InventoryManagement from "./pages/pharmacy/InventoryManagement";

// Inventory Pages
import InventoryDashboard from "./pages/inventory/InventoryDashboard";

import { PrinterProvider } from "./context/PrinterContext";

// Shared Pages
import Machines from "./pages/Machines";
import Settings from "./pages/Settings";
import PatientRecord from "./pages/shared/PatientRecord";
import PatientSearch from "./pages/shared/PatientSearch";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep cached data for 24 hours in memory
      gcTime: 1000 * 60 * 60 * 24,
      // Consider data stale after 30 seconds (faster refresh)
      staleTime: 1000 * 30,
      // Retry transient failures, but fail auth errors immediately.
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
      // Refetch when reconnecting to network
      refetchOnReconnect: 'always',
      // Refetch on window focus so switching tabs/pages shows fresh data
      refetchOnWindowFocus: true,
      // Keep previous data while fetching new data (no flash of loading)
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 5000),
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, isLoading, primaryRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getDefaultRoute = () => {
    if (!isAuthenticated || !primaryRole) return '/login';
    switch (primaryRole) {
      case 'admin': return '/admin';
      case 'lab_tech': return '/lab';
      case 'receptionist': return '/reception';
      case 'doctor': return '/doctor';
      case 'specialist': return '/doctor';
      case 'nurse': return '/nurse';
      case 'pharmacist': return '/pharmacy';
      case 'inventory_manager': return '/inventory';
      default: return '/login';
    }
  };

  const forceDevLogin = import.meta.env.DEV && location.pathname === '/login' && location.search.includes('force=true');

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        isAuthenticated && primaryRole && !forceDevLogin ? (
          <Navigate to={getDefaultRoute()} replace />
        ) : <Login />
      } />

      {/* Reception Routes */}
      <Route path="/reception" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><ReceptionDashboard /></RoleGuard>
      } />
      <Route path="/reception/register" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><RegisterPatient /></RoleGuard>
      } />
      <Route path="/reception/patients" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><PatientsPage /></RoleGuard>
      } />
      <Route path="/reception/patients/:id" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><PatientDetails /></RoleGuard>
      } />
      <Route path="/reception/new-order" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><Navigate to={`/reception/visit-registration${location.search}`} replace /></RoleGuard>
      } />
      <Route path="/reception/orders" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><OrdersPage /></RoleGuard>
      } />
      <Route path="/reception/payments" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><PaymentsPage /></RoleGuard>
      } />
      <Route path="/reception/reconciliation" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><DailyReconciliation /></RoleGuard>
      } />
      <Route path="/reception/accounts-receivable" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><AccountsReceivable /></RoleGuard>
      } />
      <Route path="/reception/quick-result-entry" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><Navigate to="/reception/lab-reports" replace /></RoleGuard>
      } />
      <Route path="/reception/lab-reports" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><CompletedOrdersPage /></RoleGuard>
      } />
      <Route path="/reception/referral-letters" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><ReferralLettersPage /></RoleGuard>
      } />
      <Route path="/reception/receipt/:orderId" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><PaymentReceipt /></RoleGuard>
      } />
      <Route path="/reception/printer" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><PrinterSetup /></RoleGuard>
      } />
      <Route path="/reception/price-list" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><PriceListPage /></RoleGuard>
      } />
      <Route path="/reception/dispense/:id" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><ReceptionDispensePage /></RoleGuard>
      } />
      <Route path="/reception/dispensing" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><ReceptionDispensingQueue /></RoleGuard>
      } />
      <Route path="/reception/prescription-receipt/:id" element={
        <RoleGuard allowedRoles={['receptionist', 'admin', 'pharmacist']}><PrescriptionReceipt /></RoleGuard>
      } />
      <Route path="/reception/visit-receipt" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><VisitReceipt /></RoleGuard>
      } />
      <Route path="/reception/walk-in-receipt" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><WalkInReceipt /></RoleGuard>
      } />
      <Route path="/reception/treatment-plans" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><ReceptionTreatmentPlans /></RoleGuard>
      } />
      <Route path="/reception/visit-registration" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><VisitRegistration /></RoleGuard>
      } />
      <Route path="/reception/daily-report" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><DailyReport /></RoleGuard>
      } />
      <Route path="/reception/expenditures" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><ExpendituresPage /></RoleGuard>
      } />
      <Route path="/reception/appointments" element={
        <RoleGuard allowedRoles={['receptionist', 'admin', 'doctor', 'nurse']}><AppointmentsPage /></RoleGuard>
      } />
      <Route path="/reception/reports/:orderId" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><LabReportPage /></RoleGuard>
      } />

      {/* Lab Routes */}
      <Route path="/lab" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><LabDashboardPage /></RoleGuard>
      } />
      <Route path="/lab/match-results" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><MatchResults /></RoleGuard>
      } />
      <Route path="/lab/pending" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><CollectSamplesPage /></RoleGuard>
      } />
      <Route path="/lab/collect" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><CollectSamplesPage /></RoleGuard>
      } />
      <Route path="/lab/processing" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><EnterResultsPage /></RoleGuard>
      } />
      <Route path="/lab/enter-results" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><EnterManualResults /></RoleGuard>
      } />
      <Route path="/lab/completed-orders" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><CompletedOrdersPage /></RoleGuard>
      } />
      <Route path="/lab/patients" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><PatientsPage /></RoleGuard>
      } />
      <Route path="/lab/patients/:id" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><PatientDetails /></RoleGuard>
      } />
      <Route path="/lab/verify-results" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><ResultVerification /></RoleGuard>
      } />
      <Route path="/lab/qc" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><QCDataEntry /></RoleGuard>
      } />
      <Route path="/lab/machines" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><Machines /></RoleGuard>
      } />
      <Route path="/lab/test-catalog" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><TestCatalogManagement /></RoleGuard>
      } />
      <Route path="/lab/result-report/:id?" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin']}><EditableResultReport /></RoleGuard>
      } />
      <Route path="/lab/reports/:orderId" element={
        <RoleGuard allowedRoles={['lab_tech', 'admin', 'doctor', 'specialist', 'nurse']}><LabReportPage /></RoleGuard>
      } />
      <Route path="/public/lab/reports/:orderId" element={<PublicLabReportPage />} />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <RoleGuard allowedRoles={['admin']}><AdminDashboard /></RoleGuard>
      } />
      <Route path="/admin/users" element={
        <RoleGuard allowedRoles={['admin']}><UserManagementPage /></RoleGuard>
      } />
      <Route path="/admin/reports" element={
        <RoleGuard allowedRoles={['admin']}><Reports /></RoleGuard>
      } />
      <Route path="/admin/test-catalog" element={
        <RoleGuard allowedRoles={['admin']}><TestCatalogManagement /></RoleGuard>
      } />
      <Route path="/admin/communication-logs" element={
        <RoleGuard allowedRoles={['admin']}><CommunicationLogs /></RoleGuard>
      } />
      <Route path="/admin/audit-logs" element={
        <RoleGuard allowedRoles={['admin']}><AuditLogViewer /></RoleGuard>
      } />
      <Route path="/admin/reconciliation" element={
        <RoleGuard allowedRoles={['admin']}><ReconciliationReview /></RoleGuard>
      } />
      <Route path="/admin/daily-report" element={
        <RoleGuard allowedRoles={['admin']}><DailyReport /></RoleGuard>
      } />
      <Route path="/admin/doctor-referral-report" element={
        <RoleGuard allowedRoles={['admin']}><DoctorReferralReport /></RoleGuard>
      } />
      <Route path="/admin/management-kpis" element={
        <RoleGuard allowedRoles={['admin']}><ManagementKpisPage /></RoleGuard>
      } />
      <Route path="/reception/doctor-referral-report" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><DoctorReferralReport /></RoleGuard>
      } />
      <Route path="/admin/report-template" element={
        <RoleGuard allowedRoles={['admin']}><ReportTemplateEditor /></RoleGuard>
      } />
      <Route path="/admin/patients" element={
        <RoleGuard allowedRoles={['admin']}><PatientsPage /></RoleGuard>
      } />
      <Route path="/admin/patients/:id" element={
        <RoleGuard allowedRoles={['admin']}><PatientDetails /></RoleGuard>
      } />
      <Route path="/admin/orders" element={
        <RoleGuard allowedRoles={['admin']}><OrdersPage /></RoleGuard>
      } />
      <Route path="/admin/results" element={
        <RoleGuard allowedRoles={['admin']}><CompletedOrdersPage /></RoleGuard>
      } />
      <Route path="/admin/machines" element={
        <RoleGuard allowedRoles={['admin']}><Machines /></RoleGuard>
      } />
      <Route path="/admin/payments" element={
        <RoleGuard allowedRoles={['admin']}><PaymentsPage /></RoleGuard>
      } />
      <Route path="/admin/settings" element={
        <RoleGuard allowedRoles={['admin']}><Settings /></RoleGuard>
      } />
      <Route path="/admin/printers" element={
        <RoleGuard allowedRoles={['admin']}><PrinterSettings /></RoleGuard>
      } />
      <Route path="/admin/branches" element={
        <RoleGuard allowedRoles={['admin']}><BranchManagementPage /></RoleGuard>
      } />
      <Route path="/admin/insurance" element={
        <RoleGuard allowedRoles={['admin', 'receptionist']}><InsuranceManagementPage /></RoleGuard>
      } />
      <Route path="/admin/insurance-claims" element={
        <RoleGuard allowedRoles={['admin', 'receptionist']}><AdminInsuranceClaimsPage /></RoleGuard>
      } />
      <Route path="/admin/insurance-blocks" element={
        <RoleGuard allowedRoles={['admin']}><InsuranceBlockListPage /></RoleGuard>
      } />
      <Route path="/reception/insurance-blocks" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><InsuranceBlockListPage /></RoleGuard>
      } />
      <Route path="/admin/service-pricing" element={
        <RoleGuard allowedRoles={['admin']}><ServicePricingPage /></RoleGuard>
      } />
      <Route path="/admin/doctors" element={
        <RoleGuard allowedRoles={['admin']}><DoctorsPage /></RoleGuard>
      } />
      <Route path="/admin/rooms" element={
        <RoleGuard allowedRoles={['admin']}><RoomsPage /></RoleGuard>
      } />
      <Route path="/admin/connection-settings" element={
        <RoleGuard allowedRoles={['admin']}><ConnectionSettings /></RoleGuard>
      } />
      <Route path="/reception/doctors" element={
        <RoleGuard allowedRoles={['receptionist', 'admin']}><DoctorsPage /></RoleGuard>
      } />

      {/* Doctor Routes */}
      <Route path="/doctor" element={
        <RoleGuard allowedRoles={['doctor', 'specialist', 'admin']}><DoctorDashboard /></RoleGuard>
      } />
      <Route path="/doctor/prescribe/:consultationId" element={
        <RoleGuard allowedRoles={['doctor', 'specialist', 'admin']}><Navigate to="/doctor" replace /></RoleGuard>
      } />
      <Route path="/doctor/prescription/:consultationId" element={
        <RoleGuard allowedRoles={['doctor', 'specialist', 'admin']}><Navigate to="/doctor" replace /></RoleGuard>
      } />
      <Route path="/doctor/treatment-plans" element={
        <RoleGuard allowedRoles={['doctor', 'specialist', 'admin']}><DoctorTreatmentPlanPage /></RoleGuard>
      } />

      {/* Nurse Routes */}
      <Route path="/nurse" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseDashboard /></RoleGuard>
      } />
      <Route path="/nurse/triage" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseTriagePage /></RoleGuard>
      } />
      <Route path="/nurse/admissions" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseAdmissionsPage /></RoleGuard>
      } />
      <Route path="/nurse/mar" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseMarPage /></RoleGuard>
      } />
      <Route path="/nurse/lab-requests" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseLabRequestsPage /></RoleGuard>
      } />
      <Route path="/nurse/prescriptions" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NursePrescriptionPage /></RoleGuard>
      } />
      <Route path="/nurse/treatment-plans" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseTreatmentPlanPage /></RoleGuard>
      } />
      <Route path="/nurse/observation" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseObservationPage /></RoleGuard>
      } />
      <Route path="/nurse/procedures" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><NurseProceduresPage /></RoleGuard>
      } />
      <Route path="/nurse/reports/:orderId" element={
        <RoleGuard allowedRoles={['nurse', 'admin']}><LabReportPage /></RoleGuard>
      } />

      {/* Pharmacy Routes */}
      <Route path="/pharmacy" element={
        <RoleGuard allowedRoles={['pharmacist', 'admin', 'receptionist']}><PharmacyDashboard /></RoleGuard>
      } />
      <Route path="/pharmacy/inventory" element={
        <RoleGuard allowedRoles={['pharmacist', 'admin', 'receptionist']}><InventoryManagement /></RoleGuard>
      } />

      {/* Inventory Routes */}
      <Route path="/inventory" element={
        <RoleGuard allowedRoles={['inventory_manager', 'admin']}><InventoryDashboard /></RoleGuard>
      } />

      {/* Patient Record - Accessible by all roles */}
      <Route path="/patient/search" element={
        <RoleGuard allowedRoles={['admin', 'doctor', 'specialist', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'inventory_manager']}>
          <PatientSearch />
        </RoleGuard>
      } />
      <Route path="/patient/:patientId" element={
        <RoleGuard allowedRoles={['admin', 'doctor', 'specialist', 'nurse', 'receptionist', 'lab_tech', 'pharmacist', 'inventory_manager']}>
          <PatientRecord />
        </RoleGuard>
      } />

      {/* Default Route - Redirect based on auth state */}
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Use HashRouter for Electron (file:// protocol), BrowserRouter for web
const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
const Router = isElectron ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router
        {...(!isElectron ? {
          future: {
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          },
        } : {})}
      >
        <AuthProvider>
          <SyncProvider>
            <PrinterProvider>
              <WebSocketProvider>
                <ConnectionStatus />
                <AppRoutes />
              </WebSocketProvider>
            </PrinterProvider>
          </SyncProvider>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
