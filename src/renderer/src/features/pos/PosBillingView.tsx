import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  UserPlus,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  FileText,
  Printer,
  X,
  History,
  Ban,
  RotateCcw,
  Loader2,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import {
  ProductDTO,
  CustomerDTO,
  SaleSummaryDTO,
  SaleDetailDTO,
  PaymentMethod,
  GatewayProvider,
  InvoiceDocumentDTO,
} from '../../../../shared/types';
import { SalesReturnModal } from '../returns/SalesReturnModal';
import { InvoicePreviewModal } from '../invoice/InvoicePreviewModal';
import { PrinterSettingsModal } from '../invoice/PrinterSettingsModal';
import { OnlineGatewayModal } from './OnlineGatewayModal';
import { renderInvoiceHtml } from '../invoice/invoice-templates';
import { Settings as SettingsIcon } from 'lucide-react';

export interface PosCartItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  unitCode: string;
  currentStock: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
}

export function PosBillingView() {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';
  const negativeStockPolicy = settings?.pos?.negativeStockPolicy || 'BLOCK';

  const [activeTab, setActiveTab] = useState<'terminal' | 'history'>('terminal');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // --------------------------------------------------------------------------
  // PRODUCTS & SEARCH
  // --------------------------------------------------------------------------
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<ProductDTO[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------------------------------
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    openingBalance: 0,
  });

  // --------------------------------------------------------------------------
  // CART & BILLING
  // --------------------------------------------------------------------------
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [orderTax, setOrderTax] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [allowNegativeStockOverride, setAllowNegativeStockOverride] = useState<boolean>(false);
  const [saleNotes, setSaleNotes] = useState<string>('');

  // --------------------------------------------------------------------------
  // SALES HISTORY & RECEIPT MODAL
  // --------------------------------------------------------------------------
  const [salesHistory, setSalesHistory] = useState<SaleSummaryDTO[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'POSTED' | 'CANCELLED'>('ALL');
  const [activeReceipt, setActiveReceipt] = useState<SaleDetailDTO | null>(null);
  const [cancelModalSale, setCancelModalSale] = useState<SaleSummaryDTO | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [returningSaleId, setReturningSaleId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<InvoiceDocumentDTO | null>(null);
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);
  const [gatewayModalOpen, setGatewayModalOpen] = useState<boolean>(false);
  const [activeGateway, setActiveGateway] = useState<GatewayProvider>('RAZORPAY');

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------
  const loadInitialData = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    try {
      // 1. Fetch active products
      const pRes = await electronAPI.invoke('products:list', {
        page: 1,
        pageSize: 1000,
        status: 'ACTIVE',
      });
      if (pRes?.data) setProducts(pRes.data);

      // 2. Fetch customers
      const cRes = await electronAPI.invoke('customers:list', {
        token: session?.token,
        page: 1,
        pageSize: 500,
      });
      if (cRes?.data) {
        setCustomers(cRes.data);
      }

      // Default to cash customer
      const cashCust = await electronAPI.invoke('customers:getById', {
        id: 'cash-customer',
        token: session?.token,
      });
      if (cashCust && !cashCust.error) {
        setSelectedCustomer(cashCust);
      }
    } catch (err: any) {
      console.error('[POS Load Error]', err);
    }
  };

  const loadSalesHistory = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    try {
      setLoading(true);
      const res = await electronAPI.invoke('sales:list', {
        token: session.token,
        search: historySearch || undefined,
        status: historyStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res?.data) {
        setSalesHistory(res.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load sales history' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadSalesHistory();
    }
  }, [activeTab, historySearch, historyStatusFilter]);

  // Focus search input on F1 / Terminal load
  useEffect(() => {
    if (activeTab === 'terminal') {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  // Product quick filter search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
    setSearchResults(filtered.slice(0, 8));
  }, [searchQuery, products]);

  // --------------------------------------------------------------------------
  // BARCODE SCANNER HOOK
  // --------------------------------------------------------------------------
  useBarcodeScanner({
    config: { enabled: Boolean(session && activeTab === 'terminal') },
    onScan: (barcode) => {
      handleBarcodeScan(barcode);
    },
    onError: (err) => {
      console.warn('[POS Scanner Warning]', err);
    },
  });

  const handleBarcodeScan = (barcode: string) => {
    const clean = barcode.trim();
    if (!clean) return;

    // Search existing products list for matching barcode or SKU
    const matched = products.find(
      (p) => (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) || p.sku.toLowerCase() === clean.toLowerCase()
    );

    if (matched) {
      addProductToCart(matched);
      setFeedback({ type: 'success', message: `Added "${matched.name}" to cart via barcode scan.` });
      setSearchQuery('');
      setSearchResults([]);
    } else {
      setFeedback({ type: 'error', message: `No active product found with barcode/SKU "${clean}".` });
    }
  };

  // --------------------------------------------------------------------------
  // CART OPERATIONS
  // --------------------------------------------------------------------------
  const addProductToCart = (product: ProductDTO) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      if (existingIndex > -1) {
        // Increment quantity
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = existing.quantity + 1;
        const lineGross = newQty * existing.sellingPrice;
        const taxable = Math.max(0, lineGross - existing.discount);
        const taxAmount = Math.round(taxable * (existing.taxRate / 100) * 100) / 100;
        const lineTotal = Math.round((taxable + taxAmount) * 100) / 100;

        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal,
        };
        return updated;
      } else {
        // Add new item
        const sellingPrice = Number(product.salePrice);
        const taxRate = Number(product.taxRate || 0);
        const lineTax = Math.round(sellingPrice * (taxRate / 100) * 100) / 100;
        const lineTotal = Math.round((sellingPrice + lineTax) * 100) / 100;

        const newItem: PosCartItem = {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitCode: product.unitCode || 'PCS',
          currentStock: Number(product.currentStock),
          quantity: 1,
          sellingPrice,
          discount: 0,
          taxRate,
          lineTotal,
        };
        return [newItem, ...prev];
      }
    });
  };

  const updateCartItemQuantity = (index: number, qty: number) => {
    if (qty <= 0) {
      removeCartItem(index);
      return;
    }

    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const lineGross = qty * item.sellingPrice;
      const taxable = Math.max(0, lineGross - item.discount);
      const taxAmount = Math.round(taxable * (item.taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((taxable + taxAmount) * 100) / 100;

      updated[index] = {
        ...item,
        quantity: qty,
        lineTotal,
      };
      return updated;
    });
  };

  const updateCartItemDiscount = (index: number, discount: number) => {
    const d = Math.max(0, Number(discount) || 0);
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const lineGross = item.quantity * item.sellingPrice;
      const taxable = Math.max(0, lineGross - d);
      const taxAmount = Math.round(taxable * (item.taxRate / 100) * 100) / 100;
      const lineTotal = Math.round((taxable + taxAmount) * 100) / 100;

      updated[index] = {
        ...item,
        discount: d,
        lineTotal,
      };
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setGlobalDiscount(0);
    setOrderTax(0);
    setPaidAmount('');
    setSaleNotes('');
    setAllowNegativeStockOverride(false);
    setFeedback(null);
    searchInputRef.current?.focus();
  };

  // --------------------------------------------------------------------------
  // DETERMINISTIC TOTALS
  // --------------------------------------------------------------------------
  const calculateTotals = () => {
    let subtotal = 0;
    let totalItemDiscount = 0;
    let totalTax = 0;
    let hasNegativeStock = false;

    for (const item of cart) {
      const lineGross = item.quantity * item.sellingPrice;
      const taxable = Math.max(0, lineGross - item.discount);
      const lineTax = Math.round(taxable * (item.taxRate / 100) * 100) / 100;

      subtotal += taxable;
      totalItemDiscount += item.discount;
      totalTax += lineTax;

      if (item.quantity > item.currentStock) {
        hasNegativeStock = true;
      }
    }

    const netTaxable = Math.max(0, subtotal - Number(globalDiscount || 0));
    const finalTax = Math.round((totalTax + Number(orderTax || 0)) * 100) / 100;
    const grandTotal = Math.round((netTaxable + finalTax) * 100) / 100;

    const numericPaid = paidAmount === '' ? grandTotal : Math.max(0, Number(paidAmount));
    const changeDue = Math.max(0, Math.round((numericPaid - grandTotal) * 100) / 100);
    const balanceDue = Math.max(0, Math.round((grandTotal - numericPaid) * 100) / 100);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalItemDiscount: Math.round(totalItemDiscount * 100) / 100,
      globalDiscount: Number(globalDiscount || 0),
      orderTax: Number(orderTax || 0),
      totalTax: finalTax,
      grandTotal,
      paidAmount: numericPaid,
      changeDue,
      balanceDue,
      hasNegativeStock,
    };
  };

  const totals = calculateTotals();

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'terminal') return;

      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && cart.length > 0 && !showNewCustomerModal && !activeReceipt) {
        e.preventDefault();
        if (window.confirm('Clear current billing cart?')) {
          clearCart();
        }
      } else if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !loading) {
          handleCompleteSale();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, cart, totals, selectedCustomer, loading, allowNegativeStockOverride]);

  // --------------------------------------------------------------------------
  // CREATE SALE (ATOMIC POS SUBMISSION)
  // --------------------------------------------------------------------------
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setFeedback({ type: 'warning', message: 'Cart is empty. Add products before completing checkout.' });
      return;
    }

    if (!session) {
      setFeedback({ type: 'error', message: 'Session expired. Please log in again.' });
      return;
    }

    // Negative stock policy enforcement
    if (totals.hasNegativeStock) {
      if (negativeStockPolicy === 'BLOCK') {
        setFeedback({
          type: 'error',
          message: 'Insufficient stock for one or more items. System policy strictly BLOCKS negative stock sales.',
        });
        return;
      }
      if (negativeStockPolicy === 'ALLOW_WITH_WARNING' && !allowNegativeStockOverride) {
        setFeedback({
          type: 'warning',
          message: 'One or more items exceed on-hand stock. Check "Allow negative stock override" to proceed.',
        });
        return;
      }
    }

    // If online payment gateway selected, open dynamic QR / Link checkout modal
    if (['STRIPE', 'RAZORPAY', 'CASHFREE'].includes(paymentMethod)) {
      setActiveGateway(paymentMethod as GatewayProvider);
      setGatewayModalOpen(true);
      return;
    }

    await executeSalePost(paymentMethod);
  };

  const handleGatewayPaymentSuccess = async (
    gw: GatewayProvider,
    transRef: string,
    paid: number,
    saleId?: string
  ) => {
    setGatewayModalOpen(false);
    const electronAPI = (window as any).electronAPI;

    if (saleId) {
      clearCart();
      loadInitialData();

      try {
        const docRes = await electronAPI.invoke('invoice:getDocument', {
          documentType: 'SALE',
          id: saleId,
          token: session?.token,
        });

        if (docRes?.document) {
          setPreviewDocument(docRes.document);
        }
      } catch {
        // Non-blocking
      }

      setFeedback({ type: 'success', message: `Online Payment confirmed via ${gw} (${transRef})!` });
      return;
    }

    // Fallback if not auto-created by backend
    await executeSalePost('UPI', transRef, paid, gw);
  };

  const executeSalePost = async (
    method: PaymentMethod,
    transRef?: string,
    forcedPaidAmount?: number,
    gw?: GatewayProvider
  ) => {
    if (!session) return;

    // Cash Customer credit check
    const isCashCust = !selectedCustomer || selectedCustomer.id === 'cash-customer';
    const finalPaid = forcedPaidAmount !== undefined ? forcedPaidAmount : totals.paidAmount;
    if (isCashCust && (totals.grandTotal - finalPaid) > 0.01 && method === 'CREDIT') {
      setFeedback({
        type: 'error',
        message: 'Credit sales are not permitted for Cash Customer. Please select or register a customer account for credit billing.',
      });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      let finalNotes = saleNotes.trim();
      if (transRef) {
        finalNotes = finalNotes ? `${finalNotes} | ${gw || method} Ref: ${transRef}` : `${gw || method} Ref: ${transRef}`;
      }

      const salePayload = {
        customerId: isCashCust ? null : selectedCustomer.id,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          discount: item.discount,
          taxRate: item.taxRate,
        })),
        discount: totals.globalDiscount,
        tax: totals.orderTax,
        paidAmount: finalPaid,
        paymentMethod: method,
        gatewayProvider: gw || null,
        providerOrderId: transRef || null,
        notes: finalNotes || undefined,
        allowNegativeStockOverride,
      };

      const electronAPI = (window as any).electronAPI;
      const res = await electronAPI.invoke('sales:create', {
        sale: salePayload,
        token: session.token,
      });

      if (res?.error) {
        setFeedback({ type: 'error', message: res.error });
        return;
      }

      // Success! Sale is committed to database.
      // Reset cart and reload updated product stock
      clearCart();
      loadInitialData();

      // Post-commit invoice printing / preview hook
      try {
        const docRes = await electronAPI.invoke('invoice:getDocument', {
          documentType: 'SALE',
          id: res.id,
          token: session.token,
        });

        if (docRes?.document) {
          const showPrev = settings?.printer?.showPreview ?? true;
          if (showPrev) {
            setPreviewDocument(docRes.document);
          } else {
            // Post-commit silent print
            const fmt = settings?.printer?.paperFormat || 'THERMAL_80MM';
            const printRes = await electronAPI.invoke('printer:print', {
              htmlContent: renderInvoiceHtml(docRes.document, fmt),
              printerName: settings?.printer?.printerName || undefined,
              silent: true,
              copies: settings?.printer?.copies || 1,
              paperFormat: fmt,
              documentNumber: docRes.document.documentNumber,
              userId: session.user.id,
            });

            if (!printRes.success && printRes.code !== 'PRINT_CANCELLED') {
              setFeedback({
                type: 'warning',
                message: `Sale ${res.invoiceNumber} posted, but printer error (${printRes.code || 'PRINT_FAILED'}). You can reprint from Sales History anytime.`,
              });
              return;
            }
          }
        }
      } catch (docErr) {
        console.warn('[Checkout Invoice Print Hook]', docErr);
      }

      setFeedback({ type: 'success', message: `Sale ${res.invoiceNumber} completed successfully!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Transaction failed' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // CUSTOMER REGISTRATION
  // --------------------------------------------------------------------------
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      setFeedback({ type: 'error', message: 'Customer name is required' });
      return;
    }

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    try {
      setLoading(true);
      const res = await electronAPI.invoke('customers:create', {
        customer: {
          name: newCustomerForm.name.trim(),
          phone: newCustomerForm.phone.trim() || undefined,
          email: newCustomerForm.email.trim() || undefined,
          address: newCustomerForm.address.trim() || undefined,
          openingBalance: Number(newCustomerForm.openingBalance || 0),
        },
        token: session.token,
      });

      if (res?.error) {
        setFeedback({ type: 'error', message: res.error });
        return;
      }

      setCustomers((prev) => [...prev, res]);
      setSelectedCustomer(res);
      setShowNewCustomerModal(false);
      setNewCustomerForm({ name: '', phone: '', email: '', address: '', openingBalance: 0 });
      setFeedback({ type: 'success', message: `Customer "${res.name}" created and selected.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to create customer' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // SALE CANCELLATION
  // --------------------------------------------------------------------------
  const handleCancelSale = async () => {
    if (!cancelModalSale || !cancelReason.trim()) {
      setFeedback({ type: 'error', message: 'Cancellation reason is required' });
      return;
    }

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    try {
      setLoading(true);
      const res = await electronAPI.invoke('sales:cancel', {
        id: cancelModalSale.id,
        reason: cancelReason.trim(),
        token: session.token,
      });

      if (res?.error) {
        setFeedback({ type: 'error', message: res.error });
        return;
      }

      setFeedback({
        type: 'success',
        message: `Sale ${cancelModalSale.invoiceNumber} safely cancelled. Stock and accounts reversed.`,
      });
      setCancelModalSale(null);
      setCancelReason('');
      loadSalesHistory();
      loadInitialData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to cancel sale' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // PRINT RECEIPT TRIGGER (NATIVE ELECTRON OFFLINE PRINTING)
  // --------------------------------------------------------------------------
  const handlePrintReceipt = async () => {
    if (!activeReceipt) return;
    const electronAPI = (window as any).electronAPI;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${activeReceipt.invoiceNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #fff;
      padding: 12px;
      margin: 0;
      width: 76mm;
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .border-b { border-bottom: 1px dashed #333; padding-bottom: 6px; margin-bottom: 6px; }
    .border-t { border-top: 1px dashed #333; padding-top: 6px; margin-top: 6px; }
    .border-double { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin: 6px 0; }
    .header h1 { font-size: 15px; margin: 0 0 4px 0; text-transform: uppercase; font-weight: 900; }
    .header p { margin: 2px 0; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10px; }
    th { border-bottom: 1px solid #000; padding: 3px 0; text-align: left; }
    td { padding: 3px 0; vertical-align: top; }
    .totals { font-size: 11px; }
    .totals-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .grand-total { font-size: 13px; font-weight: 900; }
    .footer { text-align: center; font-size: 9px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="header text-center border-b">
    <h1>${settings?.company?.shopName || 'RS Inventory Solo'}</h1>
    ${settings?.company?.address ? `<p>${settings.company.address}</p>` : ''}
    ${settings?.company?.phone ? `<p>Phone: ${settings.company.phone}</p>` : ''}
    ${settings?.company?.gstin ? `<p>GSTIN: ${settings.company.gstin}</p>` : ''}
  </div>

  <div class="border-b" style="font-size: 10px;">
    <div style="display: flex; justify-content: space-between;">
      <span><strong>Invoice:</strong> ${activeReceipt.invoiceNumber}</span>
      <span>${new Date(activeReceipt.saleDate).toLocaleDateString()} ${new Date(activeReceipt.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 2px;">
      <span><strong>Customer:</strong> ${activeReceipt.customerName}</span>
      <span><strong>Cashier:</strong> ${session?.user?.fullName || 'Admin'}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 45%;">Item</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 20%; text-align: right;">Rate</th>
        <th style="width: 20%; text-align: right;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${activeReceipt.items
        .map(
          (it) => `
        <tr>
          <td>
            <div>${it.productName}</div>
            ${it.discount > 0 ? `<div style="font-size: 9px; color: #555;">Disc: -${currencySymbol}${it.discount.toFixed(2)}</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: bold;">${it.quantity}</td>
          <td style="text-align: right;">${it.sellingPrice.toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold;">${it.lineTotal.toFixed(2)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="border-t totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>${currencySymbol}${activeReceipt.subtotal.toFixed(2)}</span>
    </div>
    ${
      activeReceipt.discount > 0
        ? `
      <div class="totals-row">
        <span>Discount:</span>
        <span>-${currencySymbol}${activeReceipt.discount.toFixed(2)}</span>
      </div>
    `
        : ''
    }
    ${
      activeReceipt.tax > 0
        ? `
      <div class="totals-row">
        <span>Tax:</span>
        <span>${currencySymbol}${activeReceipt.tax.toFixed(2)}</span>
      </div>
    `
        : ''
    }
    <div class="totals-row border-double grand-total">
      <span>TOTAL:</span>
      <span>${currencySymbol}${activeReceipt.total.toFixed(2)}</span>
    </div>
    <div class="totals-row" style="margin-top: 4px;">
      <span>Paid (${activeReceipt.paymentMethod}):</span>
      <span>${currencySymbol}${activeReceipt.paidAmount.toFixed(2)}</span>
    </div>
    ${
      activeReceipt.dueAmount > 0
        ? `
      <div class="totals-row font-bold" style="color: #c00;">
        <span>Balance Due (Khata):</span>
        <span>${currencySymbol}${activeReceipt.dueAmount.toFixed(2)}</span>
      </div>
    `
        : `
      <div class="totals-row">
        <span>Change Returned:</span>
        <span>${currencySymbol}${Math.max(0, activeReceipt.paidAmount - activeReceipt.total).toFixed(2)}</span>
      </div>
    `
    }
  </div>

  <div class="footer border-t">
    <p>Thank you for shopping with us!</p>
    <p>Goods once sold cannot be returned without original receipt.</p>
  </div>
</body>
</html>
    `;

    if (electronAPI?.invoke) {
      try {
        const res = await electronAPI.invoke('printer:printReceipt', { htmlContent });
        if (res?.error) {
          setFeedback({ type: 'error', message: `Print error: ${res.error}` });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err?.message || 'Failed to print receipt' });
      }
    } else {
      window.print();
    }
  };

  // ==========================================================================
  // RENDER UI
  // ==========================================================================
  return (
    <div className="h-full flex flex-col space-y-4">
      {/* View Header with Mode Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === 'terminal'
                ? 'bg-accent text-accent-foreground shadow-accent font-bold'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Billing Terminal (F1)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              activeTab === 'history'
                ? 'bg-accent text-accent-foreground shadow-accent font-bold'
                : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Sales & Invoices</span>
          </button>

          <button
            onClick={() => setShowPrinterSettings(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-all ml-2"
            title="Printer & Layout Settings"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Printer Settings</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`px-3 py-1.5 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in duration-200 ${
              feedback.type === 'success'
                ? 'bg-success-bg border border-success-border text-success-text'
                : feedback.type === 'warning'
                ? 'bg-warning-bg border border-warning-border text-warning-text'
                : 'bg-danger-bg border border-danger-border text-danger-text'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-75">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: TERMINAL BILLING WORKSTATION                                 */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'terminal' && (
        <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
          {/* Left Column: Product Search & Cart Table (8 Cols) */}
          <div className="col-span-8 flex flex-col space-y-4 min-h-0">
            {/* Fast Barcode / Search Box */}
            <div className="bg-surface border border-border rounded-xl p-3 shadow-sm relative">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Scan Barcode or Search by Name / SKU (Press F1 to focus)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-input border border-input-border rounded-lg px-4 py-2.5 pl-10 text-sm focus:outline-none focus:border-primary text-foreground transition-colors"
                  data-scanner-target="true"
                />
                <ScanBarcode className="w-5 h-5 absolute left-3 top-2.5 text-foreground-subtle" />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-3 top-2.5 text-foreground-muted hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Instant Search Dropdown Results */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface-elevated border border-border rounded-xl shadow-2xl z-40 max-h-72 overflow-y-auto">
                  <div className="p-2 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                    Search Results ({searchResults.length})
                  </div>
                  {searchResults.map((product) => {
                    const isLow = Number(product.currentStock) <= Number(product.reorderLevel);
                    const isOut = Number(product.currentStock) <= 0;
                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          addProductToCart(product);
                          setSearchQuery('');
                          setSearchResults([]);
                          searchInputRef.current?.focus();
                        }}
                        className="p-3 border-b border-border-subtle hover:bg-surface-hover cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-sm text-foreground">{product.name}</div>
                          <div className="text-xs text-foreground-muted font-mono">
                            SKU: {product.sku} {product.barcode ? `| Barcode: ${product.barcode}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isOut
                                ? 'bg-danger-bg text-danger-text border border-danger-border'
                                : isLow
                                ? 'bg-warning-bg text-warning-text border border-warning-border'
                                : 'bg-success-bg text-success-text border border-success-border'
                            }`}
                          >
                            Stock: {product.currentStock} {product.unitCode || 'PCS'}
                          </span>
                          <span className="font-mono font-bold text-accent text-sm">
                            {currencySymbol}
                            {Number(product.salePrice).toFixed(2)}
                          </span>
                          <button className="p-1 rounded bg-accent-muted hover:bg-accent text-accent hover:text-accent-foreground transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Cart Items Table */}
            <div className="bg-surface border border-border rounded-xl flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-muted/60">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary">
                    Active Cart ({cart.reduce((s, i) => s + i.quantity, 0)} Units, {cart.length} Lines)
                  </h3>
                </div>

                {cart.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all items from current cart?')) {
                        clearCart();
                      }
                    }}
                    className="text-xs text-foreground-muted hover:text-danger flex items-center space-x-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cart (Esc)</span>
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-foreground-muted space-y-3 p-8">
                  <div className="w-16 h-16 rounded-2xl bg-surface-muted border border-border flex items-center justify-center text-foreground-subtle">
                    <ScanBarcode className="w-8 h-8 stroke-1" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground-secondary text-sm">Scan barcode or search products</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Hardware USB barcode scanner is automatically connected and armed.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-surface-muted sticky top-0 text-foreground-muted uppercase tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Product / SKU</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Price ({currencySymbol})</th>
                        <th className="p-3 text-right">Disc ({currencySymbol})</th>
                        <th className="p-3 text-right">Tax (%)</th>
                        <th className="p-3 text-right">Total ({currencySymbol})</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-sans">
                      {cart.map((item, idx) => {
                        const isExcessStock = item.quantity > item.currentStock;
                        return (
                          <tr
                            key={item.productId}
                            className={`hover:bg-surface-hover transition-colors ${
                              isExcessStock ? 'bg-danger-bg' : ''
                            }`}
                          >
                            <td className="p-3 font-mono text-foreground-subtle">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{item.productName}</div>
                              <div className="text-[11px] text-foreground-muted font-mono flex items-center space-x-2">
                                <span>{item.sku}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                    isExcessStock
                                      ? 'bg-danger-bg text-danger-text border border-danger-border'
                                      : 'text-foreground-subtle'
                                  }`}
                                >
                                  Stock: {item.currentStock} {item.unitCode}
                                </span>
                              </div>
                            </td>

                            {/* Qty Controls */}
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center space-x-1 bg-input border border-input-border rounded-lg p-0.5">
                                <button
                                  onClick={() => updateCartItemQuantity(idx, item.quantity - 1)}
                                  className="p-1 hover:bg-surface-hover text-foreground-muted hover:text-foreground rounded"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateCartItemQuantity(idx, Math.max(1, Number(e.target.value)))}
                                  className="w-12 bg-transparent text-center font-mono font-bold text-foreground focus:outline-none"
                                />
                                <button
                                  onClick={() => updateCartItemQuantity(idx, item.quantity + 1)}
                                  className="p-1 hover:bg-surface-hover text-foreground-muted hover:text-foreground rounded"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Unit Price */}
                            <td className="p-3 text-right font-mono text-foreground-secondary">
                              {item.sellingPrice.toFixed(2)}
                            </td>

                            {/* Discount */}
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.discount || ''}
                                onChange={(e) => updateCartItemDiscount(idx, Number(e.target.value))}
                                placeholder="0.00"
                                className="w-16 bg-input border border-input-border rounded px-1.5 py-1 text-right font-mono text-xs focus:outline-none focus:border-primary text-foreground"
                              />
                            </td>

                            {/* Tax Rate */}
                            <td className="p-3 text-right font-mono text-foreground-muted">
                              {item.taxRate}%
                            </td>

                            {/* Line Total */}
                            <td className="p-3 text-right font-mono font-bold text-accent text-sm">
                              {item.lineTotal.toFixed(2)}
                            </td>

                            {/* Remove */}
                            <td className="p-3 text-center">
                              <button
                                onClick={() => removeCartItem(idx)}
                                className="p-1 text-foreground-subtle hover:text-danger rounded hover:bg-surface-hover transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Customer Selection & Settlement Panel (4 Cols) */}
          <div className="col-span-4 flex flex-col space-y-4 min-h-0">
            {/* Customer Box */}
            <div className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-accent" />
                  <span>Customer (Khata)</span>
                </span>
                <button
                  onClick={() => setShowNewCustomerModal(true)}
                  className="text-xs text-accent hover:opacity-80 flex items-center space-x-1 transition-colors"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>New Customer</span>
                </button>
              </div>

              <div className="space-y-2">
                <select
                  value={selectedCustomer?.id || 'cash-customer'}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id === 'cash-customer') {
                      setSelectedCustomer({
                        id: 'cash-customer',
                        name: 'Cash Customer',
                        phone: null,
                        email: null,
                        address: null,
                        openingBalance: 0,
                        currentBalance: 0,
                        status: 'ACTIVE',
                        createdAt: '',
                      });
                    } else {
                      const found = customers.find((c) => c.id === id);
                      if (found) setSelectedCustomer(found);
                    }
                  }}
                  className="w-full bg-input border border-input-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="cash-customer">Walk-in Cash Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} - Due: {currencySymbol}{c.currentBalance.toFixed(2)}
                    </option>
                  ))}
                </select>

                {selectedCustomer && selectedCustomer.id !== 'cash-customer' && (
                  <div className="p-2.5 rounded-lg bg-surface-muted border border-border flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-foreground">{selectedCustomer.name}</div>
                      <div className="text-foreground-muted text-[11px] font-mono">{selectedCustomer.phone || 'No Phone'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-foreground-subtle">Current Due</div>
                      <div
                        className={`font-mono font-bold ${
                          selectedCustomer.currentBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
                        }`}
                      >
                        {currencySymbol}
                        {selectedCustomer.currentBalance.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Calculations & Settlement */}
            <div className="bg-surface border border-border rounded-xl p-4 flex-1 flex flex-col justify-between shadow-sm space-y-3 min-h-0 overflow-y-auto">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground-muted border-b border-border pb-2">
                  Invoice Breakdown
                </h3>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-foreground-muted">
                    <span>Taxable Subtotal</span>
                    <span className="font-mono text-foreground-secondary">
                      {currencySymbol}
                      {totals.subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-foreground-muted">
                    <span>Order Discount ({currencySymbol})</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={globalDiscount || ''}
                      onChange={(e) => setGlobalDiscount(Math.max(0, Number(e.target.value)))}
                      placeholder="0.00"
                      className="w-20 bg-input border border-input-border rounded px-1.5 py-0.5 text-right font-mono text-xs focus:outline-none focus:border-primary text-foreground"
                    />
                  </div>

                  <div className="flex justify-between text-foreground-muted">
                    <span>Total Tax</span>
                    <span className="font-mono text-foreground-secondary">
                      {currencySymbol}
                      {totals.totalTax.toFixed(2)}
                    </span>
                  </div>

                  {/* Grand Net Total */}
                  <div className="pt-2 border-t border-border flex justify-between items-baseline">
                    <span className="font-bold text-foreground text-sm">Net Payable</span>
                    <span className="font-mono font-bold text-2xl text-accent">
                      {currencySymbol}
                      {totals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Tender */}
                <div className="pt-3 border-t border-border space-y-2.5">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(() => {
                      const activeMethods = (settings?.paymentMethods && settings.paymentMethods.length > 0)
                        ? settings.paymentMethods.filter((m) => m.active).map((m) => m.type)
                        : (['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'] as PaymentMethod[]);

                      return activeMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method);
                            if (method === 'CREDIT') {
                              setPaidAmount('0');
                            } else if (paidAmount === '0') {
                              setPaidAmount(totals.grandTotal.toString());
                            }
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                            paymentMethod === method
                              ? 'bg-accent/20 border-accent text-accent shadow-sm font-bold'
                              : 'bg-surface-muted border-border text-foreground-secondary hover:text-foreground hover:bg-surface-hover'
                          }`}
                        >
                          {method === 'BANK_TRANSFER' ? 'BANK' : method}
                        </button>
                      ));
                    })()}
                  </div>

                  {/* Online Payment Gateway Providers (Only shown when configured & enabled) */}
                  {(() => {
                    const enabledGateways: GatewayProvider[] = [];
                    if (settings?.gateways?.stripe?.enabled) enabledGateways.push('STRIPE');
                    if (settings?.gateways?.razorpay?.enabled) enabledGateways.push('RAZORPAY');
                    if ((settings?.gateways as any)?.cashfree?.enabled) enabledGateways.push('CASHFREE');

                    if (enabledGateways.length === 0) return null;

                    return (
                      <div className="pt-1.5 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-500 flex items-center space-x-1">
                          <span>⚡ Online Payment Gateways</span>
                        </span>
                        <div className="flex gap-1.5">
                          {enabledGateways.map((gw) => (
                            <button
                              key={gw}
                              type="button"
                              onClick={() => {
                                setActiveGateway(gw);
                                setGatewayModalOpen(true);
                              }}
                              className="flex-1 py-1.5 px-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 transition-all shadow-sm flex items-center justify-center space-x-1"
                            >
                              <span>{gw === 'STRIPE' ? 'Stripe' : gw === 'RAZORPAY' ? 'Razorpay' : 'Cashfree'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground-muted">
                      Amount Tendered ({currencySymbol})
                    </label>
                    <div className="flex space-x-1.5">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder={totals.grandTotal.toFixed(2)}
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="flex-1 bg-input border border-input-border rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-foreground focus:outline-none focus:border-primary text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setPaidAmount(totals.grandTotal.toString())}
                        className="px-2.5 py-1 bg-surface-muted hover:bg-surface-hover text-foreground-secondary rounded-lg text-xs font-semibold"
                      >
                        Exact
                      </button>
                    </div>

                    {/* Quick Cash Presets */}
                    <div className="flex space-x-1 pt-1">
                      {[100, 200, 500, 2000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            const cur = Number(paidAmount) || 0;
                            setPaidAmount((cur + amt).toString());
                          }}
                          className="flex-1 py-1 rounded bg-surface-muted hover:bg-surface-hover text-[11px] font-mono text-foreground-secondary border border-border"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Change / Credit Balance Badge */}
                  <div className="p-3 rounded-lg bg-surface-muted border border-border space-y-1 text-xs">
                    {totals.paidAmount >= totals.grandTotal ? (
                      <div className="flex justify-between items-center text-emerald-500 font-bold">
                        <span className="uppercase tracking-wider text-[11px]">Change Due (Return)</span>
                        <span className="font-mono text-base">
                          {currencySymbol}
                          {totals.changeDue.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-amber-500 font-bold">
                        <span className="uppercase tracking-wider text-[11px]">Credit Due (Khata)</span>
                        <span className="font-mono text-base">
                          {currencySymbol}
                          {totals.balanceDue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Negative Stock Override Warning */}
                  {totals.hasNegativeStock && (
                    <div className="p-2.5 rounded-lg bg-danger-bg border border-danger-border space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5 text-danger-text font-bold">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Insufficient Stock Detected</span>
                      </div>
                      <p className="text-[11px] text-danger-text">
                        {negativeStockPolicy === 'BLOCK'
                          ? 'Sale cannot be processed. Negative stock is strictly BLOCKED.'
                          : 'Items in cart exceed available on-hand stock.'}
                      </p>
                      {negativeStockPolicy === 'ALLOW_WITH_WARNING' && (
                        <label className="flex items-center space-x-2 pt-1 text-[11px] text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowNegativeStockOverride}
                            onChange={(e) => setAllowNegativeStockOverride(e.target.checked)}
                            className="rounded bg-input border-danger-border text-primary focus:ring-0"
                          />
                          <span>Allow negative stock override for this invoice</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Complete Checkout Button */}
              <div className="pt-3 border-t border-border space-y-2">
                <button
                  type="button"
                  disabled={loading || cart.length === 0}
                  onClick={handleCompleteSale}
                  className="w-full bg-accent hover:bg-accent-hover text-accent-foreground font-bold py-3 px-4 rounded-xl shadow-accent text-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Complete Checkout (Ctrl+Enter / F9)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: SALES INVOICES & HISTORY                                     */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border rounded-xl flex-1 flex flex-col min-h-0 shadow-sm">
          {/* Filter Bar */}
          <div className="p-4 border-b border-border flex items-center justify-between space-x-4 bg-surface-elevated/60">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search Invoice # or Customer..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 pl-9 text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                className="bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">All Invoices</option>
                <option value="POSTED">Completed (Posted)</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                onClick={loadSalesHistory}
                className="px-3 py-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground border border-border text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Sales Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-surface-elevated sticky top-0 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-center">Items</th>
                  <th className="p-3">Method</th>
                  <th className="p-3 text-right">Total ({currencySymbol})</th>
                  <th className="p-3 text-right">Paid ({currencySymbol})</th>
                  <th className="p-3 text-right">Due ({currencySymbol})</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-sans">
                {salesHistory.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No sale invoices found matching criteria.
                    </td>
                  </tr>
                ) : (
                  salesHistory.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-primary">{s.invoiceNumber}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(s.saleDate).toLocaleString([], {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="p-3 font-medium text-foreground">{s.customerName}</td>
                      <td className="p-3 text-center font-mono text-muted-foreground">{s.itemCount}</td>
                      <td className="p-3 font-mono text-muted-foreground text-[11px]">{s.paymentMethod}</td>
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        {s.total.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-500">
                        {s.paidAmount.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-500">
                        {s.dueAmount.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            s.status === 'POSTED'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-500 border border-red-500/30'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1.5">
                        <button
                          onClick={async () => {
                            const electronAPI = (window as any).electronAPI;
                            try {
                              const docRes = await electronAPI.invoke('invoice:getDocument', {
                                documentType: 'SALE',
                                id: s.id,
                                token: session?.token,
                              });
                              if (docRes?.document) {
                                setPreviewDocument(docRes.document);
                              } else {
                                const fullSale = await electronAPI.invoke('sales:getById', {
                                  id: s.id,
                                  token: session?.token,
                                });
                                if (fullSale) setActiveReceipt(fullSale);
                              }
                            } catch {
                              // Fallback
                            }
                          }}
                          className="px-2 py-1 rounded bg-surface-elevated hover:bg-surface-muted text-foreground border border-border text-[11px] font-semibold inline-flex items-center space-x-1"
                        >
                          <Printer className="w-3 h-3 text-primary" />
                          <span>Invoice / Print</span>
                        </button>

                        {s.status === 'POSTED' && (
                          <>
                            <button
                              onClick={() => setReturningSaleId(s.id)}
                              className="px-2 py-1 rounded bg-primary-muted hover:bg-primary/20 text-primary text-[11px] font-semibold border border-primary/30 inline-flex items-center space-x-1"
                              title="Process Return"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Return</span>
                            </button>

                            <button
                              onClick={() => {
                                setCancelModalSale(s);
                                setCancelReason('');
                              }}
                              className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[11px] font-semibold border border-red-500/30 inline-flex items-center space-x-1"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: NEW CUSTOMER REGISTRATION                                    */}
      {/* -------------------------------------------------------------------- */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <span>Register New Customer Account</span>
              </h3>
              <button
                onClick={() => setShowNewCustomerModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Address</label>
                <textarea
                  rows={2}
                  placeholder="Street / City address..."
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">
                  Opening Balance / Prior Due ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0.00"
                  value={newCustomerForm.openingBalance || ''}
                  onChange={(e) =>
                    setNewCustomerForm({ ...newCustomerForm, openingBalance: Number(e.target.value) })
                  }
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-muted text-foreground border border-border font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary-hover transition-colors"
                >
                  {loading ? 'Creating...' : 'Save & Select'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: SALE CANCEL CONFIRMATION                                     */}
      {/* -------------------------------------------------------------------- */}
      {cancelModalSale && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-red-500/50 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-500 border-b border-border pb-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="font-bold text-sm text-foreground">
                Cancel Sale {cancelModalSale.invoiceNumber}
              </h3>
            </div>

            <p className="text-xs text-muted-foreground">
              Cancelling this sale will safely create reverse stock movements in the ledger for all line items
              and reverse any customer receivable balance created for this invoice.
            </p>

            <div className="space-y-1 text-xs">
              <label className="block text-muted-foreground font-semibold">Reason for Cancellation *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Customer changed mind, accidental scan, or cashier error..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="pt-3 border-t border-border flex justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setCancelModalSale(null)}
                className="px-4 py-2 rounded-lg bg-surface hover:bg-surface-muted text-foreground border border-border font-semibold"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={loading || !cancelReason.trim()}
                onClick={handleCancelSale}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shadow-md disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: PRINTABLE THERMAL RECEIPT / INVOICE PREVIEW                  */}
      {/* -------------------------------------------------------------------- */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2 text-foreground">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm">Sale Receipt & Invoice</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintReceipt}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center space-x-1.5 shadow-sm hover:bg-primary-hover"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Paper Body (Intentional paper receipt styling) */}
            <div className="flex-1 overflow-y-auto my-4 p-5 bg-white text-slate-950 rounded-xl font-mono text-xs shadow-inner space-y-4">
              {/* Shop Header */}
              <div className="text-center space-y-1 border-b border-slate-300 pb-3">
                <h2 className="font-extrabold text-base tracking-wider uppercase">
                  {settings?.company?.shopName || 'RS Inventory Solo'}
                </h2>
                {settings?.company?.address && <p className="text-[11px]">{settings.company.address}</p>}
                {settings?.company?.phone && <p className="text-[11px]">Phone: {settings.company.phone}</p>}
                {settings?.company?.gstin && <p className="text-[11px]">GSTIN: {settings.company.gstin}</p>}
              </div>

              {/* Invoice Meta */}
              <div className="flex justify-between text-[11px] border-b border-slate-300 pb-2">
                <div>
                  <p><strong>Invoice:</strong> {activeReceipt.invoiceNumber}</p>
                  <p><strong>Customer:</strong> {activeReceipt.customerName}</p>
                </div>
                <div className="text-right">
                  <p>
                    {new Date(activeReceipt.saleDate).toLocaleDateString()}{' '}
                    {new Date(activeReceipt.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p><strong>Cashier:</strong> {session?.user?.fullName || 'Admin'}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="border-b border-slate-300">
                  <tr>
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeReceipt.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-1">
                        <div>{it.productName}</div>
                        {it.discount > 0 && (
                          <div className="text-[10px] text-slate-500">Disc: -{currencySymbol}{it.discount.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-1 text-center font-bold">{it.quantity}</td>
                      <td className="py-1 text-right">{it.sellingPrice.toFixed(2)}</td>
                      <td className="py-1 text-right font-bold">{it.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Receipt Totals */}
              <div className="border-t-2 border-dashed border-slate-400 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{currencySymbol}{activeReceipt.subtotal.toFixed(2)}</span>
                </div>
                {activeReceipt.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-{currencySymbol}{activeReceipt.discount.toFixed(2)}</span>
                  </div>
                )}
                {activeReceipt.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>{currencySymbol}{activeReceipt.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t border-slate-400 pt-1">
                  <span>TOTAL:</span>
                  <span>{currencySymbol}{activeReceipt.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span>Paid ({activeReceipt.paymentMethod}):</span>
                  <span>{currencySymbol}{activeReceipt.paidAmount.toFixed(2)}</span>
                </div>
                {activeReceipt.dueAmount > 0 ? (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Credit / Balance Due:</span>
                    <span>{currencySymbol}{activeReceipt.dueAmount.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-700">
                    <span>Change Returned:</span>
                    <span>
                      {currencySymbol}
                      {Math.max(0, activeReceipt.paidAmount - activeReceipt.total).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Receipt Footer */}
              <div className="text-center pt-3 border-t border-slate-300 text-[10px] text-slate-600">
                <p>Thank you for shopping with us!</p>
                <p>Goods once sold cannot be returned without original receipt.</p>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                onClick={() => {
                  setActiveReceipt(null);
                  searchInputRef.current?.focus();
                }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary-hover transition-colors"
              >
                Done / New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {returningSaleId && (
        <SalesReturnModal
          saleId={returningSaleId}
          onClose={() => setReturningSaleId(null)}
          onSuccess={() => {
            setReturningSaleId(null);
            loadSalesHistory();
            loadInitialData();
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ADVANCED INVOICE PREVIEW & MULTI-FORMAT PRINTER OUTPUT        */}
      {/* -------------------------------------------------------------------- */}
      {previewDocument && (
        <InvoicePreviewModal
          document={previewDocument}
          onClose={() => {
            setPreviewDocument(null);
            searchInputRef.current?.focus();
          }}
          onOpenSettings={() => {
            setPreviewDocument(null);
            setShowPrinterSettings(true);
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: PRINTER & INVOICE CONFIGURATION                                */}
      {/* -------------------------------------------------------------------- */}
      {showPrinterSettings && (
        <PrinterSettingsModal onClose={() => setShowPrinterSettings(false)} />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: ONLINE GATEWAY CHECKOUT (STRIPE / RAZORPAY / CASHFREE)         */}
      {/* -------------------------------------------------------------------- */}
      {gatewayModalOpen && (
        <OnlineGatewayModal
          isOpen={gatewayModalOpen}
          onClose={() => setGatewayModalOpen(false)}
          onPaymentComplete={handleGatewayPaymentSuccess}
          amount={totals.grandTotal}
          orderNumber={`INV-${Date.now().toString().slice(-6)}`}
          customerName={selectedCustomer?.name || 'Walk-in Customer'}
          customerPhone={selectedCustomer?.phone || ''}
          initialGateway={activeGateway}
          salePayload={{
            customerId: !selectedCustomer || selectedCustomer.id === 'cash-customer' ? null : selectedCustomer.id,
            items: cart.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              sellingPrice: item.sellingPrice,
              discount: item.discount,
              taxRate: item.taxRate,
            })),
            discount: totals.globalDiscount,
            tax: totals.orderTax,
            paidAmount: totals.grandTotal,
            notes: saleNotes.trim() || undefined,
            allowNegativeStockOverride,
          }}
        />
      )}
    </div>
  );
}
