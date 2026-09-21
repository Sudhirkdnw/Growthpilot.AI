export interface PermissionDefinition {
  key: string;
  category: string;
  displayName: string;
  description: string;
  dangerous?: boolean;
}

export const PERMISSION_CATALOGUE: PermissionDefinition[] = [
  // ACCOUNTING (9 permissions)
  {
    key: 'accounting.mappings.update',
    category: 'Accounting',
    displayName: 'Update Account Mappings',
    description: 'Change business-event to ledger account mappings',
  },
  {
    key: 'accounting.chart.update',
    category: 'Accounting',
    displayName: 'Edit Chart of Accounts',
    description: 'Create, edit, or archive general ledger accounts',
  },
  {
    key: 'accounting.opening_balances',
    category: 'Accounting',
    displayName: 'Enter Opening Balances',
    description: 'Enter or modify initial fiscal ledger opening balances',
    dangerous: true,
  },
  {
    key: 'accounting.lock_period',
    category: 'Accounting',
    displayName: 'Lock Accounting Period',
    description: 'Lock past periods against manual backdated transactions',
  },
  {
    key: 'accounting.manual_entry',
    category: 'Accounting',
    displayName: 'Manual Journal Entry',
    description: 'Post manual journal entries into accounts',
  },
  {
    key: 'accounting.reverse_entry',
    category: 'Accounting',
    displayName: 'Reverse Journal Entry',
    description: 'Post journal entry reversals',
  },
  {
    key: 'accounting.year_end_close',
    category: 'Accounting',
    displayName: 'Year-End Fiscal Close',
    description: 'Perform permanent annual fiscal year closure',
    dangerous: true,
  },
  {
    key: 'accounting.unlock_period',
    category: 'Accounting',
    displayName: 'Unlock Closed Period',
    description: 'Reopen locked historical financial periods',
    dangerous: true,
  },
  {
    key: 'accounting.view',
    category: 'Accounting',
    displayName: 'View Accounts & Balances',
    description: 'Read chart of accounts, balances, and entries',
  },

  // BACKUP (2 permissions)
  {
    key: 'backup.restore',
    category: 'Backup',
    displayName: 'Restore Database',
    description: 'Perform destructive restore of SQLite database from snapshot',
    dangerous: true,
  },
  {
    key: 'backup.run',
    category: 'Backup',
    displayName: 'Run Manual Backup',
    description: 'Generate point-in-time SQLite VACUUM INTO snapshots',
  },

  // CUSTOMERS (9 permissions)
  {
    key: 'customers.loyalty_manage',
    category: 'Customers',
    displayName: 'Manage Loyalty Points',
    description: 'Manually adjust or redeem customer loyalty balances',
  },
  {
    key: 'customers.credit_manage',
    category: 'Customers',
    displayName: 'Manage Credit Limits',
    description: 'Adjust customer credit limits and Khata payment terms',
  },
  {
    key: 'customers.create',
    category: 'Customers',
    displayName: 'Create Customer',
    description: 'Add new customers to store directory',
  },
  {
    key: 'customers.delete',
    category: 'Customers',
    displayName: 'Delete Customer',
    description: 'Remove customer profiles with no active balances',
  },
  {
    key: 'customers.export',
    category: 'Customers',
    displayName: 'Export Customers',
    description: 'Export customer phone lists and balances to CSV',
  },
  {
    key: 'customers.import',
    category: 'Customers',
    displayName: 'Import Customers',
    description: 'Bulk import customer data from spreadsheets',
  },
  {
    key: 'customers.payments_record',
    category: 'Customers',
    displayName: 'Record Khata Payment',
    description: 'Record customer ledger credit payments and receipts',
  },
  {
    key: 'customers.update',
    category: 'Customers',
    displayName: 'Update Customer',
    description: 'Edit customer phone, address, and GSTIN details',
  },
  {
    key: 'customers.view',
    category: 'Customers',
    displayName: 'View Customers',
    description: 'Browse customer directory and outstanding balances',
  },

  // EXPENSES (5 permissions)
  {
    key: 'expenses.delete',
    category: 'Expenses',
    displayName: 'Delete Expense',
    description: 'Remove or cancel recorded operating expense entries',
  },
  {
    key: 'expenses.update',
    category: 'Expenses',
    displayName: 'Update Expense',
    description: 'Modify expense amounts, categories, or descriptions',
  },
  {
    key: 'expenses.export',
    category: 'Expenses',
    displayName: 'Export Expenses',
    description: 'Export operating expense ledgers to spreadsheet',
  },
  {
    key: 'expenses.create',
    category: 'Expenses',
    displayName: 'Record Expense',
    description: 'Record store petty cash and operating expenditures',
  },
  {
    key: 'expenses.view',
    category: 'Expenses',
    displayName: 'View Expenses',
    description: 'View expense logs and category breakdowns',
  },

  // HARDWARE (4 permissions)
  {
    key: 'terminals.configure',
    category: 'Hardware',
    displayName: 'Configure Terminals',
    description: 'Configure POS workstation settings and hardware assignments',
  },
  {
    key: 'hardware.test_print',
    category: 'Hardware',
    displayName: 'Printer Diagnostics',
    description: 'Send test print receipts and paper cuts to printers',
  },
  {
    key: 'hardware.diagnostics',
    category: 'Hardware',
    displayName: 'Scanner & Scale Diagnostics',
    description: 'Inspect barcode scanner buffers and scale communication',
  },
  {
    key: 'terminals.view',
    category: 'Hardware',
    displayName: 'View Terminals',
    description: 'Inspect active workstation terminals',
  },

  // OPERATIONS (2 permissions)
  {
    key: 'sync.log.retry',
    category: 'Operations',
    displayName: 'Retry Background Tasks',
    description: 'Retry failed scheduled operations and queue dispatches',
  },
  {
    key: 'sync.log.view',
    category: 'Operations',
    displayName: 'View Operation Logs',
    description: 'Inspect scheduler execution and operational logs',
  },

  // PRODUCTS (12 permissions)
  {
    key: 'products.delete_batch',
    category: 'Products',
    displayName: 'Delete Product Batch',
    description: 'Purge inventory batches with zero stock balance',
  },
  {
    key: 'products.create',
    category: 'Products',
    displayName: 'Create Product',
    description: 'Add new products, barcodes, and SKUs to catalog',
  },
  {
    key: 'products.delete',
    category: 'Products',
    displayName: 'Delete Product',
    description: 'Remove inactive catalog items with zero stock and no transactions',
  },
  {
    key: 'products.export',
    category: 'Products',
    displayName: 'Export Catalog',
    description: 'Export product inventory and prices to CSV',
  },
  {
    key: 'products.import',
    category: 'Products',
    displayName: 'Import Products',
    description: 'Bulk inward products from CSV or Excel sheets',
  },
  {
    key: 'taxonomies.manage',
    category: 'Products',
    displayName: 'Manage Categories & Brands',
    description: 'Add, update, or archive product categories, brands, and units',
  },
  {
    key: 'products.adjust_stock',
    category: 'Products',
    displayName: 'Adjust Inventory Stock',
    description: 'Record stock adjustments, shrinkage, damage, and audit counts',
  },
  {
    key: 'products.update_cost',
    category: 'Products',
    displayName: 'Update Purchase Costs',
    description: 'Modify product default purchase price and margin base',
  },
  {
    key: 'inventory.sell_expired',
    category: 'Products',
    displayName: 'Sell Expired Items',
    description: 'Override warnings when billing expired product batches',
  },
  {
    key: 'products.transfer_stock',
    category: 'Products',
    displayName: 'Transfer Stock Locations',
    description: 'Move stock between aisle, rack, shelf, or back stock',
  },
  {
    key: 'products.update',
    category: 'Products',
    displayName: 'Update Product',
    description: 'Edit product name, selling price, tax rate, and reorder levels',
  },
  {
    key: 'products.view',
    category: 'Products',
    displayName: 'View Products & Stock',
    description: 'Browse catalog, barcodes, prices, and live stock balances',
  },

  // PURCHASES (5 permissions)
  {
    key: 'purchases.create',
    category: 'Purchases',
    displayName: 'Create Purchase Inward',
    description: 'Record purchase bills and supplier invoices',
  },
  {
    key: 'purchases.delete',
    category: 'Purchases',
    displayName: 'Cancel Purchase',
    description: 'Cancel posted purchase bills and reverse stock ledgers',
  },
  {
    key: 'purchases.receive',
    category: 'Purchases',
    displayName: 'Receive Stock Goods',
    description: 'Confirm inward receipt of supplier deliveries',
  },
  {
    key: 'purchases.update',
    category: 'Purchases',
    displayName: 'Update Purchase Bill',
    description: 'Edit purchase bill notes and payment terms',
  },
  {
    key: 'purchases.view',
    category: 'Purchases',
    displayName: 'View Purchases',
    description: 'Browse inward purchase history and supplier bills',
  },

  // QUOTATIONS (7 permissions)
  {
    key: 'quotations.cancel',
    category: 'Quotations',
    displayName: 'Cancel Quotation',
    description: 'Cancel customer price estimates and quotations',
    dangerous: true,
  },
  {
    key: 'quotations.convert',
    category: 'Quotations',
    displayName: 'Convert to Sale Invoice',
    description: 'Convert accepted quotation directly into a POS sale',
  },
  {
    key: 'quotations.create',
    category: 'Quotations',
    displayName: 'Create Quotation',
    description: 'Generate new price quotations and estimates',
  },
  {
    key: 'quotations.update',
    category: 'Quotations',
    displayName: 'Update Quotation',
    description: 'Modify items, quantities, and pricing on draft quotations',
  },
  {
    key: 'quotations.send',
    category: 'Quotations',
    displayName: 'Send Quotation',
    description: 'Dispatch quotations via WhatsApp or email to customers',
  },
  {
    key: 'quotations.view_all',
    category: 'Quotations',
    displayName: 'View All Quotations',
    description: 'View quotations generated by all staff members',
  },
  {
    key: 'quotations.view_own',
    category: 'Quotations',
    displayName: 'View Own Quotations',
    description: 'View only quotations created by the logged-in user',
  },

  // REPORTS (11 permissions)
  {
    key: 'reports.export',
    category: 'Reports',
    displayName: 'Export Reports',
    description: 'Download business reports to CSV or Excel',
  },
  {
    key: 'reports.cross_store',
    category: 'Reports',
    displayName: 'Cross-Store Analytics',
    description: 'Consolidated store reporting metrics',
  },
  {
    key: 'reports.save_shared',
    category: 'Reports',
    displayName: 'Save Shared Reports',
    description: 'Save custom report filter presets',
  },
  {
    key: 'reports.schedule',
    category: 'Reports',
    displayName: 'Schedule Automated Reports',
    description: 'Configure automated daily/weekly report generation',
  },
  {
    key: 'reports.view_customers',
    category: 'Reports',
    displayName: 'View Customer Reports',
    description: 'View customer ledger balances and top buyers',
  },
  {
    key: 'reports.view_employees',
    category: 'Reports',
    displayName: 'View Cashier Performance',
    description: 'View sales and shifts broken down by staff member',
  },
  {
    key: 'reports.view_financial',
    category: 'Reports',
    displayName: 'View Profit & Margins',
    description: 'View net profit, gross margins, and financial P&L statements',
  },
  {
    key: 'reports.view_inventory',
    category: 'Reports',
    displayName: 'View Stock Reports',
    description: 'View inventory valuation, stock movement, and low-stock alerts',
  },
  {
    key: 'reports.view_sales',
    category: 'Reports',
    displayName: 'View Sales Reports',
    description: 'View daily sales volumes, tender breakdowns, and product revenue',
  },
  {
    key: 'reports.view_suppliers',
    category: 'Reports',
    displayName: 'View Supplier Reports',
    description: 'View purchase summaries and supplier payables',
  },
  {
    key: 'reports.view_tax',
    category: 'Reports',
    displayName: 'View Tax & GST Summary',
    description: 'View GST tax summary, HSN breakdown, and tax reports',
  },

  // RETURNS (3 permissions)
  {
    key: 'returns.create',
    category: 'Returns',
    displayName: 'Create Sales Return',
    description: 'Process customer returns against past sale invoices',
  },
  {
    key: 'returns.create_above_threshold',
    category: 'Returns',
    displayName: 'Create High-Value Return',
    description: 'Authorize sales returns exceeding standard amount threshold',
  },
  {
    key: 'returns.void',
    category: 'Returns',
    displayName: 'Void / Cancel Return',
    description: 'Cancel processed returns and reverse credit adjustments',
  },

  // SALES (14 permissions)
  {
    key: 'sales.discount',
    category: 'Sales',
    displayName: 'Apply Standard Discount',
    description: 'Apply line item or invoice discount up to configured threshold',
  },
  {
    key: 'sales.discount_above_threshold',
    category: 'Sales',
    displayName: 'Discount Above Threshold',
    description: 'Authorize high discounts exceeding normal cashier limits',
  },
  {
    key: 'sales.create',
    category: 'Sales',
    displayName: 'Create Sale Invoice',
    description: 'Process POS billing transactions and issue receipts',
  },
  {
    key: 'sales.update',
    category: 'Sales',
    displayName: 'Edit Sale Details',
    description: 'Update customer notes or payment details on pending orders',
  },
  {
    key: 'sales.held.create',
    category: 'Sales',
    displayName: 'Hold Sale Order',
    description: 'Park active cart orders to serve another customer',
  },
  {
    key: 'sales.print_receipt',
    category: 'Sales',
    displayName: 'Print / Reprint Receipts',
    description: 'Output thermal slips and duplicate tax invoices',
  },
  {
    key: 'sales.refund',
    category: 'Sales',
    displayName: 'Process Cash Refund',
    description: 'Issue immediate cash payout on sales return',
  },
  {
    key: 'sales.held.resume_others',
    category: 'Sales',
    displayName: 'Resume Others Held Orders',
    description: 'Retrieve parked orders created by another cashier',
  },
  {
    key: 'sales.adjust_price',
    category: 'Sales',
    displayName: 'Override Unit Price',
    description: 'Manually edit selling price directly inside the POS cart',
  },
  {
    key: 'sales.oversell',
    category: 'Sales',
    displayName: 'Allow Negative Overselling',
    description: 'Override negative stock block to sell unstocked goods',
  },
  {
    key: 'sales.view_all',
    category: 'Sales',
    displayName: 'View All Sales Invoices',
    description: 'Browse complete historical store sales across all staff',
  },
  {
    key: 'sales.view_own',
    category: 'Sales',
    displayName: 'View Own Sales Invoices',
    description: 'Browse only sales invoices created by logged-in user',
  },
  {
    key: 'sales.cross_store_view',
    category: 'Sales',
    displayName: 'Cross-Store Sales View',
    description: 'Inspect sales invoices from other store locations',
  },
  {
    key: 'sales.void',
    category: 'Sales',
    displayName: 'Void / Cancel Sale Invoice',
    description: 'Cancel posted sale invoice, restocking items and reversing payments',
  },

  // SALES CHANNELS (4 permissions)
  {
    key: 'commerce.manage',
    category: 'Sales Channels',
    displayName: 'Manage E-Commerce Sync',
    description: 'Configure and authorize external commerce integrations',
    dangerous: true,
  },
  {
    key: 'commerce.sync.retry',
    category: 'Sales Channels',
    displayName: 'Retry Channel Sync',
    description: 'Force re-synchronization of orders from external channels',
  },
  {
    key: 'commerce.orders.manage',
    category: 'Sales Channels',
    displayName: 'Manage Online Orders',
    description: 'Accept, fulfill, or cancel incoming online channel orders',
  },
  {
    key: 'commerce.view',
    category: 'Sales Channels',
    displayName: 'View Channel Status',
    description: 'Inspect sales channel connection statuses and sync logs',
  },

  // SETTINGS (5 permissions)
  {
    key: 'settings.tax.update',
    category: 'Settings',
    displayName: 'Update Tax Configurations',
    description: 'Modify GST rates, tax slabs, and HSN tax categories',
  },
  {
    key: 'settings.update_dangerous',
    category: 'Settings',
    displayName: 'Update Critical Settings',
    description: 'Modify financial year, fiscal currency, or system scripts',
    dangerous: true,
  },
  {
    key: 'settings.update',
    category: 'Settings',
    displayName: 'Update Store Settings',
    description: 'Edit store profile, theme, receipt templates, and POS layout',
  },
  {
    key: 'settings.view',
    category: 'Settings',
    displayName: 'View Settings',
    description: 'Browse administration settings and configuration values',
  },
  {
    key: 'settings.tax.view',
    category: 'Settings',
    displayName: 'View Tax Settings',
    description: 'Inspect tax configurations and GST rates',
  },


  // SHIFTS (8 permissions)
  {
    key: 'shifts.close_others',
    category: 'Shifts',
    displayName: 'Close Others Shifts',
    description: 'Force-close active cash register shifts of other staff',
  },
  {
    key: 'shifts.close_own',
    category: 'Shifts',
    displayName: 'Close Own Shift',
    description: 'Perform end-of-day register count and close own shift',
  },
  {
    key: 'shifts.open',
    category: 'Shifts',
    displayName: 'Open Cash Shift',
    description: 'Open new register shift with starting cash float',
  },
  {
    key: 'cash_drawer.open_no_sale',
    category: 'Shifts',
    displayName: 'Open Drawer (No Sale)',
    description: 'Trigger cash drawer kick without billing an invoice',
  },
  {
    key: 'cash_drawer.pay_in',
    category: 'Shifts',
    displayName: 'Cash Float Pay-In',
    description: 'Add cash float or change into the register drawer',
  },
  {
    key: 'cash_drawer.pay_out',
    category: 'Shifts',
    displayName: 'Cash Drop Pay-Out',
    description: 'Remove cash drop from register drawer for safe deposit',
  },
  {
    key: 'shifts.bypass_enforcement',
    category: 'Shifts',
    displayName: 'Bypass Shift Enforcement',
    description: 'Perform POS sales without opening a mandatory cash shift',
  },
  {
    key: 'shifts.view_all',
    category: 'Shifts',
    displayName: 'View All Shifts',
    description: 'Inspect register shift balances and cash float history',
  },

  // STORES (4 permissions)
  {
    key: 'stores.create',
    category: 'Stores',
    displayName: 'Create Store',
    description: 'Register branch location identity in configuration',
  },
  {
    key: 'stores.delete',
    category: 'Stores',
    displayName: 'Delete Store',
    description: 'Remove inactive branch identity records',
  },
  {
    key: 'stores.update',
    category: 'Stores',
    displayName: 'Update Store',
    description: 'Update branch address, tax number, and contact info',
  },
  {
    key: 'stores.view',
    category: 'Stores',
    displayName: 'View Stores',
    description: 'Inspect physical store establishment profiles',
  },

  // SUPPLIERS (6 permissions)
  {
    key: 'suppliers.create',
    category: 'Suppliers',
    displayName: 'Create Supplier',
    description: 'Add wholesale vendor or supplier to address book',
  },
  {
    key: 'suppliers.delete',
    category: 'Suppliers',
    displayName: 'Delete Supplier',
    description: 'Remove supplier profile with zero outstanding balance',
  },
  {
    key: 'suppliers.payments_record',
    category: 'Suppliers',
    displayName: 'Record Supplier Payment',
    description: 'Post payout voucher against supplier inward bills',
  },
  {
    key: 'suppliers.update',
    category: 'Suppliers',
    displayName: 'Update Supplier',
    description: 'Edit vendor contact info, bank details, and GSTIN',
  },
  {
    key: 'suppliers.view',
    category: 'Suppliers',
    displayName: 'View Suppliers',
    description: 'Browse supplier directory and payables ledger',
  },
  {
    key: 'suppliers.payments_void',
    category: 'Suppliers',
    displayName: 'Void Supplier Payment',
    description: 'Cancel posted supplier payment voucher',
  },

  // UPDATER (2 permissions)
  {
    key: 'updater.check',
    category: 'Updater',
    displayName: 'Check Updates',
    description: 'Query official channel for new software releases',
  },
  {
    key: 'updater.run',
    category: 'Updater',
    displayName: 'Install Software Update',
    description: 'Apply software update package and restart application',
    dangerous: true,
  },

  // USERS (8 permissions)
  {
    key: 'users.create_super_admin',
    category: 'Users',
    displayName: 'Create Super-Admin',
    description: 'Create top-level administrator with full system privileges',
    dangerous: true,
  },
  {
    key: 'users.create',
    category: 'Users',
    displayName: 'Create Staff User',
    description: 'Create cashier or manager accounts',
  },
  {
    key: 'users.delete',
    category: 'Users',
    displayName: 'Delete Staff User',
    description: 'Remove user accounts',
  },
  {
    key: 'users.force_logout',
    category: 'Users',
    displayName: 'Force Session Logout',
    description: 'Terminate active session of another user immediately',
  },
  {
    key: 'roles.manage',
    category: 'Users',
    displayName: 'Manage Roles & Permissions',
    description: 'Create, modify, and assign system roles and permissions',
  },
  {
    key: 'users.mfa_reset',
    category: 'Users',
    displayName: 'Reset User Security',
    description: 'Force password reset and unlock locked accounts',
    dangerous: true,
  },
  {
    key: 'users.update',
    category: 'Users',
    displayName: 'Update Staff User',
    description: 'Change user full name, role, and active status',
  },
  {
    key: 'users.view',
    category: 'Users',
    displayName: 'View Staff Users',
    description: 'Inspect system user accounts and roles',
  },

  // WHATSAPP (8 permissions)
  {
    key: 'settings.whatsapp.credentials',
    category: 'WhatsApp',
    displayName: 'Manage WhatsApp Credentials',
    description: 'View and update Meta Cloud API access tokens and secrets',
    dangerous: true,
  },
  {
    key: 'whatsapp.logs.retry',
    category: 'WhatsApp',
    displayName: 'Retry Failed Messages',
    description: 'Retry unsent WhatsApp message queue items',
  },
  {
    key: 'whatsapp.send_bulk',
    category: 'WhatsApp',
    displayName: 'Send Bulk Broadcast',
    description: 'Broadcast promotional or statement messages in bulk',
    dangerous: true,
  },
  {
    key: 'whatsapp.send_statement',
    category: 'WhatsApp',
    displayName: 'Send Khata Statement',
    description: 'Dispatch account balance statement to customer',
  },
  {
    key: 'whatsapp.send_receipt',
    category: 'WhatsApp',
    displayName: 'Send Sale Receipt',
    description: 'Dispatch PDF or text receipt link to customer upon sale',
  },
  {
    key: 'whatsapp.send_supplier_voucher',
    category: 'WhatsApp',
    displayName: 'Send Supplier Voucher',
    description: 'Dispatch purchase voucher to supplier via WhatsApp',
  },
  {
    key: 'settings.whatsapp.update',
    category: 'WhatsApp',
    displayName: 'Update WhatsApp Config',
    description: 'Change WhatsApp templates and sender phone number ID',
  },
  {
    key: 'whatsapp.logs.view',
    category: 'WhatsApp',
    displayName: 'View WhatsApp Dispatch Logs',
    description: 'Inspect status of outbound WhatsApp messages',
  },
];

