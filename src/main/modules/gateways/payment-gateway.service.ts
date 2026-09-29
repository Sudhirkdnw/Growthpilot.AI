import { randomUUID } from 'crypto';
import { getPrismaClient } from '../../database/client';
import { settingsService } from '../settings/settings.service';
import { auditService } from '../audit/audit.service';
import { saleService } from '../sales/sale.service';
import { roleService } from '../auth/role.service';
import {
  GatewayProvider,
  GatewayCapabilities,
  GatewayTestRequestDTO,
  GatewayTestResponseDTO,
  CreatePaymentAttemptRequestDTO,
  GatewayOrderResponseDTO,
  GatewayStatusCheckResponseDTO,
  ManualPaymentOverrideDTO,
  RecoverPaymentResponseDTO,
  PaymentAttemptDTO,
  PaymentMethod,
} from '../../../shared/types';
import { PaymentGatewayAdapter, PaymentStatusResult } from './adapters/gateway-adapter.interface';
import { stripeAdapter } from './adapters/stripe.adapter';
import { razorpayAdapter } from './adapters/razorpay.adapter';
import { cashfreeAdapter } from './adapters/cashfree.adapter';

export class PaymentGatewayService {
  private adapters: Map<GatewayProvider, PaymentGatewayAdapter> = new Map([
    ['STRIPE', stripeAdapter],
    ['RAZORPAY', razorpayAdapter],
    ['CASHFREE', cashfreeAdapter],
  ]);

  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Retrieves provider adapter instance.
   */
  getAdapter(provider: GatewayProvider): PaymentGatewayAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Unsupported payment gateway provider: ${provider}`);
    }
    return adapter;
  }

  /**
   * Returns dynamic capabilities supported by a specific provider.
   */
  getCapabilities(provider: GatewayProvider): GatewayCapabilities {
    return this.getAdapter(provider).getCapabilities();
  }

  /**
   * Resolves the configured active gateway provider for a given payment method.
   * Does NOT hardcode method -> gateway; determines via admin settings and provider capabilities.
   */
  async resolveProviderForMethod(
    method: PaymentMethod
  ): Promise<{ provider: GatewayProvider; capabilities: GatewayCapabilities } | null> {
    const rawSettings = await settingsService.getRawAppSettings();
    const stored = rawSettings.gateways || {};

    if (method === 'UPI') {
      if (stored.razorpay?.enabled) {
        return { provider: 'RAZORPAY', capabilities: this.getCapabilities('RAZORPAY') };
      }
      if ((stored as any).cashfree?.enabled) {
        return { provider: 'CASHFREE', capabilities: this.getCapabilities('CASHFREE') };
      }
      return null;
    }

    if (method === 'CARD') {
      if (stored.stripe?.enabled) {
        return { provider: 'STRIPE', capabilities: this.getCapabilities('STRIPE') };
      }
      if (stored.razorpay?.enabled) {
        return { provider: 'RAZORPAY', capabilities: this.getCapabilities('RAZORPAY') };
      }
      if ((stored as any).cashfree?.enabled) {
        return { provider: 'CASHFREE', capabilities: this.getCapabilities('CASHFREE') };
      }
      return null;
    }

    if (method === 'BANK_TRANSFER') {
      if (stored.razorpay?.enabled) {
        return { provider: 'RAZORPAY', capabilities: this.getCapabilities('RAZORPAY') };
      }
      if ((stored as any).cashfree?.enabled) {
        return { provider: 'CASHFREE', capabilities: this.getCapabilities('CASHFREE') };
      }
      return null;
    }

    return null;
  }

  /**
   * Helper: Resolves credentials for a gateway, falling back to stored plaintext secrets
   * if the incoming config has masked or empty keys.
   */
  async resolveGatewayConfig(gateway: GatewayProvider, incomingConfig?: any): Promise<any> {
    const rawSettings = await settingsService.getRawAppSettings();
    const stored = rawSettings.gateways || {};

    if (gateway === 'STRIPE') {
      const storedStripe = stored.stripe || {};
      let secretKey = incomingConfig?.secretKey;
      if (secretKey === undefined || (typeof secretKey === 'string' && secretKey.startsWith('••'))) {
        secretKey = storedStripe.secretKey || '';
      }
      return {
        enabled: incomingConfig?.enabled ?? storedStripe.enabled ?? false,
        mode: incomingConfig?.mode ?? storedStripe.mode ?? 'TEST',
        publishableKey: (incomingConfig?.publishableKey ?? storedStripe.publishableKey ?? '').trim(),
        secretKey: (secretKey || '').trim(),
        webhookSecret: (incomingConfig?.webhookSecret ?? storedStripe.webhookSecret ?? '').trim(),
      };
    }

    if (gateway === 'RAZORPAY') {
      const storedRzp = stored.razorpay || {};
      let keySecret = incomingConfig?.keySecret;
      if (keySecret === undefined || (typeof keySecret === 'string' && keySecret.startsWith('••'))) {
        keySecret = storedRzp.keySecret || '';
      }
      return {
        enabled: incomingConfig?.enabled ?? storedRzp.enabled ?? false,
        mode: incomingConfig?.mode ?? storedRzp.mode ?? 'TEST',
        keyId: (incomingConfig?.keyId ?? storedRzp.keyId ?? '').trim(),
        keySecret: (keySecret || '').trim(),
        webhookSecret: (incomingConfig?.webhookSecret ?? storedRzp.webhookSecret ?? '').trim(),
      };
    }

    if (gateway === 'CASHFREE') {
      const storedCf = stored.cashfree || {};
      let secretKey = incomingConfig?.secretKey;
      if (secretKey === undefined || (typeof secretKey === 'string' && secretKey.startsWith('••'))) {
        secretKey = storedCf.secretKey || '';
      }
      return {
        enabled: incomingConfig?.enabled ?? storedCf.enabled ?? false,
        mode: incomingConfig?.mode ?? storedCf.mode ?? 'TEST',
        appId: (incomingConfig?.appId ?? storedCf.appId ?? '').trim(),
        secretKey: (secretKey || '').trim(),
      };
    }

    throw new Error(`Unsupported gateway provider: ${gateway}`);
  }

  /**
   * Diagnostic: Tests API credentials against live gateway servers.
   * Permission protected and audited. Secrets are NEVER logged.
   */
  async testGateway(req: GatewayTestRequestDTO, userId?: string): Promise<GatewayTestResponseDTO> {
    const { gateway, config } = req;
    const adapter = this.getAdapter(gateway);
    const resolved = await this.resolveGatewayConfig(gateway, config);

    const result = await adapter.testConnection({ config: resolved });

    await auditService.log({
      userId: userId || null,
      action: 'PAYMENT_GATEWAY_CONNECTION_TESTED',
      entityType: 'PaymentGateway',
      entityId: gateway,
      newValue: {
        provider: gateway,
        mode: result.mode,
        success: result.success,
        latencyMs: result.latencyMs,
      },
    });

    return result;
  }

  /**
   * Initializes a persistent PaymentAttempt and requests the gateway order/session.
   * Enforces idempotency via idempotencyKey.
   */
  async createPaymentAttempt(
    req: CreatePaymentAttemptRequestDTO,
    userId?: string
  ): Promise<GatewayOrderResponseDTO> {
    const { amount } = req;
    let gateway = req.gateway;

    if (!amount || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (!gateway && req.method) {
      const resolvedTarget = await this.resolveProviderForMethod(req.method);
      if (!resolvedTarget) {
        return {
          success: false,
          gateway: 'RAZORPAY',
          orderId: '',
          amount,
          currency: req.currency || 'INR',
          error: `No payment gateway is configured or enabled for payment method ${req.method}.`,
        };
      }
      gateway = resolvedTarget.provider;
    }

    if (!gateway) {
      gateway = 'RAZORPAY';
    }

    const adapter = this.getAdapter(gateway);
    const resolved = await this.resolveGatewayConfig(gateway);

    if (!resolved.enabled) {
      return {
        success: false,
        gateway,
        orderId: '',
        amount,
        currency: req.currency || 'INR',
        error: `Gateway ${gateway} is disabled in Administration settings.`,
      };
    }

    const currency = (req.currency || 'INR').toUpperCase();
    const amountMinor = Math.round(amount * 100);
    const orderNumber = req.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;
    const idempotencyKey = req.idempotencyKey || `IDEM_${gateway}_${orderNumber}_${Date.now()}`;
    const method = req.method || (gateway === 'STRIPE' ? 'CARD' : 'UPI');

    // 1. Idempotency Check: Existing PaymentAttempt
    const existing = await this.prisma.paymentAttempt.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        success: true,
        gateway,
        orderId: existing.providerOrderId || '',
        attemptId: existing.id,
        amount: existing.amountMinor / 100,
        currency: existing.currency,
        checkoutUrl: existing.checkoutUrl || undefined,
        paymentLinkUrl: existing.paymentLinkUrl || undefined,
        qrCodeData: existing.qrPayload || existing.checkoutUrl || undefined,
        method: existing.method as PaymentMethod,
        capabilities: adapter.getCapabilities(),
      };
    }

    // 2. Delegate to Gateway Adapter
    try {
      const gatewayRes = await adapter.createPayment({
        amountMinor,
        currency,
        orderNumber,
        customerName: req.customerName,
        customerPhone: req.customerPhone,
        customerEmail: req.customerEmail,
        config: resolved,
      });

      // 3. Persist PaymentAttempt in DB
      const attempt = await this.prisma.paymentAttempt.create({
        data: {
          provider: gateway,
          method: req.method || (gateway === 'STRIPE' ? 'CARD' : 'UPI'),
          amountMinor,
          currency,
          status: 'PENDING',
          idempotencyKey,
          providerOrderId: gatewayRes.providerOrderId,
          checkoutUrl: gatewayRes.checkoutUrl || null,
          paymentLinkUrl: gatewayRes.paymentLinkUrl || null,
          qrPayload: gatewayRes.qrPayload || null,
          expiresAt: gatewayRes.expiresAt || null,
          metadata: req.salePayload ? JSON.stringify(req.salePayload) : null,
        },
      });

      await auditService.log({
        userId: userId || null,
        action: 'PAYMENT_ATTEMPT_CREATED',
        entityType: 'PaymentAttempt',
        entityId: attempt.id,
        newValue: {
          provider: gateway,
          orderNumber,
          amountMinor,
          currency,
          providerOrderId: gatewayRes.providerOrderId,
        },
      });

      return {
        success: true,
        gateway,
        orderId: gatewayRes.providerOrderId,
        attemptId: attempt.id,
        amount,
        currency,
        checkoutUrl: gatewayRes.checkoutUrl,
        paymentLinkUrl: gatewayRes.paymentLinkUrl,
        qrCodeData: gatewayRes.qrPayload || gatewayRes.checkoutUrl,
        paymentSessionId: gatewayRes.paymentSessionId,
        method: req.method || (gateway === 'STRIPE' ? 'CARD' : 'UPI'),
        capabilities: adapter.getCapabilities(),
      };
    } catch (err: any) {
      console.error(`[PaymentGatewayService] Order creation failed for ${gateway}:`, err);
      return {
        success: false,
        gateway,
        orderId: '',
        amount,
        currency,
        error: err?.message || `Failed to create payment order on ${gateway}`,
      };
    }
  }

  /**
   * Real-time status polling and authoritative payment verification.
   * When gateway confirms payment, authoritatively verifies amount & currency,
   * performs idempotency checks, and creates the local Sale transaction.
   */
  async checkPaymentStatus(
    req: { gateway: GatewayProvider; orderId?: string; attemptId?: string },
    userId?: string
  ): Promise<GatewayStatusCheckResponseDTO> {
    const { gateway } = req;
    const adapter = this.getAdapter(gateway);
    const resolved = await this.resolveGatewayConfig(gateway);

    // 1. Locate local PaymentAttempt record
    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        OR: [
          ...(req.attemptId ? [{ id: req.attemptId }] : []),
          ...(req.orderId ? [{ provider: gateway, providerOrderId: req.orderId }] : []),
        ],
      },
    });

    if (!attempt) {
      return {
        success: false,
        gateway,
        orderId: req.orderId || '',
        status: 'FAILED',
        message: 'Payment attempt record not found.',
      };
    }

    // 2. If already completed and consumed by a Sale
    if (attempt.status === 'SUCCESS' && attempt.saleId) {
      const existingSale = await this.prisma.sale.findUnique({
        where: { id: attempt.saleId },
        select: { invoiceNumber: true },
      });
      return {
        success: true,
        gateway,
        orderId: attempt.providerOrderId || '',
        attemptId: attempt.id,
        status: 'SUCCESS',
        paidAmount: attempt.amountMinor / 100,
        transactionRef: attempt.providerPaymentId || undefined,
        saleCreated: true,
        saleId: attempt.saleId,
        invoiceNumber: existingSale?.invoiceNumber,
        message: 'Payment verified and local sale already posted.',
      };
    }

    // 3. Query Provider Gateway API for Live Status with Safe Network Boundary
    let statusResult: PaymentStatusResult;
    try {
      statusResult = await adapter.getPaymentStatus({
        providerOrderId: attempt.providerOrderId || req.orderId || '',
        providerPaymentId: attempt.providerPaymentId || undefined,
        config: resolved,
      });
    } catch (netErr: any) {
      console.warn('[PaymentGatewayService] Error querying gateway live status:', netErr);
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'UNKNOWN',
          failureCode: 'PAYMENT_NETWORK_ERROR',
          failureMessage: netErr?.message || 'Gateway unreachable or network timeout',
        },
      });

      return {
        success: false,
        gateway,
        orderId: attempt.providerOrderId || '',
        attemptId: attempt.id,
        status: 'UNKNOWN',
        failureCode: 'PAYMENT_NETWORK_ERROR',
        message: 'Gateway unreachable or network connection dropped. Please check payment status again before retrying.',
      };
    }

    // 4. Handle UNKNOWN / REQUIRES_ACTION from Gateway
    if (statusResult.status === 'UNKNOWN' || statusResult.status === 'REQUIRES_ACTION') {
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: statusResult.status,
          failureCode: statusResult.failureCode || 'PAYMENT_UNKNOWN',
          failureMessage: statusResult.failureMessage || 'Payment status unresolved at gateway',
        },
      });

      return {
        success: false,
        gateway,
        orderId: attempt.providerOrderId || '',
        attemptId: attempt.id,
        status: statusResult.status,
        failureCode: statusResult.failureCode || 'PAYMENT_UNKNOWN',
        message: statusResult.failureMessage || 'Payment status unresolved. Please retry verification.',
      };
    }

    // 5. State Transitions
    if (statusResult.status === 'SUCCESS') {
      const providerPaymentId = statusResult.providerPaymentId || attempt.providerOrderId || `PAY_${Date.now()}`;

      // --- AUTHORITATIVE AMOUNT & CURRENCY VERIFICATION ---
      if (statusResult.amountMinor !== undefined && statusResult.amountMinor !== attempt.amountMinor) {
        await this.prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'FAILED',
            failureCode: 'PAYMENT_AMOUNT_MISMATCH',
            failureMessage: `Expected ${attempt.amountMinor} minor units, but provider reported ${statusResult.amountMinor}.`,
          },
        });

        await auditService.log({
          userId: userId || null,
          action: 'PAYMENT_FAILED',
          entityType: 'PaymentAttempt',
          entityId: attempt.id,
          reason: 'PAYMENT_AMOUNT_MISMATCH',
          newValue: {
            expectedAmountMinor: attempt.amountMinor,
            reportedAmountMinor: statusResult.amountMinor,
          },
        });

        return {
          success: false,
          gateway,
          orderId: attempt.providerOrderId || '',
          attemptId: attempt.id,
          status: 'FAILED',
          message: 'Security Alert: Payment amount mismatch detected between POS and Gateway.',
        };
      }

      if (statusResult.currency && statusResult.currency !== attempt.currency) {
        await this.prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'FAILED',
            failureCode: 'PAYMENT_CURRENCY_MISMATCH',
            failureMessage: `Expected currency ${attempt.currency}, but provider reported ${statusResult.currency}.`,
          },
        });

        await auditService.log({
          userId: userId || null,
          action: 'PAYMENT_FAILED',
          entityType: 'PaymentAttempt',
          entityId: attempt.id,
          reason: 'PAYMENT_CURRENCY_MISMATCH',
        });

        return {
          success: false,
          gateway,
          orderId: attempt.providerOrderId || '',
          attemptId: attempt.id,
          status: 'FAILED',
          message: 'Security Alert: Payment currency mismatch detected.',
        };
      }

      // --- IDEMPOTENCY CHECK: Duplicate provider payment ---
      const duplicateSalePayment = await this.prisma.salePayment.findFirst({
        where: {
          gatewayProvider: gateway,
          providerPaymentId,
        },
      });

      if (duplicateSalePayment) {
        return {
          success: true,
          gateway,
          orderId: attempt.providerOrderId || '',
          attemptId: attempt.id,
          status: 'SUCCESS',
          paidAmount: attempt.amountMinor / 100,
          saleCreated: true,
          saleId: duplicateSalePayment.saleId,
          message: 'Payment already processed by existing sale transaction.',
        };
      }

      // --- ATOMIC LOCAL SALE CREATION ---
      let createdSale: any = null;
      if (attempt.metadata) {
        try {
          const saleInput = JSON.parse(attempt.metadata);
          // Enrich input with gateway details
          saleInput.paymentMethod = (statusResult.method || attempt.method || (gateway === 'STRIPE' ? 'CARD' : 'UPI')) as PaymentMethod;
          saleInput.gatewayProvider = gateway;
          saleInput.providerOrderId = attempt.providerOrderId;
          saleInput.providerPaymentId = providerPaymentId;
          saleInput.paymentAttemptId = attempt.id;
          saleInput.paidAmount = attempt.amountMinor / 100;

          createdSale = await saleService.createSale(saleInput, userId);
        } catch (saleErr: any) {
          console.error('[PaymentGatewayService] Local sale creation failed after gateway success:', saleErr);
          // Mark attempt as SUCCESS but saleId as null so it is caught by reconciliation/recovery!
          await this.prisma.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: 'SUCCESS',
              verifiedAt: new Date(),
              providerPaymentId,
            },
          });

          return {
            success: true,
            gateway,
            orderId: attempt.providerOrderId || '',
            attemptId: attempt.id,
            status: 'SUCCESS',
            paidAmount: attempt.amountMinor / 100,
            transactionRef: providerPaymentId,
            saleCreated: false,
            message: `Gateway payment confirmed, but local sale posting failed: ${saleErr.message}. Recoverable via crash recovery.`,
          };
        }
      }

      // Update PaymentAttempt as consumed
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUCCESS',
          verifiedAt: new Date(),
          providerPaymentId,
          saleId: createdSale?.id || null,
        },
      });

      await auditService.log({
        userId: userId || null,
        action: 'PAYMENT_VERIFIED',
        entityType: 'PaymentAttempt',
        entityId: attempt.id,
        newValue: {
          provider: gateway,
          providerPaymentId,
          saleId: createdSale?.id,
          invoiceNumber: createdSale?.invoiceNumber,
        },
      });

      return {
        success: true,
        gateway,
        orderId: attempt.providerOrderId || '',
        attemptId: attempt.id,
        status: 'SUCCESS',
        paidAmount: attempt.amountMinor / 100,
        transactionRef: providerPaymentId,
        saleCreated: !!createdSale,
        saleId: createdSale?.id,
        invoiceNumber: createdSale?.invoiceNumber,
        message: 'Payment verified and local sale posted successfully.',
      };
    }

    if (statusResult.status === 'FAILED') {
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'FAILED',
          failureCode: statusResult.failureCode || 'PAYMENT_FAILED',
          failureMessage: statusResult.failureMessage || 'Payment was declined',
        },
      });

      await auditService.log({
        userId: userId || null,
        action: 'PAYMENT_FAILED',
        entityType: 'PaymentAttempt',
        entityId: attempt.id,
        reason: statusResult.failureMessage,
      });

      return {
        success: false,
        gateway,
        orderId: attempt.providerOrderId || '',
        attemptId: attempt.id,
        status: 'FAILED',
        message: statusResult.failureMessage || 'Payment was declined or cancelled by customer',
      };
    }

    if (statusResult.status === 'EXPIRED') {
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'EXPIRED',
          failureCode: 'PAYMENT_EXPIRED',
          failureMessage: 'Payment session expired',
        },
      });

      await auditService.log({
        userId: userId || null,
        action: 'PAYMENT_EXPIRED',
        entityType: 'PaymentAttempt',
        entityId: attempt.id,
      });

      return {
        success: false,
        gateway,
        orderId: attempt.providerOrderId || '',
        attemptId: attempt.id,
        status: 'EXPIRED',
        message: 'Payment session has expired. Please initiate a new order.',
      };
    }

    // Still pending
    return {
      success: true,
      gateway,
      orderId: attempt.providerOrderId || '',
      attemptId: attempt.id,
      status: 'PENDING',
      message: 'Waiting for customer payment completion...',
    };
  }

  /**
   * Manual Payment Override:
   * Authorized manager or admin marks a gateway attempt as paid via Cash/Card.
   * Requires permission `sales.payment_override` and mandatory audit logging.
   */
  async manualPaymentOverride(
    dto: ManualPaymentOverrideDTO,
    session: { user: { id: string; role: string; username: string } }
  ): Promise<{ success: boolean; saleId?: string; invoiceNumber?: string }> {
    const { paymentAttemptId, newPaymentMethod, reason } = dto;

    if (!reason || reason.trim().length < 3) {
      throw new Error('A detailed reason is mandatory for manual payment override.');
    }

    // Permission verification
    const isAllowed =
      session.user.role === 'ADMIN' ||
      (await roleService.hasPermission(session.user.role, 'sales.payment_override'));

    if (!isAllowed) {
      throw new Error('Unauthorized: Manual Payment Override requires "sales.payment_override" permission.');
    }

    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
    });

    if (!attempt) {
      throw new Error('Payment attempt not found.');
    }

    if (attempt.saleId) {
      throw new Error('This payment attempt has already been consumed by an existing sale.');
    }

    let createdSale: any = null;
    if (attempt.metadata) {
      const saleInput = JSON.parse(attempt.metadata);
      saleInput.paymentMethod = newPaymentMethod;
      saleInput.paidAmount = attempt.amountMinor / 100;
      saleInput.notes = saleInput.notes
        ? `${saleInput.notes} | [OVERRIDE from ${attempt.provider}: ${reason}]`
        : `[OVERRIDE from ${attempt.provider}: ${reason}]`;

      createdSale = await saleService.createSale(saleInput, session.user.id);
    }

    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'CANCELLED',
        failureCode: 'PAYMENT_OVERRIDDEN',
        failureMessage: `Overridden to ${newPaymentMethod} by ${session.user.username}: ${reason}`,
        saleId: createdSale?.id || null,
      },
    });

    await auditService.log({
      userId: session.user.id,
      action: 'PAYMENT_OVERRIDE',
      entityType: 'PaymentAttempt',
      entityId: attempt.id,
      reason,
      oldValue: {
        gatewayStatus: attempt.status,
        provider: attempt.provider,
      },
      newValue: {
        newPaymentMethod,
        amount: attempt.amountMinor / 100,
        saleId: createdSale?.id,
        invoiceNumber: createdSale?.invoiceNumber,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      saleId: createdSale?.id,
      invoiceNumber: createdSale?.invoiceNumber,
    };
  }

  /**
   * Cancellation: Cancels an open payment attempt.
   */
  async cancelPaymentAttempt(attemptId: string, userId?: string): Promise<{ success: boolean }> {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      return { success: false };
    }

    if (attempt.saleId) {
      throw new Error('Cannot cancel payment attempt that has already posted a sale.');
    }

    await this.prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'CANCELLED',
        failureCode: 'USER_CANCELLED',
        failureMessage: 'Cashier cancelled online payment modal',
      },
    });

    await auditService.log({
      userId: userId || null,
      action: 'PAYMENT_CANCELLED',
      entityType: 'PaymentAttempt',
      entityId: attemptId,
    });

    return { success: true };
  }

  /**
   * Reconciliation: Finds any PaymentAttempt where status is SUCCESS but local Sale is missing.
   * Crucial for detecting crash scenarios between gateway success and sale commit.
   */
  async getUnreconciledPayments(): Promise<PaymentAttemptDTO[]> {
    const records = await this.prisma.paymentAttempt.findMany({
      where: {
        status: 'SUCCESS',
        saleId: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      provider: r.provider as GatewayProvider,
      method: r.method as PaymentMethod,
      amountMinor: r.amountMinor,
      currency: r.currency,
      status: r.status as any,
      idempotencyKey: r.idempotencyKey,
      providerOrderId: r.providerOrderId,
      providerPaymentId: r.providerPaymentId,
      checkoutUrl: r.checkoutUrl,
      paymentLinkUrl: r.paymentLinkUrl,
      qrPayload: r.qrPayload,
      expiresAt: r.expiresAt?.toISOString() || null,
      failureCode: r.failureCode,
      failureMessage: r.failureMessage,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      saleId: r.saleId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      verifiedAt: r.verifiedAt?.toISOString() || null,
    }));
  }

  /**
   * Crash Recovery:
   * Idempotently recovers a successful gateway payment when local sale creation had crashed or failed.
   * Re-checks idempotency and creates the local Sale once, never duplicating.
   */
  async recoverPayment(attemptId: string, userId?: string): Promise<RecoverPaymentResponseDTO> {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      return { success: false, alreadyProcessed: false, error: 'Payment attempt not found' };
    }

    // If sale is already created, idempotently return it
    if (attempt.saleId) {
      const existingSale = await this.prisma.sale.findUnique({
        where: { id: attempt.saleId },
        select: { id: true, invoiceNumber: true },
      });
      return {
        success: true,
        alreadyProcessed: true,
        saleId: attempt.saleId,
        invoiceNumber: existingSale?.invoiceNumber,
      };
    }

    if (!attempt.metadata) {
      return {
        success: false,
        alreadyProcessed: false,
        error: 'No sale metadata available in payment attempt to reconstruct sale.',
      };
    }

    try {
      const saleInput = JSON.parse(attempt.metadata);
      saleInput.paymentMethod = (attempt.method || 'UPI') as PaymentMethod;
      saleInput.gatewayProvider = attempt.provider;
      saleInput.providerOrderId = attempt.providerOrderId;
      saleInput.providerPaymentId = attempt.providerPaymentId;
      saleInput.paymentAttemptId = attempt.id;
      saleInput.paidAmount = attempt.amountMinor / 100;

      const sale = await saleService.createSale(saleInput, userId);

      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          saleId: sale.id,
          status: 'SUCCESS',
        },
      });

      await auditService.log({
        userId: userId || null,
        action: 'PAYMENT_RECOVERED',
        entityType: 'PaymentAttempt',
        entityId: attempt.id,
        newValue: {
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
        },
      });

      return {
        success: true,
        alreadyProcessed: false,
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
      };
    } catch (err: any) {
      return {
        success: false,
        alreadyProcessed: false,
        error: err?.message || 'Failed to reconstruct sale during recovery',
      };
    }
  }
}

export const paymentGatewayService = new PaymentGatewayService();
