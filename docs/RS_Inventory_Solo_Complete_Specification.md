# RS Inventory – Solo
## Complete Product Requirements, Feature Specification & Control-Flow Document

**Product:** RS Inventory – Solo  
**Company:** RS ORANGE TECH PVT LTD  
**Product Type:** Offline-first single-shop Windows POS & Inventory Management System  
**Primary Platform:** Windows Desktop  
**Core Stack:** Electron + Node.js + React+ Fastify + TypeScript + Prisma + SQLite  
**Optional Online Services:** WhatsApp billing, license validation, application updates, optional cloud backup

---

## 1. Product Overview

RS Inventory – Solo is an offline-first desktop POS and inventory management application designed for a single retail shop.

The core application must continue to operate when the computer has no internet connection. Billing, inventory, purchases, customers, suppliers, returns, expenses, reports, invoice generation, printing, and local data management must not depend on an external API.

Internet connectivity is only required for optional services such as:

- WhatsApp bill delivery
- License activation/periodic license refresh
- Application updates
- Optional cloud backup

An outage of any optional online service must never block local billing or inventory operations.

### Primary objectives

1. Fast retail billing.
2. Reliable inventory tracking.
3. Auditable stock movement.
4. Correct customer/supplier balances.
5. Historical profit accuracy.
6. Safe financial transactions using database transactions.
7. Strong local data protection.
8. Automatic and manual backup.
9. Simple first-run setup.
10. Printer and barcode-scanner support.
11. Optional WhatsApp invoice delivery.
12. Architecture that can later evolve into RS Inventory Business.

---

# 2. Product Scope

## 2.1 Included in Solo

- First-run setup wizard
- Admin authentication
- Dashboard
- Product management
- Category management
- Brand management
- Unit management
- POS / sales billing
- Barcode scanning
- Purchase management
- Supplier management
- Customer management
- Sales returns
- Purchase returns
- Stock ledger
- Stock adjustments
- Opening stock
- Low-stock management
- Expense management
- Profit estimation
- Sales reports
- Purchase reports
- Return reports
- Stock reports
- Customer outstanding reports
- Supplier outstanding reports
- Expense reports
- Tax/GST summary
- A4 invoices
- 58mm / 80mm thermal receipts
- Invoice preview
- Invoice reprint
- PDF generation
- Barcode/QR display
- Configurable invoice numbering
- Printer configuration
- Backup
- Restore
- Database maintenance
- Audit log
- Session timeout
- Secure password hashing
- Offline operation
- Optional WhatsApp billing
- Optional license service
- Optional update service
- Optional cloud backup

## 2.2 Explicitly out of Solo scope

These may be added later to RS Inventory Business:

- Multi-store
- Multi-warehouse
- Multiple simultaneous users
- Cloud-first operation
- Centralized cloud database
- Shopify integration
- WooCommerce integration
- Kiosk
- Customer display
- Advanced ERP accounting
- Payroll
- HR
- Enterprise approval workflows

The codebase should nevertheless use service boundaries and a data model that can support these features later.

---

# 3. Core Technology Architecture

```text
+------------------------------------------------------+
|                  RS Inventory – Solo                 |
|                                                      |
|  Electron Desktop Shell                              |
|       |                                              |
|       +-- React + TypeScript Renderer                |
|       |                                              |
|       +-- Secure Preload / IPC                       |
|                    |                                 |
|                    v                                 |
|              Node.js Application Layer               |
|                    |                                 |
|          +---------+----------+                      |
|          |                    |                      |
|      Domain Services      System Services             |
|          |                    |                      |
|          |                    +-- Printer             |
|          |                    +-- PDF                |
|          |                    +-- Backup              |
|          |                    +-- File System        |
|          |                    +-- Updates             |
|          |                    +-- WhatsApp Queue     |
|          |                                           |
|          v                                           |
|                  Prisma ORM                          |
|                       |                              |
|                       v                              |
|                    SQLite                            |
|                                                      |
+------------------------------------------------------+

Optional online layer:

Electron App
     |
     | HTTPS only when needed
     v
RS Online Services
     |
     +-- License API
     +-- WhatsApp Gateway
     +-- Update Metadata
     +-- Optional Cloud Backup
```

## 3.1 Architectural principles

### Offline-first

Local SQLite is the operational source for the shop.

### Transaction-first

Sales, purchases, returns, stock adjustments, and financial balance changes must be atomic.

### Ledger-first inventory

`current_stock` can be cached for performance, but every stock change must create a stock-ledger entry.

### Secure renderer

React must not receive unrestricted Node.js, filesystem, shell, or database access.

### IPC boundary

```text
React Renderer
    |
    v
Preload API
    |
    v
Electron IPC
    |
    v
Node Service
    |
    v
Prisma
    |
    v
SQLite
```

### No external dependency for core POS

A failed internet request must not cause a sale/purchase/inventory operation to fail.

---

# 4. Application Modules

## Module 1 — First-Run Setup
## Module 2 — Authentication & Security
## Module 3 — Dashboard
## Module 4 — Products
## Module 5 — Inventory & Stock Ledger
## Module 6 — POS / Sales
## Module 7 — Purchases
## Module 8 — Sales Returns
## Module 9 — Purchase Returns
## Module 10 — Customers
## Module 11 — Suppliers
## Module 12 — Expenses
## Module 13 — Profit
## Module 14 — Reports
## Module 15 — Invoice & Printing
## Module 16 — Settings
## Module 17 — Backup & Restore
## Module 18 — Audit & Maintenance
## Module 19 — Optional WhatsApp Service
## Module 20 — Optional License Service
## Module 21 — Optional Update Service
## Module 22 — Optional Cloud Backup

---

# 5. Navigation / Screen Structure

```text
Login
  |
  v
Dashboard
  |
  +-- New Sale
  +-- Sales
  |     +-- Sales History
  |     +-- Sales Return
  |     +-- Invoice Preview
  |
  +-- Purchases
  |     +-- New Purchase
  |     +-- Purchase History
  |     +-- Purchase Return
  |
  +-- Products
  |     +-- Product List
  |     +-- Add Product
  |     +-- Edit Product
  |     +-- Categories
  |     +-- Brands
  |     +-- Units
  |
  +-- Inventory
  |     +-- Stock Summary
  |     +-- Stock Ledger
  |     +-- Stock Adjustment
  |     +-- Low Stock
  |
  +-- Customers
  |     +-- Customer List
  |     +-- Customer Ledger
  |     +-- Receive Payment
  |
  +-- Suppliers
  |     +-- Supplier List
  |     +-- Supplier Ledger
  |     +-- Pay Supplier
  |
  +-- Expenses
  |
  +-- Reports
  |
  +-- Settings
  |     +-- Company
  |     +-- Invoice
  |     +-- Tax/GST
  |     +-- Printer
  |     +-- POS
  |     +-- Backup
  |     +-- Security
  |
  +-- Backup & Restore
  |
  +-- Audit Log
  |
  +-- Database Maintenance
```

