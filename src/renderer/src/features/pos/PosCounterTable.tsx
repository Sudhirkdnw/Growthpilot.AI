import React from 'react';
import { ProductDTO } from '../../../../shared/types';
import { Plus, Package } from 'lucide-react';
import { formatQuantity, formatUnitPrice } from '../../../../shared/utils/quantity';

export interface PosCounterTableProps {
  products: ProductDTO[];
  currencySymbol: string;
  categoryLabel?: string;
  onSelectProduct: (product: ProductDTO) => void;
}

export function PosCounterTable({
  products,
  currencySymbol,
  categoryLabel = 'All',
  onSelectProduct,
}: PosCounterTableProps) {
  if (products.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-foreground-muted select-none">
        <Package className="w-12 h-12 stroke-1 mb-2 text-foreground-subtle" />
        <p className="text-sm font-semibold text-foreground-secondary">No items found</p>
        <p className="text-xs text-foreground-muted mt-1">Try changing category or search terms.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface select-none">
      {/* Category count indicator */}
      <div className="px-4 py-2 text-xs font-semibold text-foreground-muted border-b border-border/60 shrink-0">
        <span>{categoryLabel}</span>
        <span className="mx-1.5 text-foreground-subtle">·</span>
        <span className="font-mono text-foreground-secondary">{products.length} items</span>
      </div>

      {/* High Density Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-surface-muted/60 sticky top-0 text-[10px] font-bold uppercase tracking-wider text-foreground-muted border-b border-border/80 z-10">
            <tr>
              <th className="py-2.5 px-4 w-48">PLU / SKU</th>
              <th className="py-2.5 px-4">ITEM</th>
              <th className="py-2.5 px-4 text-right w-36">PRICE</th>
              <th className="py-2.5 px-4 text-center w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {products.map((p) => {
              const isOut = Number(p.currentStock || 0) <= 0;
              const price = Number(p.salePrice || 0);
              const initialLetter = p.name ? p.name.trim().charAt(0).toUpperCase() : 'P';

              return (
                <tr
                  key={p.id}
                  onClick={() => onSelectProduct(p)}
                  className="hover:bg-surface-hover/80 transition-colors cursor-pointer group"
                >
                  {/* Media + PLU/SKU */}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      {/* Thumbnail or Avatar square */}
                      <div className="w-9 h-9 rounded-lg bg-surface-muted border border-border/80 flex items-center justify-center overflow-hidden shrink-0">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <span className="font-bold text-foreground-subtle text-sm">
                            {initialLetter}
                          </span>
                        )}
                      </div>

                      {/* SKU */}
                      <span className="font-mono text-[11px] text-foreground-muted truncate max-w-[120px]">
                        {p.sku || p.barcode || '—'}
                      </span>
                    </div>
                  </td>

                  {/* Item Title, Badges & Stock */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {p.name}
                        </span>

                        {isOut && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-danger-bg text-danger-text border border-danger-border shrink-0">
                            Out of stock
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-foreground-muted flex items-center space-x-2">
                        <span>{p.unitCode || 'PCS'}</span>
                        <span className="text-foreground-subtle">·</span>
                        <span className="font-mono text-foreground-subtle">
                          {formatQuantity(p.currentStock, p.unitCode)} in stock
                        </span>
                        {p.brandName && (
                          <>
                            <span className="text-foreground-subtle">·</span>
                            <span className="text-foreground-muted">{p.brandName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-foreground text-xs">
                    {formatUnitPrice(price, p.unitCode, currencySymbol)}
                  </td>

                  {/* Plus Action Button */}
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onSelectProduct(p)}
                      title="Add to Cart"
                      className="p-1.5 rounded-lg bg-surface-muted hover:bg-primary text-foreground-secondary hover:text-white border border-border hover:border-primary transition-all active:scale-90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
