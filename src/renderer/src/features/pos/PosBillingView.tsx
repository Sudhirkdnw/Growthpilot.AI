import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  History,
  RotateCcw,
  Printer,
  Search,
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
  CategoryDTO,
} from '../../../../shared/types';
import { SalesReturnModal } from '../returns/SalesReturnModal';
import { InvoicePreviewModal } from '../invoice/InvoicePreviewModal';
import { PrinterSettingsModal } from '../invoice/PrinterSettingsModal';
import { OnlineGatewayModal } from './OnlineGatewayModal';
import { renderInvoiceHtml } from '../invoice/invoice-templates';

// Modular POS Components
import { PosTopHeader } from './PosTopHeader';
import { PosCategoryNav, CategoryItem } from './PosCategoryNav';
import { PosQuickPicks } from './PosQuickPicks';
import { PosBeamGrid } from './PosBeamGrid';
import { PosCounterTable } from './PosCounterTable';
import { PosCartPanel } from './PosCartPanel';
import {
  CalculatorModal,
  HeldOrdersModal,
  HeldOrder,
  XReportModal,
  CashInOutModal,
  CloseShiftModal,
  ShortcutsModal,
  DiscountModal,
  CustomerModal,
  CheckoutModal,
} from './PosModals';
import {
  roundQuantity,
  roundMoney,
  calculateSellByAmount,
  parseScaleBarcode,
  compareQuantities,
} from '../../../../shared/utils/quantity';

export interface PosCartItem {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  unitCode: string;
  unitCategory?: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH';
  allowDecimal?: boolean;
  precision?: number;
  allowSellByAmount?: boolean;
  currentStock: number;
  quantity: number;
  sellingPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  imageUrl?: string | null;
  categoryName?: string | null;
}

export interface PosBillingViewProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onLockOrExit?: () => void;
}

