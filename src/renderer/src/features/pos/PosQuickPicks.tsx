import React from 'react';
import { ProductDTO } from '../../../../shared/types';
import { formatUnitPrice } from '../../../../shared/utils/quantity';
import { ProductImage } from '../../components/common/ProductImage';

export interface PosQuickPicksProps {
  products: ProductDTO[];
  currencySymbol: string;
  onSelectProduct: (product: ProductDTO) => void;
}

export function PosQuickPicks({
  products,
  currencySymbol,
  onSelectProduct,
}: PosQuickPicksProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="flex items-center px-4 py-2 bg-surface/70 border-b border-border/60 shrink-0 gap-3 overflow-hidden select-none">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground-muted whitespace-nowrap">
        QUICK PICKS
      </span>

      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
        {products.map((p) => {
          const price = Number(p.salePrice || 0);

          return (
            <button
              key={p.id}
              onClick={() => onSelectProduct(p)}
              className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-surface-muted hover:bg-surface-hover border border-border/80 hover:border-primary/50 text-xs text-foreground transition-all shrink-0 group active:scale-95"
            >
              <ProductImage
                src={p.imageUrl}
                name={p.name}
                category={p.categoryName}
                className="w-5 h-5 rounded-full shrink-0 border border-border/60"
                imageClassName="w-full h-full object-cover p-0 rounded-full"
                iconClassName="w-3 h-3"
              />
              <span className="font-medium truncate max-w-[140px] text-foreground-secondary group-hover:text-foreground">
                {p.name}
              </span>
              <span className="font-mono font-bold text-primary text-[11px]">
                {formatUnitPrice(price, p.unitCode, currencySymbol)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
