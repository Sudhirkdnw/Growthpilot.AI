# Payment Gateways Integration Architecture — RS Inventory Solo

## 1. Overview & Architecture

RS Inventory Solo is an offline-first Windows Electron POS application. This document specifies the production implementation and hardening for online payment gateway providers: **Stripe**, **Razorpay**, and **Cashfree**.

### Architectural Layers
```text
React Renderer (OnlineGatewayModal / PosBillingView / AdministrationHubView)
      ↓
Secure Electron Preload (contextBridge whitelist)
      ↓
Electron IPC (gateways:*)
      ↓
Fastify In-Process (fastify.inject() / AuthGuard / RBAC)
      ↓
PaymentGatewayService
      ↓
Provider Adapters (StripeAdapter, RazorpayAdapter, CashfreeAdapter)
      ↓
Native HTTPS / fetch (Zero external gateway SDKs)
      ↓
Gateway APIs (Stripe, Razorpay, Cashfree)
```

---

## 2. Core Concepts: Gateway Provider vs. Payment Method

In accordance with strict financial modeling, **a gateway is never modeled as a payment method**. A payment method describes the financial instrument, whereas a gateway describes the processing provider:

```typescript
type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT';
type GatewayProvider = 'STRIPE' | 'RAZORPAY' | 'CASHFREE';
```

Examples:
- Gateway: `RAZORPAY`, Method: `UPI` (Customer scanned dynamic UPI QR)
- Gateway: `RAZORPAY`, Method: `CARD` (Customer paid via Razorpay hosted checkout card form)
- Gateway: `CASHFREE`, Method: `UPI` (Customer completed payment via Cashfree PG)
- Gateway: `STRIPE`, Method: `CARD` (Customer paid via Stripe Checkout card form)

---

## 3. Provider Adapters

Gateways are isolated behind a unified abstraction (`PaymentGatewayAdapter`):
- `StripeAdapter` (`src/main/modules/gateways/adapters/stripe.adapter.ts`):
  - Uses native `fetch` with Stripe REST API (`/v1/checkout/sessions`, `/v1/balance`, `/v1/refunds`).
  - Capabilities: `hostedCheckout: true`, `card: true`, `qr: false`, `refund: true`.
  - Stripe is never forced into Indian UPI QR models.
- `RazorpayAdapter` (`src/main/modules/gateways/adapters/razorpay.adapter.ts`):
  - Uses native `fetch` with Razorpay REST API (`/v1/orders`, `/v1/payments/qr_codes`, `/v1/payment_links`, `/v1/payments/{id}/refund`).
  - Capabilities: `qr: true`, `upi: true`, `card: true`, `netBanking: true`, `hostedCheckout: true`, `refund: true`.
  - Uses official Razorpay QR / Payment Link endpoints. No fake `upi://` strings.
- `CashfreeAdapter` (`src/main/modules/gateways/adapters/cashfree.adapter.ts`):
  - Uses native `fetch` with Cashfree PG API v2023-08-01 (`/orders`, `/orders/{id}`, `/orders/{id}/payments`, `/orders/{id}/refunds`).
  - Capabilities: `hostedCheckout: true`, `upi: true`, `card: true`, `netBanking: true`, `qr: false`, `refund: true`.
  - Supports Sandbox and Production environments.

---

## 4. Payment Lifecycle & State Machine

A gateway order creation **never** equals payment success. The authoritative flow is strictly enforced:

```text
1. POS Cart Active
   ↓
2. Cashier triggers Online Payment (Stripe / Razorpay / Cashfree)
   ↓
3. Backend creates PaymentAttempt record (status: PENDING, idempotencyKey)
   ↓
4. Provider adapter creates live Gateway Order/Session
   ↓
5. Modal displays dynamic capabilities (QR code / Hosted checkout / Copy link)
   ↓
6. Customer completes payment on phone or hosted portal
   ↓
7. Backend polling & status verification (every 2.5s with 5m timeout)
   ↓
8. Authoritative Backend Verification:
   - Expected minor amount == Reported provider amount
   - Expected currency == Reported provider currency
   - Provider payment ID not previously consumed
   ↓
9. Atomic Local Sale Creation:
   - Sale + SaleItems (historical cost preserved)
   - SalePayment (stores gatewayProvider, providerOrderId, providerPaymentId, paymentAttemptId)
   - Stock Ledger adjustment (real-time balance update)
   - Customer Ledger (if credit due balance exists)
   - Audit Log (PAYMENT_VERIFIED)
   ↓
10. PaymentAttempt status -> SUCCESS (linked to saleId)
   ↓
11. POS clears cart and opens Invoice Preview / Print
```

---

## 5. Security, Credential Storage & RBAC

1. **Encryption at Rest**:
   Gateway secret keys (`secretKey`, `keySecret`, `webhookSecret`) are encrypted at rest in SQLite `app_settings` using AES-256-GCM via `SecretCipher` (`src/main/security/secret.cipher.ts`).
2. **Masked for Renderer**:
   When settings are fetched by the renderer, secrets are masked (`••••••••1234`). Plaintext secrets never leave the main process.
3. **Secret Preservation**:
   When saving unrelated store settings, omitted or masked secrets preserve the encrypted stored secrets.
4. **Audit Protection**:
   Secrets are strictly excluded from audit log payloads.
5. **RBAC Protection**:
   - Gateway testing and credential updates require `settings.payment_gateways.update` (or `ADMIN` role).
   - Manual Payment Override requires `sales.payment_override` permission, a mandatory reason, and writes an immutable `PAYMENT_OVERRIDE` audit event.

---

## 6. Idempotency & Crash Recovery

### Idempotency
- Each payment attempt is assigned an `idempotencyKey` (`IDEM_<provider>_<orderNumber>_<timestamp>`).
- If an order with the same key is submitted, the existing attempt is returned without duplicate gateway orders.
- A single verified `providerPaymentId` can only be consumed once by a local `SalePayment`.

### Crash Recovery & Reconciliation
If the desktop application crashes or powers off immediately after the customer pays but before local sale creation commits:
1. `PaymentAttempt` remains in state `SUCCESS` with `saleId: null`.
2. The reconciliation service (`gateways:unreconciled`) surfaces all unconsumed successful attempts.
3. The cashier or manager clicks **Recover Payment** (`gateways:recover`), which safely reconstructs the local sale from `metadata` and links `saleId`.
4. Subsequent recovery calls idempotently return the existing sale without duplicate inventory deductions.

---

## 7. Offline-First Guarantee

The core POS operates 100% offline:
- If internet is disconnected or gateway APIs are unreachable, cashiers can tender sales with `CASH`, `CARD` (physical EDC), `UPI` (static QR), `BANK_TRANSFER`, or `CREDIT`.
- Gateways show clear failure or timeout badges without crashing or freezing the checkout UI.
