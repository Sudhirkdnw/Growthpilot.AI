// Domain and DTO types shared between Main, Preload and Renderer

export type Role = 'ADMIN' | 'CASHIER' | 'MANAGER' | (string & {});
export type Status = 'ACTIVE' | 'INACTIVE';

export interface RoleDTO {
  id: string;
  name: string;
  description?: string | null;
  status: Status;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  userCount: number;
  permissionCount: number;
}

export interface RoleDetailDTO extends RoleDTO {
  permissions: string[];
}

export interface CreateRoleDTO {
  name: string;
  description?: string;
  permissions: string[];
  status?: Status;
}

export interface UpdateRoleDTO {
  name?: string;
  description?: string;
  permissions?: string[];
  status?: Status;
}


export type StockTransactionType =
  | 'OPENING'
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CREDIT';


export type TransactionStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type WhatsAppStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

// Auth DTOs
export interface UserDTO {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: Status;
  createdAt: string;
}

export interface SessionInfo {
  token: string;
  user: UserDTO;
  expiresAt: string;
}

export interface AuthResult {
  success: boolean;
  session?: SessionInfo;
  error?: string;
}

// Master Data DTOs
export interface CategoryDTO {
  id: string;
  name: string;
  description?: string | null;
  status: Status;
  createdAt: string;
  productCount?: number;
}

export interface BrandDTO {
  id: string;
  name: string;
  status: Status;
  createdAt: string;
  productCount?: number;
}

export interface UnitDTO {
  id: string;
  name: string;
  shortCode: string;
  allowDecimal: boolean;
  status: Status;
  productCount?: number;
}

export interface ProductDTO {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  unitId: string;
  unitCode?: string;
  allowDecimal?: boolean;
  purchasePrice: number;
  salePrice: number;
  taxRate: number;
  openingStock: number;
  reorderLevel: number;
  currentStock: number;
  status: Status;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// POS & Cart DTOs
export interface CartItemDTO {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string | null;
  quantity: number;
  unitPrice: number;
  costPrice: number; // captured historical cost
  taxRate: number;
  discount: number;
  lineTotal: number;
  allowDecimal: boolean;
}

export interface CreateSaleDTO {
  customerId?: string | null;
  items: {
    productId: string;
    quantity: number;
    sellingPrice: number;
    discount?: number;
    taxRate?: number;
  }[];
  discount?: number;
  tax?: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  allowNegativeStockOverride?: boolean;
}

export interface SaleSummaryDTO {
  id: string;
  invoiceNumber: string;
  customerName: string;
  saleDate: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  itemCount: number;
}

export interface SaleDetailDTO extends SaleSummaryDTO {
  subtotal: number;
  discount: number;
  tax: number;
  notes?: string | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    sellingPrice: number;
    costPrice: number;
    discount: number;
    taxRate: number;
    lineTotal: number;
  }[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    reference?: string | null;
    gatewayProvider?: GatewayProvider | null;
    providerOrderId?: string | null;
    providerPaymentId?: string | null;
    paymentAttemptId?: string | null;
    createdAt: string;
  }[];
}

export interface PurchaseSummaryDTO {
  id: string;
  purchaseNumber: string;
  supplierId?: string | null;
  supplierName: string;
  purchaseDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  itemCount: number;
  createdAt: string;
}

