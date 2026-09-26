import React from 'react';
import { ProductDTO } from '../../../../shared/types';
import { Package, Plus } from 'lucide-react';
import { formatQuantity, formatUnitPrice } from '../../../../shared/utils/quantity';

export interface PosBeamGridProps {
  products: ProductDTO[];
  currencySymbol: string;
  onSelectProduct: (product: ProductDTO) => void;
}

export function PosBeamGrid({
  products,
  currencySymbol,
  onSelectProduct,
}: PosBeamGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-foreground-muted select-none">
        <Package className="w-12 h-12 stroke-1 mb-2 text-foreground-subtle" />
        <p className="text-sm font-semibold text-foreground-secondary">No products match this filter</p>
        <p className="text-xs text-foreground-muted mt-1">Try selecting another category or clear search.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 select-none">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {products.map((p) => {
          const isOut = Number(p.currentStock || 0) <= 0;
          const isLow = Number(p.currentStock || 0) <= Number(p.reorderLevel || 0);
          const price = Number(p.salePrice || 0);
          const initialLetter = p.name ? p.name.trim().charAt(0).toUpperCase() : 'P';

          return (
            <div
              key={p.id}
              onClick={() => onSelectProduct(p)}
              className="group relative bg-surface-elevated/70 hover:bg-surface-elevated border border-border/80 hover:border-primary/50 rounded-xl p-2.5 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {/* Top Media & Badges */}
              <div className="relative w-full aspect-square rounded-lg bg-surface-muted overflow-hidden flex items-center justify-center mb-2.5">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="w-full h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-extrabold text-foreground-subtle/50 font-sans">
                    {initialLetter}
                  </div>
                )}

                {/* Top Badges */}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 items-start">
                  {isOut ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-danger-bg text-danger-text border border-danger-border shadow-sm">
                      Out of stock
                    </span>
                  ) : null}
                </div>

                {/* Quick Add Overlay on hover */}
                <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shadow-md">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Title & Info */}
              <div className="flex-1 flex flex-col justify-between space-y-1">
                <div>
                  <h4
                    className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors"
                    title={p.name}
                  >
                    {p.name}
                  </h4>

                  {/* Brand / Subtitle / Stock Info */}
                  <div className="mt-1 text-[11px] text-foreground-muted flex items-center justify-between">
                    <span className="truncate max-w-[80px]">
                      {p.brandName || p.categoryName || p.unitCode || 'Item'}
                    </span>
                    <span
                      className={`font-mono text-[10px] ${
                        isOut ? 'text-danger-text' : isLow ? 'text-warning-text' : 'text-foreground-subtle'
                      }`}
                    >
                      {formatQuantity(p.currentStock, p.unitCode)}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="pt-1.5 border-t border-border/40 flex items-baseline justify-between">
                  <span className="text-xs font-extrabold font-mono text-foreground">
                    {formatUnitPrice(price, p.unitCode, currencySymbol)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
