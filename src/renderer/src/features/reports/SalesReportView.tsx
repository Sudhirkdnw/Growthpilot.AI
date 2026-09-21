import React, { useState, useCallback, useEffect } from 'react';
import {
  DollarSign,
  RotateCcw,
  TrendingUp,
  Tag,
  Receipt,
  FileText,
  AlertCircle,
  Package,
  Users,
  CreditCard,
  Building2,
} from 'lucide-react';
import { DateRangePicker, ReportPeriod } from './shared/DateRangePicker';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportDataTable } from './shared/ReportDataTable';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface SalesReportViewProps {
  token: string;
}

type SubTab = 'summary' | 'by-product' | 'by-customer' | 'by-payment' | 'returns';

export const SalesReportView: React.FC<SalesReportViewProps> = ({ token }) => {
  const [period, setPeriod] = useState<ReportPeriod>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [subTab, setSubTab] = useState<SubTab>('summary');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let result: any;
      const baseQuery = { token, period, startDate, endDate };
      if (subTab === 'summary') {
        result = await window.electronAPI.invoke('reports:getSales', baseQuery);
      } else if (subTab === 'by-product') {
        result = await window.electronAPI.invoke('reports:getSalesByProduct', baseQuery);
      } else if (subTab === 'by-customer') {
        result = await window.electronAPI.invoke('reports:getSalesByCustomer', baseQuery);
      } else if (subTab === 'by-payment') {
        result = await window.electronAPI.invoke('reports:getSalesByPaymentMethod', baseQuery);
      } else if (subTab === 'returns') {
        result = await window.electronAPI.invoke('reports:getSalesReturns', baseQuery);
      }
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales report');
    } finally {
      setLoading(false);
    }
  }, [token, period, startDate, endDate, subTab]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePeriodChange = (p: ReportPeriod, sd?: string, ed?: string) => {
    setPeriod(p);
    setStartDate(sd);
    setEndDate(ed);
  };

  const SUBTABS: { label: string; value: SubTab; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'Overview & Invoices', value: 'summary', icon: Receipt },
    { label: 'Sales By Product', value: 'by-product', icon: Package },
    { label: 'Sales By Customer', value: 'by-customer', icon: Users },
    { label: 'By Payment Mode', value: 'by-payment', icon: CreditCard },
    { label: 'Sales Returns (SR)', value: 'returns', icon: RotateCcw },
  ];

  const summaryCards = data?.summary
    ? [
        {
          label: 'Gross Sales',
          value: fmt(data.summary.grossSales),
          color: 'green' as const,
          icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
        },
        {
          label: 'Sales Returns',
          value: fmt(data.summary.salesReturns),
          color: 'red' as const,
          icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
        },
        {
          label: 'Net Sales',
          value: fmt(data.summary.netSales),
          color: 'blue' as const,
          icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
        },
        {
          label: 'Total Discount',
          value: fmt(data.summary.totalDiscount),
          color: 'amber' as const,
          icon: <Tag className="w-4 h-4 text-amber-400" />,
        },
        {
          label: 'Total Tax (GST)',
          value: fmt(data.summary.totalTax),
          color: 'purple' as const,
          icon: <FileText className="w-4 h-4 text-purple-400" />,
        },
        {
          label: 'Total Invoices',
          value: data.summary.salesCount,
          color: 'teal' as const,
          icon: <Receipt className="w-4 h-4 text-teal-400" />,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Date Filter */}
      <DateRangePicker
        value={period}
        startDate={startDate}
        endDate={endDate}
        onChange={handlePeriodChange}
        disabled={loading}
      />

      {/* Sub-Tab Pills */}
      <div className="flex items-center space-x-1.5 p-1 bg-surface-elevated/50 border border-border rounded-xl overflow-x-auto">
        {SUBTABS.map((t) => {
          const Icon = t.icon;
          const isActive = subTab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setSubTab(t.value)}
              disabled={loading}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-surface-elevated text-primary border border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Summary & Invoices ── */}
      {subTab === 'summary' && data && (
        <div className="space-y-4">
          <ReportSummaryCards cards={summaryCards} />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="No sales invoices found for this period."
            columns={[
              { key: 'invoiceNumber', label: 'Invoice #', sortable: true },
              {
                key: 'saleDate',
                label: 'Date',
                render: (v) => new Date(v).toLocaleDateString('en-IN'),
                sortable: true,
              },
              {
                key: 'customerName',
                label: 'Customer',
                render: (v) => <span className="font-medium text-foreground">{v}</span>,
                sortable: true,
              },
              { key: 'grandTotal', label: 'Total', render: (v) => fmt(v), align: 'right', sortable: true },
              { key: 'paidAmount', label: 'Paid', render: (v) => fmt(v), align: 'right' },
              {
                key: 'dueAmount',
                label: 'Due',
                render: (v) =>
                  Number(v) > 0 ? (
                    <span className="font-semibold text-rose-400">{fmt(v)}</span>
                  ) : (
                    <span className="text-muted-foreground">₹0.00</span>
                  ),
                align: 'right',
              },
              {
                key: 'paymentMethod',
                label: 'Method',
                render: (v) => (
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-xs text-foreground">
                    {v}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (v) => (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase border ${
                      v === 'POSTED'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                        : 'bg-rose-950/80 text-rose-400 border-rose-800/60'
                    }`}
                  >
                    {v}
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* ── By Product ── */}
      {subTab === 'by-product' && data && (
        <div className="space-y-4">
          {data.totals && (
            <ReportSummaryCards
              cards={[
                {
                  label: 'Gross Revenue',
                  value: fmt(data.totals.grossRevenue),
                  color: 'green',
                  icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
                },
                {
                  label: 'Net Revenue',
                  value: fmt(data.totals.netRevenue),
                  color: 'blue',
                  icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
                },
                {
                  label: 'Historical COGS',
                  value: fmt(data.totals.historicalCogs),
                  color: 'orange',
                  icon: <Package className="w-4 h-4 text-primary" />,
                },
                {
                  label: 'Gross Profit',
                  value: fmt(data.totals.grossProfit),
                  color: 'teal',
                  icon: <TrendingUp className="w-4 h-4 text-teal-400" />,
                },
              ]}
            />
          )}
          <ReportDataTable<any>
            loading={loading}
            data={data.data || []}
            emptyMessage="No product sales found for this period."
            columns={[
              { key: 'productName', label: 'Product', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'sku', label: 'SKU', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v}</span> },
              { key: 'categoryName', label: 'Category', render: (v) => v || '—' },
              { key: 'quantitySold', label: 'Qty Sold', align: 'right', sortable: true },
              { key: 'grossRevenue', label: 'Gross Rev', render: (v) => fmt(v), align: 'right', sortable: true },
              { key: 'salesReturnValue', label: 'Returns', render: (v) => fmt(v), align: 'right' },
              { key: 'netRevenue', label: 'Net Rev', render: (v) => fmt(v), align: 'right', sortable: true },
              { key: 'historicalCogs', label: 'COGS', render: (v) => fmt(v), align: 'right', sortable: true },
              {
                key: 'grossProfit',
                label: 'Profit',
                render: (v) => (
                  <span className={`font-semibold ${Number(v) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {fmt(v)}
                  </span>
                ),
                align: 'right',
                sortable: true,
              },
              {
                key: 'grossMarginPercent',
                label: 'Margin',
                render: (v) => (
                  <span className="font-medium text-foreground">{Number(v).toFixed(1)}%</span>
                ),
                align: 'right',
                sortable: true,
              },
            ]}
          />
        </div>
      )}

      {/* ── By Customer ── */}
      {subTab === 'by-customer' && data && (
        <div className="space-y-4">
          {data.totals && (
            <ReportSummaryCards
              cards={[
                {
                  label: 'Gross Sales',
                  value: fmt(data.totals.grossSales),
                  color: 'green',
                  icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
                },
                {
                  label: 'Returns',
                  value: fmt(data.totals.returnsValue),
                  color: 'red',
                  icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
                },
                {
                  label: 'Net Sales',
                  value: fmt(data.totals.netSales),
                  color: 'blue',
                  icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
                },
                {
                  label: 'Total Outstanding',
                  value: fmt(data.totals.outstanding),
                  color: 'orange',
                  icon: <Building2 className="w-4 h-4 text-primary" />,
                },
              ]}
            />
          )}
          <ReportDataTable<any>
            loading={loading}
            data={data.data || []}
            emptyMessage="No customer sales found."
            columns={[
              { key: 'customerName', label: 'Customer', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'phone', label: 'Phone', render: (v) => v || '—' },
              { key: 'salesCount', label: 'Invoices', align: 'right', sortable: true },
              { key: 'grossSales', label: 'Gross Sales', render: (v) => fmt(v), align: 'right', sortable: true },
              { key: 'returnsValue', label: 'Returns', render: (v) => fmt(v), align: 'right' },
              { key: 'netSales', label: 'Net Sales', render: (v) => fmt(v), align: 'right', sortable: true },
              {
                key: 'outstanding',
                label: 'Outstanding',
                render: (v) =>
                  Number(v) > 0 ? (
                    <span className="font-semibold text-rose-400">{fmt(v)}</span>
                  ) : (
                    <span className="text-muted-foreground">₹0.00</span>
                  ),
                align: 'right',
                sortable: true,
              },
            ]}
          />
        </div>
      )}

      {/* ── By Payment Method ── */}
      {subTab === 'by-payment' && data && (
        <ReportDataTable<any>
          loading={loading}
          data={data.data || []}
          emptyMessage="No payment method statistics found."
          columns={[
            {
              key: 'paymentMethod',
              label: 'Payment Method',
              render: (v) => (
                <span className="px-2.5 py-1 rounded-md bg-surface-elevated border border-border text-xs font-semibold text-foreground">
                  {v}
                </span>
              ),
              sortable: true,
            },
            { key: 'transactionCount', label: 'Transactions', align: 'right', sortable: true },
            { key: 'salesAmount', label: 'Sales Billed', render: (v) => fmt(v), align: 'right', sortable: true },
            {
              key: 'collectionAmount',
              label: 'Actual Collected',
              render: (v) => <span className="font-semibold text-emerald-400">{fmt(v)}</span>,
              align: 'right',
              sortable: true,
            },
          ]}
        />
      )}

      {/* ── Returns ── */}
      {subTab === 'returns' && data && (
        <div className="space-y-4">
          <ReportSummaryCards
            cards={[
              {
                label: 'Total Returns',
                value: data.totalReturns || 0,
                color: 'red',
                icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
              },
              {
                label: 'Total Refund Value',
                value: fmt(data.totalReturnValue || 0),
                color: 'red',
                icon: <DollarSign className="w-4 h-4 text-rose-400" />,
              },
            ]}
          />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="No sales returns found for this period."
            columns={[
              { key: 'returnNumber', label: 'Return #', render: (v) => <span className="font-mono text-xs text-primary">{v}</span>, sortable: true },
              { key: 'invoiceNumber', label: 'Orig Invoice #', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v}</span> },
              {
                key: 'returnDate',
                label: 'Date',
                render: (v) => new Date(v).toLocaleDateString('en-IN'),
                sortable: true,
              },
              { key: 'customerName', label: 'Customer', render: (v) => v || 'Walk-in' },
              {
                key: 'totalAmount',
                label: 'Refund Amount',
                render: (v) => <span className="font-semibold text-rose-400">{fmt(v)}</span>,
                align: 'right',
                sortable: true,
              },
              {
                key: 'refundType',
                label: 'Refund Type',
                render: (v) => (
                  <span className="text-xs text-foreground">
                    {v.replace(/_/g, ' ')}
                  </span>
                ),
              },
              { key: 'itemCount', label: 'Items', align: 'center' },
            ]}
          />
        </div>
      )}
    </div>
  );
};
