import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  PackageOpen,
  User,
  Printer,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { SaleReturnableDetailsDTO, RefundMethod, InvoiceDocumentDTO } from '../../../../shared/types';
import { InvoicePreviewModal } from '../invoice/InvoicePreviewModal';
import { ProductImage } from '../../components/common/ProductImage';

interface SalesReturnModalProps {
  saleId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  saleId,
  onClose,
  onSuccess,
}) => {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [details, setDetails] = useState<SaleReturnableDetailsDTO | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH_REFUND');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any | null>(null);
  const [previewDoc, setPreviewDoc] = useState<InvoiceDocumentDTO | null>(null);

  useEffect(() => {
    fetchDetails();
  }, [saleId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const electronAPI = (window as any).electronAPI;
      const res = await electronAPI.invoke('salesReturns:getReturnable', {
        saleId,
        token: session?.token,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setDetails(res);
        const initialQtys: Record<string, number> = {};
        res.items.forEach((item: any) => {
          initialQtys[item.saleItemId] = 0;
        });
        setReturnQtys(initialQtys);

        // If walk-in cash customer (no customerId or cash-customer), default and lock to CASH_REFUND
        if (!res.customerId || res.customerId === 'cash-customer') {
          setRefundMethod('CASH_REFUND');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load sale details for return.');
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (saleItemId: string, maxQty: number, val: string) => {
    const num = Math.max(0, Math.min(maxQty, Number(val) || 0));
    setReturnQtys((prev) => ({
      ...prev,
      [saleItemId]: num,
    }));
  };

  // Calculate totals dynamically (exact 2-decimal precision matching backend service)
  const calculatedItems = (details?.items || []).map((item) => {
    const qty = returnQtys[item.saleItemId] || 0;
    const soldQty = item.soldQuantity || 1;
    const discountPerUnit = soldQty > 0 ? (item.discount || 0) / soldQty : 0;
    const lineDiscount = Math.round(discountPerUnit * qty * 100) / 100;

    const lineGross = Math.round(item.unitPrice * qty * 100) / 100;
    const lineTaxable = Math.max(0, lineGross - lineDiscount);
    const taxRate = Number(item.taxRate || 0);
    const lineTax = Math.round(lineTaxable * (taxRate / 100) * 100) / 100;
    const lineTotal = Math.round((lineTaxable + lineTax) * 100) / 100;

    return {
      ...item,
      returnQty: qty,
      lineSubtotal: lineGross,
      lineDiscount,
      lineTax,
      lineTotal,
    };
  });

  const totalReturnQty = calculatedItems.reduce((acc, it) => acc + it.returnQty, 0);
  const totalSubtotal = Math.round(calculatedItems.reduce((acc, it) => acc + it.lineSubtotal, 0) * 100) / 100;
  const totalDiscount = Math.round(calculatedItems.reduce((acc, it) => acc + it.lineDiscount, 0) * 100) / 100;
  const totalTax = Math.round(calculatedItems.reduce((acc, it) => acc + it.lineTax, 0) * 100) / 100;
  const totalRefundAmount = Math.max(0, Math.round((totalSubtotal - totalDiscount + totalTax) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalReturnQty <= 0) {
      setError('Please select at least 1 item quantity to return.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const itemsToReturn = calculatedItems
      .filter((it) => it.returnQty > 0)
      .map((it) => ({
        saleItemId: it.saleItemId,
        productId: it.productId,
        quantity: it.returnQty,
        reason: reason || undefined,
      }));

    try {
      const electronAPI = (window as any).electronAPI;
      const res = await electronAPI.invoke('salesReturns:create', {
        returnData: {
          saleId,
          refundType: refundMethod,
          refundMethod: refundMethod === 'CUSTOMER_CREDIT' ? 'CREDIT' : 'CASH',
          notes: reason || undefined,
          items: itemsToReturn,
        },
        token: session?.token,
      });

      if (res?.error) {
        setError(res.error);
        setSubmitting(false);
      } else {
        setSuccessInfo(res);
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to process sales return.');
      setSubmitting(false);
    }
  };

  const isWalkInCustomer = !details?.customerId || details?.customerId === 'cash-customer';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-primary border border-primary/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <span>Process Sales Return</span>
                {details && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-elevated text-primary">
                    {details.invoiceNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative stock restock (RETURN_IN) & linked customer credit/cash refund
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading sale line items & return balances...</p>
            </div>
          ) : error && !details ? (
            <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : successInfo ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Sales Return Successfully Created!</h3>
                <p className="text-xs text-muted-foreground">
                  Return Reference Number:{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {successInfo.returnNumber}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Refund Type:{' '}
                  <span className="font-bold text-foreground">
                    {successInfo.refundType === 'CUSTOMER_CREDIT'
                      ? 'Customer Account Credit'
                      : 'Cash Refund'}
                  </span>{' '}
                  | Total Refund:{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {currencySymbol}{successInfo.totalAmount.toFixed(2)}
                  </span>
                </p>
              </div>

              <div className="pt-4 flex items-center justify-center space-x-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!successInfo?.id) return;
                    try {
                      const electronAPI = (window as any).electronAPI;
                      const doc = await electronAPI.invoke('invoice:getDocument', {
                        documentType: 'SALES_RETURN',
                        id: successInfo.id,
                        token: session?.token,
                      });
                      if (doc?.error) {
                        setError(doc.error);
                      } else {
                        setPreviewDoc(doc);
                      }
                    } catch (err: any) {
                      setError(err?.message || 'Failed to load credit note document.');
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Credit Note</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSuccess();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-bold transition-all border border-border"
                >
                  Done
                </button>
              </div>
            </div>
          ) : details ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Sale Info Card */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-surface-muted border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Customer</span>
                  <span className="text-foreground font-semibold flex items-center space-x-1 mt-0.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>{details.customerName}</span>
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Original Total</span>
                  <span className="text-foreground font-mono font-semibold block mt-0.5">
                    {currencySymbol}{details.total.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Payment Mode</span>
                  <span className="text-foreground font-mono font-semibold block mt-0.5">
                    {details.paymentMethod}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Sale Date</span>
                  <span className="text-muted-foreground font-mono block mt-0.5">
                    {new Date(details.saleDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Items Return Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-1.5">
                    <PackageOpen className="w-3.5 h-3.5 text-primary" />
                    <span>Select Line Items to Return</span>
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Only sold items with available un-returned quantities are eligible
                  </span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-surface-muted">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                        <th className="p-3">Product</th>
                        <th className="p-3 text-center">Sold</th>
                        <th className="p-3 text-center">Returned</th>
                        <th className="p-3 text-center">Available</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-center w-28">Return Qty</th>
                        <th className="p-3 text-right">Refund Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-sans">
                      {calculatedItems.map((item) => {
                        const isFullyReturned = item.returnableQuantity <= 0;
                        return (
                          <tr
                            key={item.saleItemId}
                            className={`transition-colors ${
                              isFullyReturned
                                ? 'bg-surface-muted text-muted-foreground'
                                : item.returnQty > 0
                                ? 'bg-primary-muted'
                                : 'hover:bg-surface-elevated/30 text-foreground'
                            }`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <ProductImage
                                  name={item.productName}
                                  className="w-8 h-8 rounded-lg shrink-0 border border-border"
                                  imageClassName="w-full h-full object-cover p-0"
                                  iconClassName="w-4 h-4"
                                />
                                <div>
                                  <div className="font-semibold text-foreground">{item.productName}</div>
                                  <div className="text-[10px] font-mono text-muted-foreground">
                                    SKU: {item.sku} {item.unitCode ? `(${item.unitCode})` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono">{item.soldQuantity}</td>
                            <td className="p-3 text-center font-mono text-muted-foreground">
                              {item.previouslyReturnedQuantity}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-amber-400">
                              {item.returnableQuantity}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {currencySymbol}{item.unitPrice.toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              {isFullyReturned ? (
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                  Fully Returned
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={item.returnableQuantity}
                                  value={returnQtys[item.saleItemId] ?? 0}
                                  onChange={(e) =>
                                    handleQtyChange(item.saleItemId, item.returnableQuantity, e.target.value)
                                  }
                                  className="w-20 bg-input border border-border rounded-lg px-2 py-1 text-center font-mono font-bold text-primary text-xs focus:outline-none focus:border-primary"
                                />
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-primary">
                              {currencySymbol}{item.lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Settlement Options & Reason */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 rounded-xl bg-surface-muted border border-border">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Refund Settlement Method
                  </label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        refundMethod === 'CASH_REFUND'
                          ? 'border-primary bg-orange-500/10 text-primary'
                          : 'border-border bg-surface-elevated/50 text-muted-foreground hover:border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="refundMethod"
                        value="CASH_REFUND"
                        checked={refundMethod === 'CASH_REFUND'}
                        onChange={() => setRefundMethod('CASH_REFUND')}
                        className="text-primary focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-foreground">Cash Refund</div>
                        <div className="text-[10px] text-muted-foreground">
                          Immediate cash payment returned from till to customer
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        isWalkInCustomer
                          ? 'opacity-40 cursor-not-allowed border-border bg-input'
                          : refundMethod === 'CUSTOMER_CREDIT'
                          ? 'border-primary bg-orange-500/10 text-primary cursor-pointer'
                          : 'border-border bg-surface-elevated/50 text-muted-foreground hover:border-border cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="refundMethod"
                        value="CUSTOMER_CREDIT"
                        disabled={isWalkInCustomer}
                        checked={refundMethod === 'CUSTOMER_CREDIT'}
                        onChange={() => setRefundMethod('CUSTOMER_CREDIT')}
                        className="text-primary focus:ring-0"
                      />
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Customer Account Credit (Khata)
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {!isWalkInCustomer
                            ? `Credit ${details.customerName}'s ledger balance directly`
                            : 'Disabled for Walk-in Cash Customers (no customer account)'}
                        </div>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                      Return Reason / Notes
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Defective item, customer changed mind..."
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Refund Summary Calculation */}
                <div className="p-4 rounded-xl bg-surface-muted border border-border flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground block mb-2">
                      Return Summary
                    </span>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Total Return Quantity:</span>
                      <span className="font-mono font-bold text-foreground">{totalReturnQty}</span>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal Refund:</span>
                      <span className="font-mono text-foreground">
                        {currencySymbol}{totalSubtotal.toFixed(2)}
                      </span>
                    </div>

                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-400">
                        <span>Less Discount Reversed:</span>
                        <span className="font-mono">
                          -{currencySymbol}{totalDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {totalTax > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Tax Refund:</span>
                        <span className="font-mono text-foreground">
                          +{currencySymbol}{totalTax.toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-border pt-3 flex justify-between items-baseline">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Total Refund Due:
                      </span>
                      <span className="text-xl font-mono font-bold text-primary">
                        {currencySymbol}{totalRefundAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex space-x-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 bg-surface-elevated hover:bg-surface-muted text-foreground py-2.5 rounded-xl font-semibold text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || totalReturnQty <= 0}
                      className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-primary/20 transition-all flex items-center justify-center space-x-1.5"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Confirm Sales Return</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      {/* Credit Note Document Preview & Print Modal */}
      {previewDoc && (
        <InvoicePreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
};
