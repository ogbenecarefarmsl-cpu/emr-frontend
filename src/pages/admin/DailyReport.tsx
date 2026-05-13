import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useDailyReport } from '@/hooks/useReconciliation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Loader2,
  Banknote,
  Smartphone,
  FlaskConical,
  ClipboardList,
  Receipt,
  Calculator,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileDown,
} from 'lucide-react';

export default function DailyReport() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const role = pathname.startsWith('/reception') ? 'receptionist' : 'admin';
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  const { data: report, isLoading } = useDailyReport(selectedDate);

  const handleExportPDF = () => {
    if (!reportRef.current) return;
    const printContents = reportRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Report - ${format(new Date(selectedDate), 'MMM dd, yyyy')}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #111; font-size: 12px; }
          h2 { text-align: center; margin-bottom: 4px; font-size: 18px; }
          .subtitle { text-align: center; color: #666; margin-bottom: 16px; font-size: 12px; }
          .section { border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
          .section-title { font-weight: 700; font-size: 13px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
          .grid { display: grid; gap: 8px; }
          .grid-2 { grid-template-columns: 1fr 1fr; }
          .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
          .grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
          .stat { text-align: center; background: #f9f9f9; padding: 8px; border-radius: 4px; }
          .stat .value { font-size: 16px; font-weight: 700; }
          .stat .label { font-size: 10px; color: #888; }
          .row { display: flex; justify-content: space-between; padding: 4px 0; }
          .row.border-t { border-top: 1px solid #eee; margin-top: 4px; padding-top: 8px; }
          .bold { font-weight: 700; }
          .red { color: #dc2626; }
          .green { color: #16a34a; }
          .amber { color: #d97706; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #eee; }
          th { background: #f5f5f5; font-weight: 600; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: capitalize; }
          .badge-pending { background: #fef3c7; color: #d97706; }
          .badge-approved { background: #dcfce7; color: #16a34a; }
          .badge-rejected { background: #fee2e2; color: #dc2626; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h2>Hobour Diagnostics — Daily Report</h2>
        <p class="subtitle">${format(new Date(selectedDate), 'EEEE, MMMM dd, yyyy')}</p>
        ${buildPrintHTML(report)}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <RoleLayout
      title="Daily Report"
      subtitle="Summary of tests, income, discounts, expenditures & reconciliation"
      role={role as any}
      userName={profile?.full_name}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Label className="text-muted-foreground">Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-44"
          />
        </div>
        {report && (
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <FileDown className="w-4 h-4 mr-2" /> Export PDF
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !report ? (
        <p className="text-center text-muted-foreground py-12">No data for this date</p>
      ) : (
        <div ref={reportRef} className="space-y-6">
          {/* Row 1: Orders & Tests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Orders */}
            <div className="bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4" /> Orders
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold">{report.orders.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-status-normal">{report.orders.paid}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-status-warning">{report.orders.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Le {report.orders.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-status-critical">
                  <span>Discounts</span>
                  <span>− Le {report.orders.discounts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t">
                  <span>Billed Total</span>
                  <span>Le {report.orders.billed.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Tests */}
            <div className="bg-card border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4" /> Tests Done
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold">{report.tests.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-status-normal">{report.tests.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-status-warning">{report.tests.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
              {report.tests.breakdown && report.tests.breakdown.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Test Breakdown</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.tests.breakdown.map((item: any) => (
                      <span key={item.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {item.name} <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0 text-xs">{item.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Income Breakdown */}
          <div className="bg-card border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              <Banknote className="w-4 h-4" /> Income Collected
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <Banknote className="w-5 h-5 mx-auto text-status-normal mb-1" />
                <p className="text-xl font-bold">Le {report.income.cash.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cash</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <Smartphone className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                <p className="text-xl font-bold">Le {report.income.orangeMoney.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Orange Money</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <Smartphone className="w-5 h-5 mx-auto text-red-500 mb-1" />
                <p className="text-xl font-bold">Le {report.income.afrimoney.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Afrimoney</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <Calculator className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-xl font-bold text-primary">Le {report.income.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Collected</p>
              </div>
            </div>
          </div>

          {/* Row 3: Expenditures */}
          <div className="bg-card border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              <Receipt className="w-4 h-4" /> Expenditures
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-status-critical">Le {report.expenditures.cash.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cash</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-status-critical">Le {report.expenditures.orangeMoney.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Orange Money</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-status-critical">Le {report.expenditures.afrimoney.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Afrimoney</p>
              </div>
              <div className="bg-status-critical/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-status-critical">Le {report.expenditures.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>
            </div>

            {report.expenditures.items.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-left px-3 py-2 font-medium">Method</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.expenditures.items.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2 capitalize">{item.paymentMethod?.replace('_', ' ')}</td>
                        <td className="px-3 py-2 text-right">Le {item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Row 4: Net Expected */}
          <div className="bg-card border-2 border-primary/30 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4" /> Net Expected (Collected − Expenditures)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-lg font-bold">Le {report.netExpected.cash.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Cash</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">Le {report.netExpected.orangeMoney.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Orange Money</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">Le {report.netExpected.afrimoney.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Afrimoney</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary">Le {report.netExpected.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Expected</p>
              </div>
            </div>
          </div>

          {/* Row 5: Reconciliation / Submitted */}
          <div className="bg-card border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4" /> Reconciliation Submitted
            </h3>

            {!report.reconciliation ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Clock className="w-5 h-5" />
                <span>No reconciliation submitted for this date yet</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Submitted by:</span>
                  <span className="font-medium">{report.reconciliation.submittedBy}</span>
                  <Badge
                    variant="outline"
                    className={cn('capitalize ml-2', {
                      'bg-status-warning/10 text-status-warning': report.reconciliation.status === 'pending',
                      'bg-status-normal/10 text-status-normal': report.reconciliation.status === 'approved',
                      'bg-status-critical/10 text-status-critical': report.reconciliation.status === 'rejected',
                    })}
                  >
                    {report.reconciliation.status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {report.reconciliation.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
                    {report.reconciliation.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                    {report.reconciliation.status}
                  </Badge>
                </div>

                {/* Breakdown table */}
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Method</th>
                        <th className="text-right px-3 py-2 font-medium">Expected</th>
                        <th className="text-right px-3 py-2 font-medium">Actual</th>
                        <th className="text-right px-3 py-2 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <VarianceRow
                        label="Cash"
                        icon={<Banknote className="w-3.5 h-3.5 text-status-normal" />}
                        expected={report.netExpected.cash}
                        actual={report.reconciliation.actualCash}
                        variance={report.reconciliation.cashVariance}
                      />
                      <VarianceRow
                        label="Orange Money"
                        icon={<Smartphone className="w-3.5 h-3.5 text-orange-500" />}
                        expected={report.netExpected.orangeMoney}
                        actual={report.reconciliation.actualOrangeMoney}
                        variance={report.reconciliation.orangeMoneyVariance}
                      />
                      <VarianceRow
                        label="Afrimoney"
                        icon={<Smartphone className="w-3.5 h-3.5 text-red-500" />}
                        expected={report.netExpected.afrimoney}
                        actual={report.reconciliation.actualAfrimoney}
                        variance={report.reconciliation.afrimoneyVariance}
                      />
                    </tbody>
                    <tfoot className="bg-muted font-bold">
                      <tr>
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">Le {report.netExpected.total.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">Le {report.reconciliation.actualTotal.toLocaleString()}</td>
                        <td className={cn('px-3 py-2 text-right',
                          report.reconciliation.totalVariance > 0 ? 'text-status-critical' :
                          report.reconciliation.totalVariance < 0 ? 'text-status-normal' : ''
                        )}>
                          {report.reconciliation.totalVariance > 0 ? 'Shortage: ' :
                           report.reconciliation.totalVariance < 0 ? 'Surplus: ' : ''}
                          Le {Math.abs(report.reconciliation.totalVariance).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </RoleLayout>
  );
}

function VarianceRow({
  label,
  icon,
  expected,
  actual,
  variance,
}: {
  label: string;
  icon: React.ReactNode;
  expected: number;
  actual: number;
  variance: number;
}) {
  return (
    <tr>
      <td className="px-3 py-2 flex items-center gap-1.5">
        {icon} {label}
      </td>
      <td className="px-3 py-2 text-right">Le {expected.toLocaleString()}</td>
      <td className="px-3 py-2 text-right">Le {actual.toLocaleString()}</td>
      <td className={cn('px-3 py-2 text-right font-medium',
        variance > 0 ? 'text-status-critical' :
        variance < 0 ? 'text-status-normal' : ''
      )}>
        {variance > 0 ? 'Short: ' : variance < 0 ? 'Surp: ' : ''}
        Le {Math.abs(variance).toLocaleString()}
      </td>
    </tr>
  );
}

function buildPrintHTML(report: any): string {
  if (!report) return '';
  const L = (n: number) => (n || 0).toLocaleString();
  const varColor = (v: number) => v > 0 ? 'red' : v < 0 ? 'green' : '';
  const varLabel = (v: number) => v > 0 ? 'Shortage: ' : v < 0 ? 'Surplus: ' : '';

  let expRows = '';
  if (report.expenditures.items.length > 0) {
    expRows = `<table><thead><tr><th>Description</th><th>Method</th><th class="text-right">Amount</th></tr></thead><tbody>`;
    report.expenditures.items.forEach((item: any) => {
      expRows += `<tr><td>${item.description}</td><td style="text-transform:capitalize">${(item.paymentMethod || '').replace('_', ' ')}</td><td class="text-right">Le ${L(item.amount)}</td></tr>`;
    });
    expRows += `</tbody></table>`;
  }

  const recSection = !report.reconciliation
    ? `<p style="color:#888;padding:8px 0">No reconciliation submitted for this date</p>`
    : `
      <p style="margin-bottom:8px">Submitted by: <strong>${report.reconciliation.submittedBy}</strong>
        <span class="badge badge-${report.reconciliation.status}">${report.reconciliation.status}</span>
      </p>
      <table>
        <thead><tr><th>Method</th><th class="text-right">Expected</th><th class="text-right">Actual</th><th class="text-right">Variance</th></tr></thead>
        <tbody>
          <tr><td>Cash</td><td class="text-right">Le ${L(report.netExpected.cash)}</td><td class="text-right">Le ${L(report.reconciliation.actualCash)}</td><td class="text-right ${varColor(report.reconciliation.cashVariance)}">${varLabel(report.reconciliation.cashVariance)}Le ${L(Math.abs(report.reconciliation.cashVariance))}</td></tr>
          <tr><td>Orange Money</td><td class="text-right">Le ${L(report.netExpected.orangeMoney)}</td><td class="text-right">Le ${L(report.reconciliation.actualOrangeMoney)}</td><td class="text-right ${varColor(report.reconciliation.orangeMoneyVariance)}">${varLabel(report.reconciliation.orangeMoneyVariance)}Le ${L(Math.abs(report.reconciliation.orangeMoneyVariance))}</td></tr>
          <tr><td>Afrimoney</td><td class="text-right">Le ${L(report.netExpected.afrimoney)}</td><td class="text-right">Le ${L(report.reconciliation.actualAfrimoney)}</td><td class="text-right ${varColor(report.reconciliation.afrimoneyVariance)}">${varLabel(report.reconciliation.afrimoneyVariance)}Le ${L(Math.abs(report.reconciliation.afrimoneyVariance))}</td></tr>
        </tbody>
        <tfoot><tr style="font-weight:700;background:#f5f5f5"><td>Total</td><td class="text-right">Le ${L(report.netExpected.total)}</td><td class="text-right">Le ${L(report.reconciliation.actualTotal)}</td><td class="text-right ${varColor(report.reconciliation.totalVariance)}">${varLabel(report.reconciliation.totalVariance)}Le ${L(Math.abs(report.reconciliation.totalVariance))}</td></tr></tfoot>
      </table>
    `;

  return `
    <div class="grid grid-2" style="margin-bottom:12px">
      <div class="section">
        <div class="section-title">Orders</div>
        <div class="grid grid-3">
          <div class="stat"><div class="value">${report.orders.total}</div><div class="label">Total</div></div>
          <div class="stat"><div class="value green">${report.orders.paid}</div><div class="label">Paid</div></div>
          <div class="stat"><div class="value amber">${report.orders.pending}</div><div class="label">Pending</div></div>
        </div>
        <div style="margin-top:8px;border-top:1px solid #eee;padding-top:6px">
          <div class="row"><span>Subtotal</span><span>Le ${L(report.orders.subtotal)}</span></div>
          <div class="row red"><span>Discounts</span><span>− Le ${L(report.orders.discounts)}</span></div>
          <div class="row border-t bold"><span>Billed Total</span><span>Le ${L(report.orders.billed)}</span></div>
        </div>
      </div>
        <div class="section">
        <div class="section-title">Tests Done</div>
        <div class="grid grid-3">
          <div class="stat"><div class="value">${report.tests.total}</div><div class="label">Total</div></div>
          <div class="stat"><div class="value green">${report.tests.completed}</div><div class="label">Completed</div></div>
          <div class="stat"><div class="value amber">${report.tests.pending}</div><div class="label">Pending</div></div>
        </div>
        ${Array.isArray(report.tests.breakdown) && report.tests.breakdown.length > 0
          ? `<div style="margin-top:8px;border-top:1px solid #eee;padding-top:6px"><strong style="font-size:10px;color:#888">Test Breakdown: </strong>${report.tests.breakdown.map((b: any) => `<span style="display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:10px;padding:1px 8px;margin:2px;font-size:10px;font-weight:600">${b.name} ${b.count}</span>`).join('')}</div>`
          : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Income Collected</div>
      <div class="grid grid-4">
        <div class="stat"><div class="value">Le ${L(report.income.cash)}</div><div class="label">Cash</div></div>
        <div class="stat"><div class="value">Le ${L(report.income.orangeMoney)}</div><div class="label">Orange Money</div></div>
        <div class="stat"><div class="value">Le ${L(report.income.afrimoney)}</div><div class="label">Afrimoney</div></div>
        <div class="stat" style="background:#e0e7ff"><div class="value" style="color:#4338ca">Le ${L(report.income.total)}</div><div class="label">Total Collected</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Expenditures</div>
      <div class="grid grid-4" style="margin-bottom:8px">
        <div class="stat"><div class="value red">Le ${L(report.expenditures.cash)}</div><div class="label">Cash</div></div>
        <div class="stat"><div class="value red">Le ${L(report.expenditures.orangeMoney)}</div><div class="label">Orange Money</div></div>
        <div class="stat"><div class="value red">Le ${L(report.expenditures.afrimoney)}</div><div class="label">Afrimoney</div></div>
        <div class="stat"><div class="value red">Le ${L(report.expenditures.total)}</div><div class="label">Total Spent</div></div>
      </div>
      ${expRows}
    </div>

    <div class="section" style="border:2px solid #818cf8">
      <div class="section-title" style="color:#4338ca">Net Expected (Collected − Expenditures)</div>
      <div class="grid grid-4">
        <div class="stat"><div class="value">Le ${L(report.netExpected.cash)}</div><div class="label">Cash</div></div>
        <div class="stat"><div class="value">Le ${L(report.netExpected.orangeMoney)}</div><div class="label">Orange Money</div></div>
        <div class="stat"><div class="value">Le ${L(report.netExpected.afrimoney)}</div><div class="label">Afrimoney</div></div>
        <div class="stat" style="background:#e0e7ff"><div class="value" style="color:#4338ca">Le ${L(report.netExpected.total)}</div><div class="label">Total Expected</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Reconciliation</div>
      ${recSection}
    </div>
  `;
}