---

# 6. Product Management

## 6.1 Product fields

Each product supports:

- Product ID
- Product name
- SKU
- Barcode
- Category
- Brand
- Unit
- Purchase price
- Sale price
- Tax rate
- Opening stock
- Reorder level
- Current stock (cached)
- Status
- Created timestamp
- Updated timestamp

## 6.2 Product status

```text
ACTIVE
INACTIVE
```

Deleting a product with transaction history is prohibited.

Instead:

```text
Active Product
     |
     v
Deactivate
     |
     v
Inactive Product
```

An inactive product cannot be added to a new sale/purchase unless explicitly allowed by an administrator workflow.

## 6.3 SKU rules

- SKU must be unique.
- Duplicate SKU must be rejected.
- Validation must occur before save.
- Database unique constraint must also exist.

## 6.4 Barcode rules

- Barcode is optional.
- If supplied, it must be unique.
- Duplicate barcode must be rejected.
- Database unique constraint must also exist.

## 6.5 Product-name duplicate warning

Duplicate product names are allowed.

Example:

```text
Product A: Pepsi 500ml
Product B: Pepsi 500ml
```

The UI should show:

> A product with a similar name already exists. Continue?

The user may continue.

## 6.6 Product search

Search must support:

- Name
- SKU
- Barcode

Search should be case-insensitive where appropriate.

## 6.7 Product display

Product list should show:

- Name
- SKU
- Barcode
- Category
- Purchase price
- Sale price
- Current stock
- Reorder level
- Status

## 6.8 Current stock rule

The product screen must not allow direct editing of current stock.

Stock changes only through:

- Opening stock
- Purchase
- Sale
- Sales return
- Purchase return
- Positive adjustment
- Negative adjustment

---

# 7. Product Create Flow

```text
Open Products
   |
   v
Add Product
   |
   v
Enter Product Information
   |
   +-- Validate name
   +-- Validate SKU uniqueness
   +-- Validate barcode uniqueness
   +-- Validate numeric fields
   +-- Validate tax
   +-- Validate stock
   |
   v
Duplicate-name warning if applicable
   |
   v
Save
   |
   +-- If opening stock > 0:
   |       Create OPENING stock ledger
   |
   v
Commit
   |
   v
Product List
```

All opening-stock creation must be part of a transaction.

---

# 8. Product Edit Flow

```text
Open Product
   |
   v
Edit Allowed Fields
   |
   +-- Name
   +-- SKU
   +-- Barcode
   +-- Category
   +-- Brand
   +-- Unit
   +-- Purchase Price
   +-- Sale Price
   +-- Tax
   +-- Reorder Level
   |
   v
Validate
   |
   v
Save
   |
   v
Audit price changes / sensitive changes
```

Current stock is never directly edited.

---

# 9. Inventory & Stock Ledger

## 9.1 Stock ledger purpose

The stock ledger is the audit trail for every stock movement.

Each entry must contain:

- Ledger ID
- Product ID
- Transaction type
- Reference ID
- Quantity change
- Balance after
- Timestamp
- Optional notes

## 9.2 Transaction types

```text
OPENING
PURCHASE
SALE
RETURN_IN
RETURN_OUT
ADJUSTMENT_IN
ADJUSTMENT_OUT
```

## 9.3 Stock formula

```text
Current Stock =
    Opening Stock
  + Purchases
  + Positive Adjustments
  + Sales Returns
  - Sales
  - Purchase Returns
  - Negative Adjustments
```

## 9.4 Cached stock

`products.current_stock` may be maintained for fast UI queries.

It must never become the only stock record.

Every stock change:

```text
Validate movement
     |
     +--> Create stock ledger entry
     |
     +--> Update cached current_stock
```

Both must happen in the same database transaction.

## 9.5 Stock integrity invariant

After every committed stock transaction:

```text
products.current_stock
==
reconstructed ledger balance
```

A maintenance/reconciliation tool should be able to recalculate and compare both.

---

# 10. Stock Adjustment

## Positive adjustment

```text
Select Product
   |
   v
Enter Quantity
   |
   v
Enter Reason
   |
   v
Confirm
   |
   v
Transaction
   |
   +-- Create ADJUSTMENT_IN
   +-- Increase cached stock
   +-- Audit action
   |
   v
Commit
```

## Negative adjustment

Same flow but:

```text
ADJUSTMENT_OUT
```

Negative adjustments should respect configured stock rules and require a reason.

---

# 11. Low Stock

A product is low-stock when:

```text
current_stock <= reorder_level
```

The dashboard shows:

- Low-stock count
- Low-stock products

The low-stock report shows:

- Product
- Current stock
- Reorder level
- Difference

---

# 12. Purchase Management

## 12.1 Purchase fields

Purchase header:

- Purchase ID
- Purchase number
- Supplier
- Purchase date
- Subtotal
- Discount
- Tax
- Total
- Paid amount
- Due amount
- Payment method
- Status
- Notes
- Created timestamp

Purchase item:

- Product
- Quantity
- Purchase price
- Discount
- Tax
- Line total

## 12.2 Cash Supplier

Supplier selection can be:

```text
Existing Supplier
OR
Cash Supplier
```

Cash Supplier is used when there is no payable supplier balance.

## 12.3 Purchase calculation

```text
Item Amount = Quantity × Purchase Price

Subtotal = Sum(Item Amount)

Total =
    Subtotal
  - Discount
  + Tax
```

Exact tax/discount behavior is governed by configured tax and discount rules.

## 12.4 Purchase transaction flow

