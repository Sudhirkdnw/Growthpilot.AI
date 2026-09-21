import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Receipt,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  Building2,
  Trash2,
  Ban,
  Eye,
  Loader2,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { PurchaseReturnModal } from '../returns/PurchaseReturnModal';
import {
  SupplierDTO,
  SupplierLedgerDTO,
  PurchaseSummaryDTO,
  PurchaseDetailDTO,
  ProductDTO,
  InvoiceDocumentDTO,
} from '../../../../shared/types';
import { InvoicePreviewModal } from '../invoice/InvoicePreviewModal';
import { Printer } from 'lucide-react';

interface PurchaseCartItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  purchasePrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export function PurchaseView() {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';

  const [activeSubTab, setActiveSubTab] = useState<'new_purchase' | 'history' | 'suppliers'>('new_purchase');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data lists
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [purchases, setPurchases] = useState<PurchaseSummaryDTO[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductDTO[]>([]);

  // --------------------------------------------------------------------------
  // NEW PURCHASE FORM STATE
  // --------------------------------------------------------------------------
  const [isCashSupplier, setIsCashSupplier] = useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [cartItems, setCartItems] = useState<PurchaseCartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [orderTax, setOrderTax] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT'>('CASH');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  // Product selector dropdown state
  const [productSearch, setProductSearch] = useState<string>('');

  // --------------------------------------------------------------------------
  // MODALS STATE
  // --------------------------------------------------------------------------
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseDetailDTO | null>(null);
  const [returningPurchaseId, setReturningPurchaseId] = useState<string | null>(null);
  const [cancellingPurchaseId, setCancellingPurchaseId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<InvoiceDocumentDTO | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');

  // Supplier modal
  const [showSupplierModal, setShowSupplierModal] = useState<boolean>(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    openingBalance: 0,
  });

  // Supplier ledger & payment modal
  const [activeSupplierForLedger, setActiveSupplierForLedger] = useState<SupplierDTO | null>(null);
  const [supplierLedgerEntries, setSupplierLedgerEntries] = useState<SupplierLedgerDTO[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Load initial data
  useEffect(() => {
    loadSuppliers();
    loadPurchases();
    loadProducts();
  }, []);

  const loadSuppliers = async () => {
    try {
      const res = await (window as any).electronAPI.invoke('suppliers:list', {
        status: 'ALL',
        pageSize: 100,
        token: session?.token,
      });
      setSuppliers(res?.data || []);
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await (window as any).electronAPI.invoke('purchases:list', {
        pageSize: 50,
        token: session?.token,
      });
      setPurchases(res?.data || []);
    } catch (err: any) {
      console.error('Failed to load purchases:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await (window as any).electronAPI.invoke('products:list', {
        status: 'ACTIVE',
        pageSize: 100,
      });
      setAvailableProducts(res?.data || []);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    }
  };

  // --------------------------------------------------------------------------
  // CART CALCULATIONS
  // --------------------------------------------------------------------------
  const lineSubtotalSum = cartItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);
  const lineDiscountSum = cartItems.reduce((sum, item) => sum + item.discount, 0);
  const lineTaxSum = cartItems.reduce((sum, item) => {
    const taxable = Math.max(0, item.quantity * item.purchasePrice - item.discount);
    return sum + taxable * (item.taxRate / 100);
  }, 0);

