import React, { useState, useCallback, useEffect } from 'react';
import { Wallet, Receipt, AlertCircle, Layers, CreditCard } from 'lucide-react';
import { DateRangePicker, ReportPeriod } from './shared/DateRangePicker';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportDataTable } from './shared/ReportDataTable';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ExpenseReportView: React.FC<{ token: string }> = ({ token }) => {
  const [period, setPeriod] = useState<ReportPeriod>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.invoke('reports:getExpensesReport', {
        token,
        period,
        startDate,
        endDate,
      });
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load expense report');
    } finally {
      setLoading(false);
    }
  }, [token, period, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <DateRangePicker
        value={period}
        startDate={startDate}
        endDate={endDate}
        onChange={(p, sd, ed) => {
          setPeriod(p);
          setStartDate(sd);
          setEndDate(ed);
        }}
        disabled={loading}
      />

      {error && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <ReportSummaryCards
            cards={[
              {
                label: 'Total Operating Expenses',
                value: fmt(data.totalExpenses),
                color: 'red',
                icon: <Wallet className="w-4 h-4 text-rose-400" />,
              },
              {
                label: 'Posted Expense Vouchers',
                value: data.expensesCount,
                color: 'orange',
                icon: <Receipt className="w-4 h-4 text-primary" />,
              },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-foreground font-semibold text-sm">
                <Layers className="w-4 h-4 text-primary" />
                <span>Expenses By Category</span>
              </div>
              <ReportDataTable<any>
                loading={loading}
                data={data.byCategory || []}
                emptyMessage="No category expenses found."
                columns={[
                  { key: 'categoryName', label: 'Category', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
                  { key: 'count', label: 'Vouchers', align: 'right' },
                  {
                    key: 'total',
                    label: 'Total Spent',
                    render: (v) => <span className="font-semibold text-rose-400">{fmt(v)}</span>,
                    align: 'right',
                    sortable: true,
                  },
                ]}
              />
            </div>

            {/* By Payment Method */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-foreground font-semibold text-sm">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>Expenses By Payment Mode</span>
              </div>
              <ReportDataTable<any>
                loading={loading}
                data={data.byPaymentMethod || []}
                emptyMessage="No payment method statistics found."
                columns={[
                  {
                    key: 'paymentMethod',
                    label: 'Method',
                    render: (v) => (
                      <span className="px-2.5 py-1 rounded-md bg-surface-elevated border border-border text-xs font-semibold text-foreground">
                        {v}
                      </span>
                    ),
                    sortable: true,
                  },
                  { key: 'count', label: 'Vouchers', align: 'right' },
                  {
                    key: 'total',
                    label: 'Amount Paid',
                    render: (v) => <span className="font-semibold text-rose-400">{fmt(v)}</span>,
                    align: 'right',
                    sortable: true,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