```text
New Purchase
    |
    v
Select Supplier / Cash Supplier
    |
    v
Add Products
    |
    +-- Search
    +-- Barcode
    +-- Quantity
    +-- Purchase Price
    |
    v
Calculate Item Totals
    |
    v
Apply Discount
    |
    v
Apply Tax
    |
    v
Calculate Purchase Total
    |
    v
Enter Paid Amount
    |
    v
Calculate Due
    |
    v
Validate
    |
    v
BEGIN DATABASE TRANSACTION
    |
    +-- Create purchase header
    +-- Create purchase items
    +-- Create payment record if applicable
    +-- Increase stock
    +-- Create PURCHASE ledger entries
    +-- Update supplier balance if credit
    |
    v
COMMIT
    |
    v
Purchase Complete
```

## 12.5 Critical purchase rule

Stock must only be considered committed after the database transaction successfully commits.

If any step fails:

```text
ROLLBACK
```

No partial purchase is allowed.

---

# 13. POS / Sales Billing

## 13.1 New sale flow

```text
New Sale
   |
   v
Scan barcode / Search product
   |
   v
Add item to cart
   |
   v
Enter quantity
   |
   v
Validate product status
   |
   v
Validate stock
   |
   v
Calculate line subtotal
   |
   v
Apply discount
   |
   v
Apply tax
   |
   v
Calculate grand total
   |
   v
Select customer / Cash Customer
   |
   v
Select payment
   |
   +-- Cash
   +-- Card
   +-- UPI
   +-- Bank
   +-- Credit
   |
   v
Enter paid amount
   |
   v
Calculate due
   |
   v
Validate
   |
   v
BEGIN DATABASE TRANSACTION
   |
   +-- Generate invoice number
   +-- Create sale header
   +-- Create sale items
   +-- Store historical cost price
   +-- Create payment record
   +-- Update customer balance if applicable
   +-- Decrease stock
   +-- Create SALE ledger entries
   |
   v
COMMIT
   |
   v
Generate invoice
   |
   +-- Print
   +-- Save PDF
   +-- Send WhatsApp (optional)
   +-- New Sale
```

## 13.2 Stock validation

Configured policy:

```text
BLOCK
```

or

```text
ALLOW_WITH_WARNING
```

### Block mode

```text
Requested Qty > Current Stock
       |
       v
Reject sale
```

### Allow-with-warning mode

```text
Requested Qty > Current Stock
       |
       v
Show warning
       |
       v
Administrator/cashier confirmation
       |
       v
Continue
```

The resulting stock may become negative only when this policy explicitly allows it.

## 13.3 Sale calculation

```text
Line Subtotal = Quantity × Selling Price

Invoice Subtotal = Sum(Line Subtotals)

Grand Total =
    Subtotal
  - Discount
  + Tax
```

## 13.4 Payment calculation

```text
Due = Grand Total - Paid Amount
```

Validation:

- Paid amount cannot be negative.
- Payment must be consistent with selected method.
- Credit requires a real customer.
- Cash/card/UPI/bank payments may be recorded as paid.
- Overpayment behavior must be explicitly configured; default is to reject invalid overpayment unless change/refund handling is implemented.

---

# 14. Historical Cost Price

Every sale item must store the cost price at the time of sale.

Example:

```text
Product purchase cost at sale time = ₹80
Selling price = ₹100
Quantity = 5
```

Store:

```text
sale_item.cost_price = 80
sale_item.selling_price = 100
```

If the product later costs ₹90, historical sales remain based on ₹80.

Historical profit must never be recalculated using today's product purchase price.

---

# 15. Sales Return

## Flow

```text
Sales Return
   |
   v
Find Original Invoice
   |
   v
Load Original Items
   |
   v
Select Item(s)
   |
   v
Enter Return Quantity
   |
   v
Validate:
Returned Qty <= Sold Qty - Previous Returned Qty
   |
   v
Calculate return amount
   |
   v
Choose:
Refund / Customer Credit
   |
   v
BEGIN TRANSACTION
   |
   +-- Create linked sales-return transaction
   +-- Create return items
   +-- Increase stock
   +-- Create RETURN_IN ledger entries
   +-- Record refund/credit
   +-- Update customer balance if applicable
   |
   v
COMMIT
```

Original invoice must remain unchanged.

The return is a separate linked transaction.

---

# 16. Purchase Return

## Flow

```text
Purchase Return
   |
   v
Find Original Purchase
   |
   v
Select Items
   |
   v
Enter Return Quantity
   |
   v
Validate:
Returned Qty <= Purchased Qty - Previous Returned Qty
   |
   v
Calculate return amount
   |
   v
Choose:
Supplier Payable Reduction / Supplier Refund
   |
   v
BEGIN TRANSACTION
   |
   +-- Create linked purchase-return transaction
   +-- Create return items
   +-- Decrease stock
   +-- Create RETURN_OUT ledger entries
   +-- Reduce supplier payable or record refund
   |
   v
COMMIT
```

Original purchase remains unchanged.

---

# 17. Customer Management

## 17.1 Customer fields

- Customer ID
- Name
- Phone
- Address
- Opening balance
- Status
- Created timestamp
- Updated timestamp

## 17.2 Cash Customer

A system-defined Cash Customer may be used for quick POS transactions.

Cash Customer should not become a normal credit account unless explicitly supported.

## 17.3 Customer ledger

Ledger entries:

```text
INVOICE
PAYMENT_RECEIVED
SALES_RETURN
ADJUSTMENT
```

Example:

```text
Sale                 +5000
Payment received     -2000
Sales return          -500
---------------------------
Outstanding           2500
```

## 17.4 Customer payment

```text
Customer
   |
   v
Outstanding invoices
   |
   v
Enter received amount
   |
   v
Select payment method
   |
   v
Save payment
   |
   v
Update customer balance
   |
   v
Create customer ledger entry
```

## 17.5 Customer deletion

If transaction history exists:

```text
Delete = BLOCKED
```

Use:

```text
Deactivate
```

instead.

---

# 18. Supplier Management

## 18.1 Supplier fields

- Supplier ID
- Name
- Phone
- Email
- Address
- Tax/GST details
- Opening balance
- Status

## 18.2 Supplier ledger

Ledger entries:

```text
PURCHASE
PURCHASE_RETURN
PAYMENT
ADJUSTMENT
```

Example:

```text
Purchase             +10000
Payment               -4000
Purchase return       -1000
---------------------------
Payable                5000
```

## 18.3 Supplier payment

```text
Supplier
   |
   v
Outstanding
   |
   v
Enter payment
   |
   v
Save
   |
   v
Update supplier balance
   |
   v
Create supplier ledger
```

## 18.4 Supplier deletion

