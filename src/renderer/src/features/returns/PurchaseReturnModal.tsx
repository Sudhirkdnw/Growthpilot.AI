import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  PackageOpen,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { PurchaseReturnableDetailsDTO } from '../../../../shared/types';

interface PurchaseReturnModalProps {
  purchaseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PurchaseReturnModal: React.FC<PurchaseReturnModalProps> = ({
  purchaseId,
  onClose,
  onSuccess,
}) => {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [details, setDetails] = useState<PurchaseReturnableDetailsDTO | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any | null>(null);

  useEffect(() => {
    fetchDetails();
  }, [purchaseId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const electronAPI = (window as any).electronAPI;
      const res = await electronAPI.invoke('purchaseReturns:getReturnable', {
        purchaseId,
        token: session?.token,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setDetails(res);
        const initialQtys: Record<string, number> = {};
        res.items.forEach((item: any) => {
          initialQtys[item.purchaseItemId] = 0;
        });
        setReturnQtys(initialQtys);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load purchase details for return.');
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (purchaseItemId: string, maxQty: number, val: string) => {
    const num = Math.max(0, Math.min(maxQty, Number(val) || 0));
    setReturnQtys((prev) => ({
      ...prev,
      [purchaseItemId]: num,
    }));
  };

  // Calculate totals dynamically
  const calculatedItems = (details?.items || []).map((item) => {
    const qty = returnQtys[item.purchaseItemId] || 0;
    const lineTotal = item.purchasePrice * qty;

    return {
      ...item,
      returnQty: qty,
      lineTotal,
    };
  });

  const totalReturnQty = calculatedItems.reduce((acc, it) => acc + it.returnQty, 0);
  const totalReturnAmount = calculatedItems.reduce((acc, it) => acc + it.lineTotal, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalReturnQty <= 0) {
      setError('Please select at least 1 item quantity to return to supplier.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const itemsToReturn = calculatedItems
      .filter((it) => it.returnQty > 0)
      .map((it) => ({
        purchaseItemId: it.purchaseItemId,
        productId: it.productId,
        quantity: it.returnQty,
        reason: reason || undefined,
      }));

    try {
      const electronAPI = (window as any).electronAPI;
      const res = await electronAPI.invoke('purchaseReturns:create', {
        returnData: {
          purchaseId,
          refundType: 'SUPPLIER_PAYABLE_DEDUCTION',
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
      setError(err?.message || 'Failed to process purchase return.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <span>Process Purchase Return (Debit Note)</span>
                {details && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-elevated text-amber-400">
                    {details.purchaseNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authoritative stock reduction (RETURN_OUT) & supplier payable reduction (Debit)
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
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-xs font-medium">Loading purchase line items & return balances...</p>
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
                <h3 className="text-lg font-bold text-foreground">Purchase Return Successfully Created!</h3>
                <p className="text-xs text-muted-foreground">
                  Debit Note / Reference Number:{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {successInfo.returnNumber}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supplier Payable Reduced by:{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {currencySymbol}{successInfo.totalAmount.toFixed(2)}
                  </span>
                </p>
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  onClick={() => {
                    onSuccess();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-bold transition-all"
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

              {/* Purchase & Supplier Info Card */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-xl bg-surface-muted border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Supplier</span>
                  <span className="text-foreground font-semibold flex items-center space-x-1 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{details.supplierName}</span>
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Purchase Total</span>
                  <span className="text-foreground font-mono font-semibold block mt-0.5">
                    {currencySymbol}{details.total.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Due Balance</span>
                  <span className="text-amber-400 font-mono font-semibold block mt-0.5">
                    {currencySymbol}{details.dueAmount.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Purchase Date</span>
                  <span className="text-muted-foreground font-mono block mt-0.5">
                    {new Date(details.purchaseDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Items Return Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-1.5">
                    <PackageOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Select Line Items to Return to Supplier</span>
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    Items will be deducted from current stock (RETURN_OUT)
                  </span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-surface-muted">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-elevated/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                        <th className="p-3">Product</th>
                        <th className="p-3 text-center">Purchased</th>
                        <th className="p-3 text-center">Returned</th>
                        <th className="p-3 text-center">Available</th>
                        <th className="p-3 text-right">Unit Cost</th>
                        <th className="p-3 text-center w-28">Return Qty</th>
                        <th className="p-3 text-right">Debit Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-sans">
                      {calculatedItems.map((item) => {
                        const isFullyReturned = item.returnableQuantity <= 0;
                        return (
                          <tr
                            key={item.purchaseItemId}
                            className={`transition-colors ${
                              isFullyReturned
                                ? 'bg-surface-muted text-muted-foreground'
                                : item.returnQty > 0
                                ? 'bg-amber-950/10'
                                : 'hover:bg-surface-elevated/30 text-foreground'
                            }`}
                          >
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{item.productName}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                SKU: {item.sku} {item.unitCode ? `(${item.unitCode})` : ''}
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono">{item.purchasedQuantity}</td>
                            <td className="p-3 text-center font-mono text-muted-foreground">
                              {item.previouslyReturnedQuantity}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-amber-400">
                              {item.returnableQuantity}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {currencySymbol}{item.purchasePrice.toFixed(2)}
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
                                  value={returnQtys[item.purchaseItemId] ?? 0}
                                  onChange={(e) =>
                                    handleQtyChange(item.purchaseItemId, item.returnableQuantity, e.target.value)
                                  }
                                  className="w-20 bg-input border border-border rounded-lg px-2 py-1 text-center font-mono font-bold text-amber-400 text-xs focus:outline-none focus:border-amber-500"
                                />
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-amber-400">
                              {currencySymbol}{item.lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary and Reason */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 rounded-xl bg-surface-muted border border-border">
                  <div>
                    <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                      Return Reason / Remarks
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Damaged during shipment, wrong specification received..."
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    <p className="font-semibold">Financial & Stock Effect:</p>
                    <p className="text-[11px] text-amber-400/90 mt-0.5">
                      Submitting this return will create an authoritative RETURN_OUT stock ledger entry and debit {details.supplierName}&apos;s account, decreasing your payable liability.
                    </p>
                  </div>
                </div>

                {/* Return Summary Box */}
                <div className="p-4 rounded-xl bg-surface-muted border border-border flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground block mb-2">
                      Purchase Return Summary
                    </span>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Total Items Returning:</span>
                      <span className="font-mono font-bold text-foreground">{totalReturnQty}</span>
                    </div>

                    <div className="border-t border-border pt-3 flex justify-between items-baseline">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Total Debit Note Amount:
                      </span>
                      <span className="text-xl font-mono font-bold text-amber-400">
                        {currencySymbol}{totalReturnAmount.toFixed(2)}
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
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-1.5"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Confirm Return to Supplier</span>
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
    </div>
  );
};
