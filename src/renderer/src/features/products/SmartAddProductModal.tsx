import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Sparkles,
  Barcode,
  Tag,
  Boxes,
  Layers,
  AlertTriangle,
  CheckCircle,
  Loader2,
  HelpCircle,
  Hash,
  DollarSign,
  TrendingUp,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import { ProductDTO, CategoryDTO, BrandDTO, UnitDTO, SubcategoryDTO } from '../../../../shared/types';
import { useAuthStore } from '../../stores/authStore';

interface SmartAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: ProductDTO | null;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  units: UnitDTO[];
  onDependenciesChange?: () => void;
  onProductSaved: (product: ProductDTO, wasAddAnother?: boolean) => void;
}

export const SmartAddProductModal: React.FC<SmartAddProductModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  categories,
  brands,
  units,
  onDependenciesChange,
  onProductSaved,
}) => {
  const session = useAuthStore((s) => s.session);
  const settings = useAuthStore((s) => s.settings);
  const currencySymbol = settings?.company?.currencySymbol || '₹';
  const electronAPI = (window as any).electronAPI;

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // Form State
  // ----------------------------------------------------
  const [name, setName] = useState('');
  const [salePrice, setSalePrice] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [allowSellByAmount, setAllowSellByAmount] = useState<boolean>(false);
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [availableSubcategories, setAvailableSubcategories] = useState<SubcategoryDTO[]>([]);
  const [brandId, setBrandId] = useState<string>('');

  // Advanced / Collapsible State
  const [isMoreDetailsOpen, setIsMoreDetailsOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [isCustomSku, setIsCustomSku] = useState(false);
  const [previewSku, setPreviewSku] = useState('SKU-Auto');
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [mrp, setMrp] = useState<string>('');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [openingStock, setOpeningStock] = useState<string>('0');
  const [reorderLevel, setReorderLevel] = useState<string>('10');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI / Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{ name: string; sku: string; price: number } | null>(null);

  // Inline Meta Creator State
  const [inlineCreator, setInlineCreator] = useState<'category' | 'subcategory' | 'brand' | null>(null);
  const [inlineName, setInlineName] = useState('');
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // ----------------------------------------------------
  // Subcategories loader for active Category
  // ----------------------------------------------------
  useEffect(() => {
    if (!categoryId || !electronAPI) {
      setAvailableSubcategories([]);
      setSubcategoryId('');
      return;
    }
    electronAPI
      .invoke('subcategories:list', { categoryId, includeInactive: false })
      .then((res: any) => {
        if (Array.isArray(res)) {
          setAvailableSubcategories(res);
          if (editingProduct?.subcategoryId && editingProduct.categoryId === categoryId) {
            setSubcategoryId(editingProduct.subcategoryId);
          }
        }
      })
      .catch(() => setAvailableSubcategories([]));
  }, [categoryId, electronAPI, editingProduct]);

  // ----------------------------------------------------
  // Smart Default Unit Resolver
  // ----------------------------------------------------
  const getSmartDefaultUnitId = useCallback((): string => {
    if (!units || units.length === 0) return '';
    // Priority 1: Piece, Pcs, Pc
    const pcUnit = units.find(
      (u) =>
        u.shortCode?.toLowerCase() === 'pcs' ||
        u.shortCode?.toLowerCase() === 'pc' ||
        u.name?.toLowerCase().includes('piece')
    );
    if (pcUnit) return pcUnit.id;
    // Fallback: First active unit
    const activeUnit = units.find((u) => u.status === 'ACTIVE');
    return activeUnit ? activeUnit.id : units[0].id;
  }, [units]);

  // ----------------------------------------------------
  // Fetch next SKU preview
  // ----------------------------------------------------
  const fetchNextSkuPreview = useCallback(async () => {
    if (!electronAPI) return;
    try {
      const res = await electronAPI.invoke('products:getNextSku');
      if (res?.sku) {
        setPreviewSku(res.sku);
      }
    } catch {
      setPreviewSku('SKU-Auto');
    }
  }, [electronAPI]);

  // ----------------------------------------------------
  // Initialize / Reset Form
  // ----------------------------------------------------
  const initForm = useCallback(
    (preserveContext = false) => {
      setErrorMessage(null);
      setDuplicateWarning(null);
      setDuplicateDismissed(false);
      setInlineCreator(null);
      setInlineName('');
      setInlineError(null);

      if (editingProduct) {
        setName(editingProduct.name);
        setSalePrice(String(editingProduct.salePrice || ''));
        setUnitId(editingProduct.unitId);
        setAllowSellByAmount(editingProduct.allowSellByAmount ?? false);
        setCategoryId(editingProduct.categoryId || '');
        setSubcategoryId(editingProduct.subcategoryId || '');
        setBrandId(editingProduct.brandId || '');
        setSku(editingProduct.sku);
        setIsCustomSku(true);
        setBarcode(editingProduct.barcode || '');
        setPurchasePrice(editingProduct.purchasePrice ? String(editingProduct.purchasePrice) : '');
        setMrp('');
        setTaxRate(editingProduct.taxRate || 0);
        setOpeningStock(String(editingProduct.openingStock || 0));
        setReorderLevel(String(editingProduct.reorderLevel || 10));
        setStatus(editingProduct.status);
        const pImg = editingProduct.imageUrl || '';
        setImageUrl(pImg);
        setImageMode(pImg.startsWith('http') ? 'url' : 'upload');
        setImageError(null);
        setIsMoreDetailsOpen(true);
      } else {
        setName('');
        setSalePrice('');
        setPurchasePrice('');
        setMrp('');
        setBarcode('');
        setSku('');
        setAllowSellByAmount(false);
        setOpeningStock('0');
        setReorderLevel('10');
        setStatus('ACTIVE');
        setImageUrl('');
        setImageMode('upload');
        setImageError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        if (!preserveContext) {
          setUnitId(getSmartDefaultUnitId());
          setCategoryId('');
          setSubcategoryId('');
          setBrandId('');
          setTaxRate(0);
          setIsMoreDetailsOpen(false);
        }

        fetchNextSkuPreview();
      }

      // Auto-focus name
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    },
    [editingProduct, getSmartDefaultUnitId, fetchNextSkuPreview]
  );

  // ----------------------------------------------------
  // Image Upload & Compress Handler
  // ----------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setImageError('Image file is too large (max 8MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setImageUrl(compressed);
        } else {
          setImageUrl(dataUrl);
        }
      };
      img.onerror = () => {
        setImageUrl(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setImageError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      initForm();
      setSuccessBanner(null);
    }
  }, [isOpen, initForm]);

  // ----------------------------------------------------
  // Real-time Duplicate Product Name Check
  // ----------------------------------------------------
  useEffect(() => {
    if (!isOpen || duplicateDismissed || !name.trim() || name.trim().length < 3 || !electronAPI) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const check = await electronAPI.invoke('products:checkName', {
          name: name.trim(),
          excludeId: editingProduct?.id,
        });
        if (check?.hasDuplicate) {
          setDuplicateWarning(`A product with similar name "${check.similarName}" already exists.`);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        setDuplicateWarning(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [name, isOpen, duplicateDismissed, editingProduct, electronAPI]);

  // ----------------------------------------------------
  // In-Store Barcode Generator
  // ----------------------------------------------------
  const handleGenerateBarcode = async () => {
    if (!electronAPI) return;
    try {
      const res = await electronAPI.invoke(
        'products:generateBarcode',
        settings?.numbering?.inStoreBarcodePrefix || '21'
      );
      if (res?.barcode) {
        setBarcode(res.barcode);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate barcode');
    }
  };

  // ----------------------------------------------------
  // Inline Category / Brand Creation
  // ----------------------------------------------------
  const handleCreateInlineMeta = async () => {
    if (!inlineName.trim() || !session || !electronAPI) return;
    setInlineSubmitting(true);
    setInlineError(null);

    try {
      if (inlineCreator === 'category') {
        const res = await electronAPI.invoke('categories:create', {
          name: inlineName.trim(),
          description: null,
          token: session.token,
        });
        if (res.error) throw new Error(res.error);
        await onDependenciesChange?.();
        setCategoryId(res.id);
      } else if (inlineCreator === 'subcategory') {
        if (!categoryId) {
          throw new Error('Please select a Category first before creating a subcategory.');
        }
        const res = await electronAPI.invoke('subcategories:create', {
          name: inlineName.trim(),
          categoryId,
          description: null,
          token: session.token,
        });
        if (res.error) throw new Error(res.error);
        setAvailableSubcategories((prev) => [...prev, res]);
        setSubcategoryId(res.id);
      } else if (inlineCreator === 'brand') {
        const res = await electronAPI.invoke('brands:create', {
          name: inlineName.trim(),
          token: session.token,
        });
        if (res.error) throw new Error(res.error);
        await onDependenciesChange?.();
        setBrandId(res.id);
      }
      setInlineCreator(null);
      setInlineName('');
    } catch (err: any) {
      setInlineError(err?.message || 'Failed to create item');
    } finally {
      setInlineSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Submit Form Handler
  // ----------------------------------------------------
  const handleSubmit = async (e?: React.FormEvent, isAddAnother = false) => {
    if (e) e.preventDefault();
    if (!session || !electronAPI || submitting) return;

    // Validation
    if (!name.trim()) {
      setErrorMessage('Product name is required.');
      nameInputRef.current?.focus();
      return;
    }

    let finalSku = sku.trim();
    if (!finalSku) {
      try {
        const res = await electronAPI.invoke('products:getNextSku');
        finalSku = res?.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;
      } catch {
        finalSku = `SKU-${Date.now().toString(36).toUpperCase()}`;
      }
    }

    let finalBarcode = barcode.trim();
    if (!finalBarcode) {
      try {
        const res = await electronAPI.invoke(
          'products:generateBarcode',
          settings?.numbering?.inStoreBarcodePrefix || '21'
        );
        finalBarcode = res?.barcode || `BC-${Date.now().toString(36).toUpperCase()}`;
      } catch {
        finalBarcode = `BC-${Date.now().toString(36).toUpperCase()}`;
      }
    }

    const numericSalePrice = parseFloat(salePrice);
    if (isNaN(numericSalePrice) || numericSalePrice < 0) {
      setErrorMessage('A valid selling price (₹ 0.00 or higher) is required.');
      return;
    }

    const selectedUnit = unitId || getSmartDefaultUnitId();
    if (!selectedUnit) {
      setErrorMessage('Please configure or select a measurement unit.');
      return;
    }

    // MRP Validation
    const numericMrp = mrp ? parseFloat(mrp) : undefined;
    if (numericMrp !== undefined && !isNaN(numericMrp)) {
      if (numericSalePrice > numericMrp) {
        setErrorMessage(`Selling price (${currencySymbol}${numericSalePrice.toFixed(2)}) cannot exceed MRP (${currencySymbol}${numericMrp.toFixed(2)}).`);
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        name: name.trim(),
        sku: finalSku,
        barcode: finalBarcode,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        brandId: brandId || null,
        unitId: selectedUnit,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) || 0 : 0,
        salePrice: numericSalePrice,
        taxRate: Number(taxRate) || 0,
        openingStock: openingStock ? parseFloat(openingStock) || 0 : 0,
        reorderLevel: reorderLevel ? parseFloat(reorderLevel) || 10 : 10,
        status,
        imageUrl: imageUrl.trim() || null,
        allowSellByAmount: Boolean(allowSellByAmount),
      };

      if (editingProduct) {
        const res = await electronAPI.invoke('products:update', {
          id: editingProduct.id,
          data: payload,
          token: session.token,
        });
        if (res.error) throw new Error(res.error);
        onProductSaved(res, false);
        onClose();
      } else {
        const res = await electronAPI.invoke('products:create', {
          product: payload,
          token: session.token,
        });
        if (res.error) throw new Error(res.error);

        const createdProduct = res.product || res;

        if (isAddAnother) {
          setSuccessBanner({
            name: createdProduct.name,
            sku: createdProduct.sku,
            price: createdProduct.salePrice,
          });
          onProductSaved(createdProduct, true);
          initForm(true); // Preserve Category, Brand, Unit, Tax
        } else {
          onProductSaved(createdProduct, false);
          onClose();
        }
      }
    } catch (err: any) {
      console.error('[SmartAddProductModal Error]', err);
      setErrorMessage(err?.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard shortcut listener: Ctrl+Enter (Save), Esc (Close)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(undefined, false);
    } else if (e.key === 'Escape') {
      if (inlineCreator) {
        setInlineCreator(null);
      } else {
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  // Margin calculation
  const numSale = parseFloat(salePrice) || 0;
  const numCost = parseFloat(purchasePrice) || 0;
  const grossMargin = numSale - numCost;
  const marginPercent = numSale > 0 ? (grossMargin / numSale) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Quick Add Product'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {editingProduct
                  ? 'Update details or modify pricing & inventory rules'
                  : 'Fast retail product creation — only name & price required'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Success Banner from previous "Save & Add Another" */}
          {successBanner && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Saved <strong>"{successBanner.name}"</strong> ({successBanner.sku}) at {currencySymbol}
                  {successBanner.price.toFixed(2)}. Ready for next product!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessBanner(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Duplicate Name Warning Alert */}
          {duplicateWarning && !duplicateDismissed && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl flex items-start justify-between space-x-2 animate-in fade-in">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">{duplicateWarning}</span>
                  <span className="text-[11px] opacity-80">
                    You can still continue creating if this is a distinct product or pack.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateDismissed(true)}
                className="text-xs px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition font-medium whitespace-nowrap ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* General Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center space-x-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 1. QUICK ADD ESSENTIALS (Product Name & Selling Price)           */}
          {/* ============================================================== */}
          <div className="space-y-4">
            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                Product Name <span className="text-primary">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDuplicateDismissed(false);
                }}
                placeholder="e.g. Amul Pure Ghee 1L Tin"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            {/* Selling Price & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Selling Price ({currencySymbol}) <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm font-bold text-muted-foreground select-none">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-input border border-border rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1.5">
                  Measurement Unit <span className="text-primary">*</span>
                </label>
                <select
                  value={unitId || getSmartDefaultUnitId()}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary transition"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.shortCode})
                    </option>
                  ))}
                </select>
                {(() => {
                  const selU = units.find((u) => u.id === (unitId || getSmartDefaultUnitId()));
                  const isDecimal = selU && (selU.category !== 'COUNT' || (selU.precision ?? 0) > 0);
                  return (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                      <span className={`font-medium ${isDecimal ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {isDecimal ? `⚡ Decimal allowed (${selU?.precision ?? 3} digits)` : '📦 Count unit (integer only)'}
                      </span>
                      {isDecimal && (
                        <label className="flex items-center space-x-1.5 cursor-pointer text-foreground hover:text-primary transition-colors">
                          <input
                            type="checkbox"
                            checked={allowSellByAmount}
                            onChange={(e) => setAllowSellByAmount(e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          <span>Allow Sell by ₹ Amount</span>
                        </label>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* SKU & Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SKU */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    SKU (Unique Code)
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await electronAPI.invoke('products:getNextSku').catch(() => null);
                      if (res?.sku) setSku(res.sku);
                    }}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="Auto-generated if left blank"
                  className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Barcode */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Barcode
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-[11px] text-primary hover:underline flex items-center space-x-0.5"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full bg-input border border-border rounded-xl pl-3 pr-8 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <Barcode className="w-4 h-4 text-muted-foreground absolute right-2.5 top-2.5 pointer-events-none opacity-60" />
                </div>
              </div>
            </div>

            {/* Category, Subcategory & Brand (Optional, with Inline Creation) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Category (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineCreator(inlineCreator === 'category' ? null : 'category');
                      setInlineName('');
                      setInlineError(null);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center space-x-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId('');
                  }}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition"
                >
                  <option value="">Uncategorized (None)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Subcategory (Optional)
                  </label>
                  {categoryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineCreator(inlineCreator === 'subcategory' ? null : 'subcategory');
                        setInlineName('');
                        setInlineError(null);
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center space-x-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  )}
                </div>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  disabled={!categoryId}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{categoryId ? 'None (No Subcategory)' : 'Select Category First'}</option>
                  {availableSubcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Brand (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineCreator(inlineCreator === 'brand' ? null : 'brand');
                      setInlineName('');
                      setInlineError(null);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center space-x-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                </div>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition"
                >
                  <option value="">No Brand (Generic)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inline Category/Brand/Subcategory Creator Drawer */}
            {inlineCreator && (
              <div className="p-3 bg-surface-elevated/80 border border-primary/30 rounded-xl space-y-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Quick Create {inlineCreator === 'category' ? 'Category' : inlineCreator === 'subcategory' ? 'Subcategory' : 'Brand'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInlineCreator(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {inlineError && <p className="text-[11px] text-rose-400">{inlineError}</p>}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={inlineName}
                    onChange={(e) => setInlineName(e.target.value)}
                    placeholder={`Enter ${inlineCreator} name…`}
                    className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateInlineMeta();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={inlineSubmitting || !inlineName.trim()}
                    onClick={handleCreateInlineMeta}
                    className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary-hover transition disabled:opacity-50"
                  >
                    {inlineSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* 2. COLLAPSIBLE ADVANCED DETAILS                                */}
          {/* ============================================================== */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsMoreDetailsOpen(!isMoreDetailsOpen)}
              className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition group select-none"
            >
              <div className="flex items-center space-x-2">
                <span>More Product Details (Image, Cost, Tax, Stock)</span>
                {!isMoreDetailsOpen && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated text-muted-foreground font-mono">
                    Optional
                  </span>
                )}
              </div>
              {isMoreDetailsOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>

            {isMoreDetailsOpen && (
              <div className="pt-4 space-y-4 animate-in fade-in duration-200">
                {/* Product Image Section */}
                <div className="p-3.5 bg-surface-elevated/40 border border-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" />
                      <span>Product Image</span>
                      <span className="text-[10px] lowercase text-muted-foreground font-normal">(optional)</span>
                    </label>

                    {/* Mode Selector Toggle: Upload vs Link */}
                    <div className="flex items-center bg-input border border-border rounded-lg p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => { setImageMode('upload'); setImageError(null); }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition font-medium ${
                          imageMode === 'upload'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload File</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImageMode('url'); setImageError(null); }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition font-medium ${
                          imageMode === 'url'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>Image Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Content based on Mode */}
                  {imageMode === 'upload' ? (
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {!imageUrl ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-border hover:border-primary/60 bg-surface-elevated/30 hover:bg-surface-elevated/60 transition-colors rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer group"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold text-foreground">Click to upload product image</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Supports PNG, JPG, JPEG, WEBP (Max 8MB)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-2.5 bg-surface-elevated/70 border border-border rounded-xl">
                          <img
                            src={imageUrl}
                            alt="Product Preview"
                            onError={() => setImageError('Failed to display uploaded image')}
                            className="w-14 h-14 rounded-lg object-cover border border-border bg-black/20 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-foreground block truncate">Image attached</span>
                            <span className="text-[10px] text-muted-foreground block truncate font-mono">
                              {imageUrl.startsWith('data:') ? 'Local file attached' : imageUrl}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface hover:bg-surface-hover border border-border text-foreground transition"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="p-1.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                              title="Remove image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <LinkIcon className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="url"
                            value={imageUrl.startsWith('data:') ? '' : imageUrl}
                            onChange={(e) => {
                              setImageUrl(e.target.value);
                              setImageError(null);
                            }}
                            placeholder="https://example.com/product-image.jpg"
                            className="w-full bg-input border border-border rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground"
                          />
                        </div>
                        {imageUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 border border-border rounded-xl transition"
                            title="Clear image link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {imageUrl && !imageUrl.startsWith('data:') && (
                        <div className="flex items-center gap-3 p-2.5 bg-surface-elevated/70 border border-border rounded-xl">
                          <img
                            src={imageUrl}
                            alt="Link Preview"
                            onError={() => setImageError('Could not load image from this URL. Please verify the link.')}
                            className="w-14 h-14 rounded-lg object-cover border border-border bg-black/20 shrink-0"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <span className="font-semibold text-foreground block truncate">Link Preview</span>
                            <span className="text-[10px] text-muted-foreground truncate block font-mono">{imageUrl}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {imageError && (
                    <div className="text-[11px] text-rose-500 flex items-center gap-1.5 pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{imageError}</span>
                    </div>
                  )}
                </div>

                {/* Cost Price, MRP, Tax Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Cost Price */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Cost Price ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* MRP */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      MRP ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Tax Rate */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Tax Rate (%)
                    </label>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value={0}>0% (Tax Exempt)</option>
                      <option value={5}>5% (GST)</option>
                      <option value={12}>12% (GST)</option>
                      <option value={18}>18% (GST)</option>
                      <option value={28}>28% (GST)</option>
                    </select>
                  </div>
                </div>

                {/* Profit Margin Preview Card */}
                {numSale > 0 && numCost > 0 && (
                  <div className="p-3 bg-surface-elevated/70 border border-border rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 text-muted-foreground">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span>Estimated Gross Margin:</span>
                    </div>
                    <div className="font-mono space-x-2">
                      <span className="font-bold text-foreground">
                        {currencySymbol}
                        {grossMargin.toFixed(2)}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          grossMargin >= 0
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {marginPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Opening Stock & Reorder Alert */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Opening / Current Stock */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {editingProduct ? 'Current Inventory Stock' : 'Opening Stock'}
                      </label>
                      {editingProduct && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Opening was {editingProduct.openingStock}
                        </span>
                      )}
                    </div>
                    {editingProduct ? (
                      <div className="flex items-center justify-between bg-surface-elevated/70 border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground">
                        <span className="font-bold text-foreground">
                          {editingProduct.currentStock} {editingProduct.unitCode || ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground">Managed via Ledger</span>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={openingStock}
                        onChange={(e) => setOpeningStock(e.target.value)}
                        placeholder="0"
                        className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>

                  {/* Reorder Level */}
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Reorder Alert Level
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      placeholder="10"
                      className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block">Available for Sale</span>
                    <span className="text-[11px] text-muted-foreground">
                      Visible in POS billing search and product lookup
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatus(status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      status === 'ACTIVE'
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        : 'bg-surface-elevated text-muted-foreground border border-border'
                    }`}
                  >
                    {status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] font-mono">
                Ctrl + Enter
              </kbd>
              <span>to save product</span>
            </span>

            <div className="flex items-center space-x-2.5 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
              >
                Cancel
              </button>

              {!editingProduct && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(undefined, true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-surface-muted text-foreground border border-border transition shadow-sm disabled:opacity-50"
                >
                  Save & Add Another
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-primary-foreground shadow-md shadow-primary/20 transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>{editingProduct ? 'Update Product' : 'Save Product'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

