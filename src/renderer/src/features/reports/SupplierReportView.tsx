import React, { useState, useCallback, useEffect } from 'react';
import {
  Building2,
  Search,
  ArrowLeft,
  AlertCircle,
  FileText,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportDataTable } from './shared/ReportDataTable';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SubTab = 'outstanding' | 'ledger';

export const SupplierReportView: React.FC<{ token: string }> = ({ token }) => {
  const [subTab, setSubTab] = useState<SubTab>('outstanding');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.invoke('reports:getSuppliersOutstanding', {
        token,
        search: search || undefined,
        pageSize: 100,
      });
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load payables data');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLedger = useCallback(
    async (supplierId: string) => {
      setLedgerLoading(true);
      try {
        const result = await window.electronAPI.invoke('reports:getSupplierLedger', {
          token,
          supplierId,
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

  const handleViewLedger = (supplier: { id: string; name: string }) => {
    setSelectedSupplierId(supplier.id);
    setSelectedSupplierName(supplier.name);
    setSubTab('ledger');
    loadLedger(supplier.id);
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
          <Building2 className="w-3.5 h-3.5" />
          <span>Outstanding Payables (AP)</span>
        </button>
        {selectedSupplierId && (
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
            <span>Ledger: {selectedSupplierName}</span>
          </button>
        )}
      </div>

      {/* Search Bar for Outstanding */}
      {subTab === 'outstanding' && (
        <div className="flex items-center space-x-2 p-3 bg-surface border border-border rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by supplier name, phone, or GSTIN…"
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

      {/* ── Outstanding Payables ── */}
      {subTab === 'outstanding' && data && (
        <div className="space-y-4">
          <ReportSummaryCards
            cards={[
              {
                label: 'Total Outstanding Payables',
                value: fmt(data.totalPayables),
                color: 'orange',
                icon: <DollarSign className="w-4 h-4 text-primary" />,
              },
              {
                label: 'Suppliers with Pending Due',
                value: data.suppliersWithOutstanding,
                color: 'red',
                icon: <Building2 className="w-4 h-4 text-rose-400" />,
              },
            ]}
          />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="Zero outstanding payables. All supplier invoices are fully cleared."
            columns={[
              { key: 'name', label: 'Supplier Name', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'phone', label: 'Phone', render: (v) => v || '—' },
              { key: 'gstin', label: 'GSTIN', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v || '—'}</span> },
              {
                key: 'outstanding',
                label: 'Payable Due',
                render: (v) => <span className="font-bold text-rose-400 text-sm">{fmt(v)}</span>,
                align: 'right',
                sortable: true,
              },
              {
                key: 'lastPurchaseDate',
                label: 'Last Purchase',
                render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
              },
              {
                key: 'lastPaymentDate',
                label: 'Last Payment',
                render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
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
                    <span>View Ledger</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* ── Supplier Ledger Statement ── */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-surface border border-border rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('outstanding')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Payables List</span>
            </button>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Supplier Account</span>
              <span className="text-sm font-bold text-foreground">{selectedSupplierName}</span>
            </div>
          </div>

          <ReportDataTable<any>
            loading={ledgerLoading}
            keyField="id"
            data={ledgerData?.data || []}
            emptyMessage="No ledger transactions recorded for this supplier."
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
                key: 'credit',
                label: 'Credit (+ Payable)',
                render: (v) =>
                  Number(v) > 0 ? (
                    <span className="font-semibold text-rose-400">+{fmt(v)}</span>
                  ) : (
                    '—'
                  ),
                align: 'right',
              },
              {
                key: 'debit',
                label: 'Debit (- Paid)',
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
                label: 'Running Payable',
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
