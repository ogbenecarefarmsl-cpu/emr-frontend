import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useDoctorReferralReport } from '@/hooks/useReconciliation';
import { useDoctors } from '@/hooks/useDoctors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2, FileDown, Search, Stethoscope, Users, Banknote, Tag, ClipboardList } from 'lucide-react';

export default function DoctorReferralReport() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const role = pathname.startsWith('/reception') ? 'receptionist' : 'admin';
  const reportRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [doctorId, setDoctorId] = useState('all');
  const [monthFilter, setMonthFilter] = useState(thisMonth);
  const { data: doctors = [] } = useDoctors();
  const [appliedParams, setAppliedParams] = useState<{ startDate: string; endDate: string; doctor: string; doctorId?: string }>({
    startDate: today,
    endDate: today,
    doctor: '',
    doctorId: undefined,
  });

  const { data: report, isLoading } = useDoctorReferralReport({
    startDate: appliedParams.startDate,
    endDate: appliedParams.endDate,
    doctor: appliedParams.doctor || undefined,
    doctorId: appliedParams.doctorId,
  });

  const handleSearch = () => {
    setAppliedParams({
      startDate,
      endDate,
      doctor: doctorFilter,
      doctorId: doctorId !== 'all' ? doctorId : undefined,
    });
  };

  const openPrintWindow = (rows: any[], doctorName?: string) => {
    if (!reportRef.current || !report || rows.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateRange =
      appliedParams.startDate === appliedParams.endDate
        ? format(new Date(appliedParams.startDate + 'T00:00:00'), 'MMMM dd, yyyy')
        : `${format(new Date(appliedParams.startDate + 'T00:00:00'), 'MMM dd')} - ${format(new Date(appliedParams.endDate + 'T00:00:00'), 'MMM dd, yyyy')}`;

    const L = (n: number) => (n || 0).toLocaleString();
    const totalOrders = rows.length;
    const totalBilled = rows.reduce((s, r) => s + (r.total || 0), 0);
    const totalDiscount = rows.reduce((s, r) => s + (r.discount || 0), 0);
    const totalPaid = rows.reduce((s, r) => s + (r.amountPaid || 0), 0);

    const detailRows = rows
      .map((r) => {
        const date = r.date ? format(new Date(r.date), 'dd/MM/yy') : '-';
        const badge =
          r.paymentStatus === 'paid'
            ? `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px;font-size:10px">${r.paymentStatus}</span>`
            : `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:999px;font-size:10px">${r.paymentStatus}</span>`;

        return `<tr>
          <td>${date}</td>
          <td>${r.orderNumber}</td>
          <td>${r.patientName}</td>
          <td>${r.doctor}</td>
          <td>${r.tests}</td>
          <td class="text-right">Le ${L(r.total)}</td>
          <td class="text-right">Le ${L(r.discount)}</td>
          <td class="text-right">Le ${L(r.amountPaid)}</td>
          <td class="text-center">${badge}</td>
        </tr>`;
      })
      .join('');

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Doctor Report - ${doctorName || 'All Doctors'}</title>
      <style>
        * { box-sizing:border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding:24px; color:#0f172a; font-size:11px; }
        .header { margin-bottom:16px; }
        h2 { margin:0; font-size:18px; }
        .sub { color:#475569; margin-top:4px; }
        .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin:12px 0 16px; }
        .card { border:1px solid #e2e8f0; border-radius:8px; padding:8px; text-align:center; }
        .val { font-size:14px; font-weight:700; }
        .lbl { font-size:10px; color:#64748b; }
        .tbl-wrap { border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
        table { width:100%; border-collapse:collapse; }
        th, td { padding:8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
        th { background:#f8fafc; text-align:left; font-weight:600; }
        .text-right { text-align:right; }
        .text-center { text-align:center; }
        @media print { body { padding:10px; } }
      </style>
    </head><body>
      <div class="header">
        <h2>Hobour Diagnostics - Doctor Referral Report</h2>
        <div class="sub">${dateRange}${doctorName ? ` | Doctor: ${doctorName}` : ''}</div>
      </div>

      <div class="cards">
        <div class="card"><div class="val">${totalOrders}</div><div class="lbl">Orders</div></div>
        <div class="card"><div class="val">Le ${L(totalBilled)}</div><div class="lbl">Billed</div></div>
        <div class="card"><div class="val">Le ${L(totalDiscount)}</div><div class="lbl">Discount</div></div>
        <div class="card"><div class="val">Le ${L(totalPaid)}</div><div class="lbl">Paid</div></div>
      </div>

      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Order #</th><th>Patient</th><th>Doctor</th><th>Tests</th>
              <th class="text-right">Billed</th><th class="text-right">Discount</th><th class="text-right">Paid</th><th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </body></html>`);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleExportPDF = () => {
    if (!report) return;
    openPrintWindow(report.rows);
  };

  const handleExportDoctor = (doctorName: string) => {
    if (!report) return;
    const rows = report.rows.filter((r: any) => r.doctor === doctorName);
    openPrintWindow(rows, doctorName);
  };

  return (
    <RoleLayout
      title="Doctor Referral Report"
      subtitle="Orders grouped by referring doctor - patient, tests ordered, discounts and payments"
      role={role as any}
      userName={profile?.full_name}
    >
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
          <Input type="date" value={startDate} max={today} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
          <Input type="date" value={endDate} max={today} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Month</Label>
          <Input
            type="month"
            value={monthFilter}
            onChange={(e) => {
              const month = e.target.value;
              setMonthFilter(month);
              if (!month) return;
              const start = new Date(`${month}-01T00:00:00`);
              const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
              setStartDate(start.toISOString().slice(0, 10));
              setEndDate(end.toISOString().slice(0, 10));
            }}
            className="w-40"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Doctor (optional filter)</Label>
          <div className="flex gap-2">
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {doctors.map((doctor: any) => (
                  <SelectItem key={doctor._id} value={doctor._id}>{doctor.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="or name contains..."
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-40"
            />
          </div>
        </div>
        <Button onClick={handleSearch} className="gap-2">
          <Search className="w-4 h-4" /> Search
        </Button>
        {report && report.rows.length > 0 && (
          <Button variant="outline" onClick={handleExportPDF} className="gap-2 ml-auto">
            <FileDown className="w-4 h-4" /> Export PDF
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !report || report.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Stethoscope className="w-10 h-10 opacity-30" />
          <p>No referral orders found for the selected period.</p>
        </div>
      ) : (
        <div ref={reportRef} className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border rounded-lg p-4 text-center"><ClipboardList className="w-5 h-5 mx-auto text-primary mb-1" /><p className="text-2xl font-bold">{report.summary.totalOrders}</p><p className="text-xs text-muted-foreground">Total Orders</p></div>
            <div className="bg-card border rounded-lg p-4 text-center"><Banknote className="w-5 h-5 mx-auto text-status-normal mb-1" /><p className="text-2xl font-bold">Le {report.summary.totalBilled.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Billed</p></div>
            <div className="bg-card border rounded-lg p-4 text-center"><Tag className="w-5 h-5 mx-auto text-status-warning mb-1" /><p className="text-2xl font-bold text-status-critical">Le {report.summary.totalDiscount.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Discount</p></div>
            <div className="bg-card border rounded-lg p-4 text-center"><Banknote className="w-5 h-5 mx-auto text-status-normal mb-1" /><p className="text-2xl font-bold text-status-normal">Le {report.summary.totalPaid.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Paid</p></div>
          </div>

          {report.summary.doctors.length > 0 && (
            <div className="bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3"><Stethoscope className="w-4 h-4" /> Summary by Doctor</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Doctor</th>
                      <th className="text-center px-3 py-2 font-medium">Orders</th>
                      <th className="text-right px-3 py-2 font-medium">Billed</th>
                      <th className="text-right px-3 py-2 font-medium">Discount</th>
                      <th className="text-right px-3 py-2 font-medium">Paid</th>
                      <th className="text-right px-3 py-2 font-medium">Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.summary.doctors.map((d: any) => (
                      <tr key={d.name}>
                        <td className="px-3 py-2 font-medium">{d.name}</td>
                        <td className="px-3 py-2 text-center"><Badge variant="secondary">{d.orders}</Badge></td>
                        <td className="px-3 py-2 text-right">Le {d.billed.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-status-critical">{d.discount > 0 ? `- Le ${d.discount.toLocaleString()}` : '-'}</td>
                        <td className="px-3 py-2 text-right text-status-normal font-medium">Le {d.paid.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => handleExportDoctor(d.name)}>Export</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-card border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3"><Users className="w-4 h-4" /> Patient Detail</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Order #</th>
                    <th className="text-left px-3 py-2 font-medium">Patient</th>
                    <th className="text-left px-3 py-2 font-medium">Doctor</th>
                    <th className="text-left px-3 py-2 font-medium">Tests</th>
                    <th className="text-right px-3 py-2 font-medium">Billed</th>
                    <th className="text-right px-3 py-2 font-medium">Discount</th>
                    <th className="text-right px-3 py-2 font-medium">Paid</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.rows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/40">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground text-xs">{row.date ? format(new Date(row.date), 'dd/MM/yy') : '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.orderNumber}</td>
                      <td className="px-3 py-2 font-medium">{row.patientName}</td>
                      <td className="px-3 py-2">{row.doctor}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.tests}</td>
                      <td className="px-3 py-2 text-right">Le {row.total.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-status-critical">{row.discount > 0 ? `- Le ${row.discount.toLocaleString()}` : '-'}</td>
                      <td className="px-3 py-2 text-right text-status-normal font-medium">Le {row.amountPaid.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className={cn('text-xs capitalize', {
                          'bg-status-normal/10 text-status-normal': row.paymentStatus === 'paid',
                          'bg-status-warning/10 text-status-warning': row.paymentStatus === 'pending' || row.paymentStatus === 'partial',
                        })}>{row.paymentStatus}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </RoleLayout>
  );
}
