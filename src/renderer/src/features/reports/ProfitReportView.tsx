import React, { useState, useCallback, useEffect } from 'react';
import {
  TrendingUp,
  FileText,
  DollarSign,
  RotateCcw,
  Package,
  CheckCircle2,
  AlertCircle,
  Percent,
  Receipt,
  Scale,
} from 'lucide-react';
import { DateRangePicker, ReportPeriod } from './shared/DateRangePicker';
import { ReportSummaryCards } from './shared/ReportSummaryCards';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SubTab = 'profit' | 'tax';

export const ProfitReportView: React.FC<{ token: string }> = ({ token }) => {
  const [period, setPeriod] = useState<ReportPeriod>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [subTab, setSubTab] = useState<SubTab>('profit');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = { token, period, startDate, endDate };
      const result =
        subTab === 'profit'
          ? await window.electronAPI.invoke('reports:getProfitSummary', q)
          : await window.electronAPI.invoke('reports:getTaxSummary', q);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load financial statement');
    } finally {
      setLoading(false);
    }
  }, [token, period, startDate, endDate, subTab]);

  useEffect(() => {
    load();
  }, [load]);

  const p = data;

  return (
    <div className="space-y-4">
      {/* Date Filter */}
      <DateRangePicker
        value={period}
        startDate={startDate}
        endDate={endDate}
        onChange={(pt, sd, ed) => {
          setPeriod(pt);
          setStartDate(sd);
          setEndDate(ed);
        }}
        disabled={loading}
      />

      {/* Sub Tabs */}
      <div className="flex items-center space-x-1.5 p-1 bg-surface-elevated/50 border border-border rounded-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('profit')}
          disabled={loading}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'profit'
              ? 'bg-surface-elevated text-primary border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Profit & Loss Statement (P&L)</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tax')}
          disabled={loading}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'tax'
              ? 'bg-surface-elevated text-primary border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>GST / Tax Liability Summary</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── P&L Statement ── */}
      {subTab === 'profit' && p && (
        <div className="space-y-6">
          <ReportSummaryCards
            cards={[
              {
                label: 'Gross Sales',
                value: fmt(p.grossSales),
                color: 'green',
                icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
              },
              {
                label: 'Sales Returns',
                value: fmt(p.salesReturns),
                color: 'red',
                icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
              },
              {
                label: 'Net Sales',
                value: fmt(p.netSales ?? p.netRevenue),
                color: 'blue',
                icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
              },
              {
                label: 'Historical COGS',
                value: fmt(p.cogs),
                color: 'orange',
                icon: <Package className="w-4 h-4 text-primary" />,
              },
              {
                label: 'Gross Profit',
                value: fmt(p.grossProfit),
                color: p.grossProfit >= 0 ? 'green' : 'red',
                icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
              },
              {
                label: 'Gross Margin',
                value: `${Number(p.grossMarginPercent || 0).toFixed(1)}%`,
                color: 'teal',
                icon: <Percent className="w-4 h-4 text-teal-400" />,
              },
            ]}
          />

          {/* Detailed Statement Table */}
          <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground tracking-wide">
                  Formal Profit & Loss Statement
                </h3>
                <span className="text-xs text-muted-foreground">
                  Computed strictly from checkout cost snapshots (`saleItem.costPrice`)
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-surface-elevated border border-border text-xs text-primary font-semibold">
                {p.period || period}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs text-foreground">
              {/* Revenue */}
              <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase pt-2">
                1. Operating Revenue
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2">
                <span>Gross Sales Billed</span>
                <span className="font-semibold text-foreground">{fmt(p.grossSales)}</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2 text-rose-500">
                <span>Less: Customer Returns & Refunds</span>
                <span>({fmt(p.salesReturns)})</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-2 bg-surface-elevated rounded px-2 font-semibold text-blue-500 border-t border-border">
                <span>Net Operating Revenue</span>
                <span>{fmt(p.netSales ?? p.netRevenue)}</span>
              </div>

              {/* COGS */}
              <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase pt-4">
                2. Direct Cost of Goods Sold (COGS)
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2 text-rose-500">
                <span>Historical Inventory Cost (Captured at Sale Checkout)</span>
                <span>({fmt(p.cogs)})</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-2 bg-surface-elevated rounded px-2 font-bold text-sm border-y border-border">
                <span className="text-foreground">Gross Operating Profit</span>
                <span className={p.grossProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {fmt(p.grossProfit)}
                </span>
              </div>

              {/* Expenses */}
              <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase pt-4">
                3. Operating Overhead Expenses
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2 text-rose-500">
                <span>Posted Operating Expenses (Rent, Utilities, Staff, Supplies)</span>
                <span>({fmt(p.totalExpenses ?? p.operatingExpenses)})</span>
              </div>

              {/* Net Profit */}
              <div className="flex justify-between items-center p-3 bg-surface-elevated rounded-xl border border-primary/40 shadow-sm mt-6">
                <div>
                  <span className="text-sm font-bold text-foreground block">Net Bottom-Line Profit</span>
                  <span className="text-[11px] text-muted-foreground">
                    Net Margin: {Number(p.netMarginPercent || 0).toFixed(1)}%
                  </span>
                </div>
                <div
                  className={`text-xl font-extrabold ${
                    p.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {fmt(p.netProfit)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Summary ── */}
      {subTab === 'tax' && p && (
        <div className="space-y-6">
          <ReportSummaryCards
            cards={[
              {
                label: 'Net Output Tax (Sales)',
                value: fmt(p.netOutputTax),
                color: 'red',
                icon: <FileText className="w-4 h-4 text-rose-400" />,
              },
              {
                label: 'Net Input Tax (Purchases)',
                value: fmt(p.netInputTax),
                color: 'green',
                icon: <Receipt className="w-4 h-4 text-emerald-400" />,
              },
              {
                label: 'Net GST Liability',
                value: fmt(p.netTaxLiability),
                color: p.netTaxLiability >= 0 ? 'red' : 'green',
                icon: <Scale className="w-4 h-4 text-primary" />,
              },
            ]}
          />

          <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
              <div>
                <h3 className="text-base font-bold text-foreground tracking-wide">
                  GST Output vs Input Tax Audit
                </h3>
                <span className="text-xs text-muted-foreground">
                  Calculated exclusively from itemized line tax rates in posted transactions
                </span>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs text-foreground">
              <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase pt-2">
                1. Output Tax Collected (Sales)
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2">
                <span>Total Taxable Sales</span>
                <span className="font-semibold text-foreground">{fmt(p.taxableSalesAmount)}</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2">
                <span>Gross Output Tax Collected</span>
                <span className="font-semibold text-foreground">{fmt(p.outputTaxAmount)}</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2 text-rose-500">
                <span>Less: Tax Refunded on Sales Returns</span>
                <span>({fmt(p.salesReturnTaxAmount)})</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-2 bg-surface-elevated rounded px-2 font-semibold text-rose-500 border-t border-border">
                <span>Net Output Tax Payable</span>
                <span>{fmt(p.netOutputTax)}</span>
              </div>

              <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase pt-4">
                2. Input Tax Credit Paid (Purchases)
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2">
                <span>Total Taxable Purchases</span>
                <span className="font-semibold text-foreground">{fmt(p.taxablePurchasesAmount)}</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2">
                <span>Gross Input Tax Credit (ITC)</span>
                <span className="font-semibold text-foreground">{fmt(p.inputTaxAmount)}</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-1.5 hover:bg-surface-elevated rounded px-2 text-rose-500">
                <span>Less: ITC Reversed on Purchase Returns</span>
                <span>({fmt(p.purchaseReturnTaxAmount)})</span>
              </div>
              <div className="flex justify-between items-center pl-4 py-2 bg-surface-elevated rounded px-2 font-semibold text-emerald-500 border-t border-border">
                <span>Net Eligible Input Tax Credit</span>
                <span>{fmt(p.netInputTax)}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-surface-elevated rounded-xl border border-primary/40 shadow-sm mt-6">
                <div>
                  <span className="text-sm font-bold text-foreground block">
                    Net Tax Position (Output − Input)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {p.netTaxLiability >= 0
                      ? 'Government Tax Due (Net Payable)'
                      : 'Accumulated ITC Refund / Credit Carryforward'}
                  </span>
                </div>
                <div
                  className={`text-xl font-extrabold ${
                    p.netTaxLiability >= 0 ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  {fmt(p.netTaxLiability)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