If transaction history exists:

```text
Delete = BLOCKED
```

Use inactive status.

---

# 19. Expense Management

## Expense fields

- Expense ID
- Category
- Amount
- Payment method
- Date
- Description
- Reference
- Created timestamp

Examples:

- Rent
- Electricity
- Salary
- Transport
- Packaging
- Maintenance
- Other

## Expense flow

```text
New Expense
   |
   v
Select Category
   |
   v
Enter Amount
   |
   v
Select Payment Method
   |
   v
Enter Description
   |
   v
Validate
   |
   v
Save Transaction
   |
   v
Create expense record
   |
   v
Create audit record
```

---

# 20. Profit Logic

Profit is an estimate unless full accounting/COGS functionality is later added.

For each sale item:

```text
Gross Profit =
    (Selling Price - Historical Cost Price)
    × Quantity
```

Item-level discounts must be allocated appropriately.

Example:

```text
Selling price = 100
Cost price    = 80
Quantity      = 5

Gross profit = (100 - 80) × 5
             = 100
```

Estimated net profit for a period can be:

```text
Estimated Gross Profit
- Expenses
= Estimated Net Profit
```

Historical cost price must always be taken from the sale item.

---

# 21. Dashboard

Dashboard must show:

- Today's sales
- Today's purchase amount
- Today's collection
- Customer receivables
- Supplier payables
- Current stock value
- Low-stock product count
- Recent sales
- Recent purchases

## Quick actions

- New Sale
- New Purchase
- Products
- Customers
- Reports

## Stock value

Basic stock value:

```text
Sum(current_stock × relevant cost value)
```

The exact valuation basis must be documented and kept consistent.

---

# 22. Reports

## Sales reports

- Daily
- Monthly
- Custom date
- Product-wise
- Payment-wise
- Customer-wise where applicable

## Purchase reports

- Daily
- Monthly
- Custom date
- Product-wise
- Supplier-wise

## Return reports

- Sales returns
- Purchase returns

## Inventory reports

- Stock summary
- Low-stock
- Stock movement
- Stock ledger
- Stock value

## Outstanding reports

- Customer outstanding
- Customer overdue
- Supplier outstanding

## Profit reports

- Product-wise estimated gross profit
- Period estimated gross profit
- Expense-adjusted estimated profit

## Expense reports

- Category-wise
- Date-wise
- Payment-wise

## Tax/GST report

Available when tax functionality is enabled.

It should summarize:

- Taxable amount
- Tax rate
- Tax amount
- Period totals

## Export

Reports may support:

- PDF
- CSV
- Excel

Exports must be generated locally.

---

# 23. Invoice & Receipt System

## 23.1 Company configuration

Invoice can contain:

- Company/shop name
- Logo
- Address
- Phone
- GSTIN/tax registration details
- Invoice prefix
- Invoice sequence
- Footer
- Terms
- Payment information

## 23.2 Formats

### A4

For full invoices.

### Thermal

- 58mm
- 80mm

## 23.3 Invoice actions

After sale:

```text
Print
Save PDF
Send WhatsApp
New Sale
```

Existing invoice:

```text
View
Preview
Print
Reprint
Save PDF
Send WhatsApp
```

## 23.4 Invoice numbering

Format example:

```text
INV-000001
INV-000002
INV-000003
```

Requirements:

- Automatic generation
- Configurable prefix
- Configurable starting sequence
- No duplicate invoice numbers
- Sequence must be transaction-safe

---

# 24. Printer Control Flow

```text
Sale Complete
   |
   v
Generate Invoice Data
   |
   +-- A4 selected?
   |      |
   |      +--> A4 renderer
   |
   +-- Thermal selected?
          |
          +--> 58mm/80mm renderer
   |
   v
Preview
   |
   v
Print
```

Printer settings:

- Printer selection
- Paper format
- Default printer
- Receipt format
- Copies where supported

Printing failure must not roll back a completed sale.

The sale is already committed.

```text
Sale committed
   |
   v
Print fails
   |
   +--> Show print error
   +--> Allow retry
   +--> Allow PDF
   +--> Allow reprint
```

---

# 25. Barcode Scanner

USB barcode scanners that operate as keyboard/HID devices should be supported.

Flow:

```text
Scan barcode
   |
   v
Read barcode
   |
   v
Search local SQLite
   |
   +-- Product found
   |      |
   |      v
   |   Add to cart
   |
   +-- Not found
          |
          v
      Show not found
```

Barcode lookup must work fully offline.

---

# 26. Settings

## Company

- Shop/company name
- Logo
- Address
- Phone
- Tax registration

## Invoice

- Prefix
- Starting sequence
- Format
- Footer
- Terms
- Payment information

## Tax/GST

- Enable/disable tax
- Tax rates
- Default tax rate
- Tax behavior

## POS

- Default payment method
- Negative stock policy
- Customer defaults
- Barcode behavior

## Printer

- Printer selection
- A4/thermal
- Thermal width
- Print preferences

## Inventory

- Default reorder level
- Negative-stock policy

## Backup

- Backup location
- Automatic schedule
- Number of retained backups

## Security

- Session timeout
- Admin credentials
- Sensitive-setting protection

---

# 27. Negative Stock Policy

Setting:

```text
BLOCK SALE
```

or

```text
ALLOW WITH WARNING
```

## Block

```text
Stock = 5
Requested = 6

Sale rejected.
```

## Allow with warning

```text
Stock = 5
Requested = 6

Warning:
"This sale will result in negative stock."

Confirm
    |
    v
Continue
```

This rule must be enforced in the backend service, not only in React.

---

# 28. Authentication & Security

## First admin creation

Admin is created during first-run setup.

## Password

Never store plaintext passwords.

Use a strong password hashing algorithm such as:

- Argon2id
- bcrypt

## Session

Session automatically expires after configurable inactivity.

Example:

```text
User inactive
    |
    v
Timeout reached
    |
    v
Lock/logout
    |
    v
Login required
```

## Sensitive settings

Require administrator permission for:

- Restore
- Database maintenance
- Tax configuration
- Invoice numbering
- Negative-stock policy
- Product price changes where configured
- Security settings
- License settings

---

# 29. Audit Log

Important actions must be logged.

Examples:

- Invoice cancellation
- Stock adjustment
- Product price change
- Product deactivation
- Database restore
- Backup creation
- Security-setting changes
- Tax-setting changes
- Invoice numbering changes

