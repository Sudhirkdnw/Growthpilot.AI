import React, { useState, useCallback, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  ArrowDownUp,
  Search,
  Gem,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ListFilter,
} from 'lucide-react';
import { DateRangePicker, ReportPeriod } from './shared/DateRangePicker';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportDataTable } from './shared/ReportDataTable';
import { ProductImage } from '../../components/common/ProductImage';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

type SubTab = 'current-stock' | 'low-stock' | 'movement';

export const InventoryReportView: React.FC<{ token: string }> = ({ token }) => {
  const [period, setPeriod] = useState<ReportPeriod>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>();
  const [subTab, setSubTab] = useState<SubTab>('current-stock');
  const [search, setSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let result: any;
      if (subTab === 'current-stock') {
        result = await window.electronAPI.invoke('reports:getCurrentStock', {
          token,
          search: search || undefined,
          stockStatus: stockStatusFilter,
        });
      } else if (subTab === 'low-stock') {
        result = await window.electronAPI.invoke('reports:getLowStock', { token });
      } else {
        result = await window.electronAPI.invoke('reports:getStockMovement', {
          token,
          period,
          startDate,
          endDate,
          pageSize: 100,
        });
      }
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory report');
    } finally {
      setLoading(false);
    }
  }, [token, subTab, search, stockStatusFilter, period, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const SUBTABS = [
    { label: 'Current Valuation', value: 'current-stock' as SubTab, icon: Package },
    { label: 'Low Stock Alert', value: 'low-stock' as SubTab, icon: AlertTriangle },
    { label: 'Stock Movement Ledger', value: 'movement' as SubTab, icon: ArrowDownUp },
  ];

  const renderStockBadge = (status: string) => {
    switch (status) {
      case 'IN_STOCK':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            IN STOCK
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
            LOW STOCK
          </span>
        );
      case 'OUT_OF_STOCK':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
            OUT OF STOCK
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Filter (Movement only) */}
      {subTab === 'movement' && (
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
      )}

      {/* Sub Tabs */}
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

      {/* Search & Status Filters for Current Stock */}
      {subTab === 'current-stock' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-surface border border-border rounded-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by product name, SKU, or barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              className="w-full bg-input border border-border text-foreground text-xs pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            <ListFilter className="w-4 h-4 text-muted-foreground" />
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
              className="bg-input border border-border text-foreground text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-primary transition-colors"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="IN_STOCK">In Stock Only</option>
              <option value="LOW_STOCK">Low Stock (At / Below Reorder)</option>
              <option value="OUT_OF_STOCK">Out of Stock (Zero / Neg)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-md shadow-primary/20 transition-all"
          >
            Apply Filter
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl flex items-center space-x-2.5 text-rose-300 text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Current Stock Valuation ── */}
      {subTab === 'current-stock' && data && (
        <div className="space-y-4">
          <ReportSummaryCards
            cards={[
              {
                label: 'Total Stock Valuation',
                value: fmt(data.totalStockValue),
                color: 'purple',
                icon: <Gem className="w-4 h-4 text-purple-400" />,
              },
              {
                label: 'Total SKUs',
                value: data.totalProducts,
                color: 'blue',
                icon: <Package className="w-4 h-4 text-blue-400" />,
              },
              {
                label: 'In Stock',
                value: data.inStockCount,
                color: 'green',
                icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
              },
              {
                label: 'Low Stock Alerts',
                value: data.lowStockCount,
                color: data.lowStockCount > 0 ? 'red' : 'green',
                icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
              },
              {
                label: 'Out of Stock',
                value: data.outOfStockCount,
                color: data.outOfStockCount > 0 ? 'red' : 'green',
                icon: <XCircle className="w-4 h-4 text-rose-400" />,
              },
            ]}
          />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="No products match your inventory filter."
            columns={[
              { key: 'name', label: 'Product Name', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'sku', label: 'SKU', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v}</span> },
              { key: 'categoryName', label: 'Category', render: (v) => v || '—' },
              {
                key: 'currentStock',
                label: 'Current Stock',
                render: (v, row) => (
                  <span className="font-semibold text-foreground">
                    {fmtQty(v)} <span className="text-xs font-normal text-muted-foreground">{row.unitCode}</span>
                  </span>
                ),
                align: 'right',
                sortable: true,
              },
              {
                key: 'reorderLevel',
                label: 'Reorder Level',
                render: (v, row) => `${fmtQty(v)} ${row.unitCode}`,
                align: 'right',
              },
              { key: 'purchasePrice', label: 'Unit Cost', render: (v) => fmt(v), align: 'right' },
              { key: 'salePrice', label: 'Sale Price', render: (v) => fmt(v), align: 'right' },
              {
                key: 'stockValue',
                label: 'Total Value',
                render: (v) => <span className="font-semibold text-purple-300">{fmt(v)}</span>,
                align: 'right',
                sortable: true,
              },
              {
                key: 'stockStatus',
                label: 'Status',
                render: (v) => renderStockBadge(v),
              },
            ]}
          />
        </div>
      )}

      {/* ── Low Stock Alert ── */}
      {subTab === 'low-stock' && (
        <div className="space-y-4">
          {Array.isArray(data) && data.length > 0 && (
            <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl flex items-center space-x-2 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>{data.length} product(s)</strong> are at or below reorder threshold and require restocking.
              </span>
            </div>
          )}
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={Array.isArray(data) ? data : []}
            emptyMessage="All products are well-stocked above their reorder thresholds."
            columns={[
              { key: 'name', label: 'Product Name', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'sku', label: 'SKU', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v}</span> },
              { key: 'categoryName', label: 'Category', render: (v) => v || '—' },
              {
                key: 'currentStock',
                label: 'Current Stock',
                render: (v, row) => (
                  <span className="font-semibold text-rose-400">
                    {fmtQty(v)} {row.unitCode}
                  </span>
                ),
                align: 'right',
                sortable: true,
              },
              { key: 'reorderLevel', label: 'Reorder Level', render: (v, row) => `${fmtQty(v)} ${row.unitCode}`, align: 'right' },
              {
                key: 'difference',
                label: 'Shortfall',
                render: (v, row) => (
                  <span className="font-semibold text-amber-400">
                    {fmtQty(v)} {row.unitCode}
                  </span>
                ),
                align: 'right',
                sortable: true,
              },
              { key: 'purchasePrice', label: 'Unit Cost', render: (v) => fmt(v), align: 'right' },
              {
                key: 'stockStatus',
                label: 'Status',
                render: (v) => renderStockBadge(v),
              },
            ]}
          />
        </div>
      )}

      {/* ── Stock Movement ── */}
      {subTab === 'movement' && data && (
        <div className="space-y-4">
          <ReportSummaryCards
            cards={[
              {
                label: 'Total Units In',
                value: fmtQty(data.totalIn),
                color: 'green',
                icon: <ArrowDown className="w-4 h-4 text-emerald-400" />,
              },
              {
                label: 'Total Units Out',
                value: fmtQty(data.totalOut),
                color: 'red',
                icon: <ArrowUp className="w-4 h-4 text-rose-400" />,
              },
              {
                label: 'Total Movements',
                value: data.total,
                color: 'blue',
                icon: <ArrowDownUp className="w-4 h-4 text-blue-400" />,
              },
            ]}
          />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="No stock ledger movements found for this period."
            columns={[
              {
                key: 'date',
                label: 'Timestamp',
                render: (v) => new Date(v).toLocaleString('en-IN'),
                sortable: true,
              },
              {
                key: 'productName',
                label: 'Product',
                render: (v, row) => (
                  <div className="flex items-center gap-2.5">
                    <ProductImage
                      src={row?.imageUrl}
                      name={v}
                      category={row?.categoryName}
                      className="w-7 h-7 rounded shrink-0 border border-border"
                      imageClassName="w-full h-full object-cover p-0"
                      iconClassName="w-3.5 h-3.5"
                    />
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ),
                sortable: true,
              },
              { key: 'sku', label: 'SKU', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v}</span> },
              {
                key: 'transactionType',
                label: 'Transaction Type',
                render: (v) => (
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-xs font-mono text-foreground">
                    {v.replace(/_/g, ' ')}
                  </span>
                ),
              },
              {
                key: 'quantityIn',
                label: 'Qty In',
                render: (v) => (v > 0 ? <span className="font-semibold text-emerald-400">+{fmtQty(v)}</span> : '—'),
                align: 'right',
              },
              {
                key: 'quantityOut',
                label: 'Qty Out',
                render: (v) => (v > 0 ? <span className="font-semibold text-rose-400">-{fmtQty(v)}</span> : '—'),
                align: 'right',
              },
              {
                key: 'balanceAfter',
                label: 'Balance After',
                render: (v) => <span className="font-bold text-foreground">{fmtQty(v)}</span>,
                align: 'right',
                sortable: true,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};
