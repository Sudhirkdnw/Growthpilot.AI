import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  CreditCard,
  Check,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { GatewayProvider, GatewayOrderResponseDTO, PaymentMethod } from '../../../../shared/types';
import { useAuthStore } from '../../stores/authStore';

interface OnlineGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (gateway: GatewayProvider, transactionRef: string, paidAmount: number, saleId?: string) => void;
  amount: number;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  initialGateway?: GatewayProvider;
  salePayload?: any;
}

export function OnlineGatewayModal({
  isOpen,
  onClose,
  onPaymentComplete,
  amount,
  orderNumber = `ORD-${Date.now()}`,
  customerName = 'Walk-in Customer',
  customerPhone = '',
  customerEmail = '',
  initialGateway,
  salePayload,
}: OnlineGatewayModalProps) {
  const { session, settings } = useAuthStore();

  // Find enabled gateways
  const gatewaysConfig = settings?.gateways;
  const enabledGateways: GatewayProvider[] = [];
  if (gatewaysConfig?.stripe?.enabled) enabledGateways.push('STRIPE');
  if (gatewaysConfig?.razorpay?.enabled) enabledGateways.push('RAZORPAY');
  if ((gatewaysConfig as any)?.cashfree?.enabled) enabledGateways.push('CASHFREE');

  // Default to initialGateway or first enabled gateway
  const [selectedGateway, setSelectedGateway] = useState<GatewayProvider>(() => {
    if (initialGateway && enabledGateways.includes(initialGateway)) return initialGateway;
    return enabledGateways[0] || 'RAZORPAY';
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [orderData, setOrderData] = useState<GatewayOrderResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'>('PENDING');
  const [copied, setCopied] = useState<boolean>(false);
  const [pollCount, setPollCount] = useState<number>(0);

  // Manual Override State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideMethod, setOverrideMethod] = useState<PaymentMethod>('CASH');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideLoading, setOverrideLoading] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const canOverride = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  const pollTimerRef = useRef<any>(null);
  const MAX_POLLS = 120; // 120 * 2.5s = 300s (5 minutes timeout)

  // Initialize order whenever modal opens or gateway changes
  useEffect(() => {
    if (isOpen && selectedGateway) {
      createOrder(selectedGateway);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isOpen, selectedGateway]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleClose = async () => {
    stopPolling();
    if (orderData?.attemptId && pollingStatus === 'PENDING') {
      try {
        const electronAPI = (window as any).electronAPI;
        await electronAPI?.invoke('gateways:cancel', {
          attemptId: orderData.attemptId,
          token: session?.token,
        });
      } catch {
        // Non-blocking
      }
    }
    onClose();
  };

  const createOrder = async (gw: GatewayProvider) => {
    stopPolling();
    setLoading(true);
    setError(null);
    setOrderData(null);
    setPollingStatus('PENDING');
    setPollCount(0);

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) {
      setError('Desktop IPC bridge not available');
      setLoading(false);
      return;
    }

    try {
      const res: GatewayOrderResponseDTO = await electronAPI.invoke('gateways:createOrder', {
        payload: {
          gateway: gw,
          amount,
          currency: settings?.currency?.baseCurrency || 'INR',
          orderNumber,
          customerName,
          customerPhone,
          customerEmail,
          salePayload,
        },
        token: session.token,
      });

      if (!res.success || !res.orderId) {
        setError(res.error || `Failed to create payment order on ${gw}`);
        setLoading(false);
        return;
      }

      setOrderData(res);
      setLoading(false);

      // Start automatic polling every 2.5 seconds with timeout
      startPolling(gw, res.orderId, res.attemptId);
    } catch (err: any) {
      setError(err?.message || 'Order initialization network failure');
      setLoading(false);
    }
  };

  const startPolling = (gw: GatewayProvider, orderId: string, attemptId?: string) => {
    stopPolling();
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    let count = 0;
    pollTimerRef.current = setInterval(async () => {
      count++;
      setPollCount(count);

      if (count > MAX_POLLS) {
        stopPolling();
        setPollingStatus('EXPIRED');
        setError('Payment verification timed out (5 minutes elapsed). Please re-initiate if needed.');
        return;
      }

      try {
        const statusRes = await electronAPI.invoke('gateways:checkStatus', {
          gateway: gw,
          orderId,
          attemptId,
          token: session.token,
        });

        if (statusRes.status === 'SUCCESS') {
          stopPolling();
          setPollingStatus('SUCCESS');
          const transRef = statusRes.transactionRef || orderId;
          const paid = statusRes.paidAmount || amount;
          const createdSaleId = statusRes.saleId;

          // Brief delay so cashier sees celebration checkmark
          setTimeout(() => {
            onPaymentComplete(gw, transRef, paid, createdSaleId);
          }, 1200);
        } else if (statusRes.status === 'FAILED') {
          stopPolling();
          setPollingStatus('FAILED');
          setError(statusRes.message || 'Payment was declined or failed');
        } else if (statusRes.status === 'EXPIRED') {
          stopPolling();
          setPollingStatus('EXPIRED');
          setError('Payment order session expired on gateway');
        }
      } catch (pollErr) {
        console.warn('[Polling Gateway Error]', pollErr);
      }
    }, 2500);
  };

  const handleCopyLink = () => {
    const link = orderData?.paymentLinkUrl || orderData?.checkoutUrl;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenBrowser = () => {
    const link = orderData?.checkoutUrl || orderData?.paymentLinkUrl;
    if (link) {
      window.open(link, '_blank', 'width=520,height=700');
    }
  };

  const handleExecuteOverride = async () => {
    if (!overrideReason.trim() || overrideReason.trim().length < 3) {
      setOverrideError('Please provide a specific reason for manual override.');
      return;
    }

    setOverrideLoading(true);
    setOverrideError(null);

    const electronAPI = (window as any).electronAPI;
    try {
      const res = await electronAPI.invoke('gateways:manualOverride', {
        payload: {
          paymentAttemptId: orderData?.attemptId || orderData?.orderId,
          newPaymentMethod: overrideMethod,
          reason: overrideReason.trim(),
        },
        token: session?.token,
      });

      if (!res.success) {
        setOverrideError(res.error || 'Failed to apply manual override');
        setOverrideLoading(false);
        return;
      }

      stopPolling();
      setShowOverrideModal(false);
      onPaymentComplete(selectedGateway, `OVERRIDE_${overrideMethod}`, amount, res.saleId);
    } catch (err: any) {
      setOverrideError(err?.message || 'Override network error');
      setOverrideLoading(false);
    }
  };

  if (!isOpen) return null;

  const currencySymbol = settings?.currency?.symbol || '₹';
  const capabilities = orderData?.capabilities;
  const showQr = capabilities ? capabilities.qr && !!orderData?.qrCodeData : (selectedGateway === 'RAZORPAY' && !!orderData?.qrCodeData);
  const checkoutUrl = orderData?.checkoutUrl || orderData?.paymentLinkUrl;

  const qrImageUrl = orderData?.qrCodeData && showQr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(orderData.qrCodeData)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 bg-surface-elevated border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Online Gateway Payment</h3>
              <p className="text-[11px] text-muted-foreground">Authoritative Real-Time Verification</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gateway Selection Tabs */}
        {enabledGateways.length > 1 && (
          <div className="flex border-b border-border bg-surface-muted/40 p-1.5 gap-1.5">
            {enabledGateways.map((gw) => (
              <button
                key={gw}
                onClick={() => setSelectedGateway(gw)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  selectedGateway === gw
                    ? 'bg-surface text-primary shadow border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                }`}
              >
                {gw === 'STRIPE' ? 'Stripe' : gw === 'RAZORPAY' ? 'Razorpay' : 'Cashfree'}
              </button>
            ))}
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 flex-1 flex flex-col items-center justify-center space-y-4">
          {/* Amount Badge */}
          <div className="w-full text-center py-3 bg-surface-muted/60 rounded-xl border border-border">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Bill Amount</span>
            <div className="text-3xl font-extrabold text-foreground font-mono mt-0.5">
              {currencySymbol}{amount.toFixed(2)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center space-x-2">
              <span className="font-mono text-foreground font-medium">#{orderNumber}</span>
              <span>•</span>
              <span className="truncate max-w-[180px]">{customerName}</span>
            </div>
          </div>

          {/* Dynamic Provider View */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Initializing payment session with {selectedGateway}...</p>
            </div>
          ) : error ? (
            <div className="w-full p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex flex-col items-center text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <p className="text-xs font-medium text-red-300">{error}</p>
              <button
                onClick={() => createOrder(selectedGateway)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Order</span>
              </button>
            </div>
          ) : pollingStatus === 'SUCCESS' ? (
            <div className="py-8 flex flex-col items-center justify-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-bold text-foreground">Payment Verified!</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Authoritative local sale posted to ledger.</p>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center space-y-4">
              {/* Dynamic QR Display (Only if provider officially supports it) */}
              {showQr && qrImageUrl ? (
                <div className="p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center border-4 border-border relative group">
                  <img
                    src={qrImageUrl}
                    alt="Payment QR Code"
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700 mt-1">
                    Scan with any UPI App
                  </span>
                </div>
              ) : (
                /* Hosted Checkout / Payment Link Card (Stripe & Cashfree) */
                <div className="w-full p-5 bg-surface-muted/60 rounded-xl border border-border text-center space-y-3">
                  <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 w-12 h-12 mx-auto flex items-center justify-center border border-blue-500/20">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{selectedGateway} Hosted Checkout</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedGateway === 'STRIPE'
                        ? 'Customer completes payment via Stripe secure hosted checkout portal.'
                        : 'Customer completes payment via Cashfree PG checkout.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex w-full gap-2">
                {checkoutUrl && (
                  <button
                    onClick={handleOpenBrowser}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-border"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-primary" />
                    <span>Open Checkout</span>
                  </button>
                )}

                {checkoutUrl && (
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-border"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                )}
              </div>

              {/* Polling Liveness Badge */}
              <div className="flex items-center space-x-2 text-[11px] text-muted-foreground bg-surface-muted/60 px-3 py-1.5 rounded-full border border-border">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span>Listening for gateway confirmation (poll #{pollCount})...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Manual Override */}
        <div className="p-3 bg-surface-elevated border-t border-border flex items-center justify-between text-xs">
          <div className="text-[11px] text-muted-foreground font-mono flex items-center space-x-1.5">
            <Clock className="w-3 h-3" />
            <span>Timeout: 5m</span>
          </div>

          <div className="flex space-x-2">
            {canOverride && pollingStatus === 'PENDING' && (
              <button
                onClick={() => setShowOverrideModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[11px] font-semibold border border-amber-500/30 flex items-center space-x-1 transition-colors"
                title="Override with Cash/Card if customer paid outside gateway"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>Manual Override</span>
              </button>
            )}

            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold transition-colors border border-border"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Manual Override Confirmation Sub-Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-amber-500">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="font-bold text-sm text-foreground">Manual Payment Override</h4>
            </div>

            <p className="text-xs text-muted-foreground">
              Confirm payment receipt through an alternate offline method. This action is permanently audited.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Payment Method</label>
                <select
                  value={overrideMethod}
                  onChange={(e) => setOverrideMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground"
                >
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD (Physical EDC Terminal)</option>
                  <option value="UPI">UPI (Direct Merchant QR)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">
                  Reason for Override <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Customer paid cash due to network issue; EDC slip #4582"
                  className="w-full bg-input border border-border rounded-lg p-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {overrideError && (
                <p className="text-[11px] text-red-500 bg-red-500/10 p-2 rounded border border-red-500/30">
                  {overrideError}
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={overrideLoading}
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideLoading || !overrideReason.trim()}
                onClick={handleExecuteOverride}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50 hover:bg-primary-hover transition-colors"
              >
                {overrideLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Authorize & Post Sale</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
