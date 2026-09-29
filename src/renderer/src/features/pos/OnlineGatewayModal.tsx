import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
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
  Smartphone,
  Banknote,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { GatewayProvider, GatewayOrderResponseDTO, PaymentMethod } from '../../../../shared/types';
import { useAuthStore } from '../../stores/authStore';

export interface OnlineGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: (gateway: GatewayProvider, transactionRef: string, paidAmount: number, saleId?: string) => void;
  amount: number;
  paymentMethod?: PaymentMethod; // 'UPI' | 'CARD' | 'BANK_TRANSFER'
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  initialGateway?: GatewayProvider;
  salePayload?: any;
  onSwitchToCash?: () => void;
  onSwitchPaymentMethod?: (newMethod: PaymentMethod) => void;
}

export function OnlineGatewayModal({
  isOpen,
  onClose,
  onPaymentComplete,
  amount,
  paymentMethod = 'UPI',
  orderNumber = `ORD-${Date.now().toString().slice(-6)}`,
  customerName = 'Walk-in Cash Customer',
  customerPhone = '',
  customerEmail = '',
  initialGateway,
  salePayload,
  onSwitchToCash,
  onSwitchPaymentMethod,
}: OnlineGatewayModalProps) {
  const { session, settings } = useAuthStore();

  const [activeMethod, setActiveMethod] = useState<PaymentMethod>(paymentMethod);
  const [selectedGateway, setSelectedGateway] = useState<GatewayProvider | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [orderData, setOrderData] = useState<GatewayOrderResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<
    'CREATING' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'UNKNOWN' | 'REQUIRES_ACTION'
  >('CREATING');
  const [copied, setCopied] = useState<boolean>(false);
  const [pollCount, setPollCount] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300); // 5 min countdown
  const [verifyingManual, setVerifyingManual] = useState<boolean>(false);
  const [qrDisplayUrl, setQrDisplayUrl] = useState<string | null>(null);

  // Manual Override State
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [overrideMethod, setOverrideMethod] = useState<PaymentMethod>('CASH');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideLoading, setOverrideLoading] = useState<boolean>(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const canOverride = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';
  const pollTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const MAX_POLLS = 120; // 120 * 2.5s = 300s

  // Generate direct, sharp QR code locally or use direct image
  useEffect(() => {
    if (!orderData?.qrCodeData || !isOpen) {
      setQrDisplayUrl(null);
      return;
    }
    const raw = orderData.qrCodeData;

    // Check if it's already an image URL
    const isDirectImage =
      raw.startsWith('data:image/') ||
      raw.includes('/qrcode/') ||
      /\.(png|jpe?g|webp)($|\?)/i.test(raw);

    if (isDirectImage) {
      setQrDisplayUrl(raw);
      return;
    }

    // Otherwise (upi://pay?... or direct payment URI), generate a high-res local QR code
    QRCode.toDataURL(raw, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => setQrDisplayUrl(dataUrl))
      .catch((err) => {
        console.warn('Local QR generation error, using fallback:', err);
        setQrDisplayUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=8&data=${encodeURIComponent(raw)}`
        );
      });
  }, [orderData?.qrCodeData, isOpen]);

  // Sync active method if prop changes
  useEffect(() => {
    if (paymentMethod && paymentMethod !== activeMethod) {
      setActiveMethod(paymentMethod);
    }
  }, [paymentMethod]);

  // Resolve gateway and initiate payment when modal opens or method changes
  useEffect(() => {
    if (isOpen) {
      resolveAndInitiatePayment(activeMethod);
    } else {
      stopTimers();
    }
    return () => stopTimers();
  }, [isOpen, activeMethod]);

  const stopTimers = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const startCountdown = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setSecondsRemaining(300);
    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  /**
   * Resolves configured provider for active method from backend / settings
   */
  const resolveAndInitiatePayment = async (method: PaymentMethod) => {
    stopTimers();
    setLoading(true);
    setError(null);
    setFailureCode(null);
    setOrderData(null);
    setPollingStatus('CREATING');
    setPollCount(0);

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) {
      setError('Desktop IPC bridge not available');
      setLoading(false);
      setPollingStatus('FAILED');
      return;
    }

    try {
      let resolvedGw: GatewayProvider | null = initialGateway || null;

      if (!resolvedGw) {
        // Query backend for configured provider
        const resolveRes = await electronAPI.invoke('gateways:resolveProvider', {
          method,
          token: session.token,
        });

        if (resolveRes?.success && resolveRes.provider) {
          resolvedGw = resolveRes.provider;
        } else {
          // Check local settings as backup
          const gatewaysConfig = settings?.gateways;
          if (method === 'UPI') {
            if (gatewaysConfig?.razorpay?.enabled) resolvedGw = 'RAZORPAY';
            else if ((gatewaysConfig as any)?.cashfree?.enabled) resolvedGw = 'CASHFREE';
          } else if (method === 'CARD') {
            if (gatewaysConfig?.stripe?.enabled) resolvedGw = 'STRIPE';
            else if (gatewaysConfig?.razorpay?.enabled) resolvedGw = 'RAZORPAY';
            else if ((gatewaysConfig as any)?.cashfree?.enabled) resolvedGw = 'CASHFREE';
          }
        }
      }

      if (!resolvedGw) {
        setError(
          `No active payment gateway is configured for ${method}. Please configure Razorpay, Cashfree, or Stripe in Settings → Payment Gateways, or choose Cash payment.`
        );
        setFailureCode('GATEWAY_NOT_CONFIGURED');
        setLoading(false);
        setPollingStatus('FAILED');
        return;
      }

      setSelectedGateway(resolvedGw);

      // Snapshot cart to localStorage for crash resilience
      try {
        localStorage.setItem(
          'pos_active_checkout_session',
          JSON.stringify({
            orderNumber,
            method,
            gateway: resolvedGw,
            amount,
            customerName,
            customerPhone,
            salePayload,
            timestamp: new Date().toISOString(),
          })
        );
      } catch {
        // Non-blocking
      }

      // Create Payment Attempt
      const res: GatewayOrderResponseDTO = await electronAPI.invoke('gateways:createOrder', {
        payload: {
          gateway: resolvedGw,
          method,
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
        setError(res.error || `Failed to initialize ${resolvedGw} payment session.`);
        setFailureCode('ORDER_INIT_FAILED');
        setLoading(false);
        setPollingStatus('FAILED');
        return;
      }

      setOrderData(res);
      setLoading(false);
      setPollingStatus('PENDING');
      startCountdown();

      // Start automatic polling every 2.5 seconds
      startPolling(resolvedGw, res.orderId, res.attemptId);
    } catch (err: any) {
      setError(err?.message || 'Network error while initializing payment.');
      setFailureCode('NETWORK_ERROR');
      setLoading(false);
      setPollingStatus('FAILED');
    }
  };

  /**
   * Controlled polling loop
   */
  const startPolling = (gw: GatewayProvider, orderId: string, attemptId?: string) => {
    stopTimers();
    startCountdown();
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    let count = 0;
    pollTimerRef.current = setInterval(async () => {
      count++;
      setPollCount(count);

      if (count > MAX_POLLS) {
        stopTimers();
        setPollingStatus('EXPIRED');
        setError('Payment verification timed out (5 minutes elapsed). Your cart is safe.');
        setFailureCode('PAYMENT_TIMEOUT');
        return;
      }

      await checkStatus(gw, orderId, attemptId, false);
    }, 2500);
  };

  /**
   * Checks status once with gateway (used by polling or manual "Check Status" button)
   */
  const checkStatus = async (
    gw: GatewayProvider,
    orderId: string,
    attemptId?: string,
    isManual = false
  ) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    if (isManual) setVerifyingManual(true);

    try {
      const statusRes = await electronAPI.invoke('gateways:checkStatus', {
        gateway: gw,
        orderId,
        attemptId,
        token: session.token,
      });

      if (statusRes.status === 'SUCCESS') {
        stopTimers();
        setPollingStatus('SUCCESS');
        setError(null);
        setFailureCode(null);
        const transRef = statusRes.transactionRef || orderId;
        const paid = statusRes.paidAmount || amount;
        const createdSaleId = statusRes.saleId;

        // Clean up cart snapshot on success
        try {
          localStorage.removeItem('pos_active_checkout_session');
        } catch {
          // Ignore
        }

        // Brief delay so cashier sees celebration checkmark
        setTimeout(() => {
          onPaymentComplete(gw, transRef, paid, createdSaleId);
        }, 1200);
      } else if (statusRes.status === 'FAILED') {
        stopTimers();
        setPollingStatus('FAILED');
        setError(statusRes.message || 'Payment was declined or cancelled by customer.');
        setFailureCode(statusRes.failureCode || 'PAYMENT_DECLINED');
      } else if (statusRes.status === 'EXPIRED') {
        stopTimers();
        setPollingStatus('EXPIRED');
        setError('Payment order session expired on gateway. Your cart is safe.');
        setFailureCode('PAYMENT_EXPIRED');
      } else if (statusRes.status === 'UNKNOWN') {
        // Network drop or indeterminate state
        setPollingStatus('UNKNOWN');
        setError(
          statusRes.message ||
            'Gateway status currently unreachable due to network timeout. Do NOT re-charge customer yet.'
        );
        setFailureCode('PAYMENT_UNKNOWN');
      }
    } catch (pollErr: any) {
      console.warn('[Polling Gateway Error]', pollErr);
      if (isManual) {
        setPollingStatus('UNKNOWN');
        setError('Network error contacting payment gateway. Do not retry payment without verifying.');
        setFailureCode('PAYMENT_NETWORK_ERROR');
      }
    } finally {
      if (isManual) setVerifyingManual(false);
    }
  };

  /**
   * Cashier closes modal or cancels payment
   */
  const handleClose = async () => {
    stopTimers();
    if (orderData?.attemptId && (pollingStatus === 'PENDING' || pollingStatus === 'CREATING')) {
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

  /**
   * Cashier switches to another payment method (e.g. UPI -> CARD or CARD -> UPI)
   */
  const handleSwitchMethod = async (newMethod: PaymentMethod) => {
    stopTimers();
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
    setActiveMethod(newMethod);
    setSelectedGateway(null);
    if (onSwitchPaymentMethod) {
      onSwitchPaymentMethod(newMethod);
    }
  };

  /**
   * Cashier switches to direct Cash tender
   */
  const handleSwitchToCash = async () => {
    stopTimers();
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
    if (onSwitchToCash) {
      onSwitchToCash();
    }
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

      stopTimers();
      setShowOverrideModal(false);
      try {
        localStorage.removeItem('pos_active_checkout_session');
      } catch {
        // Non-blocking
      }
      onPaymentComplete(selectedGateway || 'RAZORPAY', `OVERRIDE_${overrideMethod}`, amount, res.saleId);
    } catch (err: any) {
      setOverrideError(err?.message || 'Override network error');
      setOverrideLoading(false);
    }
  };

  if (!isOpen) return null;

  const currencySymbol = settings?.currency?.symbol || '₹';
  const capabilities = orderData?.capabilities;
  const isUpi = activeMethod === 'UPI';
  const isCard = activeMethod === 'CARD';

  const showQr =
    isUpi &&
    (capabilities
      ? capabilities.qr && !!orderData?.qrCodeData
      : (selectedGateway === 'RAZORPAY' || selectedGateway === 'CASHFREE') && !!orderData?.qrCodeData);

  const checkoutUrl = orderData?.checkoutUrl || orderData?.paymentLinkUrl;

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-surface-elevated border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              {isUpi ? <Smartphone className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-foreground">
                  {isUpi ? 'UPI / QR Payment' : isCard ? 'Card Payment' : 'Online Gateway Payment'}
                </h3>
                {selectedGateway && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted text-foreground border border-border">
                    {selectedGateway}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Authoritative Real-Time External Verification</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
            title="Cancel payment and return to cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Quick Switch Bar (if not currently completed) */}
        {pollingStatus !== 'SUCCESS' && (
          <div className="flex border-b border-border bg-surface-muted/30 p-1.5 gap-1.5">
            <button
              onClick={() => handleSwitchMethod('UPI')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all ${
                activeMethod === 'UPI'
                  ? 'bg-surface text-primary shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>UPI / QR</span>
            </button>
            <button
              onClick={() => handleSwitchMethod('CARD')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 transition-all ${
                activeMethod === 'CARD'
                  ? 'bg-surface text-primary shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Card</span>
            </button>
            <button
              onClick={handleSwitchToCash}
              className="py-1.5 px-3 rounded-lg text-xs font-bold text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center space-x-1 border border-emerald-500/20"
              title="Switch to Cash payment directly"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Cash</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col items-center justify-center space-y-4">
          {/* Amount Badge */}
          <div className="w-full text-center py-3 bg-surface-muted/60 rounded-xl border border-border">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Payment Amount
            </span>
            <div className="text-3xl font-extrabold text-foreground font-mono mt-0.5">
              {currencySymbol}{amount.toFixed(2)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center space-x-2">
              <span className="font-mono text-foreground font-medium">#{orderNumber}</span>
              <span>•</span>
              <span className="truncate max-w-[180px]">{customerName}</span>
            </div>
          </div>

          {/* Dynamic States */}
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                Initializing secure payment session with {selectedGateway || 'gateway'}...
              </p>
            </div>
          ) : pollingStatus === 'SUCCESS' ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-bold text-foreground">Payment Verified!</h4>
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                  ₹{amount.toFixed(2)} confirmed by {selectedGateway}.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Finalizing sale and generating receipt...</p>
              </div>
            </div>
          ) : pollingStatus === 'FAILED' || pollingStatus === 'EXPIRED' ? (
            <div className="w-full p-4 rounded-xl bg-danger-bg border border-danger-border flex flex-col items-center text-center space-y-3">
              <div className="p-2 rounded-full bg-red-500/10 text-danger-text border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-danger-text uppercase tracking-wider">
                  {pollingStatus === 'EXPIRED' ? 'Payment Timed Out' : 'Payment Failed / Declined'}
                </h4>
                <p className="text-xs text-foreground-secondary mt-1">{error || 'External payment was not completed.'}</p>
              </div>

              {/* Crucial Cart Protection Notice */}
              <div className="w-full py-2 px-3 rounded-lg bg-surface border border-border flex items-center justify-center space-x-2 text-[11px] text-emerald-500 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Your cart is safe and preserved. No items were removed.</span>
              </div>

              {/* Action Buttons for Failure/Retry */}
              <div className="w-full pt-1 flex flex-col gap-2">
                <button
                  onClick={() => resolveAndInitiatePayment(activeMethod)}
                  className="w-full py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry {activeMethod}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {activeMethod === 'UPI' ? (
                    <button
                      onClick={() => handleSwitchMethod('CARD')}
                      className="py-2 px-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-border"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      <span>Pay by Card</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitchMethod('UPI')}
                      className="py-2 px-2.5 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-border"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-primary" />
                      <span>Pay by UPI</span>
                    </button>
                  )}

                  <button
                    onClick={handleSwitchToCash}
                    className="py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-emerald-500/30"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Pay Cash</span>
                  </button>
                </div>
              </div>
            </div>
          ) : pollingStatus === 'UNKNOWN' ? (
            <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center text-center space-y-3">
              <div className="p-2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                  Payment Status Unresolved
                </h4>
                <p className="text-xs text-foreground-secondary mt-1">
                  {error || 'Network connection dropped or gateway status could not be verified.'}
                </p>
                <p className="text-[11px] text-amber-400 font-semibold mt-1">
                  Do NOT charge the customer again without verifying with the gateway first!
                </p>
              </div>

              <div className="w-full pt-1 flex flex-col gap-2">
                <button
                  disabled={verifyingManual}
                  onClick={() => checkStatus(selectedGateway || 'RAZORPAY', orderData?.orderId || '', orderData?.attemptId, true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  {verifyingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Check Payment Status with Gateway</span>
                </button>
              </div>
            </div>
          ) : (
            /* PENDING STATE */
            <div className="w-full flex flex-col items-center space-y-4">
              {/* Dynamic QR Display for UPI */}
              {isUpi && showQr && qrDisplayUrl ? (
                <div className="p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center border-4 border-border relative group">
                  <img
                    src={qrDisplayUrl}
                    alt="Payment QR Code"
                    className="w-56 h-56 rounded-lg object-contain"
                  />
                  <div className="mt-2 text-center">
                    <span className="text-[11px] font-extrabold tracking-wider uppercase text-slate-800 block">
                      Scan with any UPI App
                    </span>
                    <span className="text-[10px] text-slate-500">
                      GPay • PhonePe • Paytm • BHIM • Cred
                    </span>
                  </div>
                </div>
              ) : isCard ? (
                /* Card Payment View */
                <div className="w-full p-5 bg-surface-muted/60 rounded-xl border border-border text-center space-y-3">
                  <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 w-12 h-12 mx-auto flex items-center justify-center border border-blue-500/20">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{selectedGateway} Card Checkout</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedGateway === 'STRIPE'
                        ? 'Customer completes card payment securely through Stripe portal.'
                        : `Customer completes card payment through ${selectedGateway} secure checkout.`}
                    </p>
                  </div>
                  {checkoutUrl && (
                    <button
                      onClick={handleOpenBrowser}
                      className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center space-x-2 transition-colors shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Launch Card Checkout Portal</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Fallback Hosted Checkout */
                <div className="w-full p-5 bg-surface-muted/60 rounded-xl border border-border text-center space-y-3">
                  <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 w-12 h-12 mx-auto flex items-center justify-center border border-blue-500/20">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{selectedGateway} Online Payment</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Customer completes payment via {selectedGateway} payment portal.
                    </p>
                  </div>
                  {checkoutUrl && (
                    <button
                      onClick={handleOpenBrowser}
                      className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center space-x-2 transition-colors shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Checkout Portal</span>
                    </button>
                  )}
                </div>
              )}

              {/* Action Buttons: Copy link & Immediate check */}
              <div className="flex w-full gap-2">
                {checkoutUrl && (
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2 px-3 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-border"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>
                )}

                <button
                  disabled={verifyingManual}
                  onClick={() => checkStatus(selectedGateway || 'RAZORPAY', orderData?.orderId || '', orderData?.attemptId, true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors border border-border disabled:opacity-50"
                  title="Query payment status immediately without waiting for poll"
                >
                  {verifyingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
                  <span>Check Status</span>
                </button>
              </div>

              {/* Polling Liveness Badge */}
              <div className="flex items-center justify-between w-full text-[11px] text-muted-foreground bg-surface-muted/60 px-3 py-1.5 rounded-full border border-border">
                <div className="flex items-center space-x-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  <span>Awaiting payment confirmation...</span>
                </div>
                <div className="flex items-center space-x-1 font-mono text-[10px]">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span>{formatCountdown(secondsRemaining)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer & Actions */}
        <div className="p-3 bg-surface-elevated border-t border-border flex items-center justify-between text-xs">
          <div className="text-[11px] text-muted-foreground font-mono flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cart Safe</span>
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
              className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-muted text-foreground text-xs font-semibold transition-colors border border-border"
            >
              Back to Cart
            </button>
          </div>
        </div>
      </div>

      {/* Manual Override Confirmation Sub-Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-150">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-amber-500 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <span>Manual Payment Override</span>
            </div>
            <p className="text-xs text-foreground-secondary">
              Authoritative override: Mark this pending online payment as tender collected via Cash/Card. Mandatory audit log entry will be created.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Settlement Method</label>
                <select
                  value={overrideMethod}
                  onChange={(e) => setOverrideMethod(e.target.value as PaymentMethod)}
                  className="w-full mt-1 bg-input border border-border rounded-lg p-2 text-xs text-foreground"
                >
                  <option value="CASH">Cash (Direct Tender)</option>
                  <option value="CARD">Card (Standalone EDC POS)</option>
                  <option value="UPI">UPI (Direct QR)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase">Mandatory Audit Reason</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Customer paid cash directly; gateway session pending"
                  rows={2}
                  className="w-full mt-1 bg-input border border-border rounded-lg p-2 text-xs text-foreground"
                />
              </div>

              {overrideError && <p className="text-xs text-danger-text">{overrideError}</p>}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-3 py-1.5 rounded-lg bg-surface-muted text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideLoading}
                onClick={handleExecuteOverride}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold flex items-center space-x-1"
              >
                {overrideLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Authorize & Post Sale</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
