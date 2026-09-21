import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { paymentGatewayService } from '../../src/main/modules/gateways/payment-gateway.service';
import { settingsService } from '../../src/main/modules/settings/settings.service';
import { SecretCipher } from '../../src/main/security/secret.cipher';
import { getPrismaClient } from '../../src/main/database/client';
import { saleService } from '../../src/main/modules/sales/sale.service';
import { roleService } from '../../src/main/modules/auth/role.service';
import { auditService } from '../../src/main/modules/audit/audit.service';
import { stripeAdapter } from '../../src/main/modules/gateways/adapters/stripe.adapter';
import { razorpayAdapter } from '../../src/main/modules/gateways/adapters/razorpay.adapter';
import { cashfreeAdapter } from '../../src/main/modules/gateways/adapters/cashfree.adapter';

describe('Payment Gateways Production Hardening & Integration Test Suite', () => {
  const prisma = getPrismaClient();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------
  // 1. CONFIGURATION, ENCRYPTION & CREDENTIAL SECURITY
  // ----------------------------------------------------
  describe('1. Configuration & Secret Encryption at Rest', () => {
    it('SecretCipher: AES-256-GCM encrypts and decrypts secrets correctly', () => {
      const plaintext = 'sk_live_very_secret_key_123456789';
      const encrypted = SecretCipher.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith('enc:')).toBe(true);

      const decrypted = SecretCipher.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('SecretCipher: masks secrets safely for UI presentation', () => {
      const secret = 'sk_test_51MzAbcDefGh1234';
      const masked = SecretCipher.mask(secret, 4);
      expect(masked).toBe('••••••••1234');
      expect(masked).not.toContain('51Mz');
    });

    it('SettingsService: masks secrets before returning to renderer', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValueOnce({
        gateways: {
          stripe: {
            enabled: true,
            mode: 'TEST',
            publishableKey: 'pk_test_public_key',
            secretKey: 'sk_test_super_secret_key_9999',
            isSecretKeyConfigured: true,
          },
          razorpay: {
            enabled: true,
            mode: 'TEST',
            keyId: 'rzp_test_123',
            keySecret: 'secret_key_secret_8888',
            isKeySecretConfigured: true,
          },
          cashfree: {
            enabled: true,
            mode: 'TEST',
            appId: 'cf_app_id',
            secretKey: 'cf_secret_key_7777',
            isSecretKeyConfigured: true,
          },
        },
      } as any);

      const maskedSettings = await settingsService.getAppSettings();

      // Secrets must be masked with bullet characters
      expect(maskedSettings.gateways.stripe.secretKey).toBe('••••••••9999');
      expect(maskedSettings.gateways.razorpay.keySecret).toBe('••••••••8888');
      expect((maskedSettings.gateways as any).cashfree.secretKey).toBe('••••••••7777');
    });

    it('SettingsService: preserves existing secrets when incoming settings are masked', async () => {
      const rawStored = {
        gateways: {
          stripe: {
            enabled: true,
            mode: 'TEST',
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_original_secret_1234',
          },
        },
      };

      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue(rawStored as any);
      const upsertSpy = vi.spyOn(prisma.appSetting, 'upsert').mockResolvedValue({} as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      await settingsService.updateAppSettings({
        gateways: {
          stripe: {
            enabled: true,
            mode: 'LIVE',
            publishableKey: 'pk_live_new',
            secretKey: '••••••••1234', // Masked from renderer
          },
        } as any,
      });

      expect(upsertSpy).toHaveBeenCalled();
      const savedPayload = JSON.parse(upsertSpy.mock.calls[0][0].create.value);
      // Decrypt saved secret to ensure original was preserved
      const decrypted = SecretCipher.decrypt(savedPayload.gateways.stripe.secretKey);
      expect(decrypted).toBe('sk_test_original_secret_1234');
      expect(savedPayload.gateways.stripe.mode).toBe('LIVE');
    });
  });

  // ----------------------------------------------------
  // 2. AUTHENTICATION & DIAGNOSTIC TEST CONNECTION
  // ----------------------------------------------------
  describe('2. Authentication & Connection Tests', () => {
    it('Stripe: fails when secretKey is missing', async () => {
      const res = await paymentGatewayService.testGateway({
        gateway: 'STRIPE',
        config: { secretKey: '', publishableKey: 'pk_test_123' },
      });
      expect(res.success).toBe(false);
      expect(res.userMessage).toContain('Secret Key');
    });

    it('Stripe: succeeds when live API handshake returns 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ livemode: false, available: [{ amount: 10000, currency: 'inr' }] }),
      } as any);

      const res = await paymentGatewayService.testGateway({
        gateway: 'STRIPE',
        config: { secretKey: 'sk_test_valid_dummy_key' },
      });
      expect(res.success).toBe(true);
      expect(res.userMessage).toContain('Stripe connection verified successfully');
    });

    it('Razorpay: fails when Key ID or Secret is missing', async () => {
      const res = await paymentGatewayService.testGateway({
        gateway: 'RAZORPAY',
        config: { keyId: 'rzp_test_123', keySecret: '' },
      });
      expect(res.success).toBe(false);
      expect(res.userMessage).toContain('required');
    });

    it('Razorpay: succeeds when API returns 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ count: 1, items: [] }),
      } as any);

      const res = await paymentGatewayService.testGateway({
        gateway: 'RAZORPAY',
        config: { keyId: 'rzp_test_123', keySecret: 'secret_456' },
      });
      expect(res.success).toBe(true);
      expect(res.userMessage).toContain('Razorpay connection verified successfully');
    });

    it('Cashfree: fails when App ID or Secret Key is missing', async () => {
      const res = await paymentGatewayService.testGateway({
        gateway: 'CASHFREE',
        config: { appId: '', secretKey: '' },
      });
      expect(res.success).toBe(false);
      expect(res.userMessage).toContain('Both Cashfree App ID and Secret Key are required');
    });

    it('Cashfree: succeeds when API returns 200', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ([]),
      } as any);

      const res = await paymentGatewayService.testGateway({
        gateway: 'CASHFREE',
        config: { appId: 'TEST1002345', secretKey: 'cf_secret_key_999', mode: 'TEST' },
      });
      expect(res.success).toBe(true);
      expect(res.userMessage).toContain('Cashfree PG connection verified successfully');
    });
  });

  // ----------------------------------------------------
  // 3. PAYMENT ATTEMPT CREATION & IDEMPOTENCY
  // ----------------------------------------------------
  describe('3. Payment Attempt Creation & Idempotency', () => {
    it('Creates PaymentAttempt with minor units, currency, and PENDING status', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          stripe: {
            enabled: true,
            mode: 'TEST',
            publishableKey: 'pk_test_123',
            secretKey: 'sk_test_mock_secret',
          },
        },
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cs_test_mock_session_123',
          url: 'https://checkout.stripe.com/c/pay/cs_test_mock_session_123',
          status: 'open',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      } as any);

      const attemptSpy = vi.spyOn(prisma.paymentAttempt, 'create').mockResolvedValueOnce({
        id: 'attempt-uuid-1',
        provider: 'STRIPE',
        method: 'CARD',
        amountMinor: 10050,
        currency: 'INR',
        status: 'PENDING',
        idempotencyKey: 'IDEM_123',
        providerOrderId: 'cs_test_mock_session_123',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_mock_session_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce(null);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      const res = await paymentGatewayService.createPaymentAttempt({
        gateway: 'STRIPE',
        amount: 100.50, // ₹100.50 -> 10050 paise
        currency: 'INR',
        orderNumber: 'INV-1001',
        idempotencyKey: 'IDEM_123',
      });

      expect(res.success).toBe(true);
      expect(res.orderId).toBe('cs_test_mock_session_123');
      expect(res.checkoutUrl).toContain('checkout.stripe.com');
      expect(attemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'STRIPE',
            amountMinor: 10050,
            currency: 'INR',
            status: 'PENDING',
            idempotencyKey: 'IDEM_123',
          }),
        })
      );
    });

    it('Idempotency: Re-submitting same idempotencyKey returns existing attempt without calling gateway', async () => {
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          stripe: {
            enabled: true,
            mode: 'TEST',
            secretKey: 'sk_test_123',
          },
        },
      } as any);

      const existingAttempt = {
        id: 'attempt-existing-99',
        provider: 'STRIPE',
        method: 'CARD',
        amountMinor: 50000,
        currency: 'INR',
        status: 'PENDING',
        idempotencyKey: 'IDEM_REPEAT_KEY',
        providerOrderId: 'cs_existing_order_555',
        checkoutUrl: 'https://checkout.stripe.com/existing',
      };

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce(existingAttempt as any);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const res = await paymentGatewayService.createPaymentAttempt({
        gateway: 'STRIPE',
        amount: 500,
        currency: 'INR',
        idempotencyKey: 'IDEM_REPEAT_KEY',
      });

      expect(res.success).toBe(true);
      expect(res.orderId).toBe('cs_existing_order_555');
      expect(res.attemptId).toBe('attempt-existing-99');
      // Must NOT make an external fetch request to Stripe again
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------
  // 4. PROVIDER CAPABILITIES & OFFICIAL FLOWS
  // ----------------------------------------------------
  describe('4. Provider Capabilities Dynamic Reporting', () => {
    it('Stripe: exposes hosted checkout & card; does NOT force UPI QR', () => {
      const caps = stripeAdapter.getCapabilities();
      expect(caps.card).toBe(true);
      expect(caps.hostedCheckout).toBe(true);
      expect(caps.qr).toBe(false); // Stripe does not have UPI QR
    });

    it('Razorpay: exposes card, upi, qr, hostedCheckout', () => {
      const caps = razorpayAdapter.getCapabilities();
      expect(caps.upi).toBe(true);
      expect(caps.qr).toBe(true);
      expect(caps.card).toBe(true);
      expect(caps.hostedCheckout).toBe(true);
    });

    it('Cashfree: exposes hosted checkout, card, upi', () => {
      const caps = cashfreeAdapter.getCapabilities();
      expect(caps.hostedCheckout).toBe(true);
      expect(caps.upi).toBe(true);
      expect(caps.card).toBe(true);
      expect(caps.qr).toBe(false);
    });
  });

  // ----------------------------------------------------
  // 5. STATUS VERIFICATION & AUTHORITATIVE SALE CREATION
  // ----------------------------------------------------
  describe('5. Authoritative Backend Verification & Local Sale Commit', () => {
    it('Amount mismatch between Gateway and local attempt is strictly rejected', async () => {
      const mockAttempt = {
        id: 'attempt-mismatch-1',
        provider: 'RAZORPAY',
        providerOrderId: 'order_rzp_123',
        amountMinor: 20000, // Expected ₹200.00
        currency: 'INR',
        status: 'PENDING',
        saleId: null,
      };

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce(mockAttempt as any);
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: { razorpay: { keyId: 'rzp_id', keySecret: 'rzp_sec' } },
      } as any);

      // Provider reports only ₹100.00 (10000 paise) instead of ₹200.00
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          items: [{ id: 'pay_underpaid', status: 'captured', amount: 10000 }],
        }),
      } as any);

      const updateSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValue({} as any);
      const auditSpy = vi.spyOn(auditService, 'log').mockResolvedValue();

      const res = await paymentGatewayService.checkPaymentStatus({
        gateway: 'RAZORPAY',
        attemptId: 'attempt-mismatch-1',
      });

      expect(res.status).toBe('FAILED');
      expect(res.message).toContain('Payment amount mismatch');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            failureCode: 'PAYMENT_AMOUNT_MISMATCH',
          }),
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'PAYMENT_AMOUNT_MISMATCH',
        })
      );
    });

    it('Duplicate provider payment ID is rejected from creating a duplicate sale', async () => {
      const mockAttempt = {
        id: 'attempt-dup-1',
        provider: 'STRIPE',
        providerOrderId: 'cs_order_dup',
        amountMinor: 5000,
        currency: 'INR',
        status: 'PENDING',
        saleId: null,
      };

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce(mockAttempt as any);
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: { stripe: { secretKey: 'sk_test_dummy' } },
      } as any);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cs_order_dup',
          payment_status: 'paid',
          amount_total: 5000,
          currency: 'inr',
          payment_intent: 'pi_already_used_999',
        }),
      } as any);

      // SalePayment already exists with this payment_intent
      vi.spyOn(prisma.salePayment, 'findFirst').mockResolvedValueOnce({
        id: 'salepay-1',
        saleId: 'sale-original-1',
        providerPaymentId: 'pi_already_used_999',
      } as any);

      const createSaleSpy = vi.spyOn(saleService, 'createSale');

      const res = await paymentGatewayService.checkPaymentStatus({
        gateway: 'STRIPE',
        attemptId: 'attempt-dup-1',
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.saleId).toBe('sale-original-1');
      expect(res.message).toContain('already processed');
      expect(createSaleSpy).not.toHaveBeenCalled();
    });

    it('Verified payment creates local Sale atomically and links saleId to PaymentAttempt', async () => {
      const mockSalePayload = {
        customerId: null,
        items: [{ productId: 'c2e64627-cff0-40e1-b4c4-f06b6a03e5c7', quantity: 1, sellingPrice: 350 }],
        discount: 0,
        tax: 0,
        paidAmount: 350,
      };

      const mockAttempt = {
        id: 'attempt-success-1',
        provider: 'CASHFREE',
        providerOrderId: 'CF_INV_888',
        amountMinor: 35000,
        currency: 'INR',
        status: 'PENDING',
        saleId: null,
        metadata: JSON.stringify(mockSalePayload),
      };

      vi.spyOn(prisma.paymentAttempt, 'findFirst').mockResolvedValueOnce(mockAttempt as any);
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: { cashfree: { appId: 'cf_id', secretKey: 'cf_sec', mode: 'TEST' } },
      } as any);

      // Mock Cashfree Order status: PAID
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            order_id: 'CF_INV_888',
            cf_order_id: 1234567,
            order_status: 'PAID',
            order_amount: 350.00,
            order_currency: 'INR',
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ cf_payment_id: 987654, payment_status: 'SUCCESS', payment_group: 'upi' }]),
        } as any);

      vi.spyOn(prisma.salePayment, 'findFirst').mockResolvedValueOnce(null);

      const mockCreatedSale = {
        id: 'sale-new-123',
        invoiceNumber: 'INV-000888',
        grandTotal: 350,
        paidAmount: 350,
      };
      vi.spyOn(saleService, 'createSale').mockResolvedValueOnce(mockCreatedSale as any);
      const updateAttemptSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValue({} as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      const res = await paymentGatewayService.checkPaymentStatus({
        gateway: 'CASHFREE',
        attemptId: 'attempt-success-1',
      });

      expect(res.status).toBe('SUCCESS');
      expect(res.saleCreated).toBe(true);
      expect(res.saleId).toBe('sale-new-123');
      expect(res.invoiceNumber).toBe('INV-000888');
      expect(updateAttemptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
            saleId: 'sale-new-123',
          }),
        })
      );
    });
  });

  // ----------------------------------------------------
  // 6. CRASH RECOVERY & RECONCILIATION
  // ----------------------------------------------------
  describe('6. Crash Recovery & Reconciliation', () => {
    it('Finds unreconciled payments (Gateway SUCCESS + Local Sale missing)', async () => {
      vi.spyOn(prisma.paymentAttempt, 'findMany').mockResolvedValueOnce([
        {
          id: 'attempt-crashed-1',
          provider: 'RAZORPAY',
          method: 'UPI',
          amountMinor: 15000,
          currency: 'INR',
          status: 'SUCCESS',
          idempotencyKey: 'IDEM_CRASH_1',
          providerOrderId: 'order_crashed_1',
          providerPaymentId: 'pay_crashed_1',
          saleId: null, // Local sale missing!
          metadata: JSON.stringify({ items: [] }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);

      const unreconciled = await paymentGatewayService.getUnreconciledPayments();
      expect(unreconciled.length).toBe(1);
      expect(unreconciled[0].id).toBe('attempt-crashed-1');
      expect(unreconciled[0].saleId).toBeNull();
    });

    it('RecoverPayment: reconstructs local sale once and avoids duplicates on retry', async () => {
      const mockAttempt = {
        id: 'attempt-crashed-1',
        provider: 'RAZORPAY',
        method: 'UPI',
        amountMinor: 15000,
        currency: 'INR',
        status: 'SUCCESS',
        providerOrderId: 'order_crashed_1',
        providerPaymentId: 'pay_crashed_1',
        saleId: null,
        metadata: JSON.stringify({
          customerId: null,
          items: [{ productId: 'c2e64627-cff0-40e1-b4c4-f06b6a03e5c7', quantity: 1, sellingPrice: 150 }],
        }),
      };

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce(mockAttempt as any);

      const mockSale = { id: 'sale-recovered-1', invoiceNumber: 'INV-REC-01' };
      const createSaleSpy = vi.spyOn(saleService, 'createSale').mockResolvedValueOnce(mockSale as any);
      const updateSpy = vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValue({} as any);
      vi.spyOn(auditService, 'log').mockResolvedValue();

      // First recovery creates sale
      const firstRecovery = await paymentGatewayService.recoverPayment('attempt-crashed-1', 'user-admin');
      expect(firstRecovery.success).toBe(true);
      expect(firstRecovery.alreadyProcessed).toBe(false);
      expect(firstRecovery.saleId).toBe('sale-recovered-1');
      expect(createSaleSpy).toHaveBeenCalledTimes(1);

      // Second recovery for already reconciled attempt returns existing sale without duplicate
      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce({
        ...mockAttempt,
        saleId: 'sale-recovered-1',
      } as any);
      vi.spyOn(prisma.sale, 'findUnique').mockResolvedValueOnce({
        id: 'sale-recovered-1',
        invoiceNumber: 'INV-REC-01',
      } as any);

      const secondRecovery = await paymentGatewayService.recoverPayment('attempt-crashed-1', 'user-admin');
      expect(secondRecovery.success).toBe(true);
      expect(secondRecovery.alreadyProcessed).toBe(true);
      expect(secondRecovery.saleId).toBe('sale-recovered-1');
      // Must NOT have called createSale a second time
      expect(createSaleSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------
  // 7. MANUAL PAYMENT OVERRIDE & RBAC
  // ----------------------------------------------------
  describe('7. Manual Payment Override & RBAC Protection', () => {
    it('Rejects cashier without sales.payment_override permission', async () => {
      vi.spyOn(roleService, 'hasPermission').mockResolvedValueOnce(false);

      const cashierSession = {
        user: { id: 'u-cashier-1', role: 'CASHIER', username: 'cashier1' },
      };

      await expect(
        paymentGatewayService.manualPaymentOverride(
          {
            paymentAttemptId: 'attempt-1',
            newPaymentMethod: 'CASH',
            reason: 'Customer paid cash directly',
          },
          cashierSession as any
        )
      ).rejects.toThrow('sales.payment_override');
    });

    it('Authorized manager can override payment with required reason and audit log', async () => {
      vi.spyOn(roleService, 'hasPermission').mockResolvedValueOnce(true);

      const mockAttempt = {
        id: 'attempt-override-1',
        provider: 'RAZORPAY',
        amountMinor: 25000,
        status: 'PENDING',
        saleId: null,
        metadata: JSON.stringify({
          customerId: null,
          items: [{ productId: 'c2e64627-cff0-40e1-b4c4-f06b6a03e5c7', quantity: 1, sellingPrice: 250 }],
        }),
      };

      vi.spyOn(prisma.paymentAttempt, 'findUnique').mockResolvedValueOnce(mockAttempt as any);
      vi.spyOn(saleService, 'createSale').mockResolvedValueOnce({
        id: 'sale-overridden-1',
        invoiceNumber: 'INV-OVR-01',
      } as any);
      vi.spyOn(prisma.paymentAttempt, 'update').mockResolvedValue({} as any);
      const auditSpy = vi.spyOn(auditService, 'log').mockResolvedValue();

      const managerSession = {
        user: { id: 'u-mgr-1', role: 'MANAGER', username: 'manager1' },
      };

      const res = await paymentGatewayService.manualPaymentOverride(
        {
          paymentAttemptId: 'attempt-override-1',
          newPaymentMethod: 'CASH',
          reason: 'Customer opted to pay in cash after bank gateway timeout',
        },
        managerSession as any
      );

      expect(res.success).toBe(true);
      expect(res.saleId).toBe('sale-overridden-1');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_OVERRIDE',
          reason: expect.stringContaining('Customer opted to pay in cash'),
        })
      );
    });
  });

  // ----------------------------------------------------
  // 8. OFFLINE-FIRST GUARANTEE
  // ----------------------------------------------------
  describe('8. Offline-First Guarantee', () => {
    it('Disabled or unreachable gateway does not hinder manual CASH sale checkout', async () => {
      // Mock gateway resolution showing all gateways disabled
      vi.spyOn(settingsService, 'getRawAppSettings').mockResolvedValue({
        gateways: {
          stripe: { enabled: false },
          razorpay: { enabled: false },
          cashfree: { enabled: false },
        },
      } as any);

      // Standard sale creation through SaleService continues smoothly without touching network
      const saleResult = await saleService.calculateSaleTotals(
        [{ productId: 'dummy-prod', quantity: 2, sellingPrice: 100 }],
        0,
        0,
        200,
        'CASH'
      );

      expect(saleResult.total).toBe(200);
      expect(saleResult.paidAmount).toBe(200);
      expect(saleResult.dueAmount).toBe(0);
    });
  });
});