Audit record should contain:

- ID
- User ID
- Action
- Entity type
- Entity ID
- Previous value where appropriate
- New value where appropriate
- Timestamp
- Optional reason

Audit records should be append-only from the normal UI.

---

# 30. Backup & Restore

Backup is a critical feature because the operational database is local.

## 30.1 Automatic daily backup

```text
Application running
      |
      v
Backup scheduler checks
      |
      v
Backup due?
   |       |
  No      Yes
   |       |
  Stop     v
        Create backup
             |
             v
        Validate backup
             |
             v
        Save timestamped file
```

## 30.2 Manual backup

```text
Settings
   |
   v
Backup & Restore
   |
   v
Backup Now
   |
   v
Create database backup
   |
   v
Validate
   |
   v
Show success path
```

## 30.3 Backup location

User may select:

- Another local drive
- USB drive
- Network folder

## 30.4 Backup naming

Example:

```text
RSInventory_Backup_2026-09-18_180500.db
```

## 30.5 Multiple versions

Keep configurable historical backup versions.

Example:

```text
Latest 7 backups
```

or configurable retention.

## 30.6 Restore

```text
Select Backup
      |
      v
Validate backup file
      |
      v
Check database integrity
      |
      v
Create safety backup of current DB
      |
      v
Show destructive confirmation
      |
      v
Restore
      |
      v
Verify restored DB
      |
      v
Restart/reload application
```

Restore must never silently replace the current database.

## 30.7 Export/import package

Recommended backup package:

```text
RSInventory_Backup.zip
 |
 +-- database.sqlite
 +-- company.json
 +-- settings.json
 +-- logo/
 +-- assets/
 +-- manifest.json
```

The package must include a version/schema identifier.

---

# 31. Database Maintenance

Maintenance tools may include:

- Integrity check
- Stock reconciliation
- Database statistics
- Backup verification
- Vacuum
- Repair diagnostics
- Orphan-record detection

Destructive maintenance operations require administrator confirmation.

---

# 32. First-Run Setup Wizard

## Step 1 — Welcome

Show:

- Product name
- Version
- Offline-first explanation

## Step 2 — Company / Store

Collect:

- Shop name
- Address
- Phone
- GSTIN/tax registration

## Step 3 — Currency & Tax

Collect:

- Currency
- Tax enabled
- Default tax rate

## Step 4 — Invoice

Collect:

- Invoice prefix
- Starting number
- A4/thermal preference

## Step 5 — Printer

Detect/select printer.

Allow skip.

## Step 6 — Admin

Collect:

- Username
- Password
- Confirm password

Password is hashed before storage.

## Step 7 — Backup

Choose:

- Backup folder
- Automatic backup schedule

Allow default local backup if skipped.

## Step 8 — Finish

```text
Create default configuration
      |
      v
Create admin
      |
      v
Create Cash Customer
      |
      v
Create default tax/payment settings
      |
      v
Initialize database
      |
      v
Open Dashboard
```

All setup initialization should be transactional where possible.

---

# 33. Offline Requirements

The following must work with internet disconnected:

- Login
- Dashboard
- Product search
- Product creation
- Product editing
- Product deactivation
- Barcode search
- POS
- Sales
- Purchases
- Sales returns
- Purchase returns
- Customers
- Suppliers
- Customer payments
- Supplier payments
- Expenses
- Stock adjustments
- Reports
- Invoice generation
- PDF generation
- Printing
- Backup
- Restore
- Database maintenance

No external API call should be required for these operations.

---

# 34. Optional Online Services

## 34.1 WhatsApp

Only this subsystem requires internet for delivery.

Recommended architecture:

```text
Electron POS
    |
    | HTTPS
    v
RS Online API
    |
    v
WhatsApp Business Platform
    |
    v
Customer WhatsApp
```

Do not embed long-lived WhatsApp API secrets directly in the desktop renderer.

## 34.2 WhatsApp bill flow

```text
Sale Complete
    |
    v
Invoice committed locally
    |
    v
Generate PDF/document
    |
    v
User clicks Send WhatsApp
    |
    v
Check internet
    |
    +-- Offline
    |      |
    |      v
    |   Queue pending delivery
    |
    +-- Online
           |
           v
        RS Online API
           |
           v
        WhatsApp API
           |
           v
        Delivery result
```

WhatsApp failure must not undo the sale.

## 34.3 Pending WhatsApp queue

A local queue should contain:

- Queue ID
- Invoice ID
- Customer phone
- Document path/reference
- Status
- Retry count
- Last error
- Created time
- Last attempt

States:

```text
PENDING
SENDING
SENT
FAILED
CANCELLED
```

Retry is allowed for transient failures.

---

# 35. License Service

Because the software may be sold separately to individual shops, an optional license service should exist outside the core POS.

## Activation

```text
Install
   |
   v
Enter License Key
   |
   v
Send activation request
   |
   v
License Server
   |
   +-- Valid
   |     |
   |     v
   |   Bind installation/device
   |
   +-- Invalid
         |
         v
      Reject
```

The POS must retain a secure local license state so that temporary internet unavailability does not stop local operations.

License checking must never block already-authorized core POS usage merely because the internet is temporarily unavailable.

---

# 36. Application Updates

Updates are optional online operations.

```text
POS
 |
 v
Check update metadata
 |
 +-- No update --> Continue
 |
 +-- Update --> Download
                  |
                  v
               Verify
                  |
                  v
               Install
                  |
                  v
               Restart
```

Update failure:

```text
Download fails
    |
    v
Keep current version
```

Core POS remains usable.

---

# 37. Optional Cloud Backup

Cloud backup is not required for normal operation.

```text
Local SQLite
    |
    v
Encrypted backup package
    |
    v
HTTPS upload
    |
    v
Cloud storage
```

If upload fails:

```text
Local backup remains available
```

Cloud failure must never block local transactions.

---

# 38. Error Handling

## General principles

- Never silently discard an error.
- Never partially save financial transactions.
- Show user-friendly messages.
- Store technical details in logs.
- Preserve the database when an operation fails.
- Allow retry where safe.

## Common validation errors

### Quantity

```text
quantity <= 0
```

Reject.

### Price

Negative/invalid prices reject.

### Discount

Discount outside configured range reject.

### Tax

Invalid tax rate reject.

### SKU

Duplicate reject.

### Barcode

Duplicate reject.

### Invoice number

