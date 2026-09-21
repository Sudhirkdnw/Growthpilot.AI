import { registerAuthIpc } from './auth.ipc';
import { registerSettingsIpc } from './settings.ipc';
import { registerProductIpc } from './product.ipc';
import { registerInventoryIpc } from './inventory.ipc';
import { registerSupplierIpc } from './supplier.ipc';
import { registerPurchaseIpc } from './purchase.ipc';
import { registerCustomerIpc } from './customer.ipc';
import { registerSaleIpc } from './sale.ipc';
import { registerPrinterIpc } from './printer.ipc';
import { registerReturnsIpc } from './returns.ipc';
import { registerExpenseIpc } from './expense.ipc';
import { registerReportsIpc } from './reports.ipc';
import { registerMaintenanceIpc } from './maintenance.ipc';
import { registerRoleIpc } from './role.ipc';
import { registerGatewayIpc } from './gateway.ipc';

export function registerAllIpcHandlers() {
  registerAuthIpc();
  registerSettingsIpc();
  registerProductIpc();
  registerInventoryIpc();
  registerSupplierIpc();
  registerPurchaseIpc();
  registerCustomerIpc();
  registerSaleIpc();
  registerPrinterIpc();
  registerReturnsIpc();
  registerExpenseIpc();
  registerReportsIpc();
  registerMaintenanceIpc();
  registerRoleIpc();
  registerGatewayIpc();
  console.log('[IPC] Registered Auth, Settings, Product, Inventory, Supplier, Purchase, Customer, Sale, Printer, Returns, Expense, Reports, Maintenance, Role, and Gateway IPC handlers.');
}

