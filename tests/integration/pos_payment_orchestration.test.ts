import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentGatewayService } from '../../src/main/modules/gateways/payment-gateway.service';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { getPrismaClient } from '../../src/main/database/client';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { auditService } from '../../src/main/modules/audit/audit.service';
import { razorpayAdapter } from '../../src/main/modules/gateways/adapters/razorpay.adapter';
import { stripeAdapter } from '../../src/main/modules/gateways/adapters/stripe.adapter';
import { cashfreeAdapter } from '../../src/main/modules/gateways/adapters/cashfree.adapter';

describe('POS Payment Orchestration & Enterprise Flow Test Suite', () => {
  const prisma = getPrismaClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------
  // 1. DYNAMIC PROVIDER RESOLUTION & CAPABILITIES
  // ----------------------------------------------------
  describe('1. Dynamic Gateway Provider Resolution by Method', () => {
    it('Resolves UPI -> RAZORPAY when Razorpay is enabled', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_test_123', keySecret: 'sec' },
          stripe: { enabled: false },
          cashfree: { enabled: false },
        },
      } as any);

      const resolved = await paymentGatewayService.resolveProviderForMethod('UPI');
      expect(resolved).not.toBeNull();
      expect(resolved?.provider).toBe('RAZORPAY');
      expect(resolved?.capabilities.upi).toBe(true);
      expect(resolved?.capabilities.qr).toBe(true);
    });

    it('Resolves UPI -> CASHFREE when Cashfree is enabled and Razorpay is disabled', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: false },
          stripe: { enabled: false },
          cashfree: { enabled: true, mode: 'TEST', appId: 'cf_app', secretKey: 'cf_sec' },
        },
      } as any);

      const resolved = await paymentGatewayService.resolveProviderForMethod('UPI');
      expect(resolved).not.toBeNull();
      expect(resolved?.provider).toBe('CASHFREE');
      expect(resolved?.capabilities.upi).toBe(true);
    });

    it('Resolves CARD -> STRIPE when Stripe is enabled', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          stripe: { enabled: true, mode: 'TEST', publishableKey: 'pk_123', secretKey: 'sk_123' },
          razorpay: { enabled: true },
        },
      } as any);

      const resolved = await paymentGatewayService.resolveProviderForMethod('CARD');
      expect(resolved).not.toBeNull();
      expect(resolved?.provider).toBe('STRIPE');
      expect(resolved?.capabilities.card).toBe(true);
      expect(resolved?.capabilities.hostedCheckout).toBe(true);
    });

    it('Resolves CARD -> RAZORPAY when Stripe is disabled and Razorpay is enabled', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          stripe: { enabled: false },
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_123', keySecret: 'sec' },
        },
      } as any);

      const resolved = await paymentGatewayService.resolveProviderForMethod('CARD');
      expect(resolved).not.toBeNull();
      expect(resolved?.provider).toBe('RAZORPAY');
      expect(resolved?.capabilities.card).toBe(true);
    });

    it('Returns null when no gateway is configured or enabled for requested method', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          stripe: { enabled: false },
          razorpay: { enabled: false },
          cashfree: { enabled: false },
        },
      } as any);

      const resolved = await paymentGatewayService.resolveProviderForMethod('UPI');
      expect(resolved).toBeNull();
    });
  });

  // ----------------------------------------------------
  // 2. SCENARIO A: UPI PAYMENT SUCCESS
  // ----------------------------------------------------
  describe('2. Scenario A — UPI Success Flow', () => {
    it('Creates PaymentAttempt, verifies success with gateway, and commits local sale atomically', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_test_123', keySecret: 'sec' },
        },
      } as any);

      // 1. Mock Razorpay Order Creation
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'order_rzp_mock_1001', status: 'created' }),
        } as any)
        // Mock Razorpay QR API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'qr_mock_123', payload: 'upi://pay?pa=rzp@axis&pn=POS&am=500.00' }),
        } as any);

      const attemptSpy = vi.spyOn(prisma.paymentAttempt, 'create').mockResolvedValueOnce({
        id: 'attempt-upi-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
        status: 'PENDING',
        idempotencyKey: 'IDEM_UPI_1',
        providerOrderId: 'order_rzp_mock_1001',
        qrPayload: 'upi://pay?pa=rzp@axis&pn=POS&am=500.00',
        metadata: JSON.stringify({
          customerId: null,
          items: [{ productId: 'prod-1', quantity: 2, sellingPrice: 250 }],
          discount: 0,
          tax: 0,
          paidAmount: 500,
        }),
      } as any);

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      const createRes = await paymentGatewayService.createPaymentAttempt({
        gateway: 'RAZORPAY',
        method: 'UPI',
        amount: 500,
        currency: 'INR',
        orderNumber: 'ORD-1001',
        idempotencyKey: 'IDEM_UPI_1',
        salePayload: {
          customerId: null,
          items: [{ productId: 'prod-1', quantity: 2, sellingPrice: 250 }],
          discount: 0,
          tax: 0,
          paidAmount: 500,
        },
      });

      expect(createRes.success).toBe(true);
      expect(createRes.orderId).toBe('order_rzp_mock_1001');
      expect(createRes.qrCodeData).toBe('upi://pay?pa=rzp@axis&pn=POS&am=500.00');
      expect(attemptSpy).toHaveBeenCalled();

      // 2. Gateway Status Check: Live verification
      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-upi-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
        status: 'PENDING',
        providerOrderId: 'order_rzp_mock_1001',
        metadata: JSON.stringify({
          customerId: null,
          items: [{ productId: 'prod-1', quantity: 2, sellingPrice: 250 }],
          discount: 0,
          tax: 0,
          paidAmount: 500,
        }),
        saleId: null,
      } as any);

      vi.spyOn(razorpayAdapter, 'getPaymentStatus').mockResolvedValueOnce({
        status: 'SUCCESS',
        providerOrderId: 'order_rzp_mock_1001',
        providerPaymentId: 'pay_rzp_mock_success_777',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
      });

      vi.spyOn(prisma.salePayment, 'findFirst').mockResolvedValueOnce(null);

      const saleServiceSpy = vi.spyOn(saleService, 'createSale').mockResolvedValueOnce({
        id: 'sale-uuid-1',
        invoiceNumber: 'INV-2026-0001',
        grandTotal: 500,
        paidAmount: 500,
        dueAmount: 0,
      } as any);

      const updateAttemptSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);

      const statusRes = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-upi-1',
        orderId: 'order_rzp_mock_1001',
      });

      expect(statusRes.status).toBe('SUCCESS');
      expect(statusRes.saleCreated).toBe(true);
      expect(statusRes.saleId).toBe('sale-uuid-1');
      expect(statusRes.invoiceNumber).toBe('INV-2026-0001');
      expect(statusRes.transactionRef).toBe('pay_rzp_mock_success_777');
      expect(saleServiceSpy).toHaveBeenCalled();
      expect(updateAttemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
            saleId: 'sale-uuid-1',
            providerPaymentId: 'pay_rzp_mock_success_777',
          }),
        })
      );
    });
  });

  // ----------------------------------------------------
  // 3. SCENARIO B: UPI FAILURE -> CARD SUCCESS
  // ----------------------------------------------------
  describe('3. Scenario B — Payment Method Switch (UPI Fails -> Card Succeeds)', () => {
    it('Preserves cart on UPI failure, logs failure, and completes cleanly when switching to Card', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_123', keySecret: 'sec' },
          stripe: { enabled: true, mode: 'TEST', publishableKey: 'pk_123', secretKey: 'sk_123' },
        },
      } as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      // Step 1: UPI Attempt 1 Fails
      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-1-upi',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 100000,
        currency: 'INR',
        status: 'PENDING',
        providerOrderId: 'order_rzp_1',
        saleId: null,
      } as any);

      vi.spyOn(razorpayAdapter, 'getPaymentStatus').mockResolvedValueOnce({
        status: 'FAILED',
        providerOrderId: 'order_rzp_1',
        failureCode: 'BAD_REQUEST_ERROR',
        failureMessage: 'Payment declined by customer',
      });

      const updateAttempt1Spy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);

      const checkRes1 = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-1-upi',
      });

      expect(checkRes1.status).toBe('FAILED');
      expect(checkRes1.message).toContain('Payment declined by customer');
      expect(updateAttempt1Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-1-upi' },
          data: expect.objectContaining({
            status: 'FAILED',
            failureCode: 'BAD_REQUEST_ERROR',
          }),
        })
      );

      // Notice: No Sale was created! Cart was untouched!

      // Step 2: Cashier switches to CARD -> Attempt 2 created with Stripe
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cs_stripe_card_999',
          url: 'https://checkout.stripe.com/c/pay/cs_stripe_card_999',
          status: 'open',
        }),
      } as any);

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce(null);
      const createAttempt2Spy = vi.spyOn(prisma.paymentAttempt, 'create').mockResolvedValueOnce({
        id: 'attempt-2-card',
        provider: 'STRIPE',
        method: 'CARD',
        amountMinor: 100000,
        currency: 'INR',
        status: 'PENDING',
        idempotencyKey: 'IDEM_CARD_2',
        providerOrderId: 'cs_stripe_card_999',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_stripe_card_999',
      } as any);

      const createRes2 = await paymentGatewayService.createPaymentAttempt({
        gateway: 'STRIPE',
        method: 'CARD',
        amount: 1000,
        currency: 'INR',
        orderNumber: 'ORD-1002',
        idempotencyKey: 'IDEM_CARD_2',
        salePayload: { items: [{ productId: 'p1', quantity: 1, sellingPrice: 1000 }] },
      });

      expect(createRes2.success).toBe(true);
      expect(createRes2.orderId).toBe('cs_stripe_card_999');
      expect(createAttempt2Spy).toHaveBeenCalled();

      // Step 3: Card Attempt 2 Succeeds
      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-2-card',
        provider: 'STRIPE',
        method: 'CARD',
        amountMinor: 100000,
        currency: 'INR',
        status: 'PENDING',
        providerOrderId: 'cs_stripe_card_999',
        metadata: JSON.stringify({ items: [{ productId: 'p1', quantity: 1, sellingPrice: 1000 }] }),
        saleId: null,
      } as any);

      vi.spyOn(stripeAdapter, 'getPaymentStatus').mockResolvedValueOnce({
        status: 'SUCCESS',
        providerOrderId: 'cs_stripe_card_999',
        providerPaymentId: 'pi_stripe_success_888',
        method: 'CARD',
        amountMinor: 100000,
        currency: 'INR',
      });

      vi.spyOn(prisma.salePayment, 'findFirst').mockResolvedValueOnce(null);

      const saleServiceSpy = vi.spyOn(saleService, 'createSale').mockResolvedValueOnce({
        id: 'sale-final-1',
        invoiceNumber: 'INV-CARD-SUCCESS',
      } as any);

      const statusRes2 = await paymentGatewayService.checkPaymentStatus({
        gateway: 'STRIPE',
        attemptId: 'attempt-2-card',
      });

      expect(statusRes2.status).toBe('SUCCESS');
      expect(statusRes2.saleCreated).toBe(true);
      expect(statusRes2.saleId).toBe('sale-final-1');
      expect(saleServiceSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------
  // 4. SCENARIO D: UNKNOWN PAYMENT STATE (NETWORK DROP)
  // ----------------------------------------------------
  describe('4. Scenario D — Unknown Payment State Protection', () => {
    it('Marks status as UNKNOWN without prematurely marking FAILED when network fails', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_123', keySecret: 'sec' },
        },
      } as any);

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-unknown-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 75000,
        currency: 'INR',
        status: 'PENDING',
        providerOrderId: 'order_rzp_netdrop',
        saleId: null,
      } as any);

      // Adapter throws network timeout error
      vi.spyOn(razorpayAdapter, 'getPaymentStatus').mockRejectedValueOnce(
        new Error('fetch failed: Connection reset by peer / Gateway timed out')
      );

      const updateSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);

      const statusRes = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-unknown-1',
      });

      expect(statusRes.status).toBe('UNKNOWN');
      expect(statusRes.failureCode).toBe('PAYMENT_NETWORK_ERROR');
      expect(statusRes.message).toContain('Gateway unreachable or network connection dropped');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-unknown-1' },
          data: expect.objectContaining({
            status: 'UNKNOWN',
            failureCode: 'PAYMENT_NETWORK_ERROR',
          }),
        })
      );
    });
  });

  // ----------------------------------------------------
  // 5. SECURITY & AMOUNT PROTECTION
  // ----------------------------------------------------
  describe('5. Security: Authoritative Amount & Currency Verification', () => {
    it('Blocks sale finalization and flags security alert when gateway paid amount does not match expected amount', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_123', keySecret: 'sec' },
        },
      } as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-mismatch-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000, // Expected: ₹500.00 (50000 paise)
        currency: 'INR',
        status: 'PENDING',
        providerOrderId: 'order_mismatch',
        saleId: null,
      } as any);

      // Gateway reports only 49000 paise (₹490.00) was paid!
      vi.spyOn(razorpayAdapter, 'getPaymentStatus').mockResolvedValueOnce({
        status: 'SUCCESS',
        providerOrderId: 'order_mismatch',
        providerPaymentId: 'pay_fraud_123',
        amountMinor: 49000,
        currency: 'INR',
      });

      const updateSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);
      const saleServiceSpy = vi.spyOn(saleService, 'createSale');

      const res = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-mismatch-1',
      });

      expect(res.status).toBe('FAILED');
      expect(res.message).toContain('Security Alert: Payment amount mismatch detected');
      expect(saleServiceSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-mismatch-1' },
          data: expect.objectContaining({
            status: 'FAILED',
            failureCode: 'PAYMENT_AMOUNT_MISMATCH',
          }),
        })
      );
    });

    it('Blocks sale finalization when gateway currency does not match store currency', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          razorpay: { enabled: true, mode: 'TEST', keyId: 'rzp_123', keySecret: 'sec' },
        },
      } as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-cur-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
        status: 'PENDING',
        providerOrderId: 'order_cur',
        saleId: null,
      } as any);

      // Provider returned USD instead of INR
      vi.spyOn(razorpayAdapter, 'getPaymentStatus').mockResolvedValueOnce({
        status: 'SUCCESS',
        providerOrderId: 'order_cur',
        amountMinor: 50000,
        currency: 'USD',
      });

      vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);

      const res = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-cur-1',
      });

      expect(res.status).toBe('FAILED');
      expect(res.message).toContain('Security Alert: Payment currency mismatch detected');
    });
  });

  // ----------------------------------------------------
  // 6. IDEMPOTENCY & DOUBLE-PAYMENT PROTECTION
  // ----------------------------------------------------
  describe('6. Idempotency & Double Payment Protection', () => {
    it('createPaymentAttempt returns existing attempt if idempotencyKey already exists without calling gateway', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: { razorpay: { enabled: true } },
      } as any);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce({
        id: 'existing-attempt-id',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
        providerOrderId: 'rzp_order_already_created',
        checkoutUrl: 'https://checkout.rzp.com/123',
      } as any);

      const res = await paymentGatewayService.createPaymentAttempt({
        gateway: 'RAZORPAY',
        amount: 500,
        idempotencyKey: 'IDEM_DOUBLE_CLICK_PREVENTION',
      });

      expect(res.success).toBe(true);
      expect(res.attemptId).toBe('existing-attempt-id');
      expect(res.orderId).toBe('rzp_order_already_created');
      // Gateway was NEVER contacted twice!
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('checkPaymentStatus idempotently returns existing invoice if sale was already completed', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: { razorpay: { enabled: true } },
      } as any);

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce({
        id: 'attempt-already-done',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
        status: 'SUCCESS',
        saleId: 'sale-already-posted-123',
        providerOrderId: 'rzp_ord_1',
      } as any);

      vi.spyOn(prisma.sale, 'findUnique').mockResolvedValueOnce({
        invoiceNumber: 'INV-EXISTING-999',
      } as any);

      const saleServiceSpy = vi.spyOn(saleService, 'createSale');

      const res = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-already-done',
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.saleCreated).toBe(true);
      expect(res.saleId).toBe('sale-already-posted-123');
      expect(res.invoiceNumber).toBe('INV-EXISTING-999');
      // Zero duplicate sales created!
      expect(saleServiceSpy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------
  // 7. CRASH RECOVERY & RECONCILIATION
  // ----------------------------------------------------
  describe('7. Crash Recovery & Unreconciled Payment Reconciliation', () => {
    it('Identifies successful external payment missing local sale and recovers it idempotently', async () => {
      vi.spyOn(prisma.paymentAttempt, 'findMany').mockResolvedValueOnce([
        {
          id: 'attempt-crashed-1',
          provider: 'RAZORPAY',
          method: 'UPI',
          amountMinor: 50000,
          currency: 'INR',
          status: 'SUCCESS',
          idempotencyKey: 'IDEM_CRASH',
          providerOrderId: 'order_crash_rzp',
          providerPaymentId: 'pay_crash_rzp',
          metadata: JSON.stringify({ items: [{ productId: 'p1', quantity: 2, sellingPrice: 250 }] }),
          saleId: null, // CRASH DETECTED: Paid externally, local sale missing!
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ]);

      const unreconciled = await paymentGatewayService.getUnreconciledPayments();
      expect(unreconciled.length).toBe(1);
      expect(unreconciled[0].id).toBe('attempt-crashed-1');

      // Recover Payment
      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce({
        id: 'attempt-crashed-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 50000,
        currency: 'INR',
        providerOrderId: 'order_crash_rzp',
        providerPaymentId: 'pay_crash_rzp',
        metadata: JSON.stringify({ items: [{ productId: 'p1', quantity: 2, sellingPrice: 250 }] }),
        saleId: null,
      } as any);

      vi.spyOn(saleService, 'createSale').mockResolvedValueOnce({
        id: 'sale-recovered-1',
        invoiceNumber: 'INV-RECOVERED-1',
      } as any);

      vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      const recoverRes = await paymentGatewayService.recoverPayment('attempt-crashed-1', 'admin-user');

      expect(recoverRes.success).toBe(true);
      expect(recoverRes.alreadyProcessed).toBe(false);
      expect(recoverRes.saleId).toBe('sale-recovered-1');
      expect(recoverRes.invoiceNumber).toBe('INV-RECOVERED-1');
    });
  });

  // ----------------------------------------------------
  // 8. CANCELLATION & CART PRESERVATION
  // ----------------------------------------------------
  describe('8. Cashier Payment Cancellation', () => {
    it('Cancels pending payment attempt and leaves cart intact without posting sale', async () => {
      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce({
        id: 'attempt-cancel-1',
        status: 'PENDING',
        saleId: null,
      } as any);

      const updateSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValueOnce({} as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      const cancelRes = await paymentGatewayService.cancelPaymentAttempt('attempt-cancel-1', 'cashier-1');

      expect(cancelRes.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'attempt-cancel-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            failureCode: 'USER_CANCELLED',
          }),
        })
      );
    });
  });
});