// Helper: Group catalogue by Category
export const PERMISSION_CATEGORIES: { name: string; permissions: PermissionDefinition[] }[] = (() => {
  const map = new Map<string, PermissionDefinition[]>();
  for (const p of PERMISSION_CATALOGUE) {
    if (!map.has(p.category)) {
      map.set(p.category, []);
    }
    map.get(p.category)!.push(p);
  }
  return Array.from(map.entries()).map(([name, permissions]) => ({ name, permissions }));
})();

// Default Standard Role Permissions
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSION_CATALOGUE.map((p) => p.key), // Full system access
  MANAGER: [
    'products.view',
    'products.create',
    'products.update',
    'products.adjust_stock',
    'products.update_cost',
    'taxonomies.manage',
    'sales.create',
    'sales.discount',
    'sales.discount_above_threshold',
    'sales.held.create',
    'sales.held.resume_others',
    'sales.print_receipt',
    'sales.refund',
    'sales.view_all',
    'sales.void',
    'returns.create',
    'returns.create_above_threshold',
    'customers.view',
    'customers.create',
    'customers.update',
    'customers.payments_record',
    'customers.credit_manage',
    'purchases.view',
    'purchases.create',
    'purchases.receive',
    'purchases.update',
    'suppliers.view',
    'suppliers.create',
    'suppliers.update',
    'suppliers.payments_record',
    'expenses.view',
    'expenses.create',
    'expenses.update',
    'reports.view_sales',
    'reports.view_inventory',
    'reports.view_customers',
    'reports.view_suppliers',
    'reports.view_tax',
    'shifts.open',
    'shifts.close_own',
    'shifts.close_others',
    'shifts.view_all',
    'cash_drawer.open_no_sale',
    'cash_drawer.pay_in',
    'cash_drawer.pay_out',
    'backup.run',
    'users.view',
    'whatsapp.send_receipt',
    'whatsapp.send_statement',
  ],
  CASHIER: [
    'sales.create',
    'sales.discount',
    'sales.held.create',
    'sales.print_receipt',
    'sales.view_own',
    'products.view',
    'customers.view',
    'customers.create',
    'shifts.open',
    'shifts.close_own',
    'cash_drawer.open_no_sale',
    'whatsapp.send_receipt',
  ],
};
