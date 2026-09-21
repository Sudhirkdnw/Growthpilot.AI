import React, { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart,
  Truck,
  TrendingUp,
  Package,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  DollarSign,
  Wallet,
  Users,
  Building2,
  Gem,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { DashboardMetricsDTO } from '../../../../shared/types';
import { formatCurrency } from '../../utils/formatCurrency';
import { useAuthStore } from '../../stores/authStore';

const fmtQty = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

interface DashboardViewProps {
  token: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ token }) => {
  const settings = useAuthStore((state) => state.settings);
  const fmt = (n: number) => formatCurrency(n, settings);

  const [metrics, setMetrics] = useState<DashboardMetricsDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.invoke('reports:getDashboard', { token });
      if (result?.error) throw new Error(result.error);
      setMetrics(result);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load executive dashboard');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const m = metrics;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center space-x-2">
            <span>Executive Store Dashboard</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time business performance snapshot for{' '}
            <span className="text-foreground font-medium">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastRefreshed && (
            <span className="inline-flex items-center space-x-1.5 text-xs text-muted-foreground bg-surface border border-border px-3 py-1.5 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                Synced{' '}
                {lastRefreshed.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing…' : 'Live Sync'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-2.5 text-rose-500 text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Skeleton Loading State */}
      {loading && !m && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-surface-elevated/60 border border-border rounded-xl p-4 flex flex-col justify-between"
            >
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-6 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Actual Data Metrics */}
      {m && (
        <div className="space-y-6">
          {/* ── Section 1: Today's Revenue & Collections ── */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-foreground font-semibold text-xs tracking-wider uppercase">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <span>Today's Billing & Collections</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Sales */}
              <div className="p-4 rounded-xl bg-surface border border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Gross Sales
                  </span>
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <DollarSign className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-emerald-500">
                    {fmt(m.todayGrossSales)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {fmtQty(m.todaySalesCount)} posted invoices
                  </div>
                </div>
              </div>

              {/* Sales Returns */}
              <div className="p-4 rounded-xl bg-surface border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sales Returns
                  </span>
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <RotateCcw className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-rose-500">
                    {fmt(m.todaySalesReturns)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Customer return refunds</div>
                </div>
              </div>

              {/* Net Sales */}
              <div className="p-4 rounded-xl bg-surface border border-blue-500/20 hover:border-blue-500/50 bg-blue-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Net Sales
                  </span>
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-blue-500">
                    {fmt(m.todayNetSales)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Gross sales − returns</div>
                </div>
              </div>

              {/* Collections Received */}
              <div className="p-4 rounded-xl bg-surface border border-teal-500/20 hover:border-teal-500/50 bg-teal-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Collections Received
                  </span>
                  <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20">
                    <Wallet className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-teal-500">
                    {fmt(m.todayCollections)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Actual cash/UPI in-hand</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Operating Costs & Profitability ── */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-foreground font-semibold text-xs tracking-wider uppercase">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>Operating Costs & Bottom-Line Profit</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Purchases */}
              <div className="p-4 rounded-xl bg-surface border border-amber-500/20 hover:border-amber-500/50 bg-amber-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Today's Purchases
                  </span>
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Truck className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-amber-500">
                    {fmt(m.todayNetPurchases)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {fmtQty(m.todayPurchasesCount)} orders received
                  </div>
                </div>
              </div>

              {/* Operating Expenses */}
              <div className="p-4 rounded-xl bg-surface border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Operating Expenses
                  </span>
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <Wallet className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-rose-500">
                    {fmt(m.todayExpenses)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {m.todayExpensesCount} expense vouchers
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div className="p-4 rounded-xl bg-surface border border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Gross Profit
                  </span>
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-emerald-500">
                    {fmt(m.todayGrossProfit)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Margin: {m.todayGrossMarginPercent.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Net Profit */}
              <div className="p-4 rounded-xl bg-surface border-2 border-primary/40 flex flex-col justify-between shadow-md hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Net Profit (Today)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/30 text-[10px] font-bold">
                    BOTTOM LINE
                  </span>
                </div>
                <div>
                  <div
                    className={`text-2xl font-extrabold tracking-tight ${
                      m.todayNetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {fmt(m.todayNetProfit)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Net Margin:{' '}
                    {m.todayNetSales > 0
                      ? ((m.todayNetProfit / m.todayNetSales) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Balances & Valuation ── */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-foreground font-semibold text-xs tracking-wider uppercase">
              <Package className="w-4 h-4 text-primary" />
              <span>Working Capital, Khata & Stock Assets</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Receivables */}
              <div className="p-4 rounded-xl bg-surface border border-blue-500/20 hover:border-blue-500/50 bg-blue-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer Receivables
                  </span>
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    <Users className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-blue-500">
                    {fmt(m.totalReceivables)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Total pending khata due</div>
                </div>
              </div>

              {/* Total Payables */}
              <div className="p-4 rounded-xl bg-surface border border-rose-500/20 hover:border-rose-500/50 bg-rose-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier Payables
                  </span>
                  <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <Building2 className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-rose-500">
                    {fmt(m.totalPayables)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Total credit bills owed</div>
                </div>
              </div>

              {/* Total Stock Value */}
              <div className="p-4 rounded-xl bg-surface border border-purple-500/20 hover:border-purple-500/50 bg-purple-500/[0.03] flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current Stock Valuation
                  </span>
                  <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    <Gem className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight text-purple-500">
                    {fmt(m.stockValue)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {m.totalActiveProducts} active products
                  </div>
                </div>
              </div>

              {/* Low Stock Alerts */}
              <div
                className={`p-4 rounded-xl bg-surface border ${
                  m.lowStockCount > 0
                    ? 'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.03]'
                    : 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-500/[0.03]'
                } flex flex-col justify-between shadow-sm hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Stock Alerts
                  </span>
                  <span
                    className={`p-1.5 rounded-lg border ${
                      m.lowStockCount > 0
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                </div>
                <div>
                  <div
                    className={`text-2xl font-bold tracking-tight ${
                      m.lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500'
                    }`}
                  >
                    {m.lowStockCount} {m.lowStockCount === 1 ? 'Alert' : 'Alerts'}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {m.lowStockCount > 0 ? 'Reorder needed immediately' : 'Inventory levels healthy'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
