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

export class CashfreeAdapter implements PaymentGatewayAdapter {
  readonly provider: GatewayProvider = 'CASHFREE';

  getCapabilities(): GatewayCapabilities {
    return {
      card: true,
      upi: true,
      netBanking: true,
      hostedCheckout: true,
      paymentLink: true,
      qr: false, // Cashfree uses hosted checkout / payment links
      refund: true,
    };
  }

  private getBaseUrl(mode?: string): string {
    return mode === 'LIVE'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  }

  private getHeaders(config: any): Record<string, string> {
    return {
      'x-client-id': (config?.appId || '').trim(),
      'x-client-secret': (config?.secretKey || '').trim(),
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json',
    };
  }

  async testConnection(req: GatewayTestRequest): Promise<GatewayTestResult> {
    const { config } = req;
    const appId = (config?.appId || '').trim();
    const secretKey = (config?.secretKey || '').trim();
    const mode = config?.mode || 'TEST';

    if (!appId || !secretKey) {
      return {
        success: false,
        provider: this.provider,
        mode,
        errorCode: 'GATEWAY_NOT_CONFIGURED',
        userMessage: 'Both Cashfree App ID and Secret Key are required to test connection.',
        message: 'Both Cashfree App ID and Secret Key are required to test connection.',
      };
    }

    const start = Date.now();
    try {
      const baseUrl = this.getBaseUrl(mode);
      const resp = await fetch(`${baseUrl}/orders?limit=1`, {
        method: 'GET',
        headers: this.getHeaders(config),
        signal: AbortSignal.timeout(8000),
      });

      const latencyMs = Date.now() - start;
      const data: any = await resp.json();

      if (!resp.ok) {
        const errMsg = data?.message || data?.error || `HTTP ${resp.status}: Invalid credentials`;
        return {
          success: false,
          provider: this.provider,
          mode,
          errorCode: 'GATEWAY_AUTH_FAILED',
          userMessage: `Cashfree connection failed: ${errMsg}`,
          message: `Cashfree connection failed: ${errMsg}`,
          latencyMs,
        };
      }

      return {
        success: true,
        provider: this.provider,
        mode,
        userMessage: `Cashfree PG connection verified successfully! Authenticated against ${mode === 'LIVE' ? 'Production' : 'Sandbox'}.`,
        message: `Cashfree PG connection verified successfully! Authenticated against ${mode === 'LIVE' ? 'Production' : 'Sandbox'}.`,
        latencyMs,
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('timeout');
      return {
        success: false,
        provider: this.provider,
        mode,
        errorCode: isTimeout ? 'GATEWAY_TIMEOUT' : 'GATEWAY_NETWORK_ERROR',
        userMessage: isTimeout
          ? 'Connection timed out connecting to Cashfree. Please check your network.'
          : `Network error: ${err?.message || 'Failed to reach Cashfree API'}`,
        message: isTimeout
          ? 'Connection timed out connecting to Cashfree. Please check your network.'
          : `Network error: ${err?.message || 'Failed to reach Cashfree API'}`,
      };
    }
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const { amountMinor, currency, orderNumber, customerName, customerPhone, customerEmail, config } = req;
    const mode = config?.mode || 'TEST';
    const baseUrl = this.getBaseUrl(mode);

    if (!config?.appId || !config?.secretKey) {
      throw new Error('Cashfree App ID and Secret Key are not configured.');
    }

    const cleanOrderId = `CF_${orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const phone = customerPhone && customerPhone.length === 10 ? customerPhone : '9999999999';
    const majorAmount = Number((amountMinor / 100).toFixed(2));

    const resp = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify({
        order_id: cleanOrderId,
        order_amount: majorAmount,
        order_currency: currency,
        customer_details: {
          customer_id: customerPhone ? `CUST_${customerPhone}` : `CUST_${Date.now()}`,
          customer_name: customerName || 'Walk-in Customer',
          customer_phone: phone,
          customer_email: customerEmail && customerEmail.includes('@') ? customerEmail : 'billing@store.com',
        },
        order_meta: {
          return_url: `https://inventrypilot.local/cashfree-return?order_id=${cleanOrderId}`,
        },
        order_note: `POS Invoice #${orderNumber}`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const cfOrder: any = await resp.json();
    if (!resp.ok) {
      throw new Error(cfOrder?.message || 'Cashfree order creation failed');
    }

    const sessionId = cfOrder.payment_session_id;
    const hostedCheckoutUrl = cfOrder.payment_link ||
      cfOrder.payments?.url ||
      `https://${mode === 'LIVE' ? 'payments' : 'sandbox'}.cashfree.com/order/#${sessionId}`;

    return {
      providerOrderId: cleanOrderId,
      checkoutUrl: hostedCheckoutUrl,
      paymentLinkUrl: hostedCheckoutUrl,
      paymentSessionId: sessionId,
      rawResponse: { order_id: cleanOrderId, order_status: cfOrder.order_status },
    };
  }