Duplicate reject.

### Return quantity

Return above remaining quantity reject.

### Credit sale

Credit without valid customer reject.

---

# 39. Transaction Safety Rules

The following operations MUST use database transactions:

- Sale
- Purchase
- Sales return
- Purchase return
- Stock adjustment
- Customer payment
- Supplier payment
- Opening stock where applicable
- Invoice sequence update

## Atomic sale example

```text
BEGIN
 |
 +-- sale
 +-- sale_items
 +-- payment
 +-- customer_balance
 +-- stock_ledger
 +-- product.current_stock
 |
COMMIT
```

Failure anywhere:

```text
ROLLBACK
```

---

# 40. Concurrency / SQLite Safety

Although Solo is primarily single-user, the application must avoid unsafe concurrent writes.

Rules:

- Serialize write operations where necessary.
- Use SQLite transactions.
- Use appropriate busy timeout.
- Avoid long-running transactions.
- Never hold a transaction open while printing.
- Never hold a transaction open while waiting for WhatsApp.
- Never call remote services inside a database transaction.

Correct:

```text
BEGIN
  Save sale
  Update stock
COMMIT

Then:
  Print
  WhatsApp
```

Incorrect:

```text
BEGIN
  Save sale
  Call WhatsApp
  Wait
  Print
COMMIT
```

---

# 41. Online-Service Isolation

Remote calls must happen outside core database transactions.

For example:

```text
SALE TRANSACTION
     |
     v
COMMIT
     |
     +----> Print
     |
     +----> WhatsApp
     |
     +----> Analytics/backup if enabled
```

Never:

```text
Sale
  |
  +--> WhatsApp API
         |
       timeout
         |
       rollback sale
```

---

# 42. Local Data Directory

Recommended conceptual layout:

```text
RSInventory/
 |
 +-- data/
 |    +-- database.sqlite
 |
 +-- backups/
 |
 +-- logs/
 |
 +-- documents/
 |    +-- invoices/
 |
 +-- assets/
 |    +-- logo/
 |
 +-- config/
 |
 +-- temp/
```

Actual application-specific paths should follow Windows best practices and user permissions.

Sensitive secrets should not be stored in easily accessible frontend files.

---

# 43. Recommended Node.js Service Architecture

```text
src/
 |
 +-- main/
 |    +-- main.ts
 |    +-- ipc/
 |    +-- windows/
 |    +-- printer/
 |    +-- backup/
 |    +-- updater/
 |
 +-- preload/
 |    +-- preload.ts
 |
 +-- renderer/
 |    +-- React application
 |
 +-- server/
      +-- services/
      |    +-- product.service.ts
      |    +-- sale.service.ts
      |    +-- purchase.service.ts
      |    +-- inventory.service.ts
      |    +-- customer.service.ts
      |    +-- supplier.service.ts
      |    +-- return.service.ts
      |    +-- expense.service.ts
      |    +-- report.service.ts
      |    +-- backup.service.ts
      |
      +-- repositories/
      +-- validators/
      +-- calculations/
      +-- audit/
      +-- db/
      +-- types/
```

The exact folder structure may evolve, but business logic should remain outside React components.

---

# 44. Frontend Architecture

Recommended:

```text
React
 |
 +-- pages/
 +-- components/
 +-- features/
 |    +-- pos/
 |    +-- products/
 |    +-- purchases/
 |    +-- inventory/
 |    +-- customers/
 |    +-- suppliers/
 |    +-- reports/
 |    +-- settings/
 |
 +-- hooks/
 +-- stores/
 +-- api/
 +-- ipc/
 +-- validation/
 +-- utils/
```

State management may use a lightweight library where needed.

---

# 45. Control Flow: Complete Daily Shop Workflow

```text
START APPLICATION
      |
      v
Check first-run state
      |
      +-- Not configured --> Setup Wizard
      |
      +-- Configured --> Login
                         |
                         v
                       Dashboard
                         |
          +--------------+--------------+
          |              |              |
       Purchase        Sale          Expense
          |              |              |
          v              v              v
       Stock +        Stock -       Expense
          |              |              |
          +--------------+--------------+
                         |
                         v
                      Reports
                         |
                         v
                       Backup
                         |
                         v
                       Exit
```

---

# 46. Control Flow: Complete Sale

```text
USER
 |
 +--> New Sale
 |
 +--> Scan/Search Product
 |
 +--> Add Quantity
 |
 +--> Cart calculation
 |
 +--> Discount
 |
 +--> Tax
 |
 +--> Customer
 |
 +--> Payment
 |
 +--> Validate
 |
 +--> BEGIN TRANSACTION
 |       |
 |       +--> Generate invoice number
 |       +--> Create sale
 |       +--> Create sale items
 |       +--> Store historical cost
 |       +--> Create payment
 |       +--> Update customer
 |       +--> Update stock
 |       +--> Create SALE ledger
 |       |
 |       +--> COMMIT
 |
 +--> Generate invoice
 |
 +--> Print/PDF
 |
 +--> WhatsApp optional
 |
 +--> New Sale
```

---

# 47. Control Flow: Complete Purchase

```text
USER
 |
 +--> New Purchase
 |
 +--> Supplier
 |
 +--> Products
 |
 +--> Quantity
 |
 +--> Purchase Price
 |
 +--> Discount
 |
 +--> Tax
 |
 +--> Total
 |
 +--> Paid / Due
 |
 +--> Validate
 |
 +--> BEGIN TRANSACTION
 |       |
 |       +--> Purchase header
 |       +--> Purchase items
 |       +--> Payment
 |       +--> Stock +
 |       +--> PURCHASE ledger
 |       +--> Supplier balance
 |       |
 |       +--> COMMIT
 |
 +--> Purchase completed
```

---

# 48. Control Flow: Sales Return

```text
Find Invoice
   |
   v
Select item
   |
   v
Validate remaining quantity
   |
   v
Calculate refund
   |
   v
BEGIN
   |
   +-- Create return
   +-- Return items
   +-- Stock +
   +-- RETURN_IN
   +-- Refund/credit
   +-- Customer balance
   |
COMMIT
```

---

# 49. Control Flow: Purchase Return

```text
Find Purchase
   |
   v
Select item
   |
   v
Validate remaining quantity
   |
   v
Calculate return
   |
   v
BEGIN
   |
   +-- Create return
   +-- Return items
   +-- Stock -
   +-- RETURN_OUT
   +-- Supplier balance/refund
   |
COMMIT
```

