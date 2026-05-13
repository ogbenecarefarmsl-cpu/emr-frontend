import { RoleLayout } from '@/components/layout/RoleLayout';
import { useAuth } from '@/context/AuthContext';
import { useOrders, useTodayOrders, usePaymentStats, useDailyIncome } from '@/hooks/useOrders';
import { useMachines } from '@/hooks/useMachines';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Download, TrendingUp, Users, DollarSign, TestTube, Loader2, Banknote, Calendar, Smartphone, CreditCard } from 'lucide-react';
import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--status-normal))', 'hsl(var(--status-warning))', 'hsl(var(--status-critical))', 'hsl(var(--muted-foreground))'];

export default function Reports() {
  const { profile } = useAuth();
  const { data: allOrders, isLoading: ordersLoading } = useOrders('all');
  const { data: todayOrders } = useTodayOrders();
  const { data: machines } = useMachines();

  const [dateRange, setDateRange] = useState('7days');

  // Get date range for payment stats
  const getDateRange = () => {
    const end = new Date().toISOString();
    let start = new Date();
    
    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case '7days':
        start = subDays(start, 7);
        break;
      case '30days':
        start = subDays(start, 30);
        break;
      case '90days':
        start = subDays(start, 90);
        break;
      default:
        start = subDays(start, 7);
    }
    
    return { start: start.toISOString(), end };
  };

  const { start, end } = getDateRange();
  const { data: paymentStats } = usePaymentStats(start, end);
  const { data: dailyIncome } = useDailyIncome(start, end);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!allOrders) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paidOrders = allOrders.filter(o => o.paymentStatus === 'paid');
    const todayRevenue = todayOrders?.filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + Number(o.total || o.totalAmount || 0), 0) || 0;
    const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total || o.totalAmount || 0), 0);
    const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
    const totalTests = allOrders.reduce((sum, o) => sum + (o.order_tests?.length || o.tests?.length || 0), 0);

    return {
      todayRevenue,
      totalRevenue,
      avgOrderValue,
      totalOrders: allOrders.length,
      completedOrders: allOrders.filter(o => o.status === 'completed').length,
      totalTests,
      uniquePatients: new Set(
        allOrders.map((o) => {
          if (typeof o.patientId === 'string') return o.patientId;
          if (o.patientId?._id) return o.patientId._id;
          if (o.patientId?.id) return o.patientId.id;
          return '';
        }),
      ).size,
    };
  }, [allOrders, todayOrders]);

  // Orders by status chart data
  const statusData = useMemo(() => {
    if (!allOrders) return [];
    
    const statusCounts: Record<string, number> = {};
    allOrders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
    }));
  }, [allOrders]);

  // Tests by category chart data
  const categoryData = useMemo(() => {
    if (!allOrders) return [];
    
    const categoryCounts: Record<string, number> = {};
    allOrders.forEach(order => {
      const orderTests = order.tests || order.order_tests || [];
      orderTests.forEach(test => {
        // Use test code prefix as category approximation
        const testCode = test.testCode || '';
        const category = testCode.substring(0, 3);
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    });

    return Object.entries(categoryCounts)
      .map(([category, count]) => ({ name: category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allOrders]);

  // Daily revenue trend (last 7 days)
  const revenueData = useMemo(() => {
    if (!allOrders) return [];

    const days: Record<string, number> = {};
    const now = new Date();
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toLocaleDateString('en-US', { weekday: 'short' });
      days[key] = 0;
    }

    // Aggregate revenue
    allOrders.forEach(order => {
      if (order.paymentStatus !== 'paid') return;
      const orderDate = new Date(order.createdAt);
      const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 7) {
        const key = orderDate.toLocaleDateString('en-US', { weekday: 'short' });
        days[key] = (days[key] || 0) + Number(order.total || order.totalAmount || 0);
      }
    });

    return Object.entries(days).map(([day, revenue]) => ({ day, revenue: revenue / 1000 }));
  }, [allOrders]);

  if (ordersLoading) {
    return (
      <RoleLayout title="Reports" subtitle="Analytics and insights" role="admin" userName={profile?.full_name}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </RoleLayout>
    );
  }

  return (
    <RoleLayout 
      title="Reports & Analytics" 
      subtitle="Business insights and performance metrics"
      role="admin"
      userName={profile?.full_name}
    >
      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Revenue Summary Cards — Matching PaymentsPage pattern */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Today's Revenue */}
        <div className="bg-card border-l-4 border-l-status-normal border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-status-normal/10">
            <DollarSign className="w-6 h-6 text-status-normal" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Today's Revenue</p>
            <p className="text-3xl font-bold text-status-normal mt-1">
              Le {(metrics?.todayRevenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              From fully paid orders today
            </p>
          </div>
        </div>

        {/* Period Revenue */}
        <div className="bg-card border-l-4 border-l-primary border rounded-lg p-5 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Banknote className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              Collected ({dateRange === 'today' ? 'Today' : dateRange === '7days' ? '7 Days' : dateRange === '30days' ? '30 Days' : '90 Days'})
            </p>
            <p className="text-3xl font-bold mt-1">
              Le {(paymentStats?.paidRevenue || metrics?.totalRevenue || 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentStats?.paidOrders || 0} paid orders
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Orders</p>
          <p className="text-xl font-bold mt-1">{metrics?.totalOrders || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics?.completedOrders || 0} completed
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Tests</p>
          <p className="text-xl font-bold mt-1">{metrics?.totalTests || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Across all orders</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> Unique Patients
          </p>
          <p className="text-xl font-bold mt-1">{metrics?.uniquePatients || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Registered patients</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Avg Order Value
          </p>
          <p className="text-xl font-bold mt-1">
            Le {Math.round(metrics?.avgOrderValue || 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Per paid order</p>
        </div>
      </div>

      {/* Daily Income Breakdown — Matching PaymentsPage pattern */}
      {dailyIncome && dailyIncome.length > 0 && (
        <div className="bg-card border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Daily Income Breakdown</h3>
            <span className="text-xs text-muted-foreground">
              Last {dailyIncome.length} day(s)
            </span>
          </div>
          <div className="divide-y">
            {dailyIncome.slice(0, 7).map((day: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm">{format(new Date(day.date), 'EEE, MMM dd')}</p>
                  <p className="text-xs text-muted-foreground">{day.orderCount} order{day.orderCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {day.cashPayments > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-normal/10 text-status-normal text-xs">
                        <Banknote className="w-3 h-3" />
                        Le {day.cashPayments.toLocaleString()}
                      </span>
                    )}
                    {day.orangeMoneyPayments > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs">
                        <Smartphone className="w-3 h-3" />
                        Le {day.orangeMoneyPayments.toLocaleString()}
                      </span>
                    )}
                    {day.afrimoneyPayments > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                        <Smartphone className="w-3 h-3" />
                        Le {day.afrimoneyPayments.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm min-w-[100px] text-right">
                    Le {day.totalIncome.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis tickFormatter={(v) => `Le ${v}K`} className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => [`Le ${(value * 1000).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Tests by Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={60} className="text-xs" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </RoleLayout>
  );
}
