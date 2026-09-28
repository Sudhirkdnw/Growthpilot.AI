import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Package,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  Search,
  RefreshCw,
  Plus,
  Minus,
  SlidersHorizontal,
  FileText,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  TrendingDown,
  Info,
} from 'lucide-react';
import {
  ProductDTO,
  StockLedgerDTO,
  StockSummaryDTO,
  LowStockProductDTO,
  StockReconciliationDTO,
} from '../../../../shared/types';
import { useAuthStore } from '../../stores/authStore';
import { ProductImage } from '../../components/common/ProductImage';

export function InventoryView() {
  const session = useAuthStore((s) => s.session);
  const settings = useAuthStore((s) => s.settings);
  const currencySymbol = settings?.company?.currencySymbol || '₹';

  // Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'lowStock' | 'reconciliation'>('overview');

  // Summary Metrics
  const [summary, setSummary] = useState<StockSummaryDTO>({
    totalProducts: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  // Stock Catalog State (Overview)
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotalCount, setProductTotalCount] = useState(0);

  // Stock Ledger State
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerDTO[]>([]);
  const [ledgerFilterType, setLedgerFilterType] = useState<string>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);

  // Low Stock State
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProductDTO[]>([]);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [lowStockTotalPages, setLowStockTotalPages] = useState(1);

  // Reconciliation State
  const [reconciliationResults, setReconciliationResults] = useState<StockReconciliationDTO[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<{
    totalChecked: number;
    totalBalanced: number;
    discrepanciesCount: number;
  } | null>(null);
  const [reconciling, setReconciling] = useState(false);

  // Global Loading & Message Banners
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Stock Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [adjustType, setAdjustType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'>('ADJUSTMENT_IN');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('Physical Stock Correction');
  const [customReason, setCustomReason] = useState<string>('');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [allowNegativeOverride, setAllowNegativeOverride] = useState<boolean>(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const electronAPI = (window as any).electronAPI;

  // --------------------------------------------------------------------------
  // DATA LOADERS
  // --------------------------------------------------------------------------

  const loadSummary = useCallback(async () => {
    if (!electronAPI) return;
    try {
      const res = await electronAPI.invoke('inventory:getSummary');
      if (res && !res.error) {
        setSummary(res);
      }
    } catch (err) {
      console.error('[Inventory Summary Error]', err);
    }
  }, [electronAPI]);

  const loadProducts = useCallback(async () => {
    if (!electronAPI) return;
    setLoading(true);
    try {
      const res = await electronAPI.invoke('products:list', {
        search: productSearch.trim() || undefined,
        status: 'ALL',
        page: productPage,
        pageSize: 15,
      });
      setProducts(res.data || []);
      setProductTotalPages(res.totalPages || 1);
      setProductTotalCount(res.total || 0);
    } catch (err) {
      console.error('[Inventory Products Error]', err);
    } finally {
      setLoading(false);
    }
  }, [electronAPI, productSearch, productPage]);

  const loadLedger = useCallback(async () => {
    if (!electronAPI) return;
    setLoading(true);
    try {
      const res = await electronAPI.invoke('inventory:getLedger', {
        transactionType: ledgerFilterType !== 'ALL' ? ledgerFilterType : undefined,
        search: ledgerSearch.trim() || undefined,
        page: ledgerPage,
        pageSize: 20,
      });
      setLedgerEntries(res.data || []);
      setLedgerTotalPages(res.totalPages || 1);
      setLedgerTotalCount(res.total || 0);
    } catch (err) {
      console.error('[Inventory Ledger Error]', err);
    } finally {
      setLoading(false);
    }
  }, [electronAPI, ledgerFilterType, ledgerSearch, ledgerPage]);

  const loadLowStock = useCallback(async () => {
    if (!electronAPI) return;
    setLoading(true);
    try {
      const res = await electronAPI.invoke('inventory:getLowStock', {
        page: lowStockPage,
        pageSize: 25,
      });
      setLowStockProducts(res.data || []);
      setLowStockTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('[Inventory Low Stock Error]', err);
    } finally {
      setLoading(false);
    }
  }, [electronAPI, lowStockPage]);

  const runReconciliation = useCallback(async () => {
    if (!electronAPI) return;
    setReconciling(true);
    try {
      const res = await electronAPI.invoke('inventory:reconcileAll');
      if (res && !res.error) {
        setReconciliationResults(res.results || []);
        setReconciliationSummary({
          totalChecked: res.totalChecked,
          totalBalanced: res.totalBalanced,
          discrepanciesCount: res.discrepanciesCount,
        });
      }
    } catch (err) {
      console.error('[Inventory Reconciliation Error]', err);
    } finally {
      setReconciling(false);
    }
  }, [electronAPI]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadProducts();
    } else if (activeTab === 'ledger') {
      loadLedger();
    } else if (activeTab === 'lowStock') {
      loadLowStock();
    } else if (activeTab === 'reconciliation' && reconciliationResults.length === 0) {
      runReconciliation();
    }
  }, [activeTab, loadProducts, loadLedger, loadLowStock, runReconciliation, reconciliationResults.length]);

  // --------------------------------------------------------------------------
  // STOCK ADJUSTMENT ACTIONS
  // --------------------------------------------------------------------------

  const handleOpenAdjustModal = (product?: ProductDTO) => {
    setSelectedProduct(product || products[0] || null);
    setAdjustType('ADJUSTMENT_IN');
    setAdjustQuantity(1);
    setAdjustReason('Physical Stock Correction');
    setCustomReason('');
    setAdjustNotes('');
    setAllowNegativeOverride(false);
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!electronAPI || !session || !selectedProduct) return;

    const finalReason = adjustReason === 'Other' ? customReason.trim() : adjustReason;
    if (!finalReason) {
      setActionMessage({ type: 'error', text: 'Please specify a reason for this stock adjustment.' });
      return;
    }

    setAdjustSubmitting(true);
    try {
      const res = await electronAPI.invoke('inventory:adjustStock', {
        adjustment: {
          productId: selectedProduct.id,
          type: adjustType,
          quantity: Number(adjustQuantity),
          reason: finalReason,
          notes: adjustNotes.trim() || null,
          allowNegativeStockOverride: allowNegativeOverride,
        },
        token: session.token,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setActionMessage({
        type: 'success',
        text: `Stock successfully adjusted for "${res.productName}". New Balance: ${res.newBalance}.`,
      });

      setIsAdjustModalOpen(false);
      loadSummary();
      if (activeTab === 'overview') loadProducts();
      if (activeTab === 'ledger') loadLedger();
      if (activeTab === 'lowStock') loadLowStock();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to record stock adjustment' });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Preview resulting stock
  const currentStockVal = selectedProduct ? Number(selectedProduct.currentStock) : 0;
  const deltaVal = adjustType === 'ADJUSTMENT_IN' ? Number(adjustQuantity || 0) : -Number(adjustQuantity || 0);
  const resultingStockVal = currentStockVal + deltaVal;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : actionMessage.type === 'warning'
              ? 'bg-amber-950/80 border-amber-800 text-amber-300'
              : 'bg-red-950/80 border-red-800 text-red-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="opacity-70 hover:opacity-100 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Navigation Tabs */}
      <div className="flex items-center justify-between bg-surface border border-border p-4 rounded-xl shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Stock Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'ledger'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Stock Ledger Audit ({ledgerTotalCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('lowStock')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'lowStock'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Low Stock ({summary.lowStockCount + summary.outOfStockCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'reconciliation'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reconciliation</span>
          </button>
        </div>

        <button
          onClick={() => handleOpenAdjustModal()}
          className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/20 transition-all"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Adjust Stock</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Products</div>
          <div className="text-2xl font-bold font-mono text-foreground mt-1.5">
            {summary.totalProducts}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Active Catalog Items</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Valuation</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1.5">
            {currencySymbol}{summary.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Estimated Purchase Cost</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock Items</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1.5">
            {summary.lowStockCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">At or below reorder level</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Out of Stock</div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1.5">
            {summary.outOfStockCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Zero or depleted stock</div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TAB 1: STOCK OVERVIEW & VALUATION */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          {/* Filter / Search Bar */}
          <div className="p-4 border-b border-border flex items-center justify-between space-x-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search products by Name, SKU, or Barcode..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductPage(1);
                }}
                className="w-full bg-input border border-border rounded-lg px-4 py-2 pl-10 text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            </div>

            <button
              onClick={() => {
                loadSummary();
                loadProducts();
              }}
              className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs">Loading stock levels...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Boxes className="w-10 h-10 text-muted-foreground stroke-1" />
                <span className="text-sm font-semibold text-muted-foreground">No products found</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted sticky top-0 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Reorder Level</th>
                    <th className="py-3 px-4 text-right">Stock Valuation</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map((p) => {
                    const isOut = p.currentStock <= 0;
                    const isLow = p.currentStock <= p.reorderLevel && !isOut;
                    const stockVal = p.currentStock * p.purchasePrice;

                    return (
                      <tr key={p.id} className="hover:bg-surface-elevated transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{p.name}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{p.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{p.categoryName || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-foreground">
                          {currencySymbol}{p.purchasePrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-primary font-semibold">
                          {currencySymbol}{p.salePrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                          {p.currentStock} {p.unitCode}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          {p.reorderLevel} {p.unitCode}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {currencySymbol}{stockVal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isOut
                                ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                                : isLow
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            }`}
                          >
                            {isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenAdjustModal(p)}
                            className="bg-surface-elevated hover:bg-surface-muted text-foreground hover:text-primary px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-border bg-surface-muted flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing Page {productPage} of {productTotalPages} ({productTotalCount} total products)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={productPage <= 1}
                onClick={() => setProductPage((p) => p - 1)}
                className="px-3 py-1 rounded bg-surface-elevated disabled:opacity-30 hover:bg-surface-muted text-foreground"
              >
                Previous
              </button>
              <button
                disabled={productPage >= productTotalPages}
                onClick={() => setProductPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-surface-elevated disabled:opacity-30 hover:bg-surface-muted text-foreground"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 2: STOCK LEDGER AUDIT TRAIL (IMMUTABLE RECORD) */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'ledger' && (
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          {/* Controls Bar */}
          <div className="p-4 border-b border-border flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Search by Product, SKU, Reference, or Notes..."
                  value={ledgerSearch}
                  onChange={(e) => {
                    setLedgerSearch(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2 pl-10 text-xs text-foreground focus:outline-none focus:border-primary"
                />
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              </div>

              <select
                value={ledgerFilterType}
                onChange={(e) => {
                  setLedgerFilterType(e.target.value);
                  setLedgerPage(1);
                }}
                className="bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Transactions</option>
                <option value="OPENING">OPENING</option>
                <option value="PURCHASE">PURCHASE</option>
                <option value="SALE">SALE</option>
                <option value="ADJUSTMENT_IN">ADJUSTMENT_IN (+)</option>
                <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT (-)</option>
                <option value="RETURN_IN">RETURN_IN</option>
                <option value="RETURN_OUT">RETURN_OUT</option>
              </select>
            </div>

            <button
              onClick={loadLedger}
              className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Ledger Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs">Loading ledger entries...</span>
              </div>
            ) : ledgerEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <FileText className="w-10 h-10 text-muted-foreground stroke-1" />
                <span className="text-sm font-semibold text-muted-foreground">No stock movements recorded</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted sticky top-0 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4">Reference ID</th>
                    <th className="py-3 px-4 text-right">Movement</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4">Notes / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {ledgerEntries.map((e) => {
                    const isPositive = e.quantityChange > 0;
                    return (
                      <tr key={e.id} className="hover:bg-surface-elevated transition-colors">
                        <td className="py-3 px-4 text-muted-foreground font-sans">
                          {new Date(e.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <div className="font-semibold text-foreground">{e.productName}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{e.sku}</div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              e.transactionType === 'OPENING'
                                ? 'bg-blue-950 text-blue-400 border border-blue-800/50'
                                : e.transactionType === 'PURCHASE' || e.transactionType === 'ADJUSTMENT_IN' || e.transactionType === 'RETURN_IN'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                            }`}
                          >
                            {e.transactionType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground truncate max-w-[140px]" title={e.referenceId}>
                          {e.referenceId}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${e.quantityChange}` : e.quantityChange}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground font-bold">
                          {e.balanceAfter}
                        </td>
                        <td className="py-3 px-4 font-sans text-muted-foreground truncate max-w-xs" title={e.notes || ''}>
                          {e.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-border bg-surface-muted flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing Page {ledgerPage} of {ledgerTotalPages} ({ledgerTotalCount} total transactions)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={ledgerPage <= 1}
                onClick={() => setLedgerPage((p) => p - 1)}
                className="px-3 py-1 rounded bg-surface-elevated disabled:opacity-30 hover:bg-surface-muted text-foreground"
              >
                Previous
              </button>
              <button
                disabled={ledgerPage >= ledgerTotalPages}
                onClick={() => setLedgerPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-surface-elevated disabled:opacity-30 hover:bg-surface-muted text-foreground"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 3: LOW STOCK REPLENISHMENT ALERT */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'lowStock' && (
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Low Stock & Depleted Products Requiring Reorder
            </span>
            <button
              onClick={loadLowStock}
              className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs">Checking replenishment thresholds...</span>
              </div>
            ) : lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-emerald-500 space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-500 stroke-1" />
                <span className="text-sm font-semibold text-foreground">Stock Levels Healthy</span>
                <span className="text-xs text-muted-foreground">All products are currently above their reorder thresholds.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted sticky top-0 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">SKU / Barcode</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Reorder Threshold</th>
                    <th className="py-3 px-4 text-right">Deficit / Shortfall</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {lowStockProducts.map((p) => {
                    const isOut = p.stockStatus === 'OUT_OF_STOCK';
                    return (
                      <tr key={p.id} className="hover:bg-surface-elevated transition-colors">
                        <td className="py-3 px-4 font-sans font-semibold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <ProductImage
                              src={p.imageUrl}
                              name={p.name}
                              category={p.categoryName}
                              className="w-8 h-8 rounded-lg shrink-0 border border-border"
                              imageClassName="w-full h-full object-cover p-0"
                              iconClassName="w-4 h-4"
                            />
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div>{p.sku}</div>
                          <div className="text-[10px] text-muted-foreground">{p.barcode || 'No Barcode'}</div>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            isOut ? 'text-red-400' : 'text-amber-400'
                          }`}
                        >
                          {p.currentStock} {p.unitCode}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {p.reorderLevel} {p.unitCode}
                        </td>
                        <td className="py-3 px-4 text-right text-primary font-bold">
                          {p.difference} {p.unitCode}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOut
                                ? 'bg-red-950 text-red-400 border border-red-800/50'
                                : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                            }`}
                          >
                            {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <button
                            onClick={() =>
                              handleOpenAdjustModal({
                                id: p.id,
                                name: p.name,
                                sku: p.sku,
                                barcode: p.barcode,
                                unitCode: p.unitCode,
                                currentStock: p.currentStock,
                                reorderLevel: p.reorderLevel,
                                purchasePrice: p.purchasePrice,
                                salePrice: 0,
                                taxRate: 0,
                                openingStock: 0,
                                unitId: '',
                                status: 'ACTIVE',
                                createdAt: '',
                                updatedAt: '',
                              })
                            }
                            className="bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-1 rounded text-[11px] font-semibold transition-all shadow-md shadow-primary/20"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 4: RECONCILIATION DIAGNOSTIC */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'reconciliation' && (
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Cryptographic & Mathematical Stock Ledger Integrity Scanner
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Verifies invariant:{' '}
                <code className="text-primary">products.currentStock == sum(stock_ledger.quantityChange)</code>
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {reconciliationSummary && (
                <div className="text-xs flex items-center space-x-2">
                  <span className="text-emerald-400 font-semibold">
                    ✓ {reconciliationSummary.totalBalanced} Balanced
                  </span>
                  {reconciliationSummary.discrepanciesCount > 0 && (
                    <span className="text-red-400 font-semibold bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                      ⚠ {reconciliationSummary.discrepanciesCount} Discrepancies
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={runReconciliation}
                disabled={reconciling}
                className="flex items-center space-x-1.5 bg-surface-elevated hover:bg-surface-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-border"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
                <span>{reconciling ? 'Scanning Ledger...' : 'Run Integrity Scan'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {reconciling ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs">Reconstructing ledger historical balance for all products...</span>
              </div>
            ) : reconciliationResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <ShieldCheck className="w-10 h-10 text-muted-foreground stroke-1" />
                <span className="text-sm font-semibold text-muted-foreground">No scan results yet.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted sticky top-0 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-right">Cached Stock</th>
                    <th className="py-3 px-4 text-right">Ledger Sum</th>
                    <th className="py-3 px-4 text-center">Movements Count</th>
                    <th className="py-3 px-4 text-center">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {reconciliationResults.map((r) => (
                    <tr key={r.productId} className="hover:bg-surface-elevated transition-colors">
                      <td className="py-3 px-4 font-sans font-semibold text-foreground">{r.productName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{r.sku}</td>
                      <td className="py-3 px-4 text-right text-foreground">{r.cachedBalance}</td>
                      <td className="py-3 px-4 text-right text-foreground">{r.calculatedBalance}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{r.totalMovements}</td>
                      <td className="py-3 px-4 text-center font-sans">
                        {r.isBalanced ? (
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded text-[10px] font-bold">
                            BALANCED (100%)
                          </span>
                        ) : (
                          <span className="bg-red-950 text-red-400 border border-red-800/60 px-2 py-0.5 rounded text-[10px] font-bold">
                            DISCREPANCY (Δ {r.discrepancy})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* STOCK ADJUSTMENT MODAL DIALOG */}
      {/* ------------------------------------------------------------------- */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-muted backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Record Stock Adjustment</h3>
              </div>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Select Product *
                </label>
                <select
                  required
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === e.target.value);
                    if (found) setSelectedProduct(found);
                  }}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.currentStock} {p.unitCode}
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-surface-elevated/60 border border-border flex items-center gap-3">
                    <ProductImage
                      src={selectedProduct.imageUrl}
                      name={selectedProduct.name}
                      category={selectedProduct.categoryName}
                      className="w-10 h-10 rounded-lg shrink-0 border border-border"
                      imageClassName="w-full h-full object-cover p-0"
                      iconClassName="w-5 h-5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{selectedProduct.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        SKU: {selectedProduct.sku} | In Stock: <span className="text-primary font-bold">{selectedProduct.currentStock} {selectedProduct.unitCode}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Adjustment Direction */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Adjustment Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADJUSTMENT_IN')}
                    className={`flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                      adjustType === 'ADJUSTMENT_IN'
                        ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 shadow-md shadow-emerald-900/20'
                        : 'bg-input border-border text-muted-foreground hover:border-border'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Positive (Stock In)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('ADJUSTMENT_OUT')}
                    className={`flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                      adjustType === 'ADJUSTMENT_OUT'
                        ? 'bg-rose-950/80 border-rose-600 text-rose-300 shadow-md shadow-rose-900/20'
                        : 'bg-input border-border text-muted-foreground hover:border-border'
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                    <span>Negative (Stock Out)</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Adjustment Quantity ({selectedProduct?.unitCode || 'Units'}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Mandatory Business Reason *
                </label>
                <select
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="Physical Stock Correction">Physical Stock Correction</option>
                  <option value="Damaged Goods">Damaged Goods</option>
                  <option value="Expired Goods">Expired Goods</option>
                  <option value="Lost / Missing Goods">Lost / Missing Goods</option>
                  <option value="Stock Found (Surplus)">Stock Found (Surplus)</option>
                  <option value="Initial Audit Correction">Initial Audit Correction</option>
                  <option value="Other">Other (Custom Reason)</option>
                </select>
              </div>

              {adjustReason === 'Other' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Specify Custom Reason *
                  </label>
                  <input
                    type="text"
                    required
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter reason for adjustment"
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {/* Additional Remarks */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Audit reference, count sheet ID, or remarks..."
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Real-time Balance Preview */}
              <div className="p-4 rounded-xl bg-input border border-border space-y-2 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Cached Stock:</span>
                  <span className="text-foreground font-bold">
                    {currentStockVal} {selectedProduct?.unitCode}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Adjustment Delta:</span>
                  <span className={`font-bold ${deltaVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deltaVal >= 0 ? `+${deltaVal}` : deltaVal} {selectedProduct?.unitCode}
                  </span>
                </div>
                <div className="pt-2 border-t border-border flex justify-between font-bold text-sm">
                  <span className="text-foreground">Resulting Stock Balance:</span>
                  <span className={resultingStockVal < 0 ? 'text-red-400' : 'text-primary'}>
                    {resultingStockVal} {selectedProduct?.unitCode}
                  </span>
                </div>
              </div>

              {/* Negative Stock Policy Notice if applicable */}
              {resultingStockVal < 0 && (
                <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl space-y-2 text-xs text-red-300">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="font-bold">Negative Stock Warning</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This adjustment will reduce stock below zero to {resultingStockVal}.
                  </p>
                  <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowNegativeOverride}
                      onChange={(e) => setAllowNegativeOverride(e.target.checked)}
                      className="w-4 h-4 rounded text-primary bg-surface border-border"
                    />
                    <span className="text-xs text-foreground">
                      I confirm override of negative stock balance
                    </span>
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-border flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-primary/20 transition-all"
                >
                  {adjustSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Stock Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
