import { z } from 'zod';

// Master Data Schemas
export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  description: z.string().trim().max(255).optional().nullable(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const CreateBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(100),
});

export const UpdateBrandSchema = CreateBrandSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const CreateUnitSchema = z.object({
  name: z.string().trim().min(1, 'Unit name is required').max(50),
  shortCode: z.string().trim().min(1, 'Unit code is required').max(10),
  allowDecimal: z.boolean().default(false),
});

export const UpdateUnitSchema = CreateUnitSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(50),
  barcode: z
    .string()
    .trim()
    .min(1, 'Barcode is required')
    .max(50),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  brandId: z.string().uuid('Invalid brand ID').optional().nullable(),
  unitId: z.string().uuid('Valid unit is required'),
  purchasePrice: z.number().min(0, 'Purchase price must be positive or zero').default(0),
  salePrice: z.number().min(0, 'Sale price must be positive or zero'),
  mrp: z.number().min(0, 'MRP must be positive or zero').optional().nullable(),
  taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%').default(0),
  openingStock: z.number().min(0, 'Opening stock cannot be negative').default(0),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative').default(10),
  imageUrl: z.string().trim().max(2048).optional().nullable(),
});

export const UpdateProductSchema = CreateProductSchema.omit({ openingStock: true }).partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const ProductQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ACTIVE'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

// POS & Sales Schemas
export const SaleItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  discount: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).max(100).optional().default(0),
});

export const CreateSaleSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  items: z.array(SaleItemInputSchema).min(1, 'At least one item is required in cart'),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  paidAmount: z.number().min(0, 'Paid amount cannot be negative'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT']),
  gatewayProvider: z.enum(['STRIPE', 'RAZORPAY', 'CASHFREE']).optional().nullable(),
  providerOrderId: z.string().optional().nullable(),
  providerPaymentId: z.string().optional().nullable(),
  paymentAttemptId: z.string().optional().nullable(),
  notes: z.string().max(500).optional(),
  allowNegativeStockOverride: z.boolean().default(false),
});

export const SaleQuerySchema = z.object({
  search: z.string().optional(),
  customerId: z.string().optional(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED', 'ALL']).optional().default('ALL'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT', 'ALL']).optional().default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  userId: z.string().optional(),
});


// Purchase Schemas
export const PurchaseItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  purchasePrice: z.number().min(0, 'Purchase price must be positive'),
  discount: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).max(100).optional().default(0),
});

export const CreatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  purchaseNumber: z.string().optional(),
  items: z.array(PurchaseItemInputSchema).min(1, 'At least one item is required'),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  paidAmount: z.number().min(0, 'Paid amount cannot be negative'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT']).default('CASH'),
  notes: z.string().max(500).optional(),
});

export const PurchaseQuerySchema = z.object({
  search: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED', 'ALL']).optional().default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});


// Inventory Stock Adjustment & Ledger Schemas
export const StockAdjustmentSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().positive('Adjustment quantity must be greater than zero'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(255),
  notes: z.string().trim().max(500).optional().nullable(),
  allowNegativeStockOverride: z.boolean().default(false),
});

export const StockLedgerQuerySchema = z.object({
  productId: z.string().optional(),
  transactionType: z.enum(['OPENING', 'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ALL']).optional().default('ALL'),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

// Customer & Supplier Schemas
export const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(150),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(255).optional().nullable(),
  openingBalance: z.number().default(0),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(150).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(255).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const CustomerQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  hasOutstanding: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const RecordCustomerPaymentSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  paymentDate: z.string().optional(),
  idempotencyKey: z.string().optional().nullable(),
});

export const CustomerLedgerQuerySchema = z.object({
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const CustomerStatementQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const ReverseCustomerPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  reason: z.string().min(1, 'Reason for reversal is required').max(500),
});

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(150),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(255).optional().nullable(),
  gstin: z.string().max(20).optional().nullable(),
  openingBalance: z.number().default(0),
});

export const UpdateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(150).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(255).optional().nullable(),
  gstin: z.string().max(20).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const SupplierQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const RecordSupplierPaymentSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  paymentDate: z.string().optional(),
});

// Expense & Category Schemas
export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(255).optional().nullable(),
});

export const UpdateExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100).optional(),
  description: z.string().max(255).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const ExpenseCategoryQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
});

export const CreateExpenseSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  amount: z.number().positive('Expense amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  description: z.string().min(1, 'Description is required').max(255),
  reference: z.string().max(100).optional().nullable(),
  date: z.string().optional(),
});

export const CancelExpenseSchema = z.object({
  expenseId: z.string().uuid('Invalid expense ID'),
  reason: z.string().trim().min(1, 'Cancellation reason is required').max(500),
});