export interface PurchaseItemDTO {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  purchasePrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PurchaseDetailDTO extends PurchaseSummaryDTO {
  notes?: string | null;
  items: PurchaseItemDTO[];
  payments: {
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    createdAt: string;
  }[];
}

export interface CreatePurchaseItemInputDTO {
  productId: string;
  quantity: number;
  purchasePrice: number;
  discount?: number;
  taxRate?: number;
}

export interface CreatePurchaseDTO {
  supplierId?: string | null;
  purchaseNumber?: string;
  items: CreatePurchaseItemInputDTO[];
  discount?: number;
  tax?: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

// Inventory & Ledger DTOs
export interface StockLedgerDTO {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  transactionType: StockTransactionType;
  referenceId: string;
  quantityChange: number;
  balanceAfter: number;
  notes?: string | null;
  createdAt: string;
}

export interface StockAdjustmentDTO {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  reason: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
}

export interface StockSummaryDTO {
  totalProducts: number;
  totalStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface LowStockProductDTO {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryName?: string | null;
  currentStock: number;
  reorderLevel: number;
  unitCode: string;
  difference: number;
  purchasePrice: number;
  stockStatus: 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface StockReconciliationDTO {
  productId: string;
  productName: string;
  sku: string;
  cachedBalance: number;
  calculatedBalance: number;
  isBalanced: boolean;
  discrepancy: number;
  totalMovements: number;
}

export interface AdjustmentInputDTO {
  productId: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantity: number;
  reason: string;
  notes?: string | null;
  allowNegativeStockOverride?: boolean;
}

// Customers & Suppliers DTOs
export interface CustomerDTO {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  openingBalance: number;
  currentBalance: number;
  status: Status;
  createdAt: string;
}

export interface CustomerLedgerDTO {
  id: string;
  customerId: string;
  type: string; // INVOICE, PAYMENT_RECEIVED, SALES_RETURN, OPENING_BALANCE, PAYMENT_REVERSED, ADJUSTMENT
  referenceId: string;
  debit: number;   // Increases customer balance owed
  credit: number;  // Decreases customer balance owed
  balance: number; // Running balance
  notes?: string | null;
  createdAt: string;
}

export interface CustomerPaymentDTO {
  id: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  paymentDate: string;
  createdAt: string;
}

export interface CustomerStatementDTO {
  customer: CustomerDTO;
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  entries: CustomerLedgerDTO[];
}

export interface CustomerReceivablesSummaryDTO {
  totalReceivables: number;
  totalCustomers: number;
  customersWithOutstanding: number;
  fullyPaidCustomers: number;
  topDebtors: Array<{
    id: string;
    name: string;
    phone?: string | null;
    outstanding: number;
  }>;
}

export interface CustomerReconciliationDTO {
  customerId: string;
  customerName: string;
  cachedBalance: number;
  calculatedBalance: number;
  isBalanced: boolean;
  discrepancy: number;
}

export interface SupplierDTO {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  openingBalance: number;
  currentBalance: number;
  status: Status;
  createdAt: string;
}

export interface SupplierLedgerDTO {
  id: string;
  supplierId: string;
  type: string; // PURCHASE, PAYMENT, PURCHASE_RETURN, OPENING_BALANCE, ADJUSTMENT
  referenceId: string;
  debit: number;
  credit: number;
  balance: number;
  notes?: string | null;
  createdAt: string;
}

export interface SupplierPaymentDTO {
  id: string;
  supplierId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  paymentDate: string;
  createdAt: string;
}

// Expense & Profit DTOs
export interface ExpenseCategoryDTO {
  id: string;
  name: string;
  description?: string | null;
  status: Status;
  createdAt: string;
  expenseCount?: number;
}

export interface ExpenseDTO {
  id: string;
  expenseNumber: string;
  categoryId: string;
  categoryName?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  description: string;
  reference?: string | null;
  status: 'POSTED' | 'CANCELLED';
  cancellationReason?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface ProfitSummaryDTO {
  period: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  salesReturns: number;
  netSales: number;
  cogs: number; // Historical cost of goods sold net of returns
  grossProfit: number; // netSales - cogs
  totalExpenses: number; // Operating expenses in period
  netProfit: number; // grossProfit - totalExpenses
  grossMarginPercent: number; // (grossProfit / netSales) * 100
  netMarginPercent: number; // (netProfit / netSales) * 100
  totalSalesCount: number;
  totalReturnsCount: number;
  totalExpensesCount: number;
}

// Settings DTOs
export interface CompanySettings {
  shopName: string;
  address: string;
  phone: string;
  email?: string;
  gstin?: string;
  currency: string;
  currencySymbol: string;
  logoPath?: string;
}

export interface InvoiceSettings {
  prefix: string;
  startingSequence: number;
  format: 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM';
  footerNotes: string;
  termsAndConditions: string;
}

export interface PosSettings {
  defaultPaymentMethod: PaymentMethod;
  negativeStockPolicy: 'BLOCK' | 'ALLOW_WITH_WARNING';
  defaultReorderLevel: number;
  scanner: {
    enabled: boolean;
    minBarcodeLength: number;
    interCharTimingThresholdMs: number;
    bufferTimeoutMs: number;
  };
}

export interface BackupSettings {
  backupDirectory: string;
  autoBackupDaily: boolean;
  retentionCount: number;
}

export interface BackupMetadataDTO {
  filename: string;
  filePath: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  createdAt: string;
  sha256Checksum: string;
  integrityStatus: 'VALID' | 'CORRUPT' | 'UNKNOWN';
  tableCount: number;
  isPreRestoreSafety: boolean;
}

export interface BackupVerifyResultDTO {
  ok: boolean;
  message: string;
  tableCount: number;
  tables: string[];
  sha256Checksum: string;
}

export interface RestoreResultDTO {
  success: boolean;
  message: string;
  safetyBackupPath: string;
  restoredAt: string;
}

export interface PrinterSettings {
  printerName: string; // empty or specific Windows printer name
  paperFormat: 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM';
  copies: number;
  silent: boolean;
  showPreview: boolean;
}

export interface BrandingSettings {
  appName: string;
  footerText: string;
  accentColor: string; // e.g. '#F97316'
  accentTextColor?: string; // e.g. '#FFFFFF'
  textColor?: string; // Base primary text color
  theme: 'light' | 'dark' | 'system' | 'LIGHT' | 'DARK' | 'SYSTEM';
  lightLogoUrl?: string;
  darkLogoUrl?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  collapsedIconUrl?: string;
  collapsedIconDarkUrl?: string;
  collapsedLogoUrl?: string;
  collapsedLogoDarkUrl?: string;
  faviconUrl?: string;
}

export interface RegionalSettings {
  timezone: string; // e.g. 'Asia/Kolkata', 'UTC'
  dateFormat: string; // 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h';
  financialYearStartMonth: number; // 1 - 12 (default 4 for April)
}

export interface CurrencySettings {
  baseCurrency: string; // 'INR', 'USD', etc.
  symbol: string; // '₹', '$', '€', etc.
  decimalPlaces: number; // 0, 2, 3
  thousandSeparator: string; // ',' | '.' | ' '
  decimalSeparator: string; // '.' | ','
  symbolPosition: 'prefix' | 'suffix';
}

export interface ReceiptSettings {
  paperSize: '58mm' | '80mm' | 'A4';
  showLogo: boolean;
  showCustomerDetails: boolean;
  showCashier: boolean;
  showTaxBreakdown: boolean;
  showBarcode: boolean;
  showQrCode: boolean;
  showSku: boolean;
  showHsn: boolean;
  showHsnTaxSummary: boolean;
  headerText: string;
  footerText: string;
  returnPolicy: string;
}

export interface CashierPosSettings {
  cartPosition: 'beam' | 'lane' | 'counter';
  tileSize: 'compact' | 'comfortable' | 'spacious';
  theme: 'auto' | 'light' | 'dark';
  defaultCategoryId: string;
}

export interface SecuritySettings {
  singleSessionPerAccount: boolean;
  sessionTimeoutMinutes: number;
}

export interface CustomScriptsSettings {
  enabled: boolean;
  headerScript: string;
  footerScript: string;
}

export interface WeighingScaleSettings {
  enabled: boolean;
  prefix: string;
  pluDigits: number;
  digitsToSkip: number;
  valueDigits: number;
  valueDecimals: number;
  embeddedValue: 'WEIGHT' | 'TOTAL_PRICE';
}

export interface StockLocationsSettings {
  enabled: boolean;
  fields: {
    aisle: { enabled: boolean; label: string };
    rack: { enabled: boolean; label: string };
    shelf: { enabled: boolean; label: string };
    bin: { enabled: boolean; label: string };
  };
  locationTypes: string[];
}

export interface LoyaltySettings {
  enabled: boolean;
  pointsPerAmount: number;
  amountThreshold: number;
  earnOn: 'GRAND_TOTAL' | 'SUBTOTAL';
  expirationMonths: number;
  redemptionPoints: number;
  redemptionValue: number;
  minRedeemBalance: number;
  maxRedeemSalePercentage: number;
}

export interface PricingSettings {
  pricingMode: 'PRODUCT_BASED' | 'BATCH_WISE';
  defaultUpdateSellingPricesOnReceive: boolean;
}

export interface NumberingSettings {
  saleInvoiceFormat: string;
  heldOrderFormat: string;
  quotationFormat: string;
  refundFormat: string;
  skuPrefix: string;
  inStoreBarcodePrefix: string;
}

export interface SmtpSettings {
  driver: 'LOG' | 'SMTP';
  host: string;
  port: number;
  username: string;
  password?: string;
  isPasswordConfigured?: boolean;
  encryption: 'NONE' | 'TLS' | 'SSL';
  fromAddress: string;
  fromName: string;
}

export interface WhatsAppSettings {
  mode: 'CLICK_TO_CHAT' | 'CLOUD_API';
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
  isTokenConfigured?: boolean;
  metaAppSecret?: string;
  webhookVerifyToken?: string;
  templates: {
    saleReceipt: string;
    quotation: string;
    creditNote: string;
    customerStatement: string;
    paymentReceipt: string;
  };
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  type: PaymentMethod;
  requiresReference: boolean;
  active: boolean;
  upiVpa?: string;
  upiPayeeName?: string;
}

export interface PaymentGatewaySettings {
  stripe: {
    enabled: boolean;
    mode: 'TEST' | 'LIVE';
    publishableKey: string;
    secretKey?: string;
    isSecretKeyConfigured?: boolean;
    webhookSecret?: string;
  };
  razorpay: {
    enabled: boolean;
    mode: 'TEST' | 'LIVE';
    keyId: string;
    keySecret?: string;
    isKeySecretConfigured?: boolean;
    webhookSecret?: string;
  };
  cashfree: {
    enabled: boolean;
    mode: 'TEST' | 'LIVE';
    appId: string;
    secretKey?: string;
    isSecretKeyConfigured?: boolean;
  };
  paystack: {
    enabled: boolean;
    mode: 'TEST' | 'LIVE';
    publicKey: string;
    secretKey?: string;
    isSecretKeyConfigured?: boolean;
  };
}

// ----------------------------------------------------
// Payment Gateway DTOs (Stripe, Razorpay, Cashfree)
// ----------------------------------------------------

export type GatewayProvider = 'STRIPE' | 'RAZORPAY' | 'CASHFREE';

export interface GatewayCapabilities {
  card: boolean;
  upi: boolean;
  netBanking: boolean;
  hostedCheckout: boolean;
  paymentLink: boolean;
  qr: boolean;
  refund: boolean;
}

export type PaymentAttemptStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface PaymentAttemptDTO {
  id: string;
  provider: GatewayProvider;
  method: PaymentMethod;
  amountMinor: number;
  currency: string;
  status: PaymentAttemptStatus;
  idempotencyKey: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  checkoutUrl?: string | null;
  paymentLinkUrl?: string | null;
  qrPayload?: string | null;
  expiresAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  metadata?: any;
  saleId?: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
}

export interface GatewayTestRequestDTO {
  gateway: GatewayProvider;
  config?: any;
}

export interface GatewayTestResponseDTO {
  success: boolean;
  provider: GatewayProvider;
  mode: string;
  errorCode?: string;
  userMessage?: string;
  message?: string; // Backwards compatibility for UI toasts
  latencyMs?: number;
}

export interface CreatePaymentAttemptRequestDTO {
  gateway: GatewayProvider;
  method?: PaymentMethod;
  amount: number; // in major units (e.g. 100.50)
  currency?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  salePayload?: any; // POS cart/sale payload to be created atomically on success
  idempotencyKey?: string;
}

export interface PaymentStatusResultDTO {
  status: PaymentAttemptStatus;
  providerPaymentId?: string;
  providerOrderId?: string;
  method?: PaymentMethod;
  amountMinor?: number;
  currency?: string;
  failureCode?: string;
  failureMessage?: string;
  rawStatus?: string;
}

export interface ManualPaymentOverrideDTO {
  paymentAttemptId: string;
  newPaymentMethod: PaymentMethod;
  reason: string;
}

export interface RecoverPaymentResponseDTO {
  success: boolean;
  alreadyProcessed: boolean;
  saleId?: string;
  invoiceNumber?: string;
  error?: string;
}

// Backwards-compatible aliases for UI components
export interface CreateGatewayOrderRequestDTO {
  gateway: GatewayProvider;
  amount: number;
  currency?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  salePayload?: any;
}

export interface GatewayOrderResponseDTO {
  success: boolean;
  gateway: GatewayProvider;
  orderId: string;
  attemptId?: string;
  amount: number;
  currency: string;
  checkoutUrl?: string;
  paymentLinkUrl?: string;
  qrCodeData?: string;
  paymentSessionId?: string;
  capabilities?: GatewayCapabilities;
  error?: string;
}

export interface GatewayStatusCheckResponseDTO {
  success: boolean;
  gateway: GatewayProvider;
  orderId: string;
  attemptId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  paidAmount?: number;
  transactionRef?: string;
  saleCreated?: boolean;
  saleId?: string;
  invoiceNumber?: string;
  message?: string;
}


export interface SchedulerSettings {
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  lowStockAlertsEnabled: boolean;
  updateChecksEnabled: boolean;
}

export interface UpdateSettings {
  currentVersion: string;
  releaseChannel: 'STABLE' | 'BETA';
  autoCheckUpdates: boolean;
  autoInstallPatches: boolean;
  lastCheckedAt?: string;
}

export interface LicenseSettings {
  purchaseCode?: string;
  isConfigured: boolean;
  status: 'ACTIVE' | 'UNLICENSED' | 'GRACE_PERIOD' | 'EXPIRED';
  licenseeName?: string;
  registeredAt?: string;
  validUntil?: string;
  offlineGraceDaysRemaining: number;
}

export interface LegalSettings {
  privacyPolicyHtml: string;
  termsOfServiceHtml: string;
}

export interface StoreProfileSettings {
  storeName: string;
  legalName: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface TerminalSettings {
  terminalName: string;
  active: boolean;
  defaultPrinter: string;
}

export interface UserManagementDTO {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: Status;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CreateUserDTO {
  username: string;
  password: string;
  fullName: string;
  role: Role;
}

export interface UpdateUserDTO {
  fullName?: string;
  role?: Role;
  status?: Status;
  password?: string;
}

export interface SystemHealthDTO {
  databaseIntegrity: 'OK' | 'ERROR';
  databaseSizeBytes: number;
  databaseSizeFormatted: string;
  diskFreeBytes: number;
  diskFreeFormatted: string;
  appVersion: string;
  schemaVersion: string;
  lastBackupDate?: string;
  lastBackupStatus: string;
  tableCounts: Record<string, number>;
  uptimeSeconds: number;
}

export interface AppSettingsDTO {
  company: CompanySettings;
  invoice: InvoiceSettings;
  pos: PosSettings;
  backup: BackupSettings;
  printer?: PrinterSettings;
  branding: BrandingSettings;
  regional: RegionalSettings;
  currency: CurrencySettings;
  receipt: ReceiptSettings;
  cashierPos: CashierPosSettings;
  security: SecuritySettings;
  scripts: CustomScriptsSettings;
  scale: WeighingScaleSettings;
  stockLocations: StockLocationsSettings;
  loyalty: LoyaltySettings;
  pricing: PricingSettings;
  numbering: NumberingSettings;
  smtp: SmtpSettings;
  whatsapp: WhatsAppSettings;
  paymentMethods: PaymentMethodConfig[];
  gateways: PaymentGatewaySettings;
  scheduler: SchedulerSettings;
  updates: UpdateSettings;
  license: LicenseSettings;
  legal: LegalSettings;
  store: StoreProfileSettings;
  terminal: TerminalSettings;
}

// Pagination generic
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ----------------------------------------------------
// Returns DTOs
// ----------------------------------------------------

export type RefundMethod = 'CASH_REFUND' | 'CUSTOMER_CREDIT';

export interface ReturnableSaleItemDTO {
  saleItemId: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  unitCode: string;
  soldQuantity: number;
  previouslyReturnedQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SaleReturnableDetailsDTO {
  saleId: string;
  invoiceNumber: string;
  saleDate: string;
  customerId: string | null;
  customerName: string;
  paymentMethod: PaymentMethod;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: TransactionStatus;
  items: ReturnableSaleItemDTO[];
}

export interface SalesReturnItemDTO {
  id: string;
  salesReturnId: string;
  saleItemId?: string | null;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SalesReturnSummaryDTO {
  id: string;
  returnNumber: string;
  saleId: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName: string;
  returnDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  refundType: 'CASH_REFUND' | 'CUSTOMER_CREDIT';
  status: 'POSTED' | 'CANCELLED';
  itemCount: number;
  createdAt: string;
}

export interface SalesReturnDetailDTO extends SalesReturnSummaryDTO {
  notes?: string | null;
  items: SalesReturnItemDTO[];
}

export interface ReturnablePurchaseItemDTO {
  purchaseItemId: string;
  productId: string;
  productName: string;
  sku: string;
  unitCode: string;
  purchasedQuantity: number;
  previouslyReturnedQuantity: number;
  returnableQuantity: number;
  currentStock: number;
  purchasePrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PurchaseReturnableDetailsDTO {
  purchaseId: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string | null;
  supplierName: string;
  paymentMethod: PaymentMethod;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: TransactionStatus;
  items: ReturnablePurchaseItemDTO[];
}

export interface PurchaseReturnItemDTO {
  id: string;
  purchaseReturnId: string;
  purchaseItemId?: string | null;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PurchaseReturnSummaryDTO {
  id: string;
  returnNumber: string;
  purchaseId: string;
  purchaseNumber: string;
  supplierId?: string | null;
  supplierName: string;
  returnDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  refundType: 'SUPPLIER_PAYABLE_DEDUCTION' | 'CASH_REFUND';
  status: 'POSTED' | 'CANCELLED';
  itemCount: number;
  createdAt: string;
}

export interface PurchaseReturnDetailDTO extends PurchaseReturnSummaryDTO {
  notes?: string | null;
  items: PurchaseReturnItemDTO[];
}

// ----------------------------------------------------
// PHASE 11 — REPORTS & BUSINESS INTELLIGENCE DTOs
// ----------------------------------------------------

export interface DashboardMetricsDTO {
  // Today Sales
  todayGrossSales: number;
  todaySalesReturns: number;
  todayNetSales: number;
  todaySalesCount: number;
  // Today Purchases
  todayGrossPurchases: number;
  todayPurchaseReturns: number;
  todayNetPurchases: number;
  todayPurchasesCount: number;
  // Today Collections (actual payments received)
  todayCollections: number;
  // Today Expenses
  todayExpenses: number;
  todayExpensesCount: number;
  // Outstanding
  totalReceivables: number;
  totalPayables: number;
  // Inventory
  stockValue: number;
  totalActiveProducts: number;
  lowStockCount: number;
  // Profit (today)
  todayGrossProfit: number;
  todayNetProfit: number;
  todayGrossMarginPercent: number;
}

export interface SalesReportSummaryDTO {
  period: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  totalDiscount: number;
  totalTax: number;
  salesReturns: number;
  netSales: number;
  salesCount: number;
  returnsCount: number;
}

export interface SalesReportRowDTO {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  customerId: string | null;
  customerName: string;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  itemCount: number;
}

export interface SalesReportDTO {
  summary: SalesReportSummaryDTO;
  data: SalesReportRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SalesByProductRowDTO {
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  categoryName: string | null;
  unitCode: string;
  quantitySold: number;
  grossRevenue: number;
  totalDiscount: number;
  totalTax: number;
  salesReturnQty: number;
  salesReturnValue: number;
  netQuantity: number;
  netRevenue: number;
  historicalCogs: number;
  grossProfit: number;
  grossMarginPercent: number;
}

export interface SalesByProductDTO {
  period: string;
  startDate: string;
  endDate: string;
  data: SalesByProductRowDTO[];
  totals: {
    quantitySold: number;
    grossRevenue: number;
    salesReturnValue: number;
    netRevenue: number;
    historicalCogs: number;
    grossProfit: number;
  };
}

export interface SalesByCustomerRowDTO {
  customerId: string | null;
  customerName: string;
  phone: string | null;
  salesCount: number;
  grossSales: number;
  returnsValue: number;
  netSales: number;
  amountPaid: number;
  outstanding: number;
}

export interface SalesByCustomerDTO {
  period: string;
  startDate: string;
  endDate: string;
  data: SalesByCustomerRowDTO[];
  totals: {
    grossSales: number;
    returnsValue: number;
    netSales: number;
    outstanding: number;
  };
}

export interface SalesByPaymentMethodRowDTO {
  paymentMethod: string;
  transactionCount: number;
  salesAmount: number;
  collectionAmount: number;
}

export interface SalesByPaymentMethodDTO {
  period: string;
  startDate: string;
  endDate: string;
  data: SalesByPaymentMethodRowDTO[];
}

export interface SalesReturnReportRowDTO {
  id: string;
  returnNumber: string;
  saleId: string;
  invoiceNumber: string;
  returnDate: string;
  customerId: string | null;
  customerName: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  refundType: string;
  status: string;
  itemCount: number;
}

export interface SalesReturnReportDTO {
  period: string;
  startDate: string;
  endDate: string;
  totalReturns: number;
  totalReturnValue: number;
  data: SalesReturnReportRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PurchaseReportSummaryDTO {
  period: string;
  startDate: string;
  endDate: string;
  grossPurchases: number;
  totalDiscount: number;
  totalTax: number;
  purchaseReturns: number;
  netPurchases: number;
  purchasesCount: number;
  returnsCount: number;
}

export interface PurchaseReportRowDTO {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string | null;
  supplierName: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  itemCount: number;
}

export interface PurchaseReportDTO {
  summary: PurchaseReportSummaryDTO;
  data: PurchaseReportRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PurchasesByProductRowDTO {
  productId: string;
  productName: string;
  sku: string;
  unitCode: string;
  quantityPurchased: number;
  grossPurchaseAmount: number;
  returnQty: number;
  returnValue: number;
  netQuantity: number;
  netPurchaseAmount: number;
}

export interface PurchasesByProductDTO {
  period: string;
  startDate: string;
  endDate: string;
  data: PurchasesByProductRowDTO[];
  totals: {
    quantityPurchased: number;
    grossPurchaseAmount: number;
    returnValue: number;
    netPurchaseAmount: number;
  };
}

export interface PurchasesBySupplierRowDTO {
  supplierId: string | null;
  supplierName: string;
  phone: string | null;
  purchasesCount: number;
  grossPurchases: number;
  returnsValue: number;
  netPurchases: number;
  amountPaid: number;
  outstanding: number;
}

export interface PurchasesBySupplierDTO {
  period: string;
  startDate: string;
  endDate: string;
  data: PurchasesBySupplierRowDTO[];
  totals: {
    grossPurchases: number;
    returnsValue: number;
    netPurchases: number;
    outstanding: number;
  };
}

export interface PurchaseReturnReportRowDTO {
  id: string;
  returnNumber: string;
  purchaseId: string;
  purchaseNumber: string;
  returnDate: string;
  supplierId: string | null;
  supplierName: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  refundType: string;
  status: string;
  itemCount: number;
}

export interface PurchaseReturnReportDTO {
  period: string;
  startDate: string;
  endDate: string;
  totalReturns: number;
  totalReturnValue: number;
  data: PurchaseReturnReportRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InventoryCurrentStockRowDTO {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  categoryName: string | null;
  brandName: string | null;
  unitCode: string;
  purchasePrice: number;
  salePrice: number;
  currentStock: number;
  reorderLevel: number;
  stockValue: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  status: string;
}

export interface InventoryCurrentStockDTO {
  data: InventoryCurrentStockRowDTO[];
  totalStockValue: number;
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StockMovementRowDTO {
  id: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  transactionType: string;
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  referenceId: string;
  notes: string | null;
}

export interface StockMovementReportDTO {
  data: StockMovementRowDTO[];
  totalIn: number;
  totalOut: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerOutstandingRowDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstanding: number;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
  status: string;
}

export interface CustomerOutstandingReportDTO {
  totalReceivables: number;
  customersWithOutstanding: number;
  data: CustomerOutstandingRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SupplierOutstandingRowDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  outstanding: number;
  lastPurchaseDate: string | null;
  lastPaymentDate: string | null;
  status: string;
}

export interface SupplierOutstandingReportDTO {
  totalPayables: number;
  suppliersWithOutstanding: number;
  data: SupplierOutstandingRowDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExpenseReportSummaryDTO {
  period: string;
  startDate: string;
  endDate: string;
  totalExpenses: number;
  expensesCount: number;
  byCategory: Array<{ categoryId: string; categoryName: string; total: number; count: number }>;
  byPaymentMethod: Array<{ paymentMethod: string; total: number; count: number }>;
}

export interface TaxSummaryDTO {
  period: string;
  startDate: string;
  endDate: string;
  // Sales-side output tax
  taxableSalesAmount: number;
  outputTaxAmount: number;
  // Purchase-side input tax
  taxablePurchasesAmount: number;
  inputTaxAmount: number;
  // Returns (reduce the above)
  salesReturnTaxAmount: number;
  purchaseReturnTaxAmount: number;
  // Net
  netOutputTax: number;
  netInputTax: number;
  netTaxLiability: number; // netOutputTax - netInputTax (positive = payable to govt)
}

// ----------------------------------------------------
// Phase 12 — Invoice Printing, PDF & Document Types
// ----------------------------------------------------

export type InvoiceDocumentType =
  | 'SALE'
  | 'SALES_RETURN'
  | 'PURCHASE'
  | 'PURCHASE_RETURN';

export interface InvoicePartyDTO {
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  gstin?: string | null;
  isCashParty?: boolean;
}

export interface InvoiceItemDTO {
  rowNumber: number;
  productId: string;
  name: string;
  sku: string;
  unitCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoicePaymentInfoDTO {
  method: string;
  amount: number;
  reference?: string | null;
  date?: string | null;
}

export interface InvoiceDocumentDTO {
  // Document metadata
  documentType: InvoiceDocumentType;
  title: string; // e.g. "TAX INVOICE", "CREDIT NOTE (SALES RETURN)", "PURCHASE INWARD BILL", "DEBIT NOTE (PURCHASE RETURN)"
  documentNumber: string;
  originalDocumentNumber?: string | null; // For returns referencing original sale/purchase
  date: string; // ISO string
  status: string; // "POSTED" | "CANCELLED"
  cashierName?: string | null;
  notes?: string | null;

  // Company details
  company: CompanySettings;

  // Party details (Customer / Supplier)
  party: InvoicePartyDTO;

  // Line items
  items: InvoiceItemDTO[];

  // Financial summary
  subtotal: number;
  itemDiscountTotal: number;
  globalDiscount: number;
  totalDiscount: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  changeAmount: number;
  paymentMethod: string;
  payments: InvoicePaymentInfoDTO[];

  // Amount in words
  amountInWords: string;

  // Settings & Terms
  currency: string;
  currencySymbol: string;
  footerNotes?: string | null;
  termsAndConditions?: string | null;
}

export interface PrintJobOptions {
  printerName?: string;
  silent?: boolean;
  copies?: number;
  paperFormat?: 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM';
}

export interface PrintResultDTO {
  success: boolean;
  code?: string; // 'OK' | 'PRINT_FAILED' | 'PRINTER_NOT_FOUND' | 'PRINTER_OFFLINE' | 'PRINT_CANCELLED'
  error?: string;
}

export interface SavePdfResultDTO {
  success: boolean;
  filePath?: string;
  cancelled?: boolean;
  code?: string;
  error?: string;
}

