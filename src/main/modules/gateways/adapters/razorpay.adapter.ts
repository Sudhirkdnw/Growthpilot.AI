import { GatewayCapabilities, GatewayProvider } from '../../../../shared/types';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import {
  PaymentGatewayAdapter,
  GatewayTestRequest,
  GatewayTestResult,
  CreatePaymentRequest,
  CreatePaymentResult,
  GetPaymentStatusRequest,
  PaymentStatusResult,
  RefundPaymentRequest,
  RefundPaymentResult,
} from './gateway-adapter.interface';

export class RazorpayAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = 'RAZORPAY';

  getCapabilities(): GatewayCapabilities {
    return {
      card: true,
      upi: true,
      netBanking: true,
      hostedCheckout: true,
      paymentLink: true,
      qr: true, // Supported via official Razorpay QR API
      refund: true,
    };
  }

  private getAuthHeader(config: any): string {
    const keyId = (config?.keyId || '').trim();
    const keySecret = (config?.keySecret || '').trim();
    return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  }

  async testConnection(req: GatewayTestRequest): Promise<GatewayTestResult> {
    const { config } = req;
    const keyId = (config?.keyId || '').trim();
    const keySecret = (config?.keySecret || '').trim();

    if (!keyId || !keySecret) {
      return {
        success: false,
        provider: this.provider,
        mode: config?.mode || 'TEST',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
        userMessage: 'Both Razorpay Key ID (rzp_...) and Key Secret are required to test connection.',
        message: 'Both Razorpay Key ID (rzp_...) and Key Secret are required to test connection.',
      };
    }

    const start = Date.now();
    try {
      const resp = await fetch('https://api.razorpay.com/v1/payments?count=1', {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(config),
        },
        signal: AbortSignal.timeout(8000),
      });

      const latencyMs = Date.now() - start;
      const data: any = await resp.json();

      if (!resp.ok) {
        const errMsg = data?.error?.description || `HTTP ${resp.status}: Invalid credentials`;
        return {
          success: false,
          provider: this.provider,
          mode: config?.mode || 'TEST',
          errorCode: 'GATEWAY_AUTH_FAILED',
          userMessage: `Razorpay connection failed: ${errMsg}`,
          message: `Razorpay connection failed: ${errMsg}`,
          latencyMs,
        };
      }

      return {
        success: true,
        provider: this.provider,
        mode: keyId.startsWith('rzp_live') ? 'LIVE' : 'TEST',
        userMessage: 'Razorpay connection verified successfully! API credentials valid and active.',
        message: 'Razorpay connection verified successfully! API credentials valid and active.',
        latencyMs,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout');
      return {
        success: false,
        provider: this.provider,
        mode: config?.mode || 'TEST',
        errorCode: isTimeout ? 'GATEWAY_TIMEOUT' : 'GATEWAY_NETWORK_ERROR',
        userMessage: isTimeout
          ? 'Connection timed out connecting to Razorpay. Please check your network.'
          : `Network error: ${err?.message || 'Failed to reach Razorpay API'}`,
        message: isTimeout
          ? 'Connection timed out connecting to Razorpay. Please check your network.'
          : `Network error: ${err?.message || 'Failed to reach Razorpay API'}`,
      };
    }
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const { amountMinor, currency, orderNumber, customerName, customerPhone, customerEmail, config } = req;
    const authHeader = this.getAuthHeader(config);
    const keyId = (config?.keyId || '').trim();

    if (!keyId || !config?.keySecret) {
      throw new Error('Razorpay Key ID and Key Secret are not configured.');
    }

    // 1. Create standard Razorpay Order
    const orderResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency,
        receipt: orderNumber,
        notes: {
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const rzpOrder: any = await orderResp.json();
    if (!orderResp.ok) {
      throw new Error(rzpOrder?.error?.description || 'Razorpay order creation failed');
    }

    const orderId = rzpOrder.id;
    let paymentLinkUrl: string | undefined;
    let qrPayload: string | undefined;

    // 2. Try official Razorpay QR Code API
    try {
      const qrResp = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'upi_qr',
          name: `POS-${orderNumber}`,
          usage: 'single_use',
          fixed_amount: true,
          payment_amount: amountMinor,
          description: `Invoice #${orderNumber}`,
          notes: {
            order_id: orderId,
          },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (qrResp.ok) {
        const qrData: any = await qrResp.json();
        // 1. If Razorpay already returned a raw UPI payload, use it directly
        if (qrData.payload && typeof qrData.payload === 'string' && qrData.payload.startsWith('upi://')) {
          qrPayload = qrData.payload;
        } else if (qrData.image_url) {
          // 2. Razorpay returns an image_url which embeds the official dynamic BharatQR / UPI intent.
          // Decode the image to extract the exact native 'upi://pay?...' intent string so mobile scanners
          // trigger GPay, PhonePe, Paytm directly instead of opening a PNG download link in the browser!
          try {
            const imgResp = await fetch(qrData.image_url, { signal: AbortSignal.timeout(5000) });
            if (imgResp.ok) {
              const arrayBuffer = await imgResp.arrayBuffer();
              const png = PNG.sync.read(Buffer.from(arrayBuffer));
              const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
              if (code?.data && (code.data.startsWith('upi://') || code.data.startsWith('000201'))) {
                qrPayload = code.data;
              }
            }
          } catch (decodeErr) {
            console.warn('[RazorpayAdapter] QR image UPI extraction fallback:', decodeErr);
          }

          // Fallback to image_url if decoding was not possible
          if (!qrPayload) {
            qrPayload = qrData.image_url;
          }
        } else {
          qrPayload = qrData.payload || qrData.id;
        }
      }
    } catch {
      // If official QR API is not enabled on account, continue with hosted checkout
    }

    // 3. Try official Razorpay Payment Link API if QR not created
    try {
      const plResp = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountMinor,
          currency,
          description: `Invoice #${orderNumber}`,
          customer: {
            name: customerName || 'Walk-in Customer',
            contact: customerPhone || undefined,
            email: customerEmail && customerEmail.includes('@') ? customerEmail : undefined,
          },
          reference_id: orderNumber,
          notes: { order_id: orderId },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (plResp.ok) {
        const plData: any = await plResp.json();
        paymentLinkUrl = plData.short_url;
      }
    } catch {
      // Fallback to hosted checkout
    }

    const hostedCheckoutUrl = `https://api.razorpay.com/v1/checkout/hosted?order_id=${orderId}&key_id=${keyId}`;

    return {
      providerOrderId: orderId,
      checkoutUrl: paymentLinkUrl || hostedCheckoutUrl,
      paymentLinkUrl: paymentLinkUrl || hostedCheckoutUrl,
      qrPayload,
      paymentSessionId: orderId,
      rawResponse: { id: orderId, status: rzpOrder.status },
    };
  }

  async getPaymentStatus(req: GetPaymentStatusRequest): Promise<PaymentStatusResult> {
    const { providerOrderId, config } = req;
    const authHeader = this.getAuthHeader(config);

    const resp = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(providerOrderId)}/payments`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
      },
      signal: AbortSignal.timeout(8000),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      return {
        status: 'FAILED',
        providerOrderId,
        failureCode: 'GATEWAY_ERROR',
        failureMessage: data?.error?.description || 'Failed to retrieve Razorpay payments',
        rawStatus: resp.status.toString(),
      };
    }

    const items: any[] = data.items || [];
    const captured = items.find((p) => p.status === 'captured');

    if (captured) {
      const rawMethod = (captured.method || '').toLowerCase();
      let method: any = 'UPI';
      if (rawMethod === 'card') method = 'CARD';
      else if (rawMethod === 'netbanking') method = 'BANK_TRANSFER';

      return {
        status: 'SUCCESS',
        providerOrderId,
        providerPaymentId: captured.id,
        method,
        amountMinor: captured.amount,
        currency: (captured.currency || 'INR').toUpperCase(),
        rawStatus: 'captured',
      };
    }

    const failed = items.every((p) => p.status === 'failed') && items.length > 0;
    if (failed) {
      const lastFailed = items[items.length - 1];
      return {
        status: 'FAILED',
        providerOrderId,
        failureCode: lastFailed?.error_code || 'PAYMENT_FAILED',
        failureMessage: lastFailed?.error_description || 'Payment was declined or failed',
        rawStatus: 'failed',
      };
    }

    return {
      status: 'PENDING',
      providerOrderId,
      rawStatus: 'pending',
    };
  }

  async refundPayment(req: RefundPaymentRequest): Promise<RefundPaymentResult> {
    const { providerPaymentId, amountMinor, config, reason } = req;
    const authHeader = this.getAuthHeader(config);

    const resp = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountMinor,
        notes: { reason: reason || 'Customer return' },
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      return {
        success: false,
        error: data?.error?.description || 'Razorpay refund failed',
      };
    }

    return {
      success: true,
      refundId: data.id,
      amountMinor: data.amount,
      status: data.status,
    };
  }
}

export const razorpayAdapter = new RazorpayAdapter();