  async getPaymentStatus(req: GetPaymentStatusRequest): Promise<PaymentStatusResult> {
    const { providerOrderId, config } = req;
    const mode = config?.mode || 'TEST';
    const baseUrl = this.getBaseUrl(mode);

    const resp = await fetch(`${baseUrl}/orders/${encodeURIComponent(providerOrderId)}`, {
      method: 'GET',
      headers: this.getHeaders(config),
      signal: AbortSignal.timeout(8000),
    });

    const cfOrder: any = await resp.json();
    if (!resp.ok) {
      return {
        status: 'FAILED',
        providerOrderId,
        failureCode: 'GATEWAY_ERROR',
        failureMessage: cfOrder?.message || 'Failed to retrieve Cashfree order status',
        rawStatus: resp.status.toString(),
      };
    }

    if (cfOrder.order_status === 'PAID') {
      let providerPaymentId = cfOrder.cf_order_id?.toString() || cfOrder.order_id;
      let method: any = 'UPI';

      try {
        const payResp = await fetch(`${baseUrl}/orders/${encodeURIComponent(providerOrderId)}/payments`, {
          method: 'GET',
          headers: this.getHeaders(config),
          signal: AbortSignal.timeout(5000),
        });
        if (payResp.ok) {
          const payments: any[] = await payResp.json();
          const successful = payments.find((p) => p.payment_status === 'SUCCESS');
          if (successful) {
            providerPaymentId = successful.cf_payment_id?.toString() || providerPaymentId;
            const rawMethod = (successful.payment_group || '').toLowerCase();
            if (rawMethod === 'card') method = 'CARD';
            else if (rawMethod === 'net_banking') method = 'BANK_TRANSFER';
          }
        }
      } catch {
        // Fallback to order id
      }

      return {
        status: 'SUCCESS',
        providerOrderId,
        providerPaymentId,
        method,
        amountMinor: Math.round(Number(cfOrder.order_amount || 0) * 100),
        currency: (cfOrder.order_currency || 'INR').toUpperCase(),
        rawStatus: cfOrder.order_status,
      };
    }

    if (cfOrder.order_status === 'EXPIRED' || cfOrder.order_status === 'TERMINATED') {
      return {
        status: 'EXPIRED',
        providerOrderId,
        failureCode: 'PAYMENT_EXPIRED',
        failureMessage: `Cashfree order was marked ${cfOrder.order_status}`,
        rawStatus: cfOrder.order_status,
      };
    }

    return {
      status: 'PENDING',
      providerOrderId,
      amountMinor: Math.round(Number(cfOrder.order_amount || 0) * 100),
      currency: (cfOrder.order_currency || 'INR').toUpperCase(),
      rawStatus: cfOrder.order_status,
    };
  }

  async refundPayment(req: RefundPaymentRequest): Promise<RefundPaymentResult> {
    const { providerPaymentId, amountMinor, config, reason } = req;
    const mode = config?.mode || 'TEST';
    const baseUrl = this.getBaseUrl(mode);

    const resp = await fetch(`${baseUrl}/orders/${encodeURIComponent(providerPaymentId)}/refunds`, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify({
        refund_amount: Number((amountMinor / 100).toFixed(2)),
        refund_id: `REF_${Date.now()}`,
        refund_note: reason || 'Customer return',
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data: any = await resp.json();
    if (!resp.ok) {
      return {
        success: false,
        error: data?.message || 'Cashfree refund failed',
      };
    }

    return {
      success: true,
      refundId: data.cf_refund_id || data.refund_id,
      amountMinor: Math.round(Number(data.refund_amount || 0) * 100),
      status: data.refund_status,
    };
  }
}

export const cashfreeAdapter = new CashfreeAdapter();
