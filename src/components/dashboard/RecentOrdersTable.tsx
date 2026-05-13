import { TestOrder } from '@/types/lis';
import { cn } from '@/lib/utils';

interface RecentOrdersTableProps {
  orders: TestOrder[];
}

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  const priorityStyles = {
    routine: 'bg-muted text-muted-foreground',
    urgent: 'bg-status-warning/10 text-status-warning',
    stat: 'bg-status-critical/10 text-status-critical',
  };

  const statusStyles: Record<string, string> = {
    'pending-payment': 'status-pending',
    'pending-collection': 'status-pending',
    'collected': 'bg-primary/10 text-primary',
    'processing': 'bg-primary/10 text-primary',
    'completed': 'status-normal',
    'cancelled': 'bg-muted text-muted-foreground',
  };

  const getTestsSummary = (order: TestOrder) => {
    if (order.tests.length === 0) return { code: '-', name: '-' };
    if (order.tests.length === 1) {
      return { code: order.tests[0].testCode, name: order.tests[0].testName };
    }
    return { 
      code: order.tests[0].testCode, 
      name: `${order.tests[0].testName} +${order.tests.length - 1} more` 
    };
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="font-semibold">Recent Orders</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Patient</th>
            <th>Test</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Ordered</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const testSummary = getTestsSummary(order);
            return (
              <tr key={order.id} className="cursor-pointer">
                <td className="font-mono text-sm">{order.orderNumber}</td>
                <td>
                  <div>
                    <p className="font-medium">{order.patient.firstName} {order.patient.lastName}</p>
                    <p className="text-xs text-muted-foreground">{order.patient.mrn}</p>
                  </div>
                </td>
                <td>
                  <div>
                    <p className="font-medium">{testSummary.code}</p>
                    <p className="text-xs text-muted-foreground">{testSummary.name}</p>
                  </div>
                </td>
                <td>
                  <span className={cn('status-badge capitalize', priorityStyles[order.priority])}>
                    {order.priority}
                  </span>
                </td>
                <td>
                  <span className={cn('status-badge capitalize', statusStyles[order.status] || 'status-pending')}>
                    {order.status.replace(/-/g, ' ')}
                  </span>
                </td>
                <td className="text-muted-foreground">
                  {new Date(order.orderedAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
