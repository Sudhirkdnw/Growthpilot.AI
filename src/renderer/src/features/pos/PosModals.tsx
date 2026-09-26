import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator as CalcIcon,
  FolderOpen,
  Play,
  Trash2,
  Clock,
  User,
  Plus,
  Minus,
  CheckCircle2,
  DollarSign,
  Lock,
  ArrowLeftRight,
  BarChart3,
  Keyboard,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  AlertTriangle,
  Loader2,
  Tag,
  Search,
} from 'lucide-react';
import { CustomerDTO, PaymentMethod } from '../../../../shared/types';
import { PosCartItem } from './PosBillingView';

// ============================================================================
// 1. CALCULATOR MODAL (Fully Keyboard & Numpad Responsive)
// ============================================================================
export interface CalculatorModalProps {
  onClose: () => void;
}

export function CalculatorModal({ onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isCalculated, setIsCalculated] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const handleDigit = (digit: string) => {
    if (isCalculated) {
      setDisplay(digit);
      setIsCalculated(false);
      return;
    }
    setDisplay((prev) => (prev === '0' || prev === 'Error' ? digit : prev + digit));
  };

  const handleDecimal = () => {
    if (isCalculated) {
      setDisplay('0.');
      setIsCalculated(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay((prev) => (prev === 'Error' ? '0.' : prev + '.'));
    }
  };

  const handleOperator = (op: string) => {
    setIsCalculated(false);
    if (display === 'Error') {
      setDisplay('0');
      return;
    }

    if (equation && (display === '0' || display === '')) {
      // Replace previous operator
      setEquation((prev) => prev.slice(0, -2) + `${op} `);
      return;
    }

    setEquation((prev) => `${prev}${display} ${op} `);
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setIsCalculated(false);
  };

  const handleBackspace = () => {
    if (isCalculated) {
      handleClear();
      return;
    }
    setDisplay((prev) => {
      if (prev.length <= 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  };

  const handleEqual = () => {
    try {
      const full = `${equation}${display}`;
      if (!full.trim()) return;

      // Sanitize equation safely
      const sanitized = full.replace(/[^0-9+\-*/.]/g, '');
      if (!sanitized) return;

      // Evaluate safely
      const result = Function(`'use strict'; return (${sanitized})`)();
      if (!isFinite(result) || isNaN(result)) {
        setDisplay('Error');
      } else {
        const rounded = Math.round(result * 100000) / 100000;
        setDisplay(String(rounded));
      }
      setEquation('');
      setIsCalculated(true);
    } catch {
      setDisplay('Error');
      setIsCalculated(true);
    }
  };

  const handlePercentage = () => {
    const num = Number(display);
    if (!isNaN(num)) {
      setDisplay(String(num / 100));
    }
  };

  // --------------------------------------------------------------------------
  // PHYSICAL KEYBOARD & NUMPAD LISTENER
  // --------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();

      // Copy result (Ctrl+C)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        navigator.clipboard?.writeText(display);
        return;
      }

      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Clear on Delete or 'c' / 'C'
      if (e.key === 'Delete' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setPressedKey('C');
        handleClear();
        setTimeout(() => setPressedKey(null), 150);
        return;
      }

      // Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPressedKey('⌫');
        handleBackspace();
        setTimeout(() => setPressedKey(null), 150);
        return;
      }

      // Calculate (Enter or =)
      if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        setPressedKey('=');
        handleEqual();
        setTimeout(() => setPressedKey(null), 150);
        return;
      }

      // Percentage (%)
      if (e.key === '%') {
        e.preventDefault();
        setPressedKey('%');
        handlePercentage();
        setTimeout(() => setPressedKey(null), 150);
        return;
      }

      // Decimal point (. or ,)
      if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        setPressedKey('.');
        handleDecimal();
        setTimeout(() => setPressedKey(null), 150);
        return;
      }

      // Operators (+, -, *, / or x/X)
      if (['+', '-', '*', '/'].includes(e.key) || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        const op = e.key === 'x' || e.key === 'X' ? '*' : e.key;
        setPressedKey(op);
        handleOperator(op);
        setTimeout(() => setPressedKey(null), 150);
        return;
      }

      // Digits (0 to 9)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setPressedKey(e.key);
        handleDigit(e.key);
        setTimeout(() => setPressedKey(null), 150);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [display, equation, isCalculated]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl w-80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 bg-surface-muted border-b border-border flex items-center justify-between">
          <div className="flex items-center space-x-2 text-foreground font-bold text-xs">
            <CalcIcon className="w-4 h-4 text-primary" />
            <span>POS Quick Calculator</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground rounded-lg hover:bg-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-4 bg-input text-right border-b border-border/60">
          <div className="text-xs font-mono text-foreground-muted h-5 overflow-hidden text-ellipsis whitespace-nowrap">
            {equation || '\u00A0'}
          </div>
          <div className="text-3xl font-mono font-bold text-foreground truncate tracking-tight">
            {display}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="p-3.5 grid grid-cols-4 gap-2 bg-surface">
          {/* Row 1 */}
          <button
            onClick={handleClear}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === 'C'
                ? 'bg-danger text-white border-danger scale-95'
                : 'bg-surface-muted hover:bg-danger-bg text-danger-text hover:text-danger-text border-border/80'
            }`}
          >
            C
          </button>
          <button
            onClick={handlePercentage}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '%'
                ? 'bg-primary text-white border-primary scale-95'
                : 'bg-surface-muted hover:bg-surface-hover text-foreground border-border/80'
            }`}
          >
            %
          </button>
          <button
            onClick={handleBackspace}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '⌫'
                ? 'bg-primary text-white border-primary scale-95'
                : 'bg-surface-muted hover:bg-surface-hover text-foreground border-border/80'
            }`}
          >
            ⌫
          </button>
          <button
            onClick={() => handleOperator('/')}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '/'
                ? 'bg-primary text-white border-primary scale-95'
                : 'bg-surface-muted hover:bg-surface-hover text-primary font-extrabold border-border/80'
            }`}
          >
            ÷
          </button>

          {/* Row 2: 7, 8, 9, * */}
          {['7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className={`p-3 rounded-xl font-bold text-sm border transition-all ${
                pressedKey === digit
                  ? 'bg-primary/20 text-primary border-primary scale-95 font-black'
                  : 'bg-surface hover:bg-surface-hover text-foreground border-border/70'
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => handleOperator('*')}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '*'
                ? 'bg-primary text-white border-primary scale-95'
                : 'bg-surface-muted hover:bg-surface-hover text-primary font-extrabold border-border/80'
            }`}
          >
            ×
          </button>

          {/* Row 3: 4, 5, 6, - */}
          {['4', '5', '6'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className={`p-3 rounded-xl font-bold text-sm border transition-all ${
                pressedKey === digit
                  ? 'bg-primary/20 text-primary border-primary scale-95 font-black'
                  : 'bg-surface hover:bg-surface-hover text-foreground border-border/70'
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => handleOperator('-')}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '-'
                ? 'bg-primary text-white border-primary scale-95'
                : 'bg-surface-muted hover:bg-surface-hover text-primary font-extrabold border-border/80'
            }`}
          >
            −
          </button>

          {/* Row 4: 1, 2, 3, + */}
          {['1', '2', '3'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className={`p-3 rounded-xl font-bold text-sm border transition-all ${
                pressedKey === digit
                  ? 'bg-primary/20 text-primary border-primary scale-95 font-black'
                  : 'bg-surface hover:bg-surface-hover text-foreground border-border/70'
              }`}
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => handleOperator('+')}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '+'
                ? 'bg-primary text-white border-primary scale-95'
                : 'bg-surface-muted hover:bg-surface-hover text-primary font-extrabold border-border/80'
            }`}
          >
            +
          </button>

          {/* Row 5: 0, ., = */}
          <button
            onClick={() => handleDigit('0')}
            className={`col-span-2 p-3 rounded-xl font-bold text-sm border transition-all text-center ${
              pressedKey === '0'
                ? 'bg-primary/20 text-primary border-primary scale-95 font-black'
                : 'bg-surface hover:bg-surface-hover text-foreground border-border/70'
            }`}
          >
            0
          </button>
          <button
            onClick={handleDecimal}
            className={`p-3 rounded-xl font-bold text-sm border transition-all ${
              pressedKey === '.'
                ? 'bg-primary/20 text-primary border-primary scale-95 font-black'
                : 'bg-surface hover:bg-surface-hover text-foreground border-border/70'
            }`}
          >
            .
          </button>
          <button
            onClick={handleEqual}
            className={`p-3 rounded-xl font-extrabold text-sm border transition-all shadow-sm ${
              pressedKey === '='
                ? 'bg-primary-hover text-white border-primary-hover scale-95 ring-2 ring-primary/40'
                : 'bg-primary hover:bg-primary-hover text-white border-primary'
            }`}
          >
            =
          </button>
        </div>

        {/* Footer Hint */}
        <div className="px-3.5 py-2 bg-surface-muted/60 border-t border-border/60 text-center text-[10px] text-foreground-muted flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>Keyboard / Numpad Active</span>
          </span>
          <span className="font-mono text-foreground-subtle">Enter = | Esc Close</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. HELD ORDERS MODAL
