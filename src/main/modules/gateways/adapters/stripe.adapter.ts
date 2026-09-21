import { GatewayCapabilities, GatewayProvider } from '../../../../shared/types';
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

export class StripeAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = 'STRIPE';

  getCapabilities(): GatewayCapabilities {
    return {
      card: true,
      upi: false,
      netBanking: false,
      hostedCheckout: true,
      paymentLink: true,
      qr: false, // Stripe does not use UPI QR
      refund: true,
    };
  }

  async testConnection(req: GatewayTestRequest): Promise<GatewayTestResult> {
    const { config } = req;
    const secretKey = (config?.secretKey || '').trim();
    if (!secretKey) {
      return {
        success: false,
        provider: this.provider,
        mode: config?.mode || 'TEST',
        errorCode: 'GATEWAY_NOT_CONFIGURED',
        userMessage: 'Stripe Secret Key (sk_...) is required to test connection.',
        message: 'Stripe Secret Key (sk_...) is required to test connection.',
      };
    }

    const start = Date.now();
    try {
      const resp = await fetch('https://api.stripe.com/v1/balance', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        signal: AbortSignal.timeout(8000),
      });

      const latencyMs = Date.now() - start;
      const data: any = await resp.json();

      if (!resp.ok) {
        const errMsg = data?.error?.message || `HTTP ${resp.status}: Authentication failed`;
        return {
          success: false,
          provider: this.provider,
          mode: config?.mode || 'TEST',
          errorCode: 'GATEWAY_AUTH_FAILED',
          userMessage: `Stripe connection failed: ${errMsg}`,
          message: `Stripe connection failed: ${errMsg}`,
          latencyMs,
        };
      }

      return {
        success: true,
        provider: this.provider,
        mode: data.livemode ? 'LIVE' : 'TEST',
        userMessage: `Stripe connection verified successfully! Live API handshake OK (${data.livemode ? 'LIVE' : 'TEST'} mode).`,
        message: `Stripe connection verified successfully! Live API handshake OK (${data.livemode ? 'LIVE' : 'TEST'} mode).`,
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
          ? 'Connection timed out connecting to Stripe. Please check your internet.'
          : `Network error: ${err?.message || 'Failed to reach Stripe API'}`,
        message: isTimeout
          ? 'Connection timed out connecting to Stripe. Please check your internet.'
          : `Network error: ${err?.message || 'Failed to reach Stripe API'}`,
      };
    }
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const { amountMinor, currency, orderNumber, customerEmail, config } = req;
    const secretKey = (config?.secretKey || '').trim();

    if (!secretKey) {
      throw new Error('Stripe Secret Key is not configured.');
    }

    const bodyParams = new URLSearchParams();
    bodyParams.append('payment_method_types[]', 'card');
    bodyParams.append('mode', 'payment');
    bodyParams.append('line_items[0][price_data][currency]', currency.toLowerCase());
    bodyParams.append('line_items[0][price_data][unit_amount]', amountMinor.toString());
    bodyParams.append('line_items[0][price_data][product_data][name]', `Invoice #${orderNumber}`);
    bodyParams.append('line_items[0][quantity]', '1');
    bodyParams.append('client_reference_id', orderNumber);
    if (customerEmail && customerEmail.includes('@')) {
      bodyParams.append('customer_email', customerEmail);
    }
    bodyParams.append('success_url', `https://inventrypilot.local/success?session_id={CHECKOUT_SESSION_ID}`);
    bodyParams.append('cancel_url', `https://inventrypilot.local/cancel`);

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const session: any = await resp.json();
    if (!resp.ok) {
      throw new Error(session?.error?.message || 'Stripe Checkout Session creation failed');
    }

    return {
      providerOrderId: session.id,
      checkoutUrl: session.url,
      paymentLinkUrl: session.url,
      paymentSessionId: session.id,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
      rawResponse: { id: session.id, status: session.status },
    };
  }

  async getPaymentStatus(req: GetPaymentStatusRequest): Promise<PaymentStatusResult> {
    const { providerOrderId, config } = req;
    const secretKey = (config?.secretKey || '').trim();

    const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(providerOrderId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    const session: any = await resp.json();
    if (!resp.ok) {
      return {
        status: 'FAILED',
        providerOrderId,
        failureCode: 'GATEWAY_ERROR',
        failureMessage: session?.error?.message || 'Failed to retrieve Stripe session',
        rawStatus: resp.status.toString(),
      };
    }

    if (session.payment_status === 'paid') {
      return {
        status: 'SUCCESS',
        providerOrderId,
        providerPaymentId: session.payment_intent || session.id,
        method: 'CARD',
        amountMinor: session.amount_total,
        currency: (session.currency || 'INR').toUpperCase(),
        rawStatus: session.payment_status,
      };
    }

    if (session.status === 'expired') {
      return {
        status: 'EXPIRED',
        providerOrderId,
        failureCode: 'PAYMENT_EXPIRED',
        failureMessage: 'Stripe checkout session has expired',
        rawStatus: session.status,
      };
    }

    return {
      status: 'PENDING',
      providerOrderId,
      amountMinor: session.amount_total,
      currency: (session.currency || 'INR').toUpperCase(),
      rawStatus: session.status || session.payment_status,
    };
  }

  async refundPayment(req: RefundPaymentRequest): Promise<RefundPaymentResult> {
    const { providerPaymentId, amountMinor, config, reason } = req;
    const secretKey = (config?.secretKey || '').trim();

    const bodyParams = new URLSearchParams();
    bodyParams.append('payment_intent', providerPaymentId);
    bodyParams.append('amount', amountMinor.toString());
    if (reason) bodyParams.append('reason', 'requested_by_customer');

    const resp = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      return {
        success: false,
        error: data?.error?.message || 'Stripe refund failed',
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

export const stripeAdapter = new StripeAdapter();