---

# 50. Control Flow: Backup

```text
Manual or Scheduled Trigger
          |
          v
Check database availability
          |
          v
Create consistent backup
          |
          v
Integrity validation
          |
          v
Timestamp filename
          |
          v
Save
          |
          v
Apply retention
          |
          v
Audit backup
```

---

# 51. Control Flow: Restore

```text
Admin opens Restore
       |
       v
Select backup
       |
       v
Validate format
       |
       v
Integrity check
       |
       v
Safety backup current DB
       |
       v
Confirmation
       |
       v
Restore
       |
       v
Validate restored DB
       |
       v
Reload/restart
       |
       v
Audit restore
```

If restored DB validation fails, the application must preserve/recover the previous working database.

---

# 52. Control Flow: WhatsApp

```text
Invoice committed
      |
      v
User selects Send WhatsApp
      |
      v
Check customer number
      |
      +-- Invalid --> Show validation error
      |
      +-- Valid
             |
             v
        Check internet
             |
        +----+----+
        |         |
       OFF       ON
        |         |
        v         v
      Queue     Send API
        |         |
        |    +----+----+
        |    |         |
        |  Success    Fail
        |    |         |
        |    v         v
        |   SENT     FAILED
        |
        v
   Retry later
```

---

# 53. Control Flow: Application Shutdown

```text
Exit requested
      |
      v
Check active transaction
      |
      +-- Active --> Finish/rollback safely
      |
      +-- None
             |
             v
       Flush local state
             |
             v
       Stop background jobs
             |
             v
       Close DB
             |
             v
       Exit Electron
```

The app must not terminate in the middle of a committed financial transaction.

---

# 54. Data Integrity Invariants

These rules must always remain true:

1. SKU uniqueness is enforced by database constraint.
2. Barcode uniqueness is enforced when barcode exists.
3. Invoice numbers are unique.
4. Sale items belong to a valid sale.
5. Purchase items belong to a valid purchase.
6. Return quantities never exceed eligible quantities.
7. Every stock change has a ledger entry.
8. Cached stock equals committed ledger balance.
9. Historical sale cost price never changes.
10. Financial transactions are atomic.
11. Original sale/purchase documents are immutable after posting except through defined cancellation/return workflows.
12. Products with transaction history cannot be deleted.
13. Customers with transaction history cannot be deleted.
14. Suppliers with transaction history cannot be deleted.
15. Passwords are never stored plaintext.
16. Online service failures cannot corrupt local transactions.
17. Printing failures cannot undo completed sales.
18. WhatsApp failures cannot undo completed sales.
19. Restore creates a safety backup before replacement.
20. Backup files are integrity-checked.

---

# 55. Transaction States

Where useful, financial records should support states such as:

```text
DRAFT
POSTED
CANCELLED
```

A posted financial transaction should not be silently edited.

For corrections:

```text
Original Transaction
       |
       +--> Return
       +--> Cancellation (where permitted)
       +--> Adjustment
```

This preserves auditability.

---

# 56. Cancellation Rules

Cancellation of a financial transaction must:

- Require confirmation.
- Require administrator authorization where configured.
- Create audit record.
- Reverse stock if stock was affected.
- Reverse applicable customer/supplier balance.
- Never simply delete historical records.

A cancellation should be modeled as a controlled reversal rather than destructive deletion.

---

# 57. Performance Requirements

The POS must prioritize fast local operations.

Target behavior:

- Barcode lookup should feel instantaneous.
- Cart operations should not require network access.
- Sales should commit locally without waiting for internet.
- Reports should query local indexes efficiently.
- Large product lists should support pagination/search.
- Heavy reports should avoid blocking the UI thread.
- PDF generation should not freeze the renderer.

---

# 58. Reliability Requirements

The application must:

- Recover cleanly after normal restart.
- Detect database corruption where possible.
- Maintain backups.
- Avoid partial financial records.
- Preserve audit history.
- Handle printer failures gracefully.
- Handle disconnected internet gracefully.
- Handle missing optional services gracefully.

---

# 59. Security Model

```text
React Renderer
     |
     | limited exposed API
     v
Preload
     |
     | validated IPC
     v
Main Process
     |
     | authorized service call
     v
Domain Service
     |
     v
Repository / Prisma
     |
     v
SQLite
```

Never expose:

- Arbitrary filesystem APIs
- Arbitrary shell execution
- Database connection directly
- WhatsApp secrets
- License secrets

to the React renderer.

Electron security should include appropriate production settings such as:

- Context isolation
- Sandboxed renderer where compatible
- Disabled unsafe Node integration in renderer
- Narrow preload API
- Strict IPC validation
- Secure external URL handling

---

# 60. Recommended Database Entities

Core conceptual entities:

```text
users
roles
permissions
user_sessions
audit_logs

company_settings
invoice_settings
tax_settings
printer_settings
backup_settings

categories
brands
units
products

stock_ledger
stock_adjustments

customers
customer_ledger
customer_payments

suppliers
supplier_ledger
supplier_payments

purchases
purchase_items
purchase_payments

sales
sale_items
sale_payments

sales_returns
sales_return_items

purchase_returns
purchase_return_items

expenses
expense_categories

invoice_sequences

whatsapp_queue
license_state
app_settings
```

Exact schema, columns, foreign keys, indexes, and Prisma models should be finalized as the next implementation specification.

---

# 61. Recommended Indexes

At minimum:

### Products

- SKU unique index
- Barcode unique index where non-null
- Name index
- Category index
- Status index

### Sales

- Invoice number unique
- Sale date
- Customer ID

### Purchases

- Purchase number unique
- Purchase date
- Supplier ID

### Stock ledger

- Product ID + timestamp
- Transaction type
- Reference ID

### Customers

- Phone
- Status

### Suppliers

- Phone
- Status

### Audit

- Timestamp
- Entity type + entity ID

---

# 62. Backup Safety Rules

Never:

- Overwrite the only backup blindly.
- Restore without validation.
- Delete all previous backups after creating one.
- Store the only backup on the same physical disk if the user explicitly selected another location.
- Perform destructive restore without confirmation.

Recommended:

```text
Current DB
   |
   +--> Working database
   |
   +--> Local backup
   |
   +--> Optional external backup
```

---

# 63. UX Principles

The POS is intended for shop staff, so the UI should be:

