import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  Tag,
  Boxes,
  Layers,
  RefreshCw,
  Power,
  SlidersHorizontal,
  Download,
  Upload,
} from 'lucide-react';
import { ProductDTO, CategoryDTO, BrandDTO, UnitDTO } from '../../../../shared/types';
import { useAuthStore } from '../../stores/authStore';
import { SmartAddProductModal } from './SmartAddProductModal';
import { ProductImportModal } from './ProductImportModal';
import { exportToCsv } from '../../utils/csvHelper';
import { formatQuantity, formatUnitPrice } from '../../../../shared/utils/quantity';
import { ProductImage } from '../../components/common/ProductImage';

export function ProductCatalogView() {
  const session = useAuthStore((s) => s.session);
  const settings = useAuthStore((s) => s.settings);
  const currencySymbol = settings?.company?.currencySymbol || '₹';

  // Navigation State
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'brands' | 'units'>('products');
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [brands, setBrands] = useState<BrandDTO[]>([]);
  const [units, setUnits] = useState<UnitDTO[]>([]);

  // Filtering & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ACTIVE');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Modals State: Product
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<ProductDTO | null>(null);

  // Modals State: Meta (Category / Subcategory / Brand / Unit)
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaType, setMetaType] = useState<'category' | 'subcategory' | 'brand' | 'unit'>('category');
  const [metaParentCategoryId, setMetaParentCategoryId] = useState<string>('');
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [metaName, setMetaName] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaCode, setMetaCode] = useState('');
  const [metaAllowDecimal, setMetaAllowDecimal] = useState(false);
  const [metaStatus, setMetaStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [deleteConfirmMeta, setDeleteConfirmMeta] = useState<{
    type: 'category' | 'subcategory' | 'brand' | 'unit';
    id: string;
    name: string;
    productCount: number;
  } | null>(null);

  const electronAPI = (window as any).electronAPI;

  const loadDependencies = useCallback(async () => {
    if (!electronAPI) return;
    try {
      const [cats, brs, unts] = await Promise.all([
        electronAPI.invoke('categories:list', true),
        electronAPI.invoke('brands:list', true),
        electronAPI.invoke('units:list', true),
      ]);
      setCategories(cats || []);
      setBrands(brs || []);
      setUnits(unts || []);
    } catch (err) {
      console.error('[Load Dependencies Error]', err);
    }
  }, [electronAPI]);

  const loadProducts = useCallback(async () => {
    if (!electronAPI) return;
    setLoading(true);
    try {
      const result = await electronAPI.invoke('products:list', {
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        brandId: selectedBrand || undefined,
        status: statusFilter,
        page,
        pageSize: 15,
      });

      setProducts(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.total || 0);
    } catch (err) {
      console.error('[Load Products Error]', err);
    } finally {
      setLoading(false);
    }
  }, [electronAPI, search, selectedCategory, selectedBrand, statusFilter, page]);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: ProductDTO) => {
    setEditingProduct(p);
    setIsProductModalOpen(true);
  };

  // CSV Export Handler
  const handleExportCsv = async () => {
    if (!electronAPI) return;
    setIsExporting(true);
    try {
      const res = await electronAPI.invoke('products:list', {
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        brandId: selectedBrand || undefined,
        status: statusFilter,
        page: 1,
        pageSize: 10000,
      });

      const exportList: ProductDTO[] = res?.data || products;
      if (!exportList || exportList.length === 0) {
        setActionMessage({ type: 'warning', text: 'No products found to export.' });
        return;
      }

      const columns = [
        { key: 'name', label: 'Product Name' },
        { key: 'sku', label: 'SKU' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'salePrice', label: 'Sale Price' },
        { key: 'purchasePrice', label: 'Cost Price' },
        { key: 'categoryName', label: 'Category' },
        { key: 'subcategoryName', label: 'Subcategory' },
        { key: 'brandName', label: 'Brand' },
        { key: 'unitCode', label: 'Unit' },
        { key: 'taxRate', label: 'Tax Rate (%)' },
        { key: 'currentStock', label: 'Current Stock' },
        { key: 'reorderLevel', label: 'Reorder Level' },
        { key: 'status', label: 'Status' },
        { key: 'imageUrl', label: 'Image URL' },
      ];

      const rows = exportList.map((p) => ({
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || '',
        salePrice: p.salePrice,
        purchasePrice: p.purchasePrice,
        categoryName: p.categoryName || '',
        subcategoryName: p.subcategoryName || '',
        brandName: p.brandName || '',
        unitCode: p.unitCode || '',
        taxRate: p.taxRate,
        currentStock: p.currentStock,
        reorderLevel: p.reorderLevel,
        status: p.status,
        imageUrl: p.imageUrl || '',
      }));

      const dateStr = new Date().toISOString().slice(0, 10);
      exportToCsv(`products_catalog_${dateStr}`, rows, columns);

      setActionMessage({
        type: 'success',
        text: `Exported ${rows.length} products to CSV successfully.`,
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Failed to export CSV: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Quick Product Status Toggle
  const handleToggleProductStatus = async (p: ProductDTO) => {
    if (!electronAPI || !session) return;
    const newStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await electronAPI.invoke('products:update', {
        id: p.id,
        data: { status: newStatus },
        token: session.token,
      });
      if (res.error) throw new Error(res.error);
      setActionMessage({
        type: 'success',
        text: `Product "${p.name}" status changed to ${newStatus}.`,
      });
      loadProducts();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update status' });
    }
  };

  // Deactivate or Delete Product
  const handleDeleteOrDeactivateProduct = async () => {
    if (!deleteConfirmProduct || !electronAPI || !session) return;

    try {
      const res = await electronAPI.invoke('products:delete', {
        id: deleteConfirmProduct.id,
        token: session.token,
      });

      if (res.error) throw new Error(res.error);

      setActionMessage({
        type: res.action === 'DEACTIVATED' ? 'warning' : 'success',
        text: res.message,
      });

      setDeleteConfirmProduct(null);
      loadProducts();
      loadDependencies();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Action failed' });
    }
  };

  // --------------------------------------------------------------------------
  // CATEGORY, BRAND, UNIT MANAGEMENT (MODALS & ACTIONS)
  // --------------------------------------------------------------------------

  const handleOpenAddMeta = (type: 'category' | 'subcategory' | 'brand' | 'unit', parentCatId?: string) => {
    setMetaType(type);
    setMetaParentCategoryId(parentCatId || (categories[0]?.id || ''));
    setEditingMetaId(null);
    setMetaName('');
    setMetaDescription('');
    setMetaCode('');
    setMetaAllowDecimal(false);
    setMetaStatus('ACTIVE');
    setIsMetaModalOpen(true);
  };

  const handleOpenEditMeta = (type: 'category' | 'subcategory' | 'brand' | 'unit', item: any) => {
    setMetaType(type);
    setMetaParentCategoryId(item.categoryId || '');
    setEditingMetaId(item.id);
    setMetaName(item.name);
    setMetaDescription(item.description || '');
    setMetaCode(item.shortCode || '');
    setMetaAllowDecimal(Boolean(item.allowDecimal));
    setMetaStatus(item.status || 'ACTIVE');
    setIsMetaModalOpen(true);
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!electronAPI || !session || !metaName.trim()) return;

    try {
      if (editingMetaId) {
        // Update
        if (metaType === 'category') {
          const res = await electronAPI.invoke('categories:update', {
            id: editingMetaId,
            data: { name: metaName.trim(), description: metaDescription.trim() || null, status: metaStatus },
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        } else if (metaType === 'subcategory') {
          const res = await electronAPI.invoke('subcategories:update', {
            id: editingMetaId,
            data: { name: metaName.trim(), description: metaDescription.trim() || null, status: metaStatus },
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        } else if (metaType === 'brand') {
          const res = await electronAPI.invoke('brands:update', {
            id: editingMetaId,
            data: { name: metaName.trim(), status: metaStatus },
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        } else {
          const res = await electronAPI.invoke('units:update', {
            id: editingMetaId,
            data: {
              name: metaName.trim(),
              shortCode: metaCode.trim().toUpperCase(),
              allowDecimal: metaAllowDecimal,
              status: metaStatus,
            },
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        }
        setActionMessage({ type: 'success', text: `${metaType.toUpperCase()} updated successfully.` });
      } else {
        // Create
        if (metaType === 'category') {
          const res = await electronAPI.invoke('categories:create', {
            name: metaName.trim(),
            description: metaDescription.trim() || null,
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        } else if (metaType === 'subcategory') {
          if (!metaParentCategoryId) {
            throw new Error('Please select a parent category for the subcategory.');
          }
          const res = await electronAPI.invoke('subcategories:create', {
            name: metaName.trim(),
            categoryId: metaParentCategoryId,
            description: metaDescription.trim() || null,
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        } else if (metaType === 'brand') {
          const res = await electronAPI.invoke('brands:create', {
            name: metaName.trim(),
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        } else {
          const res = await electronAPI.invoke('units:create', {
            name: metaName.trim(),
            shortCode: (metaCode.trim() || metaName.slice(0, 3)).toUpperCase(),
            allowDecimal: metaAllowDecimal,
            token: session.token,
          });
          if (res.error) throw new Error(res.error);
        }
        setActionMessage({ type: 'success', text: `${metaType.toUpperCase()} created successfully.` });
      }

      setIsMetaModalOpen(false);
      loadDependencies();
      loadProducts();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || `Failed to save ${metaType}` });
    }
  };

  const handleToggleMetaStatus = async (type: 'category' | 'subcategory' | 'brand' | 'unit', item: any) => {
    if (!electronAPI || !session) return;
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      if (type === 'category') {
        await electronAPI.invoke('categories:update', { id: item.id, data: { status: newStatus }, token: session.token });
      } else if (type === 'subcategory') {
        await electronAPI.invoke('subcategories:update', { id: item.id, data: { status: newStatus }, token: session.token });
      } else if (type === 'brand') {
        await electronAPI.invoke('brands:update', { id: item.id, data: { status: newStatus }, token: session.token });
      } else {
        await electronAPI.invoke('units:update', { id: item.id, data: { status: newStatus }, token: session.token });
      }
      setActionMessage({ type: 'success', text: `${type.toUpperCase()} "${item.name}" marked ${newStatus}.` });
      loadDependencies();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update status' });
    }
  };

  const handleDeleteMeta = async () => {
    if (!deleteConfirmMeta || !electronAPI || !session) return;
    const { type, id, name } = deleteConfirmMeta;

    try {
      let res: any;
      if (type === 'category') {
        res = await electronAPI.invoke('categories:delete', { id, token: session.token });
      } else if (type === 'subcategory') {
        res = await electronAPI.invoke('subcategories:delete', { id, token: session.token });
      } else if (type === 'brand') {
        res = await electronAPI.invoke('brands:delete', { id, token: session.token });
      } else {
        res = await electronAPI.invoke('units:delete', { id, token: session.token });
      }

      if (res?.error) {
        throw new Error(res.error);
      }

      setActionMessage({ type: 'success', text: `${type.toUpperCase()} "${name}" was deleted successfully.` });
      setDeleteConfirmMeta(null);
      loadDependencies();
      loadProducts();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || `Failed to delete ${type}` });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Alert Notification Banner */}
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
            onClick={() => setActiveTab('products')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'products'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Products ({totalCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'categories'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Categories ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('brands')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'brands'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Brands ({brands.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'units'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Units ({units.length})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'products' ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCsv}
                disabled={isExporting}
                title="Export products to CSV spreadsheet"
                className="flex items-center space-x-1.5 bg-surface-elevated hover:bg-surface-muted text-foreground px-3 py-2 rounded-lg text-xs font-semibold border border-border transition-all shadow-sm disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                title="Bulk import products from CSV spreadsheet"
                className="flex items-center space-x-1.5 bg-surface-elevated hover:bg-surface-muted text-foreground px-3 py-2 rounded-lg text-xs font-semibold border border-border transition-all shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>

              <button
                onClick={handleOpenAddProduct}
                className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-primary/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Product</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleOpenAddMeta(activeTab === 'categories' ? 'category' : activeTab === 'brands' ? 'brand' : 'unit')}
              className="flex items-center space-x-2 bg-surface-elevated hover:bg-surface-muted text-foreground px-4 py-2 rounded-lg text-xs font-bold transition-all border border-border shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add {activeTab.slice(0, -1).toUpperCase()}</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* PRODUCTS TAB */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'products' && (
        <div className="flex-1 flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          {/* Search & Filter Controls */}
          <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <input
                type="text"
                placeholder="Search products by Name, SKU, or Barcode..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-input border border-border rounded-lg px-4 py-2.5 pl-10 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
            </div>

            <div className="flex items-center space-x-2.5 text-xs">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Brand Filter */}
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                  setPage(1);
                }}
                className="bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
                <option value="ALL">All Status</option>
              </select>

              <button
                onClick={loadProducts}
                className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh Product List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Product Data Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs">Loading master products...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground space-y-2">
                <Package className="w-10 h-10 text-muted-foreground stroke-1" />
                <span className="text-sm font-semibold text-muted-foreground">No products found</span>
                <span className="text-xs">Try adjusting your filters or create a new product.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted sticky top-0 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product / SKU</th>
                    <th className="py-3 px-4">Barcode</th>
                    <th className="py-3 px-4">Category / Brand</th>
                    <th className="py-3 px-4 text-right">Cost Price</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Stock Level</th>
                    <th className="py-3 px-4 text-right">Stock Value</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map((p) => {
                    const isLowStock = p.currentStock <= p.reorderLevel;
                    const stockValue = p.currentStock * p.purchasePrice;
                    return (
                      <tr key={p.id} className="hover:bg-surface-elevated transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={p.imageUrl}
                              name={p.name}
                              category={p.categoryName}
                              className="w-10 h-10 rounded-lg object-cover border border-border shrink-0 bg-surface-elevated"
                              imageClassName="w-full h-full object-cover p-0"
                              iconClassName="w-5 h-5"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate max-w-[200px]">{p.name}</div>
                              <div className="text-[11px] font-mono text-muted-foreground">{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">
                          {p.barcode ? (
                            <span className="bg-surface-elevated px-2 py-0.5 rounded border border-slate-700/60">
                              {p.barcode}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">No Barcode</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          <div className="font-medium text-foreground">{p.categoryName || '—'}</div>
                          {p.subcategoryName && (
                            <div className="text-[10px] text-primary font-semibold">{p.subcategoryName}</div>
                          )}
                          <div className="text-[11px] text-muted-foreground">{p.brandName || '—'}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-foreground">
                          {formatUnitPrice(p.purchasePrice, p.unitCode, currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-primary">
                          {formatUnitPrice(p.salePrice, p.unitCode, currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              isLowStock
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                                : 'text-foreground'
                            }`}
                          >
                            {formatQuantity(p.currentStock, p.unitCode, p.precision)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {currencySymbol}{stockValue.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleProductStatus(p)}
                            title={`Click to ${p.status === 'ACTIVE' ? 'deactivate' : 'activate'}`}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-transform hover:scale-105 ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                : 'bg-surface-elevated text-muted-foreground border border-border'
                            }`}
                          >
                            {p.status}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-primary transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleProductStatus(p)}
                              className={`p-1.5 rounded-md hover:bg-surface-elevated transition-colors ${
                                p.status === 'ACTIVE'
                                  ? 'text-emerald-400 hover:text-amber-400'
                                  : 'text-muted-foreground hover:text-emerald-400'
                              }`}
                              title={p.status === 'ACTIVE' ? 'Deactivate Product' : 'Reactivate Product'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmProduct(p)}
                              className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-red-400 transition-colors"
                              title="Delete / Soft Deactivate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t border-border bg-surface-muted flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing Page {page} of {totalPages} ({totalCount} total products)
            </span>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded bg-surface-elevated disabled:opacity-30 hover:bg-surface-muted text-foreground transition-colors"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-surface-elevated disabled:opacity-30 hover:bg-surface-muted text-foreground transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* CATEGORIES TAB */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'categories' && (
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Categories ({categories.length} total)
            </span>
            <button
              onClick={() => handleOpenAddMeta('category')}
              className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
                <Layers className="w-8 h-8 text-muted-foreground stroke-1" />
                <span className="text-xs">No categories registered yet.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Assigned Products</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-elevated transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <div>{c.name}</div>
                        {c.subcategories && c.subcategories.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {c.subcategories.map((sub) => (
                              <span
                                key={sub.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-normal border ${
                                  sub.status === 'ACTIVE'
                                    ? 'bg-surface-elevated border-border text-foreground'
                                    : 'bg-surface-muted border-border/50 text-muted-foreground line-through'
                                }`}
                              >
                                <span>{sub.name}</span>
                                <span className="text-[9px] text-muted-foreground">({sub.productCount ?? 0})</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditMeta('subcategory', sub);
                                  }}
                                  className="hover:text-primary p-0.5"
                                  title="Edit Subcategory"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmMeta({
                                      type: 'subcategory',
                                      id: sub.id,
                                      name: sub.name,
                                      productCount: sub.productCount ?? 0,
                                    });
                                  }}
                                  className="hover:text-red-400 p-0.5"
                                  title="Delete Subcategory"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleOpenAddMeta('subcategory', c.id)}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors"
                              title="Add subcategory to this category"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Subcategory</span>
                            </button>
                          </div>
                        )}
                        {(!c.subcategories || c.subcategories.length === 0) && (
                          <div className="mt-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAddMeta('subcategory', c.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-normal"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Subcategory</span>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{c.description || '—'}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="bg-surface-elevated px-2 py-0.5 rounded text-foreground">
                          {c.productCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleMetaStatus('category', c)}
                          title="Click to toggle status"
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-transform hover:scale-105 ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-surface-elevated text-muted-foreground border border-border'
                          }`}
                        >
                          {c.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditMeta('category', c)}
                            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-primary transition-colors"
                            title="Edit Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirmMeta({
                                type: 'category',
                                id: c.id,
                                name: c.name,
                                productCount: c.productCount ?? 0,
                              })
                            }
                            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
      {/* BRANDS TAB */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'brands' && (
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Brands ({brands.length} total)</span>
            <button
              onClick={() => handleOpenAddMeta('brand')}
              className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Brand</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {brands.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
                <Tag className="w-8 h-8 text-muted-foreground stroke-1" />
                <span className="text-xs">No brands registered yet.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Brand Name</th>
                    <th className="py-3 px-4 text-center">Assigned Products</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {brands.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-elevated transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{b.name}</td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="bg-surface-elevated px-2 py-0.5 rounded text-foreground">
                          {b.productCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleMetaStatus('brand', b)}
                          title="Click to toggle status"
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-transform hover:scale-105 ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-surface-elevated text-muted-foreground border border-border'
                          }`}
                        >
                          {b.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditMeta('brand', b)}
                            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-primary transition-colors"
                            title="Edit Brand"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirmMeta({
                                type: 'brand',
                                id: b.id,
                                name: b.name,
                                productCount: b.productCount ?? 0,
                              })
                            }
                            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete Brand"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
      {/* UNITS TAB */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'units' && (
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Units ({units.length} total)</span>
            <button
              onClick={() => handleOpenAddMeta('unit')}
              className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md shadow-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Unit</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {units.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2">
                <Boxes className="w-8 h-8 text-muted-foreground stroke-1" />
                <span className="text-xs">No units configured.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-muted border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Unit Name</th>
                    <th className="py-3 px-4">Short Code</th>
                    <th className="py-3 px-4">Fractional / Decimals</th>
                    <th className="py-3 px-4 text-center">Assigned Products</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {units.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-elevated transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{u.name}</td>
                      <td className="py-3 px-4 font-mono text-foreground">
                        <span className="bg-surface-elevated px-2 py-0.5 rounded border border-slate-700/60">
                          {u.shortCode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            u.allowDecimal
                              ? 'bg-blue-950 text-blue-400 border border-blue-800/50'
                              : 'bg-surface-elevated text-muted-foreground'
                          }`}
                        >
                          {u.allowDecimal ? 'Decimals Allowed (e.g. 1.250)' : 'Whole Units Only'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="bg-surface-elevated px-2 py-0.5 rounded text-foreground">
                          {u.productCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleMetaStatus('unit', u)}
                          title="Click to toggle status"
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-transform hover:scale-105 ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-surface-elevated text-muted-foreground border border-border'
                          }`}
                        >
                          {u.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditMeta('unit', u)}
                            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-primary transition-colors"
                            title="Edit Unit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirmMeta({
                                type: 'unit',
                                id: u.id,
                                name: u.name,
                                productCount: u.productCount ?? 0,
                              })
                            }
                            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete Unit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <SmartAddProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        categories={categories}
        brands={brands}
        units={units}
        onDependenciesChange={loadDependencies}
        onProductSaved={(product, wasAddAnother) => {
          setActionMessage({
            type: 'success',
            text: editingProduct
              ? `Product "${product.name}" updated successfully.`
              : `Product "${product.name}" created successfully.`,
          });
          loadProducts();
          loadDependencies();
        }}
      />

      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        units={units}
        onImportComplete={() => {
          loadProducts();
          loadDependencies();
        }}
      />

      {/* ------------------------------------------------------------------- */}
      {/* PRODUCT DELETE / DEACTIVATE CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------------- */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-surface-muted backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-foreground">Remove or Deactivate Product?</h3>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to remove <strong>"{deleteConfirmProduct.name}"</strong>?
              </p>
            </div>

            <div className="p-3 bg-input border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
              <strong>Enterprise Integrity Rule:</strong> If this product has any historical sales, purchases, or stock ledger movements, it will be <strong>soft-deactivated</strong> to preserve historical accounting and audit trails.
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setDeleteConfirmProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-elevated text-foreground text-xs font-semibold hover:bg-surface-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrDeactivateProduct}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* ADD / EDIT META (Category / Brand / Unit) MODAL */}
      {/* ------------------------------------------------------------------- */}
      {isMetaModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-muted backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">
                {editingMetaId ? `Edit ${metaType}` : `Add New ${metaType}`}
              </h3>
              <button onClick={() => setIsMetaModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMeta} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value)}
                  placeholder={`Enter ${metaType} name`}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {metaType === 'subcategory' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Parent Category *</label>
                  <select
                    value={metaParentCategoryId}
                    onChange={(e) => setMetaParentCategoryId(e.target.value)}
                    disabled={Boolean(editingMetaId)}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(metaType === 'category' || metaType === 'subcategory') && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Brief description"
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {metaType === 'unit' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Short Code *</label>
                    <input
                      type="text"
                      required
                      value={metaCode}
                      onChange={(e) => setMetaCode(e.target.value)}
                      placeholder="e.g. PCS, KG, BOX"
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground uppercase focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      id="metaDecimal"
                      checked={metaAllowDecimal}
                      onChange={(e) => setMetaAllowDecimal(e.target.checked)}
                      className="w-4 h-4 rounded text-primary bg-input border-border"
                    />
                    <label htmlFor="metaDecimal" className="text-xs text-foreground cursor-pointer">
                      Allow fractional quantities (e.g. 1.250 KG)
                    </label>
                  </div>
                </>
              )}

              {editingMetaId && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
                  <select
                    value={metaStatus}
                    onChange={(e) => setMetaStatus(e.target.value as any)}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              )}

              <div className="pt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMetaModalOpen(false)}
                  className="flex-1 py-2 rounded-lg bg-surface-elevated text-muted-foreground text-xs font-semibold hover:bg-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-all shadow-md shadow-primary/20"
                >
                  {editingMetaId ? 'Save Changes' : `Create ${metaType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* DELETE / DEACTIVATE CONFIRMATION FOR META (Category / Brand / Unit) */}
      {/* ------------------------------------------------------------------- */}
      {deleteConfirmMeta && (
        <div className="fixed inset-0 z-50 bg-surface-muted backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-foreground">
                Delete {deleteConfirmMeta.type.toUpperCase()}?
              </h3>
              <p className="text-xs text-muted-foreground">
                Are you sure you want to delete <strong>"{deleteConfirmMeta.name}"</strong>?
              </p>
            </div>

            {deleteConfirmMeta.productCount > 0 ? (
              <div className="p-3 bg-amber-950/80 border border-amber-800 rounded-xl text-xs text-amber-300 leading-relaxed">
                <strong>Relational Integrity Protection:</strong> {deleteConfirmMeta.productCount} product(s) are assigned to this {deleteConfirmMeta.type}. Hard deletion is prevented by the system. Please reassign the products or mark it inactive instead.
              </div>
            ) : (
              <div className="p-3 bg-input border border-border rounded-xl text-xs text-muted-foreground leading-relaxed">
                This {deleteConfirmMeta.type} currently has zero products assigned and can be safely deleted.
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setDeleteConfirmMeta(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-elevated text-foreground text-xs font-semibold hover:bg-surface-muted transition-colors"
              >
                Cancel
              </button>
              {deleteConfirmMeta.productCount > 0 ? (
                <button
                  onClick={() => {
                    handleToggleMetaStatus(deleteConfirmMeta.type, {
                      id: deleteConfirmMeta.id,
                      name: deleteConfirmMeta.name,
                      status: 'ACTIVE',
                    });
                    setDeleteConfirmMeta(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all"
                >
                  Deactivate Instead
                </button>
              ) : (
                <button
                  onClick={handleDeleteMeta}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
