import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ScanBarcode,
  Camera,
  Maximize2,
  Minimize2,
  Calculator,
  MoreVertical,
  Sun,
  Moon,
  Store,
  LogOut,
  ChevronDown,
  Trash2,
  Printer,
  BarChart3,
  Lock,
  ArrowLeftRight,
  RotateCcw,
  FolderOpen,
  History,
  Keyboard,
  Layers,
  LayoutGrid,
  List,
} from 'lucide-react';

export interface PosTopHeaderProps {
  appName?: string;
  storeName?: string;
  cashierName?: string;
  viewMode: 'beam' | 'lane' | 'counter';
  onViewModeChange: (mode: 'beam' | 'lane' | 'counter') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  barcodeInput: string;
  onBarcodeChange: (code: string) => void;
  onBarcodeSubmit: (code: string) => void;
  isOnline?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenCalculator: () => void;
  onOpenMenuAction: (action: string) => void;
  onOpenCameraScan: () => void;
  onLockOrExit?: () => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  barcodeInputRef: React.RefObject<HTMLInputElement>;
}

export function PosTopHeader({
  storeName = 'Main Store',
  cashierName = 'admin',
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  barcodeInput,
  onBarcodeChange,
  onBarcodeSubmit,
  isOnline = true,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenCalculator,
  onOpenMenuAction,
  onOpenCameraScan,
  onLockOrExit,
  searchInputRef,
  barcodeInputRef,
}: PosTopHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark';
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (storeRef.current && !storeRef.current.contains(e.target as Node)) {
        setStoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    const current = root.getAttribute('data-theme') || (root.classList.contains('dark') ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    if (next === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', next);
    setIsDark(next === 'dark');
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (barcodeInput.trim()) {
        onBarcodeSubmit(barcodeInput.trim());
      }
    }
  };

  return (
    <div className="flex flex-col bg-surface border-b border-border select-none shrink-0 z-30">
      {/* ---------------- Top Branding & Utility Bar (Image 3) ---------------- */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/60 bg-surface">
        {/* Left: HYPER POS Logo & Store Selector */}
        <div className="flex items-center space-x-3">
          {/* Logo Badge */}
          <div className="flex items-center space-x-1.5 font-black tracking-tight text-base">
            <div className="flex items-center bg-primary text-white px-2 py-0.5 rounded font-black text-sm tracking-wider uppercase shadow-sm">
              HYPER
            </div>
            <span className="font-extrabold text-foreground text-sm tracking-widest">
              POS
            </span>
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Store Selector Dropdown */}
          <div className="relative" ref={storeRef}>
            <button
              onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
              className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-surface-muted hover:bg-surface-hover text-xs font-semibold text-foreground border border-border/80 transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-primary" />
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[9px] uppercase tracking-wider text-foreground-muted font-bold">Store</span>
                <span className="truncate max-w-[120px] font-semibold">{storeName}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-foreground-muted ml-0.5" />
            </button>

            {storeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-surface-elevated border border-border rounded-xl shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground-muted border-b border-border/50">
                  Select Outlet / Branch
                </div>
                <button
                  onClick={() => setStoreDropdownOpen(false)}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center justify-between"
                >
                  <span>Main Store</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </button>
                <button
                  onClick={() => setStoreDropdownOpen(false)}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-surface-hover text-foreground-muted hover:text-foreground flex items-center justify-between"
                >
                  <span>Warehouse #1</span>
                  <span className="text-[10px] text-foreground-subtle">Secondary</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Theme Toggle, Cashier Profile & Exit */}
        <div className="flex items-center space-x-2">
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            className="p-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Cashier Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-surface-muted border border-border/60 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-foreground-muted text-[11px]">Cashier:</span>
            <span className="font-semibold text-foreground">{cashierName}</span>
          </div>

          {/* Quick Exit / Logout */}
          {onLockOrExit && (
            <button
              onClick={onLockOrExit}
              title="Lock Terminal or Sign Out"
              className="p-1.5 rounded-lg bg-surface-muted hover:bg-danger-bg text-foreground-muted hover:text-danger-text transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ---------------- Sub-Header: Search, Barcode & Action Controls ---------------- */}
      <div className="h-14 px-4 flex items-center justify-between gap-3 bg-surface">
        {/* Left Inputs: Search (/) & Scan (F8) */}
        <div className="flex items-center space-x-2 flex-1 max-w-2xl">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products by name / SKU..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-input border border-border rounded-lg pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:border-primary transition-colors"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-muted text-foreground-muted border border-border/60">
              /
            </span>
          </div>

          {/* Scan Barcode Box */}
          <div className="relative flex-1">
            <ScanBarcode className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode..."
              value={barcodeInput}
              onChange={(e) => onBarcodeChange(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              className="w-full bg-input border border-border rounded-lg pl-9 pr-10 py-2 text-xs font-mono text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:border-primary transition-colors"
              data-scanner-target="true"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-surface-muted text-foreground-muted border border-border/60">
              F8
            </span>
          </div>

          {/* Camera Button */}
          <button
            onClick={onOpenCameraScan}
            title="Scan with Camera"
            className="p-2 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border/80 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Center / Right: View Mode Switchers & Utility Actions */}
        <div className="flex items-center space-x-2">
          {/* Mode Switchers: Beam, Lane, Counter */}
          <div className="flex items-center bg-input border border-border rounded-lg p-0.5">
            <button
              onClick={() => onViewModeChange('beam')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'beam'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
              }`}
              title="Beam - Visual Card Grid with Category Filter"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Beam</span>
            </button>

            <button
              onClick={() => onViewModeChange('lane')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'lane'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
              }`}
              title="Lane - Fast Streamlined Scanning Lane"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Lane</span>
            </button>

            <button
              onClick={() => onViewModeChange('counter')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'counter'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
              }`}
              title="Counter - High-Density Table with Category Sidebar"
            >
              <List className="w-3.5 h-3.5" />
              <span>Counter</span>
            </button>
          </div>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="p-2 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border/80 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Nta (Customer Facing Display or Register status) */}
          <button
            onClick={() => onOpenMenuAction('nta')}
            className="px-2.5 py-1.5 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border/80 text-xs font-bold transition-colors"
            title="Customer Pole Display / Secondary Screen"
          >
            Nta
          </button>

          {/* Online Status Badge */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[11px] font-bold uppercase tracking-wider">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Quick Calculator */}
          <button
            onClick={onOpenCalculator}
            title="Calculator"
            className="p-2 rounded-lg bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border/80 transition-colors"
          >
            <Calculator className="w-4 h-4" />
          </button>

          {/* Action Menu (Three dots dropdown as in Image 3) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              title="More Actions"
              className={`p-2 rounded-lg border border-border/80 transition-colors ${
                menuOpen
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface-elevated border border-border rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-border/40">
                <div className="py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('clear_cart');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-danger-bg text-danger-text flex items-center space-x-2.5 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-danger-text" />
                    <span>Clear cart</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('reprint_last');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <Printer className="w-4 h-4 text-foreground-muted" />
                    <span>Reprint last receipt</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('x_report');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 text-foreground-muted" />
                    <span>X-Report</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('close_shift');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <Lock className="w-4 h-4 text-foreground-muted" />
                    <span>Close shift</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('cash_in_out');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-foreground-muted" />
                    <span>Cash in / out</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('refund_return');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-foreground-muted" />
                    <span>Refund / Return</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('held_orders');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-foreground-muted" />
                    <span>Held orders</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('recent_sales');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <History className="w-4 h-4 text-foreground-muted" />
                    <span>Recent sales</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenMenuAction('shortcuts');
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-surface-hover text-foreground flex items-center space-x-2.5 transition-colors"
                  >
                    <Keyboard className="w-4 h-4 text-foreground-muted" />
                    <span>Keyboard shortcuts</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