// ============================================================================
export interface HeldOrder {
  id: string;
  createdAt: string;
  customer: CustomerDTO | null;
  items: PosCartItem[];
  subtotal: number;
  totalDue: number;
}

export interface HeldOrdersModalProps {
  heldOrders: HeldOrder[];
  currencySymbol: string;
  onResume: (order: HeldOrder) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
}

export function HeldOrdersModal({
  heldOrders,
  currencySymbol,
  onResume,
  onDiscard,
  onClose,
}: HeldOrdersModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Held Orders ({heldOrders.length})</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {heldOrders.length === 0 ? (
            <div className="py-12 text-center text-foreground-muted">
              <FolderOpen className="w-10 h-10 stroke-1 mx-auto mb-2 text-foreground-subtle" />
              <p className="text-sm font-semibold text-foreground-secondary">No held orders found</p>
              <p className="text-xs text-foreground-muted mt-0.5">Use [F4] or the Hold button to save active orders.</p>
            </div>
          ) : (
            heldOrders.map((ho) => (
              <div
                key={ho.id}
                className="p-3.5 rounded-xl border border-border bg-surface-elevated/60 hover:bg-surface-elevated flex items-center justify-between transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-foreground">
                      {ho.customer ? ho.customer.name : 'Walk-in Cash Customer'}
                    </span>
                    <span className="text-[11px] font-mono text-foreground-subtle flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(ho.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                  <div className="text-xs text-foreground-muted">
                    {ho.items.length} lines ({ho.items.reduce((s, i) => s + i.quantity, 0)} units) · Total:{' '}
                    <span className="font-mono font-bold text-foreground">
                      {currencySymbol}
                      {ho.totalDue.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onResume(ho)}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>
                  <button
                    onClick={() => onDiscard(ho.id)}
                    className="p-1.5 rounded-lg bg-surface-muted hover:bg-danger-bg text-foreground-muted hover:text-danger-text transition-colors"
                    title="Discard order"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. X-REPORT MODAL (Daily / Shift Sales Summary)
// ============================================================================
export interface XReportModalProps {
  currencySymbol: string;
  onClose: () => void;
  salesData?: {
    totalSales: number;
    transactionCount: number;
    cashSales: number;
    cardSales: number;
    upiSales: number;
    creditSales: number;
    totalTax: number;
    totalDiscount: number;
  };
}

export function XReportModal({ currencySymbol, onClose, salesData }: XReportModalProps) {
  const data = salesData || {
    totalSales: 0,
    transactionCount: 0,
    cashSales: 0,
    cardSales: 0,
    upiSales: 0,
    creditSales: 0,
    totalTax: 0,
    totalDiscount: 0,
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">X-Report (Shift Summary)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-surface-elevated border border-border/80 rounded-xl p-4 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground-muted block mb-1">
              Total Shift Gross Turnover
            </span>
            <div className="font-mono font-black text-3xl text-primary">
              {currencySymbol}
              {data.totalSales.toFixed(2)}
            </div>
            <span className="text-xs text-foreground-muted mt-1 block">
              {data.transactionCount} Completed Transactions
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-border/40">
            <div className="flex justify-between py-1.5 text-foreground-secondary">
              <span>Cash Collections</span>
              <span className="font-mono font-bold text-foreground">
                {currencySymbol}
                {data.cashSales.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-foreground-secondary">
              <span>UPI / QR Collections</span>
              <span className="font-mono font-bold text-foreground">
                {currencySymbol}
                {data.upiSales.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-foreground-secondary">
              <span>Card Collections</span>
              <span className="font-mono font-bold text-foreground">
                {currencySymbol}
                {data.cardSales.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-foreground-secondary">
              <span>Credit Sales (Khata)</span>
              <span className="font-mono font-bold text-amber-500">
                {currencySymbol}
                {data.creditSales.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-foreground-secondary">
              <span>Total Tax Collected</span>
              <span className="font-mono font-bold text-foreground">
                {currencySymbol}
                {data.totalTax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-foreground-secondary">
              <span>Discounts Allowed</span>
              <span className="font-mono font-bold text-emerald-500">
                -{currencySymbol}
                {data.totalDiscount.toFixed(2)}
              </span>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-sm"
          >
            Print X-Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. CASH IN / CASH OUT MODAL
// ============================================================================
export interface CashInOutModalProps {
  currencySymbol: string;
  onSubmit: (type: 'IN' | 'OUT', amount: number, reason: string) => void;
  onClose: () => void;
}

export function CashInOutModal({ currencySymbol, onSubmit, onClose }: CashInOutModalProps) {
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) return;
    onSubmit(type, num, reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Cash Drawer Float (In / Out)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-input border border-border p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType('IN')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                type === 'IN' ? 'bg-emerald-500 text-white shadow-sm' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Cash In (Float Add)
            </button>
            <button
              type="button"
              onClick={() => setType('OUT')}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                type === 'OUT' ? 'bg-danger-bg text-danger-text border border-danger-border shadow-sm' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Cash Out (Drop / Expense)
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
              Amount ({currencySymbol})
            </label>
            <input
              type="number"
              step="1"
              min="1"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-3 py-2 text-base font-mono font-bold text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
              Reason / Memo
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Opening float addition, Petty cash..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-sm"
          >
            Record Cash {type === 'IN' ? 'In' : 'Out'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 5. CLOSE SHIFT MODAL
// ============================================================================
export interface CloseShiftModalProps {
  currencySymbol: string;
  onClose: () => void;
  onConfirmClose: () => void;
}

export function CloseShiftModal({ currencySymbol, onClose, onConfirmClose }: CloseShiftModalProps) {
  const [countedCash, setCountedCash] = useState('');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Close Shift & Reconcile</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-foreground-muted">
            Count the physical cash in the drawer and enter the amount to complete end-of-shift reconciliation.
          </p>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1.5">
              Physical Cash Counted ({currencySymbol})
            </label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="0.00"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-3 py-2 text-base font-mono font-bold text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-surface-muted hover:bg-surface-hover text-foreground-secondary text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirmClose();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-danger-bg hover:bg-danger text-danger-text hover:text-white border border-danger-border text-xs font-bold transition-colors"
            >
              Close Shift Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. KEYBOARD SHORTCUTS MODAL
// ============================================================================
export interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const shortcuts = [
    { key: '/', desc: 'Focus product search input' },
    { key: 'F8', desc: 'Focus barcode scanner input' },
    { key: 'F2', desc: 'Attach / Select Customer (Khata)' },
    { key: 'F3', desc: 'Add Global Order Discount' },
    { key: 'F4', desc: 'Hold current order / View held orders' },
    { key: 'F5', desc: 'Quick Discount popup' },
    { key: 'F9 / Ctrl+Enter', desc: 'Checkout & Tender Payment' },
    { key: 'Esc', desc: 'Clear active cart / Close dialogs' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-2.5">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between p-2 rounded-xl bg-surface-muted/60 border border-border/60 text-xs"
            >
              <span className="text-foreground-secondary">{s.desc}</span>
              <kbd className="font-mono font-bold px-2 py-1 rounded bg-surface border border-border text-primary text-[11px] shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. ORDER DISCOUNT MODAL
// ============================================================================
export interface DiscountModalProps {
  currentDiscount: number;
  subtotal: number;
  currencySymbol: string;
  onApply: (discount: number) => void;
  onClose: () => void;
}

export function DiscountModal({
  currentDiscount,
  subtotal,
  currencySymbol,
  onApply,
  onClose,
}: DiscountModalProps) {
  const [val, setVal] = useState(String(currentDiscount || ''));
  const [mode, setMode] = useState<'FLAT' | 'PERCENT'>('FLAT');

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(val) || 0;
    if (mode === 'PERCENT') {
      const calculated = Math.round((subtotal * (num / 100)) * 100) / 100;
      onApply(calculated);
    } else {
      onApply(num);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-3.5 border-b border-border bg-surface-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-xs text-foreground">Order Discount</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-1.5 bg-input border border-border p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('FLAT')}
              className={`py-1.5 rounded-lg transition-all ${
                mode === 'FLAT' ? 'bg-primary text-white shadow-sm' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Flat ({currencySymbol})
            </button>
            <button
              type="button"
              onClick={() => setMode('PERCENT')}
              className={`py-1.5 rounded-lg transition-all ${
                mode === 'PERCENT' ? 'bg-primary text-white shadow-sm' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Percentage (%)
            </button>
          </div>

          <div>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-3 py-2 text-base font-mono font-bold text-foreground text-center focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => {
                onApply(0);
                onClose();
              }}
              className="flex-1 py-2 rounded-xl bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground text-xs font-bold transition-colors"
            >
              Remove
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-sm"
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 8. CUSTOMER SELECTION & CREATE MODAL
// ============================================================================
export interface CustomerModalProps {
  customers: CustomerDTO[];
  currencySymbol: string;
  selectedCustomerId?: string;
  onSelect: (customer: CustomerDTO) => void;
  onCreateCustomer: (data: { name: string; phone?: string; email?: string; address?: string }) => void;
  onClose: () => void;
}

export function CustomerModal({
  customers,
  currencySymbol,
  selectedCustomerId,
  onSelect,
  onCreateCustomer,
  onClose,
}: CustomerModalProps) {
  const [tab, setTab] = useState<'SELECT' | 'CREATE'>('SELECT');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onCreateCustomer(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Attach Customer (Khata)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-2 bg-surface border-b border-border text-xs font-bold">
          <button
            onClick={() => setTab('SELECT')}
            className={`py-2 rounded-lg transition-all ${
              tab === 'SELECT' ? 'bg-primary text-white shadow-sm' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Select Existing Customer
          </button>
          <button
            onClick={() => setTab('CREATE')}
            className={`py-2 rounded-lg transition-all ${
              tab === 'CREATE' ? 'bg-primary text-white shadow-sm' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            + Create New Customer
          </button>
        </div>

        {tab === 'SELECT' ? (
          <div className="p-4 flex-1 flex flex-col min-h-0 space-y-3">
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                type="text"
                placeholder="Search by customer name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-input border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 divide-y divide-border/30">
              {/* Cash customer default option */}
              <button
                onClick={() => {
                  onSelect({
                    id: 'cash-customer',
                    name: 'Walk-in Cash Customer',
                    phone: null,
                    email: null,
                    address: null,
                    openingBalance: 0,
                    currentBalance: 0,
                    status: 'ACTIVE',
                    createdAt: '',
                  });
                  onClose();
                }}
                className="w-full text-left p-3 rounded-xl hover:bg-surface-hover flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="font-bold text-xs text-foreground">Walk-in Cash Customer</div>
                  <div className="text-[10px] text-foreground-muted">Default regular guest checkout</div>
                </div>
                <span className="text-[11px] font-mono text-emerald-500 font-semibold">Standard</span>
              </button>

              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-xl hover:bg-surface-hover flex items-center justify-between transition-colors ${
                    selectedCustomerId === c.id ? 'bg-primary/10 border border-primary/40' : ''
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-foreground">{c.name}</div>
                    <div className="text-[10px] text-foreground-muted font-mono">{c.phone || 'No phone'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-foreground-subtle">Balance Due</div>
                    <div
                      className={`font-mono font-bold text-xs ${
                        c.currentBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {currencySymbol}
                      {c.currentBalance.toFixed(2)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="p-5 space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-1">
                Billing Address
              </label>
              <input
                type="text"
                placeholder="Street address / city"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-sm"
            >
              Save Customer & Attach
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 9. CHECKOUT SETTLEMENT DRAWER / MODAL
// ============================================================================
export interface CheckoutModalProps {
  totalDue: number;
  currencySymbol: string;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (m: PaymentMethod) => void;
  paidAmount: string;
  onPaidAmountChange: (amt: string) => void;
  hasNegativeStock: boolean;
  allowNegativeStockOverride: boolean;
  onToggleNegativeStockOverride: (checked: boolean) => void;
  loading: boolean;
  onCompleteSale: () => void;
  onClose: () => void;
}

export function CheckoutModal({
  totalDue,
  currencySymbol,
  paymentMethod,
  onPaymentMethodChange,
  paidAmount,
  onPaidAmountChange,
  hasNegativeStock,
  allowNegativeStockOverride,
  onToggleNegativeStockOverride,
  loading,
  onCompleteSale,
  onClose,
}: CheckoutModalProps) {
  const numericPaid = paidAmount === '' ? totalDue : Math.max(0, Number(paidAmount));
  const changeDue = Math.max(0, Math.round((numericPaid - totalDue) * 100) / 100);
  const balanceDue = Math.max(0, Math.round((totalDue - numericPaid) * 100) / 100);

  const paymentMethods: { type: PaymentMethod; label: string; icon: any }[] = [
    { type: 'CASH', label: 'Cash', icon: Banknote },
    { type: 'UPI', label: 'UPI / QR', icon: Smartphone },
    { type: 'CARD', label: 'Card', icon: CreditCard },
    { type: 'BANK_TRANSFER', label: 'Bank', icon: Building2 },
    { type: 'CREDIT', label: 'Khata / Credit', icon: User },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-muted flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Tender Payment & Settlement</h3>
          </div>
          <button onClick={onClose} className="p-1 text-foreground-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Total Display */}
          <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted">
              Total Payable
            </span>
            <span className="font-mono font-black text-3xl text-primary">
              {currencySymbol}
              {totalDue.toFixed(2)}
            </span>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground-muted mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {paymentMethods.map((m) => {
                const Icon = m.icon;
                const active = paymentMethod === m.type;

                return (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => {
                      onPaymentMethodChange(m.type);
                      if (m.type === 'CREDIT') onPaidAmountChange('0');
                      else if (paidAmount === '0') onPaidAmountChange(totalDue.toString());
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                      active
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-surface-muted hover:bg-surface-hover text-foreground-secondary border-border/80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tendered Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                Amount Tendered ({currencySymbol})
              </label>
              <button
                type="button"
                onClick={() => onPaidAmountChange(totalDue.toString())}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Exact ({currencySymbol}{totalDue.toFixed(2)})
              </button>
            </div>

            <input
              type="number"
              step="any"
              min="0"
              placeholder={totalDue.toFixed(2)}
              value={paidAmount}
              onChange={(e) => onPaidAmountChange(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-right text-foreground focus:outline-none focus:border-primary"
            />

            {/* Quick Cash Presets */}
            <div className="flex space-x-1.5 mt-2">
              {[100, 200, 500, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    const cur = Number(paidAmount) || 0;
                    onPaidAmountChange((cur + amt).toString());
                  }}
                  className="flex-1 py-1 rounded-lg bg-surface-muted hover:bg-surface-hover text-[11px] font-mono font-bold text-foreground border border-border"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Change Due / Khata Balance */}
          <div className="p-3 rounded-xl bg-surface-muted border border-border/80 flex items-center justify-between text-xs">
            {numericPaid >= totalDue ? (
              <div className="flex items-center justify-between w-full text-emerald-500 font-bold">
                <span className="uppercase tracking-wider text-[11px]">Change Due (Return)</span>
                <span className="font-mono text-lg">
                  {currencySymbol}
                  {changeDue.toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full text-amber-500 font-bold">
                <span className="uppercase tracking-wider text-[11px]">Credit Due (Khata)</span>
                <span className="font-mono text-lg">
                  {currencySymbol}
                  {balanceDue.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Negative Stock Warning */}
          {hasNegativeStock && (
            <div className="p-3 rounded-xl bg-danger-bg border border-danger-border text-xs space-y-1">
              <div className="flex items-center space-x-1.5 text-danger-text font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Insufficient Stock Warning</span>
              </div>
              <label className="flex items-center space-x-2 pt-1 text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowNegativeStockOverride}
                  onChange={(e) => onToggleNegativeStockOverride(e.target.checked)}
                  className="rounded bg-input border-danger-border text-primary"
                />
                <span className="text-[11px]">Allow negative stock override for this invoice</span>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onCompleteSale}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Complete Sale & Print Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
