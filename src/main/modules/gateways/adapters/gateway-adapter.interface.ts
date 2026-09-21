import { GatewayCapabilities, GatewayProvider, PaymentMethod, PaymentStatusResultDTO } from '../../../../shared/types';

export interface GatewayTestRequest {
  config: any;
}

export interface GatewayTestResult {
  success: boolean;
  provider: GatewayProvider;
  mode: string;
  errorCode?: string;
  userMessage?: string;
  message?: string;
  latencyMs?: number;
}

export interface CreatePaymentRequest {
  amountMinor: number;
  currency: string;
  orderNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  config: any;
  notes?: string;
  callbackUrl?: string;
}

export interface CreatePaymentResult {
  providerOrderId: string;
  providerPaymentId?: string;
  checkoutUrl?: string;
  paymentLinkUrl?: string;
  qrPayload?: string;
  expiresAt?: Date;
  paymentSessionId?: string;
  rawResponse?: any;
}

export interface GetPaymentStatusRequest {
  providerOrderId: string;
  providerPaymentId?: string;
  config: any;
}

export interface PaymentStatusResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  providerPaymentId?: string;
  providerOrderId?: string;
  method?: PaymentMethod;
  amountMinor?: number;
  currency?: string;
  failureCode?: string;
  failureMessage?: string;
  rawStatus?: string;
}

export interface CancelPaymentRequest {
  providerOrderId: string;
  config: any;
}

export interface CancelPaymentResult {
  success: boolean;
  status: 'CANCELLED' | 'PENDING';
  message?: string;
}

export interface RefundPaymentRequest {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
  config: any;
}

export interface RefundPaymentResult {
  success: boolean;
  refundId?: string;
  amountMinor?: number;
  status?: string;
  error?: string;
}

export interface PaymentGatewayAdapter {
  readonly provider: GatewayProvider;
  getCapabilities(): GatewayCapabilities;
  testConnection(request: GatewayTestRequest): Promise<GatewayTestResult>;
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult>;
  getPaymentStatus(request: GetPaymentStatusRequest): Promise<PaymentStatusResult>;
  cancelPayment?(request: CancelPaymentRequest): Promise<CancelPaymentResult>;
  refundPayment?(request: RefundPaymentRequest): Promise<RefundPaymentResult>;
}