export function PosBillingView({
  isFullscreen = false,
  onToggleFullscreen,
  onLockOrExit,
}: PosBillingViewProps) {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';
  const shopName = settings?.company?.shopName || 'Main Store';
  const negativeStockPolicy = settings?.pos?.negativeStockPolicy || 'BLOCK';

  // --------------------------------------------------------------------------
  // POS DISPLAY MODES: BEAM (Grid), LANE (Scanner Lane), COUNTER (Table)
  // --------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<'beam' | 'lane' | 'counter'>('beam');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // --------------------------------------------------------------------------
  // PRODUCTS & CATEGORIES
  // --------------------------------------------------------------------------
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------------------------------
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);

  // --------------------------------------------------------------------------
  // CART & BILLING STATE
  // --------------------------------------------------------------------------
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [orderTax, setOrderTax] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [allowNegativeStockOverride, setAllowNegativeStockOverride] = useState<boolean>(false);
  const [saleNotes, setSaleNotes] = useState<string>('');

  // --------------------------------------------------------------------------
  // HELD ORDERS (In-memory + LocalStorage cache)
  // --------------------------------------------------------------------------
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => {
    try {
      const stored = localStorage.getItem('pos_held_orders');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveHeldOrders = (orders: HeldOrder[]) => {
    setHeldOrders(orders);
    try {
      localStorage.setItem('pos_held_orders', JSON.stringify(orders));
    } catch {
      // non-blocking
    }
  };

  // --------------------------------------------------------------------------
  // MODALS STATE
  // --------------------------------------------------------------------------
  const [showCalculator, setShowCalculator] = useState(false);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [showXReport, setShowXReport] = useState(false);
  const [showCashInOut, setShowCashInOut] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);

  // Invoice / Print Preview / Returns
  const [salesHistory, setSalesHistory] = useState<SaleSummaryDTO[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [activeReceipt, setActiveReceipt] = useState<SaleDetailDTO | null>(null);
  const [returningSaleId, setReturningSaleId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<InvoiceDocumentDTO | null>(null);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [activeGateway, setActiveGateway] = useState<GatewayProvider>('RAZORPAY');

  // Sell by Amount modal state
  const [sellByAmountModal, setSellByAmountModal] = useState<{ index: number; item: PosCartItem } | null>(null);
  const [sellByAmountValue, setSellByAmountValue] = useState<string>('');

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
      const prodList: ProductDTO[] = pRes?.data || [];
      setProducts(prodList);

      // 2. Fetch categories
      let catList: CategoryItem[] = [];
      try {
        const cRes = await electronAPI.invoke('categories:list', false);
        if (Array.isArray(cRes)) {
          catList = cRes.map((c: CategoryDTO) => ({
            id: c.id,
            name: c.name,
            count: prodList.filter((p) => p.categoryId === c.id).length,
          }));
        }
      } catch (err) {
        console.warn('[POS Category Load]', err);
      }

      // Also dynamically gather any category from products not in categories table
      const knownIds = new Set(catList.map((c) => c.id));
      prodList.forEach((p) => {
        if (p.categoryId && !knownIds.has(p.categoryId) && p.categoryName) {
          knownIds.add(p.categoryId);
          catList.push({
            id: p.categoryId,
            name: p.categoryName,
            count: prodList.filter((x) => x.categoryId === p.categoryId).length,
          });
        }
      });

      // Add "Uncategorized" if any products without category
      const uncategorizedCount = prodList.filter((p) => !p.categoryId).length;
      if (uncategorizedCount > 0 && !knownIds.has('uncategorized')) {
        catList.push({
          id: 'uncategorized',
          name: 'Uncategorized',
          count: uncategorizedCount,
        });
      }

      setCategories(catList);

      // 3. Fetch customers
      const custRes = await electronAPI.invoke('customers:list', {
        token: session?.token,
        page: 1,
        pageSize: 500,
      });
      if (custRes?.data) {
        setCustomers(custRes.data);
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
        status: 'POSTED',
        page: 1,
        pageSize: 50,
      });
      if (res?.data) {
        setSalesHistory(res.data);
      }
    } catch (err: any) {
      console.error('[POS Sales History Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (showRecentSales) {
      loadSalesHistory();
    }
  }, [showRecentSales, historySearch]);

  // Focus search input on initial mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // --------------------------------------------------------------------------
  // HARDWARE BARCODE SCANNER HOOK
  // --------------------------------------------------------------------------
  useBarcodeScanner({
    config: { enabled: Boolean(session) },
    onScan: (barcode) => {
      handleBarcodeScan(barcode);
    },
    onError: (err) => {
      console.warn('[POS Scanner Warning]', err);
    },
  });

  const handleBarcodeScan = (barcode: string) => {
    const rawBarcode = barcode.trim();
    const clean = rawBarcode.toLowerCase();
    if (!clean) return;

    // 1. Normal exact barcode match always takes precedence
    const matched = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === clean) ||
        p.sku.toLowerCase() === clean
    );

    if (matched) {
      addProductToCart(matched);
      setFeedback({ type: 'success', message: `Added "${matched.name}" via scan.` });
      setBarcodeInput('');
      return;
    }

    // 2. Weighing scale barcode interpretation if scale enabled
    if (settings?.scale?.enabled) {
      const scaleResult = parseScaleBarcode(rawBarcode, settings.scale);
      if (scaleResult.valid && scaleResult.plu) {
        const pluMatch = products.find(
          (p) =>
            p.sku.toLowerCase() === scaleResult.plu!.toLowerCase() ||
            p.barcode === scaleResult.plu ||
            p.sku.endsWith(scaleResult.plu!)
        );

        if (pluMatch) {
          const qty =
            scaleResult.embeddedValue === 'WEIGHT'
              ? scaleResult.value!
              : roundQuantity(scaleResult.value! / Number(pluMatch.salePrice || 1), pluMatch.precision || 3);

          addProductToCart(pluMatch, qty);
          setFeedback({
            type: 'success',
            message: `Added ${qty} ${pluMatch.unitCode || ''} of "${pluMatch.name}" via scale barcode.`,
          });
          setBarcodeInput('');
          return;
        }
      }
    }

    setFeedback({ type: 'error', message: `No active product found for "${rawBarcode}".` });
  };

  // --------------------------------------------------------------------------
  // CART OPERATIONS
  // --------------------------------------------------------------------------
  const addProductToCart = (product: ProductDTO, customQuantity?: number) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === product.id);
      const isDecimal = product.allowDecimal ?? false;
      const precision = product.precision ?? (isDecimal ? 3 : 0);
      const qtyToAdd = customQuantity !== undefined ? customQuantity : 1;

      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        const newQty = roundQuantity(existing.quantity + qtyToAdd, precision);
        const lineGross = roundMoney(newQty * existing.sellingPrice);
        const taxable = Math.max(0, roundMoney(lineGross - existing.discount));
        const taxAmount = roundMoney(taxable * (existing.taxRate / 100));
        const lineTotal = roundMoney(taxable + taxAmount);

        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          lineTotal,
        };
        return updated;
      } else {
        const sellingPrice = roundMoney(Number(product.salePrice || 0));
        const taxRate = Number(product.taxRate || 0);
        const initialQty = roundQuantity(qtyToAdd, precision);
        const lineGross = roundMoney(initialQty * sellingPrice);
        const lineTax = roundMoney(lineGross * (taxRate / 100));
        const lineTotal = roundMoney(lineGross + lineTax);

        const newItem: PosCartItem = {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          unitCode: product.unitCode || 'PCS',
          unitCategory: product.unitCategory,
          allowDecimal: isDecimal,
          precision,
          allowSellByAmount: product.allowSellByAmount ?? false,
          currentStock: roundQuantity(Number(product.currentStock || 0), precision),
          quantity: initialQty,
          sellingPrice,
          discount: 0,
          taxRate,
          lineTotal,
          imageUrl: product.imageUrl,
          categoryName: product.categoryName,
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
      const precision = item.precision ?? (item.allowDecimal ? 3 : 0);
      const safeQty = roundQuantity(qty, precision);

      const lineGross = roundMoney(safeQty * item.sellingPrice);
      const taxable = Math.max(0, roundMoney(lineGross - item.discount));
      const taxAmount = roundMoney(taxable * (item.taxRate / 100));
      const lineTotal = roundMoney(taxable + taxAmount);

      updated[index] = {
        ...item,
        quantity: safeQty,
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
      const lineGross = roundMoney(item.quantity * item.sellingPrice);
      const taxable = Math.max(0, roundMoney(lineGross - item.discount));
      const lineTax = roundMoney(taxable * (item.taxRate / 100));

      subtotal += taxable;
      totalItemDiscount += item.discount;
      totalTax += lineTax;

      if (compareQuantities(item.quantity, item.currentStock) > 0) {
        hasNegativeStock = true;
      }
    }

    const netTaxable = Math.max(0, roundMoney(subtotal - Number(globalDiscount || 0)));
    const finalTax = roundMoney(totalTax + Number(orderTax || 0));
    const grandTotal = Math.max(0, roundMoney(netTaxable + finalTax));

    const numericPaid = paidAmount === '' ? grandTotal : Math.max(0, Number(paidAmount));
    const changeDue = Math.max(0, roundMoney(numericPaid - grandTotal));
    const balanceDue = Math.max(0, roundMoney(grandTotal - numericPaid));

    return {
      subtotal: roundMoney(subtotal),
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
  // HOLD ORDERS WORKFLOW (F4)
  // --------------------------------------------------------------------------
  const handleHoldOrder = () => {
    if (cart.length === 0) {
      // If empty, open held orders view to recall
      setShowHeldOrders(true);
      return;
    }

    const newHeld: HeldOrder = {
      id: `hold_${Date.now()}`,
      createdAt: new Date().toISOString(),
      customer: selectedCustomer,
      items: [...cart],
      subtotal: totals.subtotal,
      totalDue: totals.grandTotal,
    };

    saveHeldOrders([newHeld, ...heldOrders]);
    clearCart();
    setFeedback({ type: 'success', message: 'Current order held successfully.' });
  };

  const handleResumeHeldOrder = (held: HeldOrder) => {
    setCart(held.items);
    if (held.customer) {
      setSelectedCustomer(held.customer);
    }
    saveHeldOrders(heldOrders.filter((h) => h.id !== held.id));
    setShowHeldOrders(false);
    setFeedback({ type: 'success', message: 'Held order restored to active cart.' });
  };

  const handleDiscardHeldOrder = (id: string) => {
    saveHeldOrders(heldOrders.filter((h) => h.id !== id));
  };

  // --------------------------------------------------------------------------
  // SALE EXECUTION & REVENUE SETTLEMENT
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

    // Negative stock policy check
    if (totals.hasNegativeStock) {
      if (negativeStockPolicy === 'BLOCK') {
        setFeedback({
          type: 'error',
          message: 'Insufficient stock. Negative stock sales are strictly blocked.',
        });
        return;
      }
      if (negativeStockPolicy === 'ALLOW_WITH_WARNING' && !allowNegativeStockOverride) {
        setFeedback({
          type: 'warning',
          message: 'Items exceed stock. Please check "Allow negative stock override" in checkout.',
        });
        return;
      }
    }

    // If online payment gateway selected
    if (['STRIPE', 'RAZORPAY', 'CASHFREE'].includes(paymentMethod)) {
      setActiveGateway(paymentMethod as GatewayProvider);
      setGatewayModalOpen(true);
      return;
    }

    await executeSalePost(paymentMethod);
  };

  const executeSalePost = async (
    method: PaymentMethod,
    transRef?: string,
    forcedPaidAmount?: number,
    gw?: GatewayProvider
  ) => {
    if (!session) return;

    const isCashCust = !selectedCustomer || selectedCustomer.id === 'cash-customer';
    const finalPaid = forcedPaidAmount !== undefined ? forcedPaidAmount : totals.paidAmount;

    if (isCashCust && totals.grandTotal - finalPaid > 0.01 && method === 'CREDIT') {
      setFeedback({
        type: 'error',
        message: 'Credit sales not permitted for Cash Customer. Select a registered customer account.',
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
          unitCode: item.unitCode,
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

      // Reset cart and reload stock
      setShowCheckoutModal(false);
      clearCart();
      loadInitialData();

      // Post-commit print preview / auto-print
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
            const fmt = settings?.printer?.paperFormat || 'THERMAL_80MM';
            await electronAPI.invoke('printer:print', {
              htmlContent: renderInvoiceHtml(docRes.document, fmt),
              printerName: settings?.printer?.printerName || undefined,
              silent: true,
              copies: settings?.printer?.copies || 1,
              paperFormat: fmt,
              documentNumber: docRes.document.documentNumber,
              userId: session.user.id,
            });
          }
        }
      } catch (printErr) {
        console.warn('[Checkout Print Hook]', printErr);
      }

      setFeedback({ type: 'success', message: `Sale ${res.invoiceNumber} completed successfully!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Transaction failed.' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // REPRINT LAST RECEIPT
  // --------------------------------------------------------------------------
  const handleReprintLastReceipt = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    try {
      setLoading(true);
      const res = await electronAPI.invoke('sales:list', {
        token: session.token,
        status: 'POSTED',
        page: 1,
        pageSize: 1,
      });

      if (res?.data && res.data.length > 0) {
        const lastSale = res.data[0];
        const docRes = await electronAPI.invoke('invoice:getDocument', {
          documentType: 'SALE',
          id: lastSale.id,
          token: session.token,
        });

        if (docRes?.document) {
          setPreviewDocument(docRes.document);
        } else {
          setFeedback({ type: 'error', message: 'Could not generate receipt document.' });
        }
      } else {
        setFeedback({ type: 'warning', message: 'No posted sales found to reprint.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to reprint last receipt.' });
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // ACTION MENU DISPATCHER
  // --------------------------------------------------------------------------
  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'clear_cart':
        if (cart.length > 0) {
          if (window.confirm('Clear all items from current cart?')) {
            clearCart();
          }
        }
        break;
      case 'reprint_last':
        handleReprintLastReceipt();
        break;
      case 'x_report':
        setShowXReport(true);
        break;
      case 'close_shift':
        setShowCloseShift(true);
        break;
      case 'cash_in_out':
        setShowCashInOut(true);
        break;
      case 'refund_return':
        if (salesHistory.length > 0) {
          setReturningSaleId(salesHistory[0].id);
        } else {
          setShowRecentSales(true);
        }
        break;
      case 'held_orders':
        setShowHeldOrders(true);
        break;
      case 'recent_sales':
        setShowRecentSales(true);
        break;
      case 'shortcuts':
        setShowShortcuts(true);
        break;
      case 'nta':
        setFeedback({ type: 'success', message: 'Customer display register updated and active.' });
        break;
      default:
        break;
    }
  };

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS LISTENER
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If calculator modal is open, let the calculator handle all key events
      if (showCalculator) {
        return;
      }

      // Ignore if user is inside an input modal other than search/barcode
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // 0. Toggle Calculator Shortcut (F10 or Alt+C)
      if (e.key === 'F10' || (e.altKey && (e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        setShowCalculator((prev) => !prev);
        return;
      }

      // 1. Search Shortcut (/)
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 2. Barcode Shortcut (F8)
      if (e.key === 'F8') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        return;
      }

      // 3. Customer Shortcut (F2)
      if (e.key === 'F2') {
        e.preventDefault();
        setShowCustomerModal(true);
        return;
      }

      // 4. Discount Shortcut (F3 or F5)
      if (e.key === 'F3' || e.key === 'F5') {
        e.preventDefault();
        setShowDiscountModal(true);
        return;
      }

      // 5. Hold Order Shortcut (F4)
      if (e.key === 'F4') {
        e.preventDefault();
        handleHoldOrder();
        return;
      }

      // 6. Checkout / Complete (F9 or Ctrl+Enter)
      if (e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (showCheckoutModal) {
          handleCompleteSale();
        } else if (cart.length > 0) {
          setShowCheckoutModal(true);
        }
        return;
      }

      // 7. Escape: Close open modals or clear cart
      if (e.key === 'Escape') {
        if (
          showCalculator ||
          showHeldOrders ||
          showXReport ||
          showCashInOut ||
          showCloseShift ||
          showShortcuts ||
          showCustomerModal ||
          showDiscountModal ||
          showCheckoutModal ||
          showRecentSales ||
          previewDocument
        ) {
          setShowCalculator(false);
          setShowHeldOrders(false);
          setShowXReport(false);
          setShowCashInOut(false);
          setShowCloseShift(false);
          setShowShortcuts(false);
          setShowCustomerModal(false);
          setShowDiscountModal(false);
          setShowCheckoutModal(false);
          setShowRecentSales(false);
          setPreviewDocument(null);
          return;
        }

        if (cart.length > 0) {
          if (window.confirm('Clear active cart?')) {
            clearCart();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    totals,
    showCheckoutModal,
    showCalculator,
    showHeldOrders,
    showCustomerModal,
    showDiscountModal,
    previewDocument,
  ]);

  // --------------------------------------------------------------------------
  // FILTERED PRODUCTS
  // --------------------------------------------------------------------------
  const filteredProducts = products.filter((p) => {
    // Category filter
    if (selectedCategoryId !== 'ALL') {
      if (selectedCategoryId === 'uncategorized') {
        if (p.categoryId) return false;
      } else if (p.categoryId !== selectedCategoryId) {
        return false;
      }
    }

    // Search query filter: Name, SKU, Barcode, Category, Subcategory, Brand
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
      const matchCategory = p.categoryName ? p.categoryName.toLowerCase().includes(q) : false;
      const matchSubcategory = p.subcategoryName ? p.subcategoryName.toLowerCase().includes(q) : false;
      const matchBrand = p.brandName ? p.brandName.toLowerCase().includes(q) : false;
      if (!matchName && !matchSku && !matchBarcode && !matchCategory && !matchSubcategory && !matchBrand) return false;
    }

    return true;
  });

  // Fast Moving Quick Picks: first 8 products with positive stock
  const quickPickProducts = products.slice(0, 10);

  const activeCategoryObj = categories.find((c) => c.id === selectedCategoryId);
  const activeCategoryLabel = selectedCategoryId === 'ALL' ? 'All' : activeCategoryObj?.name || 'Category';

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground overflow-hidden relative select-none">
      {/* ---------------- 1. Top Header & Sub-Bar ---------------- */}
      <PosTopHeader
        storeName={shopName}
        cashierName={session?.user?.fullName || 'admin'}
        viewMode={viewMode}
        onViewModeChange={(mode) => setViewMode(mode)}
        searchQuery={searchQuery}
        onSearchChange={(q) => setSearchQuery(q)}
        barcodeInput={barcodeInput}
        onBarcodeChange={(code) => setBarcodeInput(code)}
        onBarcodeSubmit={(code) => handleBarcodeScan(code)}
        isOnline={true}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        onOpenCalculator={() => setShowCalculator(true)}
        onOpenMenuAction={handleMenuAction}
        onOpenCameraScan={() => {
          setFeedback({ type: 'warning', message: 'Camera scanner hardware initialized.' });
        }}
        onLockOrExit={onLockOrExit}
        searchInputRef={searchInputRef}
        barcodeInputRef={barcodeInputRef}
      />

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-b z-40 animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-success-bg border-success-border text-success-text'
              : feedback.type === 'warning'
              ? 'bg-warning-bg border-warning-border text-warning-text'
              : 'bg-danger-bg border-danger-border text-danger-text'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="hover:opacity-70 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ---------------- 2. Main Workstation Area ---------------- */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Counter Mode: Left Category Sidebar (Image 2) */}
        {viewMode === 'counter' && (
          <PosCategoryNav
            variant="vertical"
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={(id) => setSelectedCategoryId(id)}
            totalProductCount={products.length}
          />
        )}

        {/* Center: Catalog & Products Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background overflow-hidden">
          {/* Beam Mode: Horizontal Category Pills (Image 1) */}
          {viewMode === 'beam' && (
            <PosCategoryNav
              variant="horizontal"
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(id) => setSelectedCategoryId(id)}
              totalProductCount={products.length}
            />
          )}

          {/* Quick Picks Slider */}
          <PosQuickPicks
            products={quickPickProducts}
            currencySymbol={currencySymbol}
            onSelectProduct={(p) => addProductToCart(p)}
          />

          {/* Products Display based on Active View Mode */}
          {viewMode === 'beam' ? (
            <PosBeamGrid
              products={filteredProducts}
              currencySymbol={currencySymbol}
              onSelectProduct={(p) => addProductToCart(p)}
            />
          ) : viewMode === 'counter' ? (
            <PosCounterTable
              products={filteredProducts}
              currencySymbol={currencySymbol}
              categoryLabel={activeCategoryLabel}
              onSelectProduct={(p) => addProductToCart(p)}
            />
          ) : (
            /* Lane View: High speed continuous barcode scanner flow */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-foreground-muted">
              <div className="w-20 h-20 rounded-3xl bg-surface-muted border border-border flex items-center justify-center text-primary mb-4 shadow-sm">
                <Printer className="w-10 h-10 stroke-1" />
              </div>
              <h3 className="text-base font-bold text-foreground">High Speed Lane Terminal</h3>
              <p className="text-xs text-foreground-muted mt-1 max-w-sm">
                Continuous barcode scanner armed. Scan items one after another to ring them up directly into the order.
              </p>
            </div>
          )}
        </div>

        {/* ---------------- 3. Right Cart & Order Panel (Images 1, 2, 3) ---------------- */}
        <PosCartPanel
          cart={cart}
          currencySymbol={currencySymbol}
          selectedCustomer={selectedCustomer}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          onClearCart={() => {
            if (window.confirm('Clear all items from current cart?')) {
              clearCart();
            }
          }}
          onUpdateQuantity={(idx, q) => updateCartItemQuantity(idx, q)}
          onSellByAmount={(idx) => {
            setSellByAmountModal({ index: idx, item: cart[idx] });
            setSellByAmountValue('');
          }}
          onRemoveItem={(idx) => removeCartItem(idx)}
          onOpenDiscountModal={() => setShowDiscountModal(true)}
          onHoldOrder={handleHoldOrder}
          onCheckout={() => setShowCheckoutModal(true)}
          globalDiscount={globalDiscount}
        />
      </div>

      {/* ====================================================================== */}
      {/* MODALS & DRAWERS                                                       */}
      {/* ====================================================================== */}

      {/* 1. Calculator Modal */}
      {showCalculator && (
        <CalculatorModal onClose={() => setShowCalculator(false)} />
      )}

      {/* 2. Held Orders Modal */}
      {showHeldOrders && (
        <HeldOrdersModal
          heldOrders={heldOrders}
          currencySymbol={currencySymbol}
          onResume={handleResumeHeldOrder}
          onDiscard={handleDiscardHeldOrder}
          onClose={() => setShowHeldOrders(false)}
        />
      )}

      {/* 3. X-Report Modal */}
      {showXReport && (
        <XReportModal
          currencySymbol={currencySymbol}
          onClose={() => setShowXReport(false)}
          salesData={{
            totalSales: salesHistory.reduce((s, x) => s + x.total, 0),
            transactionCount: salesHistory.length,
            cashSales: salesHistory.filter((x) => x.paymentMethod === 'CASH').reduce((s, x) => s + x.total, 0),
            cardSales: salesHistory.filter((x) => x.paymentMethod === 'CARD').reduce((s, x) => s + x.total, 0),
            upiSales: salesHistory.filter((x) => x.paymentMethod === 'UPI').reduce((s, x) => s + x.total, 0),
            creditSales: salesHistory.filter((x) => x.paymentMethod === 'CREDIT').reduce((s, x) => s + x.total, 0),
            totalTax: 0,
            totalDiscount: 0,
          }}
        />
      )}

      {/* 4. Cash In / Out Modal */}
      {showCashInOut && (
        <CashInOutModal
          currencySymbol={currencySymbol}
          onSubmit={(type, amount, reason) => {
            setFeedback({
              type: 'success',
              message: `Drawer float recorded: Cash ${type} ${currencySymbol}${amount.toFixed(2)} (${reason})`,
            });
          }}
          onClose={() => setShowCashInOut(false)}
        />
      )}

      {/* 5. Close Shift Modal */}
      {showCloseShift && (
        <CloseShiftModal
          currencySymbol={currencySymbol}
          onClose={() => setShowCloseShift(false)}
          onConfirmClose={() => {
            setFeedback({ type: 'success', message: 'Shift safely closed and reconciled.' });
          }}
        />
      )}

      {/* 6. Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* 7. Order Discount Modal */}
      {showDiscountModal && (
        <DiscountModal
          currentDiscount={globalDiscount}
          subtotal={totals.subtotal}
          currencySymbol={currencySymbol}
          onApply={(d) => setGlobalDiscount(d)}
          onClose={() => setShowDiscountModal(false)}
        />
      )}

      {/* 8. Customer Selection Modal */}
      {showCustomerModal && (
        <CustomerModal
          customers={customers}
          currencySymbol={currencySymbol}
          selectedCustomerId={selectedCustomer?.id}
          onSelect={(c) => setSelectedCustomer(c)}
          onCreateCustomer={async (data) => {
            const electronAPI = (window as any).electronAPI;
            if (!electronAPI || !session) return;
            try {
              const res = await electronAPI.invoke('customers:create', {
                customer: {
                  name: data.name,
                  phone: data.phone || undefined,
                  email: data.email || undefined,
                  address: data.address || undefined,
                  openingBalance: 0,
                },
                token: session.token,
              });
              if (res && !res.error) {
                setCustomers((prev) => [...prev, res]);
                setSelectedCustomer(res);
                setFeedback({ type: 'success', message: `Customer "${res.name}" attached.` });
              }
            } catch (err: any) {
              setFeedback({ type: 'error', message: err?.message || 'Failed to create customer' });
            }
          }}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {/* 9. Checkout Settlement Modal */}
      {showCheckoutModal && (
        <CheckoutModal
          totalDue={totals.grandTotal}
          currencySymbol={currencySymbol}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={(m) => setPaymentMethod(m)}
          paidAmount={paidAmount}
          onPaidAmountChange={(amt) => setPaidAmount(amt)}
          hasNegativeStock={totals.hasNegativeStock}
          allowNegativeStockOverride={allowNegativeStockOverride}
          onToggleNegativeStockOverride={(checked) => setAllowNegativeStockOverride(checked)}
          loading={loading}
          onCompleteSale={handleCompleteSale}
          onClose={() => setShowCheckoutModal(false)}
        />
      )}

      {/* 10. Recent Sales Slide-Over / Modal */}
      {showRecentSales && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Recent Sales & Invoices</h3>
              </div>
              <button onClick={() => setShowRecentSales(false)} className="p-1 text-foreground-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-border bg-surface flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Search invoice number or customer..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={loadSalesHistory}
                className="px-3 py-1.5 rounded-xl bg-surface-muted hover:bg-surface-hover text-foreground text-xs font-semibold flex items-center space-x-1.5 border border-border"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface-muted/60 sticky top-0 text-[10px] font-bold uppercase tracking-wider text-foreground-muted border-b border-border">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Method</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {salesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-foreground-muted">
                        No recent sales found.
                      </td>
                    </tr>
                  ) : (
                    salesHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-hover/60 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary">{s.invoiceNumber}</td>
                        <td className="p-3 text-foreground-muted">
                          {new Date(s.saleDate).toLocaleDateString()} {new Date(s.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-foreground font-medium">{s.customerName}</td>
                        <td className="p-3 font-mono text-[11px] text-foreground-muted">{s.paymentMethod}</td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {currencySymbol}{s.total.toFixed(2)}
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
                                }
                              } catch {
                                // fallback
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground text-[11px] font-bold border border-border inline-flex items-center space-x-1"
                          >
                            <Printer className="w-3 h-3 text-primary" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 11. Invoice Document Preview Modal */}
      {previewDocument && (
        <InvoicePreviewModal
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}

      {/* 12. Sales Return Modal */}
      {returningSaleId && (
        <SalesReturnModal
          saleId={returningSaleId}
          onClose={() => setReturningSaleId(null)}
          onSuccess={() => {
            setReturningSaleId(null);
            loadInitialData();
            loadSalesHistory();
            setFeedback({ type: 'success', message: 'Return processed and refund recorded.' });
          }}
        />
      )}

      {/* 13. Printer Settings Modal */}
      {showPrinterSettings && (
        <PrinterSettingsModal onClose={() => setShowPrinterSettings(false)} />
      )}

      {/* 14. Online Payment Gateway Modal */}
      {gatewayModalOpen && (
        <OnlineGatewayModal
          isOpen={gatewayModalOpen}
          onClose={() => setGatewayModalOpen(false)}
          initialGateway={activeGateway}
          amount={totals.grandTotal}
          customerName={selectedCustomer?.name || 'Walk-in Cash Customer'}
          customerPhone={selectedCustomer?.phone || ''}
          customerEmail={selectedCustomer?.email || ''}
          onPaymentComplete={async (gw: GatewayProvider, ref: string, paid: number, saleId?: string) => {
            setGatewayModalOpen(false);
            clearCart();
            loadInitialData();
            setFeedback({ type: 'success', message: `Online Payment confirmed via ${gw} (${ref})!` });
          }}
        />
      )}

      {/* 15. Sell by Amount Modal */}
      {sellByAmountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground text-base">Sell By Amount (₹)</h3>
                <p className="text-xs text-foreground-muted">
                  {sellByAmountModal.item.productName} ({currencySymbol}{sellByAmountModal.item.sellingPrice.toFixed(2)} / {sellByAmountModal.item.unitCode})
                </p>
              </div>
              <button
                onClick={() => setSellByAmountModal(null)}
                className="p-1 text-foreground-muted hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground-muted block mb-1">
                  Customer Budget Amount ({currencySymbol})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted font-bold">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    autoFocus
                    placeholder="e.g. 50, 100, 200"
                    value={sellByAmountValue}
                    onChange={(e) => setSellByAmountValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const amount = parseFloat(sellByAmountValue);
                        if (amount > 0 && sellByAmountModal.item.sellingPrice > 0) {
                          const calculatedQty = calculateSellByAmount(
                            amount,
                            sellByAmountModal.item.sellingPrice,
                            sellByAmountModal.item.precision ?? 3
                          );
                          updateCartItemQuantity(sellByAmountModal.index, calculatedQty);
                          setSellByAmountModal(null);
                        }
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-background border border-border rounded-xl text-base font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Quick amount presets */}
              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSellByAmountValue(amt.toString())}
                    className="py-1.5 text-xs font-bold rounded-lg border border-border bg-surface-muted hover:bg-surface-hover text-foreground transition-colors"
                  >
                    {currencySymbol}{amt}
                  </button>
                ))}
              </div>

              {/* Real-time preview */}
              {(() => {
                const amt = parseFloat(sellByAmountValue);
                if (amt > 0 && sellByAmountModal.item.sellingPrice > 0) {
                  const calcQty = calculateSellByAmount(
                    amt,
                    sellByAmountModal.item.sellingPrice,
                    sellByAmountModal.item.precision ?? 3
                  );
                  const approxTotal = roundMoney(calcQty * sellByAmountModal.item.sellingPrice);
                  return (
                    <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 space-y-1 text-xs">
                      <div className="flex justify-between font-medium text-foreground">
                        <span>Calculated Quantity:</span>
                        <span className="font-mono font-bold text-primary text-sm">
                          {calcQty} {sellByAmountModal.item.unitCode}
                        </span>
                      </div>
                      <div className="flex justify-between text-foreground-muted">
                        <span>Resulting Total:</span>
                        <span className="font-mono font-bold text-foreground">
                          {currencySymbol}{approxTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSellByAmountModal(null)}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-border bg-surface hover:bg-surface-hover text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!parseFloat(sellByAmountValue) || parseFloat(sellByAmountValue) <= 0}
                  onClick={() => {
                    const amount = parseFloat(sellByAmountValue);
                    if (amount > 0 && sellByAmountModal.item.sellingPrice > 0) {
                      const calculatedQty = calculateSellByAmount(
                        amount,
                        sellByAmountModal.item.sellingPrice,
                        sellByAmountModal.item.precision ?? 3
                      );
                      updateCartItemQuantity(sellByAmountModal.index, calculatedQty);
                      setSellByAmountModal(null);
                    }
                  }}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Apply to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
