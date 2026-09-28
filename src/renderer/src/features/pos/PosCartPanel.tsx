import React from 'react';
import {
  ShoppingCart,
  Trash2,
  User,
  Plus,
  Minus,
  Tag,
  ArrowRight,
  FolderDown,
  Percent,
} from 'lucide-react';
import { CustomerDTO } from '../../../../shared/types';
import { PosCartItem } from './PosBillingView';
import { ProductImage } from '../../components/common/ProductImage';

export interface PosCartPanelProps {
  cart: PosCartItem[];
  currencySymbol: string;
  selectedCustomer: CustomerDTO | null;
  onOpenCustomerModal: () => void;
  onClearCart: () => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onRemoveItem: (index: number) => void;
  onOpenDiscountModal: () => void;
  onHoldOrder: () => void;
  onCheckout: () => void;
  globalDiscount: number;
  onSellByAmount?: (index: number) => void;
}

export function PosCartPanel({
  cart,
  currencySymbol,
  selectedCustomer,
  onOpenCustomerModal,
  onClearCart,
  onUpdateQuantity,
  onRemoveItem,
  onOpenDiscountModal,
  onHoldOrder,
  onCheckout,
  globalDiscount,
  onSellByAmount,
}: PosCartPanelProps) {
  // Calculations
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalLines = cart.length;

  let subtotal = 0;
  let totalItemDiscount = 0;
  let totalTax = 0;

  for (const item of cart) {
    const lineGross = item.quantity * item.sellingPrice;
    const taxable = Math.max(0, lineGross - (item.discount || 0));
    const lineTax = Math.round(taxable * ((item.taxRate || 0) / 100) * 100) / 100;

    subtotal += taxable;
    totalItemDiscount += (item.discount || 0);
    totalTax += lineTax;
  }

  const netTaxable = Math.max(0, subtotal - Number(globalDiscount || 0));
  const totalDue = Math.round((netTaxable + totalTax) * 100) / 100;

  const isCustomerAttached = selectedCustomer && selectedCustomer.id !== 'cash-customer';

  return (
    <aside className="w-80 lg:w-96 bg-surface border-l border-border flex flex-col justify-between shrink-0 select-none h-full z-20">
      {/* ---------------- 1. ORDER & Customer Header ---------------- */}
      <div className="p-3 border-b border-border/80 shrink-0 space-y-2.5">
        {/* Order Title & Clear */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-foreground-muted block">
              ORDER
            </span>
            <span className="text-sm font-bold text-foreground">Draft</span>
          </div>

          <button
            onClick={onClearCart}
            disabled={cart.length === 0}
            className="flex items-center space-x-1 text-xs text-foreground-muted hover:text-danger-text disabled:opacity-30 disabled:hover:text-foreground-muted transition-colors py-1 px-2 rounded-lg hover:bg-danger-bg"
            title="Clear Cart (Esc)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Customer Bar */}
        <button
          onClick={onOpenCustomerModal}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left group ${
            isCustomerAttached
              ? 'bg-primary/10 border-primary/40 text-foreground'
              : 'bg-surface-muted/70 hover:bg-surface-muted border-border/80 text-foreground-secondary hover:text-foreground'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isCustomerAttached ? 'bg-primary text-white' : 'bg-surface border border-border text-foreground-muted'
              }`}
            >
              <User className="w-4 h-4" />
            </div>

            <div className="truncate">
              {isCustomerAttached ? (
                <>
                  <div className="text-xs font-bold text-foreground truncate">{selectedCustomer.name}</div>
                  <div className="text-[10px] text-foreground-muted font-mono truncate">
                    {selectedCustomer.phone || 'No phone'} · Due: {currencySymbol}{selectedCustomer.currentBalance.toFixed(2)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-bold text-foreground">Add customer</div>
                  <div className="text-[10px] text-foreground-muted">Earn loyalty, attach to order</div>
                </>
              )}
            </div>
          </div>

          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface border border-border/80 text-foreground-muted shrink-0 ml-1">
            F2
          </span>
        </button>
      </div>

      {/* ---------------- 2. Cart Items List / Empty State ---------------- */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-foreground-muted space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-muted border border-border/80 flex items-center justify-center text-foreground-subtle mb-1">
              <ShoppingCart className="w-6 h-6 stroke-1" />
            </div>
            <p className="font-semibold text-foreground-secondary text-sm">No items yet</p>
            <p className="text-xs text-foreground-muted max-w-[200px]">
              Scan, search, or tap an item to begin ringing it up.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40 p-2 space-y-1">
            {cart.map((item, idx) => {
              const isExcess = item.quantity > item.currentStock;

              return (
                <div
                  key={item.productId}
                  className={`p-2 rounded-xl transition-colors ${
                    isExcess ? 'bg-danger-bg border border-danger-border' : 'hover:bg-surface-hover/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <ProductImage
                      src={item.imageUrl}
                      name={item.productName}
                      category={item.categoryName}
                      className="w-10 h-10 rounded-lg shrink-0 border border-border/70"
                      imageClassName="w-full h-full object-cover p-0"
                      iconClassName="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-semibold text-foreground truncate" title={item.productName}>
                        {item.productName}
                      </h5>
                      <div className="text-[11px] font-mono text-foreground-muted flex items-center space-x-1.5 mt-0.5">
                        <span>
                          {currencySymbol}
                          {item.sellingPrice.toFixed(2)} / {item.unitCode || 'PCS'}
                        </span>
                        {item.discount > 0 && (
                          <span className="text-emerald-500 font-semibold">
                            -{currencySymbol}{item.discount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line Total */}
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-xs text-foreground">
                        {currencySymbol}
                        {item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Controls */}
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/30 gap-1">
                    <div className="inline-flex items-center space-x-1 bg-surface-muted border border-border/80 rounded-lg p-0.5">
                      <button
                        onClick={() => onUpdateQuantity(idx, Math.max(0, item.quantity - (item.allowDecimal ? 0.5 : 1)))}
                        className="p-1 hover:bg-surface-hover rounded text-foreground-muted hover:text-foreground"
                        title={item.allowDecimal ? "Decrease by 0.5" : "Decrease by 1"}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        step={item.allowDecimal ? '0.001' : '1'}
                        min="0"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            onUpdateQuantity(idx, val);
                          }
                        }}
                        className="w-14 px-1 text-center font-mono font-bold text-xs text-foreground bg-transparent focus:outline-none focus:bg-surface rounded"
                      />
                      <span className="text-[10px] font-bold text-foreground-muted uppercase pr-1 select-none">
                        {item.unitCode || 'PCS'}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(idx, item.quantity + (item.allowDecimal ? 0.5 : 1))}
                        className="p-1 hover:bg-surface-hover rounded text-foreground-muted hover:text-foreground"
                        title={item.allowDecimal ? "Increase by 0.5" : "Increase by 1"}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      {item.allowSellByAmount && onSellByAmount && (
                        <button
                          onClick={() => onSellByAmount(idx)}
                          className="px-2 py-1 text-[10px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-md transition-colors"
                          title="Sell by Amount (e.g. ₹100 ka rice)"
                        >
                          ₹ Amt
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveItem(idx)}
                        className="p-1 text-foreground-subtle hover:text-danger-text rounded hover:bg-danger-bg transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------- 3. Cart Summary & Totals ---------------- */}
      <div className="p-3 border-t border-border bg-surface shrink-0 space-y-2">
        {/* Items & Units Count vs Subtotal */}
        <div className="flex items-center justify-between text-xs text-foreground-muted">
          <span>
            {totalLines} items · {totalUnits} units
          </span>
          <span className="font-mono text-foreground font-semibold">
            {currencySymbol}
            {subtotal.toFixed(2)}
          </span>
        </div>

        {/* Global Discount Bar */}
        <button
          onClick={onOpenDiscountModal}
          className="w-full flex items-center justify-between py-1 px-2 rounded-lg bg-surface-muted hover:bg-surface-hover border border-border/60 text-xs text-foreground-muted hover:text-foreground transition-colors group"
        >
          <div className="flex items-center space-x-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">
              {globalDiscount > 0 ? `Discount applied: -${currencySymbol}${globalDiscount.toFixed(2)}` : 'Add discount'}
            </span>
          </div>
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-surface border border-border/60 text-foreground-subtle">
            F3
          </span>
        </button>

        {/* TOTAL DUE (Large Typography) */}
        <div className="pt-2 border-t border-border flex items-baseline justify-between">
          <span className="text-xs font-black tracking-wider uppercase text-foreground">
            TOTAL DUE
          </span>
          <span className="font-mono font-black text-2xl text-foreground">
            {currencySymbol}
            {totalDue.toFixed(2)}
          </span>
        </div>

        {/* ---------------- 4. Bottom Action Bar ---------------- */}
        <div className="grid grid-cols-12 gap-1.5 pt-1">
          {/* Hold Button [F4] */}
          <button
            onClick={onHoldOrder}
            disabled={cart.length === 0}
            className="col-span-3 py-2 px-2 rounded-xl bg-surface-muted hover:bg-surface-hover border border-border text-foreground font-bold text-xs flex flex-col items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-surface-muted"
            title="Put Current Cart on Hold (F4)"
          >
            <div className="flex items-center space-x-1">
              <FolderDown className="w-3.5 h-3.5 text-foreground-muted" />
              <span>Hold</span>
            </div>
            <span className="text-[9px] font-mono text-foreground-subtle">F4</span>
          </button>

          {/* Discount Button [F5] */}
          <button
            onClick={onOpenDiscountModal}
            className="col-span-3 py-2 px-2 rounded-xl bg-surface-muted hover:bg-surface-hover border border-border text-foreground font-bold text-xs flex flex-col items-center justify-center transition-all"
            title="Order Discount (F5 / F3)"
          >
            <div className="flex items-center space-x-1">
              <Percent className="w-3.5 h-3.5 text-foreground-muted" />
              <span>Discount</span>
            </div>
            <span className="text-[9px] font-mono text-foreground-subtle">F5</span>
          </button>

          {/* Primary Checkout Button [F9] */}
          <button
            onClick={onCheckout}
            disabled={cart.length === 0}
            className="col-span-6 py-2.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-sm flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            title="Complete Checkout (F9 / Ctrl+Enter)"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Checkout</span>
            <span className="text-[10px] font-mono font-bold bg-black/25 px-1.5 py-0.5 rounded text-white ml-0.5">
              F9
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
