import React, { useState, useCallback, useEffect } from 'react';
import {
  Truck,
  Package,
  Building2,
  RotateCcw,
  DollarSign,
  Receipt,
  FileText,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { DateRangePicker, ReportPeriod } from './shared/DateRangePicker';
import { ReportSummaryCards } from './shared/ReportSummaryCards';
import { ReportDataTable } from './shared/ReportDataTable';
import { ProductImage } from '../../components/common/ProductImage';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SubTab = 'summary' | 'by-product' | 'by-supplier' | 'returns';

export const PurchasesReportView: React.FC<{ token: string }> = ({ token }) => {
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
      const q = { token, period, startDate, endDate };
      let result: any;
      if (subTab === 'summary') result = await window.electronAPI.invoke('reports:getPurchases', q);
      else if (subTab === 'by-product') result = await window.electronAPI.invoke('reports:getPurchasesByProduct', q);
      else if (subTab === 'by-supplier') result = await window.electronAPI.invoke('reports:getPurchasesBySupplier', q);
      else result = await window.electronAPI.invoke('reports:getPurchaseReturns', q);
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase report');
    } finally {
      setLoading(false);
    }
  }, [token, period, startDate, endDate, subTab]);

  useEffect(() => {
    load();
  }, [load]);

  const SUBTABS: { label: string; value: SubTab; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: 'Purchase Invoices', value: 'summary', icon: Receipt },
    { label: 'Purchases By Product', value: 'by-product', icon: Package },
    { label: 'Purchases By Supplier', value: 'by-supplier', icon: Building2 },
    { label: 'Purchase Returns (PR)', value: 'returns', icon: RotateCcw },
  ];

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

      {subTab === 'summary' && data?.summary && (
        <div className="space-y-4">
          <ReportSummaryCards
            cards={[
              {
                label: 'Gross Purchases',
                value: fmt(data.summary.grossPurchases),
                color: 'orange',
                icon: <Truck className="w-4 h-4 text-primary" />,
              },
              {
                label: 'Purchase Returns',
                value: fmt(data.summary.purchaseReturns),
                color: 'red',
                icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
              },
              {
                label: 'Net Purchases',
                value: fmt(data.summary.netPurchases),
                color: 'blue',
                icon: <DollarSign className="w-4 h-4 text-blue-400" />,
              },
              {
                label: 'Total Discount',
                value: fmt(data.summary.totalDiscount),
                color: 'teal',
                icon: <Tag className="w-4 h-4 text-teal-400" />,
              },
              {
                label: 'Total Tax',
                value: fmt(data.summary.totalTax),
                color: 'purple',
                icon: <FileText className="w-4 h-4 text-purple-400" />,
              },
              {
                label: 'Purchase Orders',
                value: data.summary.purchasesCount,
                color: 'green',
                icon: <Receipt className="w-4 h-4 text-emerald-400" />,
              },
            ]}
          />
          <ReportDataTable<any>
            loading={loading}
            keyField="id"
            data={data.data || []}
            emptyMessage="No purchases found for this period."
            columns={[
              { key: 'purchaseNumber', label: 'Purchase #', render: (v) => <span className="font-mono text-xs text-primary">{v}</span>, sortable: true },
              {
                key: 'purchaseDate',
                label: 'Date',
                render: (v) => new Date(v).toLocaleDateString('en-IN'),
                sortable: true,
              },
              { key: 'supplierName', label: 'Supplier', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'total', label: 'Total', render: (v) => fmt(v), align: 'right', sortable: true },
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
              { key: 'paymentMethod', label: 'Method' },
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

      {subTab === 'by-product' && data && (
        <div className="space-y-4">
          {data.totals && (
            <ReportSummaryCards
              cards={[
                {
                  label: 'Gross Purchased',
                  value: fmt(data.totals.grossPurchaseAmount),
                  color: 'orange',
                  icon: <Truck className="w-4 h-4 text-primary" />,
                },
                {
                  label: 'Returns',
                  value: fmt(data.totals.returnValue),
                  color: 'red',
                  icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
                },
                {
                  label: 'Net Purchased',
                  value: fmt(data.totals.netPurchaseAmount),
                  color: 'blue',
                  icon: <DollarSign className="w-4 h-4 text-blue-400" />,
                },
                {
                  label: 'Total Units',
                  value: data.totals.quantityPurchased,
                  color: 'teal',
                  icon: <Package className="w-4 h-4 text-teal-400" />,
                },
              ]}
            />
          )}
          <ReportDataTable<any>
            loading={loading}
            data={data.data || []}
            emptyMessage="No product purchases found."
            columns={[
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
              { key: 'quantityPurchased', label: 'Units In', align: 'right', sortable: true },
              { key: 'grossPurchaseAmount', label: 'Gross Amount', render: (v) => fmt(v), align: 'right', sortable: true },
              { key: 'returnQty', label: 'Return Qty', align: 'right' },
              { key: 'returnValue', label: 'Return Value', render: (v) => fmt(v), align: 'right' },
              { key: 'netPurchaseAmount', label: 'Net Amount', render: (v) => fmt(v), align: 'right', sortable: true },
            ]}
          />
        </div>
      )}

      {subTab === 'by-supplier' && data && (
        <div className="space-y-4">
          {data.totals && (
            <ReportSummaryCards
              cards={[
                {
                  label: 'Gross Purchases',
                  value: fmt(data.totals.grossPurchases),
                  color: 'orange',
                  icon: <Truck className="w-4 h-4 text-primary" />,
                },
                {
                  label: 'Returns',
                  value: fmt(data.totals.returnsValue),
                  color: 'red',
                  icon: <RotateCcw className="w-4 h-4 text-rose-400" />,
                },
                {
                  label: 'Net Purchases',
                  value: fmt(data.totals.netPurchases),
                  color: 'blue',
                  icon: <DollarSign className="w-4 h-4 text-blue-400" />,
                },
                {
                  label: 'Total Payable',
                  value: fmt(data.totals.outstanding),
                  color: 'red',
                  icon: <Building2 className="w-4 h-4 text-rose-400" />,
                },
              ]}
            />
          )}
          <ReportDataTable<any>
            loading={loading}
            data={data.data || []}
            emptyMessage="No supplier purchases found."
            columns={[
              { key: 'supplierName', label: 'Supplier', render: (v) => <span className="font-medium text-foreground">{v}</span>, sortable: true },
              { key: 'phone', label: 'Phone', render: (v) => v || '—' },
              { key: 'purchasesCount', label: 'Orders', align: 'right', sortable: true },
              { key: 'grossPurchases', label: 'Gross Billed', render: (v) => fmt(v), align: 'right', sortable: true },
              { key: 'returnsValue', label: 'Returns', render: (v) => fmt(v), align: 'right' },
              { key: 'netPurchases', label: 'Net Billed', render: (v) => fmt(v), align: 'right', sortable: true },
              {
                key: 'outstanding',
                label: 'Payable Due',
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
                label: 'Total Return Value',
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
            emptyMessage="No purchase returns found for this period."
            columns={[
              { key: 'returnNumber', label: 'PR #', render: (v) => <span className="font-mono text-xs text-primary">{v}</span>, sortable: true },
              { key: 'purchaseNumber', label: 'Orig Purchase #', render: (v) => <span className="font-mono text-xs text-muted-foreground">{v}</span> },
              {
                key: 'returnDate',
                label: 'Date',
                render: (v) => new Date(v).toLocaleDateString('en-IN'),
                sortable: true,
              },
              { key: 'supplierName', label: 'Supplier', render: (v) => <span className="font-medium text-foreground">{v}</span> },
              { key: 'totalAmount', label: 'Amount', render: (v) => <span className="font-semibold text-rose-400">{fmt(v)}</span>, align: 'right', sortable: true },
              { key: 'refundType', label: 'Refund Type', render: (v) => <span className="text-xs text-foreground">{v.replace(/_/g, ' ')}</span> },
              { key: 'itemCount', label: 'Items', align: 'center' },
            ]}
          />
        </div>
      )}
    </div>
  );
};
