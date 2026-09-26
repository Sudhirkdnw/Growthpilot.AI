import React from 'react';

export interface CategoryItem {
  id: string;
  name: string;
  count: number;
  color?: string;
}

export interface PosCategoryNavProps {
  variant: 'horizontal' | 'vertical';
  categories: CategoryItem[];
  selectedCategoryId: string; // 'ALL' or specific category id
  onSelectCategory: (id: string) => void;
  totalProductCount: number;
}

// Consistent palette of dot colors for categories
const CATEGORY_COLORS = [
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#a855f7', // Purple
  '#8b5cf6', // Violet
  '#84cc16', // Lime
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#eab308', // Yellow
  '#38bdf8', // Sky
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#d946ef', // Fuchsia
  '#ef4444', // Red
  '#94a3b8', // Slate
];

export function PosCategoryNav({
  variant,
  categories,
  selectedCategoryId,
  onSelectCategory,
  totalProductCount,
}: PosCategoryNavProps) {
  // Variant 1: Horizontal Pill Bar (Beam Mode - Image 1)
  if (variant === 'horizontal') {
    return (
      <div className="w-full overflow-x-auto no-scrollbar py-2 px-4 bg-surface border-b border-border/60 shrink-0">
        <div className="flex items-center space-x-2 min-w-max">
          {/* "All" Pill */}
          <button
            onClick={() => onSelectCategory('ALL')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
              selectedCategoryId === 'ALL'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-muted hover:bg-surface-hover text-foreground-muted hover:text-foreground border border-border/60'
            }`}
          >
            <span>All</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                selectedCategoryId === 'ALL' ? 'bg-black/20 text-white' : 'bg-black/10 text-foreground-subtle'
              }`}
            >
              {totalProductCount}
            </span>
          </button>

          {/* Individual Category Pills */}
          {categories.map((cat, idx) => {
            const isSelected = selectedCategoryId === cat.id;
            const dotColor = cat.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-white font-bold shadow-sm'
                    : 'bg-surface-muted hover:bg-surface-hover text-foreground-secondary hover:text-foreground border border-border/60'
                }`}
              >
                {!isSelected && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                )}
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-black/20 text-white' : 'text-foreground-subtle'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Variant 2: Left Vertical Sidebar (Counter Mode - Image 2)
  return (
    <aside className="w-52 bg-surface border-r border-border flex flex-col shrink-0 overflow-y-auto select-none">
      <div className="px-4 pt-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-foreground-muted border-b border-border/40">
        CATEGORY
      </div>

      <div className="p-2 space-y-0.5">
        {/* All Items */}
        <button
          onClick={() => onSelectCategory('ALL')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            selectedCategoryId === 'ALL'
              ? 'bg-primary/15 text-primary font-bold border border-primary/30'
              : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground'
          }`}
        >
          <span>All</span>
          <span className="font-mono text-[11px] text-foreground-muted">{totalProductCount}</span>
        </button>

        {/* Categories List */}
        {categories.map((cat, idx) => {
          const isSelected = selectedCategoryId === cat.id;
          const dotColor = cat.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-primary/15 text-primary font-bold border border-primary/30'
                  : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <div className="flex items-center space-x-2 truncate mr-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="truncate">{cat.name}</span>
              </div>
              <span className="font-mono text-[11px] text-foreground-subtle shrink-0">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