- Fast
- Keyboard-friendly
- Barcode-friendly
- Minimal-click
- Clear
- Readable
- Responsive
- Error-tolerant

POS screen should prioritize:

1. Product search/scan
2. Cart
3. Quantity
4. Total
5. Payment
6. Complete Sale

Do not overload the billing screen with administrative controls.

---

# 64. Keyboard Shortcuts

Recommended:

```text
F1  New Sale
F2  Search Product
F3  Customer
F4  Payment
F5  Hold/Resume Sale (if implemented)
F6  Discount
F7  Sales History
F8  New Purchase
F9  Print
ESC Cancel current modal
CTRL+B Backup
CTRL+P Print
```

Shortcut assignments may be configurable later.

---

# 65. Future RS Inventory Business Compatibility

The Solo architecture should avoid hard-coding assumptions that prevent expansion.

Future:

```text
RS Inventory Solo
       |
       v
RS Inventory Business
       |
       +-- Multiple users
       +-- Multiple stores
       +-- Cloud sync
       +-- Central dashboard
       +-- Role permissions
       +-- Multi-device
       +-- Advanced accounting
       +-- E-commerce
```

The domain services should be reusable.

For example:

```text
SaleService
InventoryService
PurchaseService
CustomerService
SupplierService
ReportService
```

should not depend directly on Electron UI code.

---

# 66. Development Order

Recommended implementation sequence:

## Phase 1 — Foundation

- Electron
- React
- TypeScript
- Node.js
- Prisma
- SQLite
- IPC
- App shell
- Logging
- Configuration

## Phase 2 — Setup & Security

- First-run wizard
- Admin
- Password hashing
- Session
- Settings

## Phase 3 — Master Data

- Products
- Categories
- Brands
- Units
- Customers
- Suppliers

## Phase 4 — Inventory

- Opening stock
- Stock ledger
- Adjustments
- Low stock
- Stock calculations

## Phase 5 — Purchases

- Purchase
- Supplier balance
- Purchase payment
- Purchase stock-in

## Phase 6 — POS

- Cart
- Barcode
- Search
- Sales
- Payment
- Invoice
- Stock-out

## Phase 7 — Returns

- Sales return
- Purchase return
- Refund/credit
- Balance corrections

## Phase 8 — Expenses & Profit

- Expenses
- Historical cost
- Profit calculations

## Phase 9 — Reports

- Sales
- Purchase
- Inventory
- Returns
- Outstanding
- Profit
- Tax

## Phase 10 — Printing

- A4
- 58mm
- 80mm
- PDF
- Reprint
- Preview

## Phase 11 — Backup

- Manual backup
- Automatic backup
- Restore
- Integrity validation
- Maintenance

## Phase 12 — Optional Online

- WhatsApp
- License
- Updates
- Cloud backup

---

# 67. Definition of Done

The Solo product is considered production-ready only when:

### Product

- SKU uniqueness works.
- Barcode uniqueness works.
- Duplicate-name warning works.
- Inactive products cannot be accidentally sold.
- Stock cannot be directly edited.

### Purchase

- Purchase transaction is atomic.
- Stock increases correctly.
- Supplier balance is correct.
- Payment is correct.
- Failure rolls back all changes.

### Sale

- Stock validation works.
- Negative-stock policy works.
- Invoice number is unique.
- Historical cost is stored.
- Stock decreases correctly.
- Customer balance is correct.
- Failure rolls back all changes.

### Returns

- Return quantity validation works.
- Original transaction remains unchanged.
- Stock is reversed correctly.
- Customer/supplier balance is corrected.

### Reports

- Date filters work.
- Totals match transactional data.
- Historical profit uses stored cost.

### Invoice

- A4 works.
- 58mm works.
- 80mm works.
- PDF works.
- Reprint works.

### Backup

- Automatic backup works.
- Manual backup works.
- Restore validation works.
- Safety backup is created before restore.

### Offline

Disconnect internet and verify:

```text
Sale       PASS
Purchase   PASS
Inventory  PASS
Reports    PASS
Printing   PASS
Backup     PASS
```

### Online

Reconnect internet and verify:

```text
WhatsApp       PASS
License        PASS
Updates        PASS
Cloud Backup   PASS (if enabled)
```

---

# 68. Final Product Control Flow

```text
                         APPLICATION START
                                |
                                v
                     +-----------------------+
                     | First-run configured? |
                     +-----------+-----------+
                                 |
                    +------------+------------+
                    |                         |
                   NO                        YES
                    |                         |
                    v                         v
             SETUP WIZARD                    LOGIN
                    |                         |
                    v                         v
             Initialize DB                AUTHENTICATE
                    |                         |
                    +------------+------------+
                                 |
                                 v
                              DASHBOARD
                                 |
       +-------------------------+-------------------------+
       |            |            |            |            |
       v            v            v            v            v
    PRODUCTS    PURCHASE       POS         CUSTOMERS    REPORTS
       |            |            |            |            |
       v            v            v            v            |
   MASTER DATA   STOCK IN     STOCK OUT   BALANCES         |
       |            |            |            |            |
       +------------+------------+------------+------------+
                                 |
                                 v
                         STOCK LEDGER
                                 |
                                 v
                         AUDIT / REPORTS
                                 |
                 +---------------+---------------+
                 |                               |
                 v                               v
              BACKUP                         ONLINE
                 |                               |
                 |                    +----------+----------+
                 |                    |          |          |
                 |                 WhatsApp   License    Update
                 |                               |
                 +---------------+---------------+
                                 |
                                 v
                                EXIT
```

---

# 69. Product Philosophy

RS Inventory – Solo is not a cloud-dependent POS.

Its core promise is:

> **Fast local billing, reliable inventory, safe data, and continued operation without internet.**

The internet is an enhancement layer, not a dependency.

```text
CORE
  |
  +-- POS
  +-- Inventory
  +-- Purchase
  +-- Returns
  +-- Customer
  +-- Supplier
  +-- Expenses
  +-- Reports
  +-- Invoice
  +-- Printing
  +-- Backup
  |
  +--> WORKS OFFLINE

OPTIONAL ONLINE
  |
  +-- WhatsApp
  +-- License
  +-- Updates
  +-- Cloud Backup
```

This specification is the functional baseline for implementation. Any feature added later should preserve the core principles of offline operation, transaction atomicity, stock-ledger auditability, historical profit accuracy, secure local storage, and graceful failure of optional online services.
