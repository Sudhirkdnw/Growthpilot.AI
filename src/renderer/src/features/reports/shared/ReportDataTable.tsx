import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Loader2, Database } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface ReportDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  keyField?: keyof T;
}

function getNestedValue(obj: any, key: string): any {
  return key.split('.').reduce((acc, k) => acc?.[k], obj);
}

export function ReportDataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  emptyMessage = 'No records found for the selected period.',
  keyField,
}: ReportDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sorted = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = getNestedValue(a, sortKey);
      const bv = getNestedValue(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av || '').localeCompare(String(bv || ''))
        : String(bv || '').localeCompare(String(av || ''));
    });
  }, [data, sortKey, sortAsc]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-surface-elevated/50 border border-border rounded-xl">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <span className="text-sm font-medium text-muted-foreground">Loading authoritative report data…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-elevated text-foreground text-xs font-semibold uppercase tracking-wider">
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <th
                    key={String(col.key)}
                    onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                    className={`px-4 py-3.5 whitespace-nowrap ${alignClass} ${
                      col.sortable ? 'cursor-pointer select-none hover:text-foreground transition-colors' : ''
                    }`}
                  >
                    <div className={`inline-flex items-center space-x-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="text-muted-foreground">
                          {sortKey === String(col.key) ? (
                            sortAsc ? (
                              <ArrowUp className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-sm">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Database className="w-8 h-8 text-muted-foreground mb-1" />
                    <span className="text-sm font-medium text-foreground">{emptyMessage}</span>
                    <span className="text-xs text-muted-foreground">Try adjusting your date range or filter criteria.</span>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((row, idx) => (
                <tr
                  key={keyField ? String(row[keyField as string]) : idx}
                  className="hover:bg-surface-elevated transition-colors group"
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    return (
                      <td
                        key={String(col.key)}
                        className={`px-4 py-3 whitespace-nowrap text-foreground ${alignClass}`}
                      >
                        {col.render
                          ? col.render(getNestedValue(row, String(col.key)), row)
                          : getNestedValue(row, String(col.key)) ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