export const ExpenseQuerySchema = z.object({
  categoryId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ALL']).optional().default('ALL'),
  status: z.enum(['POSTED', 'CANCELLED', 'ALL']).optional().default('ALL'),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const ProfitSummaryQuerySchema = z.object({
  period: z.enum(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM']).optional().default('THIS_MONTH'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Auth & Setup Admin Schema
export const SetupAdminSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required').max(100),
});

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Returns Schemas
export const SalesReturnItemInputSchema = z.object({
  saleItemId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  quantity: z.number().positive('Return quantity must be greater than zero'),
  reason: z.string().max(255).optional(),
});

export const CreateSalesReturnSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID'),
  items: z.array(SalesReturnItemInputSchema).min(1, 'At least one item is required for return'),
  refundType: z.enum(['CASH_REFUND', 'CUSTOMER_CREDIT']).default('CASH_REFUND'),
  refundMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT']).default('CASH'),
  notes: z.string().max(500).optional(),
});

export const SalesReturnQuerySchema = z.object({
  search: z.string().optional(),
  saleId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.enum(['POSTED', 'CANCELLED', 'ALL']).default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

export const PurchaseReturnItemInputSchema = z.object({
  purchaseItemId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  quantity: z.number().positive('Return quantity must be greater than zero'),
  reason: z.string().max(255).optional(),
});

export const CreatePurchaseReturnSchema = z.object({
  purchaseId: z.string().uuid('Invalid purchase ID'),
  items: z.array(PurchaseReturnItemInputSchema).min(1, 'At least one item is required for return'),
  refundType: z.enum(['SUPPLIER_PAYABLE_DEDUCTION', 'CASH_REFUND']).default('SUPPLIER_PAYABLE_DEDUCTION'),
  refundMethod: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).default('CASH'),
  notes: z.string().max(500).optional(),
  allowNegativeStockOverride: z.boolean().default(false),
});

export const PurchaseReturnQuerySchema = z.object({
  search: z.string().optional(),
  purchaseId: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(['POSTED', 'CANCELLED', 'ALL']).default('ALL'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

// ----------------------------------------------------
// PHASE 11 — REPORT QUERY SCHEMAS
// ----------------------------------------------------

/**
 * Universal date range schema used by all Phase 11 reports.
 * Extends the existing ProfitSummaryQuerySchema with LAST_MONTH and THIS_YEAR.
 */
export const ReportDateRangeSchema = z.object({
  period: z
    .enum(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM'])
    .optional()
    .default('THIS_MONTH'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const SalesReportQuerySchema = ReportDateRangeSchema.extend({
  customerId: z.string().optional(),
  productId: z.string().optional(),
  paymentMethod: z
    .enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT', 'ALL'])
    .optional()
    .default('ALL'),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED', 'ALL']).optional().default('POSTED'),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const PurchaseReportQuerySchema = ReportDateRangeSchema.extend({
  supplierId: z.string().optional(),
  productId: z.string().optional(),
  paymentMethod: z
    .enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT', 'ALL'])
    .optional()
    .default('ALL'),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED', 'ALL']).optional().default('POSTED'),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const InventoryReportQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  stockStatus: z.enum(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional().default('ALL'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const StockMovementQuerySchema = ReportDateRangeSchema.extend({
  productId: z.string().optional(),
  transactionType: z
    .enum(['OPENING', 'PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ALL'])
    .optional()
    .default('ALL'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const CustomerOutstandingQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  sortBy: z.enum(['outstanding', 'name']).optional().default('outstanding'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

export const SupplierOutstandingQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  sortBy: z.enum(['outstanding', 'name']).optional().default('outstanding'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
});

// ----------------------------------------------------
// SETTINGS & ADMINISTRATION VALIDATION SCHEMAS
// ----------------------------------------------------

export const CompanySettingsSchema = z.object({
  shopName: z.string().trim().min(1, 'Shop name is required').max(100),
  address: z.string().trim().min(1, 'Address is required').max(300),
  phone: z.string().trim().min(5, 'Valid phone number is required').max(20),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z.string().trim().max(30).optional().or(z.literal('')),
  currency: z.string().trim().min(1).max(10).default('INR'),
  currencySymbol: z.string().trim().min(1).max(5).default('₹'),
  logoPath: z.string().optional(),
});

export const BrandingSettingsSchema = z.object({
  appName: z.string().trim().min(1).max(50).default('RS Inventory'),
  footerText: z.string().trim().max(100).default('RS Inventory – Solo Station'),
  accentColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format').default('#F97316'),
  accentTextColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, 'Invalid hex color format').default('#FFFFFF'),
  theme: z.enum(['light', 'dark', 'system']).default('dark'),
  lightLogoUrl: z.string().optional(),
  darkLogoUrl: z.string().optional(),
  collapsedIconUrl: z.string().optional(),
});

export const RegionalSettingsSchema = z.object({
  timezone: z.string().min(1).default('Asia/Kolkata'),
  dateFormat: z.string().min(1).default('DD/MM/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  financialYearStartMonth: z.number().int().min(1).max(12).default(4),
});

export const CurrencySettingsSchema = z.object({
  baseCurrency: z.string().min(1).max(10).default('INR'),
  symbol: z.string().min(1).max(5).default('₹'),
  decimalPlaces: z.number().int().min(0).max(4).default(2),
  thousandSeparator: z.string().max(2).default(','),
  decimalSeparator: z.string().max(2).default('.'),
  symbolPosition: z.enum(['prefix', 'suffix']).default('prefix'),
});

export const ReceiptSettingsSchema = z.object({
  paperSize: z.enum(['58mm', '80mm', 'A4']).default('80mm'),
  showLogo: z.boolean().default(true),
  showCustomerDetails: z.boolean().default(true),
  showCashier: z.boolean().default(true),
  showTaxBreakdown: z.boolean().default(true),
  showBarcode: z.boolean().default(true),
  showQrCode: z.boolean().default(false),
  showSku: z.boolean().default(false),
  showHsn: z.boolean().default(false),
  showHsnTaxSummary: z.boolean().default(false),
  headerText: z.string().max(250).default(''),
  footerText: z.string().max(250).default('Thank you for your visit!'),
  returnPolicy: z.string().max(300).default('Items subject to standard return policy.'),
});

export const CashierPosSettingsSchema = z.object({
  cartPosition: z.enum(['beam', 'lane', 'counter']).default('counter'),
  tileSize: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
  theme: z.enum(['auto', 'light', 'dark']).default('dark'),
  defaultCategoryId: z.string().default('ALL'),
});

export const SecuritySettingsSchema = z.object({
  singleSessionPerAccount: z.boolean().default(false),
  sessionTimeoutMinutes: z.number().int().min(1).max(1440).default(30),
});

export const WeighingScaleSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  prefix: z.string().regex(/^\d{2}$/, 'Prefix must be 2 digits').default('20'),
  pluDigits: z.number().int().min(1).max(8).default(5),
  digitsToSkip: z.number().int().min(0).max(3).default(1),
  valueDigits: z.number().int().min(1).max(8).default(5),
  valueDecimals: z.number().int().min(0).max(4).default(3),
  embeddedValue: z.enum(['WEIGHT', 'TOTAL_PRICE']).default('WEIGHT'),
});

export const LoyaltySettingsSchema = z.object({
  enabled: z.boolean().default(false),
  pointsPerAmount: z.number().min(0).default(1),
  amountThreshold: z.number().min(1).default(100),
  earnOn: z.enum(['GRAND_TOTAL', 'SUBTOTAL']).default('GRAND_TOTAL'),
  expirationMonths: z.number().int().min(0).default(12),
  redemptionPoints: z.number().min(1).default(100),
  redemptionValue: z.number().min(0).default(10),
  minRedeemBalance: z.number().min(0).default(50),
  maxRedeemSalePercentage: z.number().min(0).max(100).default(50),
});

export const PricingSettingsSchema = z.object({
  pricingMode: z.enum(['PRODUCT_BASED', 'BATCH_WISE']).default('PRODUCT_BASED'),
  defaultUpdateSellingPricesOnReceive: z.boolean().default(false),
});

export const NumberingSettingsSchema = z.object({
  saleInvoiceFormat: z.string().min(3).default('INV-{seq:6}'),
  heldOrderFormat: z.string().min(3).default('HOLD-{seq:4}'),
  quotationFormat: z.string().min(3).default('QUO-{seq:6}'),
  refundFormat: z.string().min(3).default('SR-{seq:6}'),
  skuPrefix: z.string().max(10).default('SKU-'),
  inStoreBarcodePrefix: z.string().max(5).default('21'),
});

export const SmtpSettingsSchema = z.object({
  driver: z.enum(['LOG', 'SMTP']).default('LOG'),
  host: z.string().default(''),
  port: z.number().int().min(1).max(65535).default(587),
  username: z.string().default(''),
  password: z.string().optional(),
  encryption: z.enum(['NONE', 'TLS', 'SSL']).default('TLS'),
  fromAddress: z.string().email().or(z.literal('')).default(''),
  fromName: z.string().default('RS Inventory'),
});

export const PaymentMethodConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CREDIT', 'STRIPE', 'RAZORPAY', 'CASHFREE']),
  requiresReference: z.boolean().default(false),
  active: z.boolean().default(true),
  upiVpa: z.string().optional(),
  upiPayeeName: z.string().optional(),
});

export const CreateUserSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  role: z.string().trim().min(1, 'Role is required').max(50),
});

export const UpdateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().min(1).max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  password: z.string().min(6).optional(),
});

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(50),
  description: z.string().trim().max(255).optional(),
  permissions: z.array(z.string()).default([]),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const UpdateRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(50).optional(),
  description: z.string().trim().max(255).optional().nullable(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});