  const subtotal = Math.round(lineSubtotalSum * 100) / 100;
  const totalDiscount = Math.round((lineDiscountSum + orderDiscount) * 100) / 100;
  const totalTax = Math.round((lineTaxSum + orderTax) * 100) / 100;
  const grandTotal = Math.max(0, Math.round((subtotal - totalDiscount + totalTax) * 100) / 100);
  const dueAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);

  // Sync paidAmount with grandTotal when payment method is CASH/CARD/UPI/BANK
  const handlePaymentMethodChange = (method: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CREDIT') => {
    setPaymentMethod(method);
    if (method === 'CREDIT') {
      setPaidAmount(0);
    } else {
      setPaidAmount(grandTotal);
    }
  };

  const addProductToCart = (product: ProductDTO) => {
    const existingIndex = cartItems.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += 1;
      setCartItems(updated);
    } else {
      setCartItems([
        ...cartItems,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          purchasePrice: product.purchasePrice || 0,
          discount: 0,
          taxRate: 0,
          lineTotal: product.purchasePrice || 0,
        },
      ]);
    }
    setProductSearch('');
  };

  const updateCartItem = (index: number, field: keyof PurchaseCartItem, value: number) => {
    const updated = [...cartItems];
    const item = { ...updated[index], [field]: value };
    const taxable = Math.max(0, item.quantity * item.purchasePrice - item.discount);
    item.lineTotal = Math.round((taxable + taxable * (item.taxRate / 100)) * 100) / 100;
    updated[index] = item;
    setCartItems(updated);
  };

  const removeCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  // --------------------------------------------------------------------------
  // CREATE PURCHASE
  // --------------------------------------------------------------------------
  const handleSavePurchase = async () => {
    if (cartItems.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one product to the purchase cart.' });
      return;
    }

    if (!isCashSupplier && !selectedSupplierId) {
      setFeedback({ type: 'error', message: 'Please select a supplier or check "Cash Supplier".' });
      return;
    }

    if (isCashSupplier && dueAmount > 0) {
      setFeedback({ type: 'error', message: 'Cash Supplier cannot have an outstanding due balance. Payment must be in full.' });
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const payload = {
        supplierId: isCashSupplier ? null : selectedSupplierId,
        items: cartItems.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          purchasePrice: Number(i.purchasePrice),
          discount: Number(i.discount),
          taxRate: Number(i.taxRate),
        })),
        discount: Number(orderDiscount),
        tax: Number(orderTax),
        paidAmount: Number(paidAmount),
        paymentMethod,
        notes: purchaseNotes,
      };

      const res = await (window as any).electronAPI.invoke('purchases:create', {
        purchase: payload,
        token: session?.token,
      });

      if (res?.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({
          type: 'success',
          message: `Purchase order ${res.purchaseNumber} recorded! Stock successfully received.`,
        });
        // Reset form
        setCartItems([]);
        setSelectedSupplierId('');
        setIsCashSupplier(false);
        setOrderDiscount(0);
        setOrderTax(0);
        setPaidAmount(0);
        setPurchaseNotes('');
        loadPurchases();
        loadSuppliers();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to create purchase' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // CANCEL PURCHASE
  // --------------------------------------------------------------------------
  const handleConfirmCancel = async () => {
    if (!cancellingPurchaseId) return;
    if (!cancellationReason.trim()) {
      alert('Cancellation reason is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await (window as any).electronAPI.invoke('purchases:cancel', {
        id: cancellingPurchaseId,
        reason: cancellationReason,
        token: session?.token,
      });

      if (res?.error) {
        alert(res.error);
      } else {
        setCancellingPurchaseId(null);
        setCancellationReason('');
        loadPurchases();
        loadSuppliers();
        alert('Purchase order cancelled and stock reversed successfully.');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel purchase');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // CREATE SUPPLIER
  // --------------------------------------------------------------------------
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;

    setLoading(true);
    try {
      const res = await (window as any).electronAPI.invoke('suppliers:create', {
        supplier: supplierForm,
        token: session?.token,
      });

      if (res?.error) {
        alert(res.error);
      } else {
        setShowSupplierModal(false);
        setSupplierForm({ name: '', phone: '', email: '', address: '', gstin: '', openingBalance: 0 });
        loadSuppliers();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create supplier');
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // SUPPLIER LEDGER & PAYMENTS
  // --------------------------------------------------------------------------
  const openSupplierLedger = async (supplier: SupplierDTO) => {
    setActiveSupplierForLedger(supplier);
    try {
      const res = await (window as any).electronAPI.invoke('suppliers:getLedger', {
        supplierId: supplier.id,
        token: session?.token,
      });
      setSupplierLedgerEntries(res?.data || []);
    } catch (err) {
      console.error('Failed to load supplier ledger:', err);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplierForLedger || paymentAmount <= 0) return;

    setLoading(true);
    try {
      const res = await (window as any).electronAPI.invoke('suppliers:recordPayment', {
        payment: {
          supplierId: activeSupplierForLedger.id,
          amount: Number(paymentAmount),
          paymentMethod: paymentMethodChoice,
          reference: paymentRef,
          notes: paymentNotes,
        },
        token: session?.token,
      });

      if (res?.error) {
        alert(res.error);
      } else {
        setShowPaymentModal(false);
        setPaymentAmount(0);
        setPaymentRef('');
        setPaymentNotes('');
        // Refresh active supplier & ledger
        openSupplierLedger(activeSupplierForLedger);
        loadSuppliers();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveSubTab('new_purchase')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'new_purchase'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Bill</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'history'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Purchase History</span>
          </button>

          <button
            onClick={() => setActiveSubTab('suppliers')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSubTab === 'suppliers'
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Suppliers Directory & Ledger</span>
          </button>
        </div>

        {activeSubTab === 'suppliers' && (
          <button
            onClick={() => setShowSupplierModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-3.5 py-2 rounded-lg text-sm font-medium shadow-md shadow-primary/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
              : 'bg-red-950/60 border border-red-800/80 text-red-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. NEW PURCHASE STATION                                             */}
      {/* ==================================================================== */}
      {activeSubTab === 'new_purchase' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column: Product Selection & Items Cart (8 cols) */}
          <div className="col-span-8 space-y-4">
            {/* Supplier Selection Header */}
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 mr-4">
                <Building2 className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Select Supplier
                  </label>
                  <select
                    disabled={isCashSupplier}
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-40"
                  >
                    <option value="">-- Choose Supplier Account --</option>
                    {suppliers
                      .filter((s) => s.status === 'ACTIVE')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.phone || 'No phone'}) — Due: {currencySymbol}{s.currentBalance.toFixed(2)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <input
                  type="checkbox"
                  id="cashSupplierCheck"
                  checked={isCashSupplier}
                  onChange={(e) => {
                    setIsCashSupplier(e.target.checked);
                    if (e.target.checked) setSelectedSupplierId('');
                  }}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <label htmlFor="cashSupplierCheck" className="text-sm text-foreground font-medium cursor-pointer">
                  Cash Supplier (Spot Cash)
                </label>
              </div>
            </div>

            {/* Product Quick-Add Search */}
            <div className="bg-surface border border-border p-4 rounded-xl shadow-sm">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products by Name or SKU to add to purchase..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 pl-10 text-sm text-foreground focus:border-primary"
                />
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
              </div>

              {/* Autocomplete Dropdown */}
              {productSearch.trim() && (
                <div className="mt-2 bg-input border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                  {availableProducts
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                        p.sku.toLowerCase().includes(productSearch.toLowerCase())
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProductToCart(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface-elevated flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{p.name}</div>
                          <div className="text-muted-foreground font-mono">SKU: {p.sku} | In Stock: {p.currentStock}</div>
                        </div>
                        <div className="text-primary font-semibold font-mono">
                          {currencySymbol}{p.purchasePrice.toFixed(2)}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Cart Items Table */}
            <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Purchase Items ({cartItems.length} Products)
              </h3>

              {cartItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                  <Truck className="w-10 h-10 text-muted-foreground stroke-1" />
                  <p className="text-sm">Search and add products above to build purchase order</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase font-semibold">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 w-20">Quantity</th>
                        <th className="py-2.5 px-3 w-28">Buy Price ({currencySymbol})</th>
                        <th className="py-2.5 px-3 w-20">Tax (%)</th>
                        <th className="py-2.5 px-3 w-28 text-right">Line Total ({currencySymbol})</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {cartItems.map((item, idx) => (
                        <tr key={item.productId} className="hover:bg-surface-muted">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-foreground">{item.productName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">SKU: {item.sku}</div>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartItem(idx, 'quantity', Number(e.target.value))}
                              className="w-16 bg-input border border-border rounded px-2 py-1 text-center text-foreground font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.purchasePrice}
                              onChange={(e) => updateCartItem(idx, 'purchasePrice', Number(e.target.value))}
                              className="w-24 bg-input border border-border rounded px-2 py-1 text-right text-foreground font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.taxRate}
                              onChange={(e) => updateCartItem(idx, 'taxRate', Number(e.target.value))}
                              className="w-16 bg-input border border-border rounded px-2 py-1 text-center text-foreground font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                            {currencySymbol}{item.lineTotal.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              onClick={() => removeCartItem(idx)}
                              className="p-1 hover:bg-surface-elevated text-muted-foreground hover:text-red-400 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Financial Totals & Settlement (4 cols) */}
          <div className="col-span-4 space-y-4">
            <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                Purchase Settlement
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono text-foreground">{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Order Discount</span>
                  <input
                    type="number"
                    min="0"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(Number(e.target.value))}
                    className="w-24 bg-input border border-border rounded px-2 py-1 text-right text-xs text-emerald-400 font-mono"
                  />
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Tax Amount</span>
                  <span className="font-mono text-foreground">{currencySymbol}{totalTax.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t border-border flex justify-between items-baseline">
                  <span className="font-bold text-foreground">Grand Total</span>
                  <span className="font-bold text-xl font-mono text-primary">
                    {currencySymbol}{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Method & Paid Amount */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value as any)}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground"
                  >
                    <option value="CASH">Cash Payment</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CREDIT">Supplier Credit (Pay Later)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Amount Paid ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground"
                  />
                </div>

                <div className="flex justify-between items-center text-xs p-3 bg-surface-muted rounded-lg border border-border">
                  <span className="text-muted-foreground font-medium">Outstanding Balance (Payable)</span>
                  <span
                    className={`font-mono font-bold ${
                      dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {currencySymbol}{dueAmount.toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Notes / Bill Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="Supplier invoice reference or delivery remarks..."
                    className="w-full bg-input border border-border rounded-lg px-3 py-1.5 text-xs text-foreground"
                  />
                </div>
              </div>

              <button
                disabled={loading || cartItems.length === 0}
                onClick={handleSavePurchase}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-primary/20 text-sm transition-all"
              >
                {loading ? 'Processing Transaction...' : 'Save & Receive Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. PURCHASE HISTORY                                                 */}
      {/* ==================================================================== */}
      {activeSubTab === 'history' && (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Historical Purchase Bills ({purchases.length})
            </h3>
            <button
              onClick={loadPurchases}
              className="text-xs text-primary hover:text-primary transition-colors"
            >
              Refresh History
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground uppercase font-semibold">
                  <th className="py-2.5 px-3">Purchase #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3 text-right">Total ({currencySymbol})</th>
                  <th className="py-2.5 px-3 text-right">Paid ({currencySymbol})</th>
                  <th className="py-2.5 px-3 text-right">Due ({currencySymbol})</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-muted">
                    <td className="py-2.5 px-3 font-mono font-semibold text-primary">
                      {p.purchaseNumber}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {new Date(p.purchaseDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">{p.supplierName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{p.itemCount} item(s)</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-foreground">
                      {currencySymbol}{p.total.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                      {currencySymbol}{p.paidAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                      {currencySymbol}{p.dueAmount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.status === 'POSTED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : 'bg-red-950 text-red-300 border border-red-800/50'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        onClick={async () => {
                          const det = await (window as any).electronAPI.invoke('purchases:getById', {
                            id: p.id,
                            token: session?.token,
                          });
                          setViewingPurchase(det);
                        }}
                        className="p-1.5 rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"
                        title="View Purchase Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            const res = await (window as any).electronAPI.invoke('invoice:getDocument', {
                              documentType: 'PURCHASE',
                              id: p.id,
                              token: session?.token,
                            });
                            if (res?.document) {
                              setPreviewDoc(res.document);
                            }
                          } catch (err: any) {
                            setFeedback({ type: 'error', message: err?.message || 'Failed to load purchase document' });
                          }
                        }}
                        className="p-1.5 rounded hover:bg-surface-elevated text-muted-foreground hover:text-primary"
                        title="Print Purchase Bill / PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {p.status === 'POSTED' && (
                        <>
                          <button
                            onClick={() => setReturningPurchaseId(p.id)}
                            className="p-1.5 rounded hover:bg-surface-elevated text-muted-foreground hover:text-amber-400"
                            title="Return to Supplier (Debit Note)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setCancellingPurchaseId(p.id)}
                            className="p-1.5 rounded hover:bg-surface-elevated text-muted-foreground hover:text-red-400"
                            title="Cancel Purchase Bill"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. SUPPLIERS DIRECTORY & LEDGER                                     */}
      {/* ==================================================================== */}
      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Suppliers List (7 cols) */}
          <div className="col-span-7 bg-surface border border-border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Registered Suppliers ({suppliers.length})
            </h3>

            <div className="divide-y divide-border/60">
              {suppliers.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-foreground flex items-center space-x-2">
                      <span>{s.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          s.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300' : 'bg-surface-elevated text-muted-foreground'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Phone: {s.phone || 'N/A'} | GSTIN: {s.gstin || 'Unregistered'}
                    </div>
                  </div>

                  <div className="text-right flex items-center space-x-3">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">Payable Balance</div>
                      <div className="text-sm font-mono font-bold text-amber-400">
                        {currencySymbol}{s.currentBalance.toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => openSupplierLedger(s)}
                      className="bg-surface-elevated hover:bg-surface-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                      View Ledger
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier Ledger Panel (5 cols) */}
          <div className="col-span-5 bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
            {activeSupplierForLedger ? (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{activeSupplierForLedger.name}</h3>
                    <div className="text-xs text-muted-foreground">Authoritative Payable Ledger</div>
                  </div>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow"
                  >
                    Record Payment
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto max-h-96 space-y-2">
                  {supplierLedgerEntries.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-xs">
                      No ledger transactions recorded yet.
                    </div>
                  ) : (
                    supplierLedgerEntries.map((e) => (
                      <div
                        key={e.id}
                        className="p-2.5 bg-surface-muted border border-border rounded-lg text-xs space-y-1"
                      >
                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground">{e.type}</span>
                          <span className="font-mono text-muted-foreground">
                            {new Date(e.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center font-mono">
                          {e.credit > 0 && (
                            <span className="text-amber-400 flex items-center">
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                              Credit: +{currencySymbol}{e.credit.toFixed(2)}
                            </span>
                          )}
                          {e.debit > 0 && (
                            <span className="text-emerald-400 flex items-center">
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                              Debit: -{currencySymbol}{e.debit.toFixed(2)}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            Bal: {currencySymbol}{e.balance.toFixed(2)}
                          </span>
                        </div>
                        {e.notes && <div className="text-[10px] text-muted-foreground italic">{e.notes}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-muted-foreground text-xs">
                Select a supplier to view their ledger and record payments.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ADD SUPPLIER                                                 */}
      {/* ==================================================================== */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground">Add New Supplier Account</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Supplier Business Name *</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">GSTIN (Tax ID)</label>
                <input
                  type="text"
                  value={supplierForm.gstin}
                  onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground uppercase"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Opening Payable Balance ({currencySymbol})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={supplierForm.openingBalance}
                  onChange={(e) => setSupplierForm({ ...supplierForm, openingBalance: Number(e.target.value) })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground font-mono"
                />
              </div>

              <div className="pt-3 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="flex-1 bg-surface-elevated hover:bg-surface-muted text-foreground py-2.5 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-2.5 rounded-lg font-bold shadow"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: RECORD SUPPLIER PAYMENT                                      */}
      {/* ==================================================================== */}
      {showPaymentModal && activeSupplierForLedger && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground">Pay Supplier: {activeSupplierForLedger.name}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Payment Amount ({currencySymbol}) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Payment Mode</label>
                <select
                  value={paymentMethodChoice}
                  onChange={(e) => setPaymentMethodChoice(e.target.value as any)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Reference / Cheque #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>

              <div className="pt-3 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-surface-elevated hover:bg-surface-muted text-foreground py-2.5 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold shadow"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VIEW PURCHASE DETAILS                                        */}
      {/* ==================================================================== */}
      {viewingPurchase && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Purchase Order: {viewingPurchase.purchaseNumber}
                </h3>
                <div className="text-xs text-muted-foreground">
                  Supplier: {viewingPurchase.supplierName} | Date: {new Date(viewingPurchase.purchaseDate).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setViewingPurchase(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase font-semibold">
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Price ({currencySymbol})</th>
                    <th className="py-2 px-3 text-right">Tax ({currencySymbol})</th>
                    <th className="py-2 px-3 text-right">Total ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {viewingPurchase.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-foreground">{it.productName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">SKU: {it.sku}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono">{it.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">{currencySymbol}{it.purchasePrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">{currencySymbol}{it.taxAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-foreground">
                        {currencySymbol}{it.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-border flex justify-between items-baseline text-xs">
              <div className="text-muted-foreground">
                Payment: <span className="text-foreground font-semibold">{viewingPurchase.paymentMethod}</span> |
                Status: <span className="text-emerald-400 font-semibold">{viewingPurchase.status}</span>
              </div>
              <div className="text-right space-y-1 font-mono">
                <div>Grand Total: <span className="font-bold text-sm text-primary">{currencySymbol}{viewingPurchase.total.toFixed(2)}</span></div>
                <div>Paid: <span className="text-emerald-400">{currencySymbol}{viewingPurchase.paidAmount.toFixed(2)}</span></div>
                <div>Due: <span className="text-amber-400">{currencySymbol}{viewingPurchase.dueAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CANCEL PURCHASE CONFIRMATION                                 */}
      {/* ==================================================================== */}
      {cancellingPurchaseId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-foreground">Cancel Purchase Bill?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Cancelling this purchase will safely reverse the received stock from inventory and reverse any supplier payable balance.
            </p>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Cancellation Reason *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Wrong items billed by supplier"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground"
              />
            </div>
            <div className="pt-2 flex space-x-3">
              <button
                onClick={() => setCancellingPurchaseId(null)}
                className="flex-1 bg-surface-elevated hover:bg-surface-muted text-foreground py-2 rounded-lg text-xs font-medium"
              >
                Dismiss
              </button>
              <button
                disabled={loading}
                onClick={handleConfirmCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-xs font-bold"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {returningPurchaseId && (
        <PurchaseReturnModal
          purchaseId={returningPurchaseId}
          onClose={() => setReturningPurchaseId(null)}
          onSuccess={() => {
            setReturningPurchaseId(null);
            loadPurchases();
            loadSuppliers();
            loadProducts();
          }}
        />
      )}

      {/* Invoice / Bill Print Preview Modal */}
      {previewDoc && (
        <InvoicePreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
