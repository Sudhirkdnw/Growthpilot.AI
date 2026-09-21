import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Boxes,
  FileBarChart,
  ScanBarcode,
  WifiOff,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Lock,
  Loader2,
  Truck,
  Users,
  Printer,
  Database,
  Settings,
} from 'lucide-react';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { useAuthStore } from './stores/authStore';
import { useTheme } from './theme/ThemeEngine';
import { FirstRunWizard } from './features/setup/FirstRunWizard';
import { LoginView } from './features/auth/LoginView';
import { LockScreen } from './features/auth/LockScreen';
import { ProductCatalogView } from './features/products/ProductCatalogView';
import { InventoryView } from './features/inventory/InventoryView';
import { PurchaseView } from './features/purchases/PurchaseView';
import { CustomerKhataView } from './features/customers/CustomerKhataView';
import { PosBillingView } from './features/pos/PosBillingView';
import { DashboardView } from './features/reports/DashboardView';
import { ReportsHubView } from './features/reports/ReportsHubView';
import { AdministrationHubView } from './features/admin/AdministrationHubView';
import { PrinterSettingsModal } from './features/invoice/PrinterSettingsModal';
import { BackupRestoreModal } from './features/settings/BackupRestoreModal';

export default function App() {
  const { isFirstRun, session, isLocked, isLoading, checkStatus, logout, lock, settings } = useAuthStore();
  const { appName, logoUrl } = useTheme();

  const [activeTab, setActiveTab] = useState<'pos' | 'dashboard' | 'products' | 'inventory' | 'purchases' | 'customers' | 'reports' | 'admin'>('pos');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartTotal, setCartTotal] = useState<number>(0);
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);
  const [showBackupRestore, setShowBackupRestore] = useState<boolean>(false);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Global Barcode Scanner Detector (active only when logged in and unlocked)
  useBarcodeScanner({
    config: { enabled: Boolean(session && !isLocked) },
    onScan: (barcode) => {
      setLastScanned(barcode);
      setCartCount((prev) => prev + 1);
      setCartTotal((prev) => prev + 150);
    },
    onError: (err) => {
      console.warn('[Scanner Error]', err);
    },
  });

  // 1. Loading Splash
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center text-foreground space-y-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-orange-500/30">
          RS
        </div>
        <div className="flex items-center space-x-2 text-sm text-foreground-muted">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Starting RS Inventory – Solo...</span>
        </div>
      </div>
    );
  }

  // 2. First-Run Setup Wizard
  if (isFirstRun) {
    return <FirstRunWizard />;
  }

  // 3. Login Screen
  if (!session) {
    return <LoginView />;
  }

  // 4. Main POS Workstation Layout
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground relative">
      {/* Inactivity Lockout Overlay */}
      {isLocked && <LockScreen />}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-sidebar-border flex items-center space-x-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg shadow-accent" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold text-lg shadow-accent">
                RS
              </div>
            )}
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm tracking-wide text-sidebar-text truncate">
                {appName}
              </h1>
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider bg-accent-muted px-1.5 py-0.5 rounded border border-accent/20">
                Solo Station
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pos'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>POS Billing</span>
              <span className="ml-auto text-[10px] bg-black/20 px-1.5 py-0.5 rounded">F1</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'products'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products Catalog</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'inventory'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Stock Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab('purchases')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'purchases'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Purchases & Inward</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'customers'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customers & Khata</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reports'
                  ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                  : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
              }`}
            >
              <FileBarChart className="w-4 h-4" />
              <span>Reports & Profit</span>
            </button>

            {session.user.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-accent text-accent-foreground shadow-accent font-semibold'
                    : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Administration</span>
                <span className="ml-auto text-[10px] bg-black/20 px-1.5 py-0.5 rounded">F9</span>
              </button>
            )}
          </nav>
        </div>

        {/* System Status & User Actions Footer */}
        <div className="p-4 border-t border-sidebar-border bg-surface-muted/50 space-y-3">
          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="flex items-center space-x-1.5">
              <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
              <span>Offline-First (Active)</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>

          <div className="flex items-center justify-between text-xs text-foreground-muted">
            <span className="flex items-center space-x-1.5">
              <ScanBarcode className="w-3.5 h-3.5 text-amber-500" />
              <span>HID Scanner Armed</span>
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          <div className="pt-2 border-t border-sidebar-border flex items-center justify-between text-xs">
            <div className="truncate mr-2">
              <span className="text-foreground-subtle block text-[10px]">Active Cashier</span>
              <span className="font-semibold text-foreground truncate">{session.user.fullName}</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => lock()}
                title="Lock Station"
                className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-primary transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => logout()}
                title="Sign Out"
                className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-danger transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {activeTab === 'pos' && 'Point of Sale (Cashier Station)'}
              {activeTab === 'dashboard' && 'Executive Store Dashboard'}
              {activeTab === 'products' && 'Master Product Catalog'}
              {activeTab === 'inventory' && 'Double-Entry Stock Ledger'}
              {activeTab === 'purchases' && 'Purchases & Supplier Accounts'}
              {activeTab === 'customers' && 'Customer Ledger & Accounts Receivable (Khata)'}
              {activeTab === 'reports' && 'Business Intelligence & Historical Profit'}
            </h2>
            {lastScanned && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-muted text-primary border border-primary/30">
                <ScanBarcode className="w-3 h-3 mr-1" />
                Scanned: {lastScanned}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={() => setShowBackupRestore(true)}
              title="Database Backup, Restore & Disaster Recovery Center"
              className="px-2.5 py-1 rounded bg-surface-muted hover:bg-surface-hover text-foreground-secondary hover:text-foreground border border-border flex items-center space-x-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span>Backups & DR</span>
            </button>
            {session.user.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                title="Administration & Master Settings"
                className="px-2.5 py-1 rounded bg-surface-muted hover:bg-surface-hover text-foreground-secondary hover:text-foreground border border-border flex items-center space-x-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-accent" />
                <span>Administration</span>
              </button>
            )}
            <button
              onClick={() => setShowPrinterSettings(true)}
              title="Configure Hardware Printer & Invoices"
              className="px-2.5 py-1 rounded bg-surface-muted hover:bg-surface-hover text-foreground-secondary hover:text-foreground border border-border flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-accent" />
              <span>Printer Settings</span>
            </button>
            <span className="px-2.5 py-1 rounded bg-surface-muted text-foreground-secondary border border-border flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Role: {session.user.role}</span>
            </span>
          </div>
        </header>

        {/* View Body */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'admin' ? 'p-0 flex flex-col' : 'p-6'}`}>
          {activeTab === 'pos' && (
            <PosBillingView />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView token={session.token} />
          )}

          {activeTab === 'products' && (
            <ProductCatalogView />
          )}

          {activeTab === 'inventory' && (
            <InventoryView />
          )}

          {activeTab === 'purchases' && (
            <PurchaseView />
          )}

          {activeTab === 'customers' && (
            <CustomerKhataView />
          )}

          {activeTab === 'reports' && (
            <ReportsHubView token={session.token} />
          )}

          {activeTab === 'admin' && (
            <AdministrationHubView />
          )}
        </div>
      </main>

      {/* Global Printer & Invoice Settings Modal */}
      {showPrinterSettings && (
        <PrinterSettingsModal onClose={() => setShowPrinterSettings(false)} />
      )}

      {/* Database Backup, Restore & Disaster Recovery Modal */}
      {showBackupRestore && (
        <BackupRestoreModal onClose={() => setShowBackupRestore(false)} />
      )}
    </div>
  );
}
