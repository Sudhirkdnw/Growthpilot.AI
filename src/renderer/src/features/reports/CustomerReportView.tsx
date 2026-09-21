import React, { useState, useCallback, useEffect } from 'react';
import {
  Users,
  Search,
  ArrowLeft,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportDataTable } from './shared/ReportDataTable';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SubTab = 'outstanding' | 'ledger';

export const CustomerReportView: React.FC<{ token: string }> = ({ token }) => {
  const [subTab, setSubTab] = useState<SubTab>('outstanding');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.invoke('reports:getCustomersOutstanding', {
        token,
        search: search || undefined,
        pageSize: 100,
      });
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load receivables data');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLedger = useCallback(
    async (customerId: string) => {
      setLedgerLoading(true);
      try {
        const result = await window.electronAPI.invoke('reports:getCustomerLedger', {
          token,
          customerId,
          pageSize: 100,
        });
        if (result?.error) throw new Error(result.error);
        setLedgerData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load ledger');
      } finally {
        setLedgerLoading(false);
      }
    },
    [token]
  );

  const handleViewLedger = (customer: { id: string; name: string }) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.name);
    setSubTab('ledger');
    loadLedger(customer.id);
  };

  return (
    <div className="space-y-4">
      {/* Sub Tabs */}
      <div className="flex items-center space-x-1.5 p-1 bg-surface-elevated/50 border border-border rounded-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('outstanding')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'outstanding'
              ? 'bg-surface-elevated text-primary border border-border shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Outstanding Receivables (AR)</span>
        </button>
        {selectedCustomerId && (
          <button
            type="button"
            onClick={() => setSubTab('ledger')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              subTab === 'ledger'
                ? 'bg-surface-elevated text-primary border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Ledger: {selectedCustomerName}</span>
          </button>
        )}
      </div>

      {/* Search Input for Outstanding */}
      {subTab === 'outstanding' && (
        <div className="flex items-center space-x-2 p-3 bg-surface border border-border rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by customer name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              className="w-full bg-input border border-border text-foreground text-xs pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-md shadow-primary/20 transition-all"
          >
            Search
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Outstanding Receivables ── */}
      {subTab === 'outstanding' && data && (
        <div className="space-y-4">
          <ReportSummaryCards
            cards={[
              {
                label: 'Total Outstanding Receivables',
                value: fmt(data.totalReceivables),
                color: 'blue',
                icon: <DollarSign className="w-4 h-4 text-blue-400" />,
              },
              {
                label: 'Customers with Due Khata',
                value: data.customersWithOutstanding,
                color: 'orange',
                icon: <Users className="w-4 h-4 text-primary" />,
              },
            ]}
          />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="Zero outstanding balances. All customer accounts are settled."
            columns={[
              { key: 'name', label: 'Customer Name', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'phone', label: 'Phone', render: (v) => v || '—' },
              {
                key: 'outstanding',
                label: 'Outstanding Khata',
                render: (v) => <span className="font-bold text-rose-400 text-sm">{fmt(v)}</span>,
                align: 'right',
                sortable: true,
              },
              {
                key: 'lastTransactionDate',
                label: 'Last Transaction',
                render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
              },
              {
                key: 'lastPaymentDate',
                label: 'Last Payment',
                render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
              },
              {
                key: 'status',
                label: 'Status',
                render: (v) => (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider uppercase border ${
                      v === 'ACTIVE'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                        : 'bg-surface-elevated text-muted-foreground border-border'
                    }`}
                  >
                    {v}
                  </span>
                ),
              },
              {
                key: 'id',
                label: 'Actions',
                align: 'right',
                render: (_, row) => (
                  <button
                    type="button"
                    onClick={() => handleViewLedger(row)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-primary hover:text-primary transition-colors"
                  >
                    <span>View Khata</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* ── Customer Ledger Statement ── */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-surface border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('outstanding')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Outstanding List</span>
            </button>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Customer Account</span>
              <span className="text-sm font-bold text-foreground">{selectedCustomerName}</span>
            </div>
          </div>

          <ReportDataTable<any>
            loading={ledgerLoading}
            keyField="id"
            data={ledgerData?.data || []}
            emptyMessage="No ledger transactions recorded for this customer."
            columns={[
              {
                key: 'createdAt',
                label: 'Timestamp',
                render: (v) => new Date(v).toLocaleDateString('en-IN'),
                sortable: true,
              },
              {
                key: 'type',
                label: 'Transaction Type',
                render: (v) => (
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-xs font-mono text-foreground">
                    {v.replace(/_/g, ' ')}
                  </span>
                ),
              },
              { key: 'notes', label: 'Notes', render: (v) => v || '—' },
              {
                key: 'debit',
                label: 'Debit (+ Due)',
                render: (v) =>
                  Number(v) > 0 ? (
                    <span className="font-semibold text-rose-400">+{fmt(v)}</span>
                  ) : (
                    '—'
                  ),
                align: 'right',
              },
              {
                key: 'credit',
                label: 'Credit (- Paid)',
                render: (v) =>
                  Number(v) > 0 ? (
                    <span className="font-semibold text-emerald-400">-{fmt(v)}</span>
                  ) : (
                    '—'
                  ),
                align: 'right',
              },
              {
                key: 'balance',
                label: 'Running Balance',
                render: (v) => (
                  <span
                    className={`font-bold ${
                      Number(v) > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {fmt(v)}
                  </span>
                ),
                align: 'right',
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};
