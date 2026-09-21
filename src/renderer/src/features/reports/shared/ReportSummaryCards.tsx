import React from 'react';

export interface SummaryCard {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode | string;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'teal' | 'amber' | 'default';
  small?: boolean;
}

interface ReportSummaryCardsProps {
  cards: SummaryCard[];
}

const THEME_MAP: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  green: {
    border: 'border-emerald-500/25 hover:border-emerald-500/50',
    bg: 'bg-emerald-500/[0.04]',
    text: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  red: {
    border: 'border-rose-500/25 hover:border-rose-500/50',
    bg: 'bg-rose-500/[0.04]',
    text: 'text-rose-500',
    badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  },
  blue: {
    border: 'border-blue-500/25 hover:border-blue-500/50',
    bg: 'bg-blue-500/[0.04]',
    text: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  orange: {
    border: 'border-primary/25 hover:border-primary/50',
    bg: 'bg-primary/[0.04]',
    text: 'text-primary',
    badge: 'bg-primary/10 text-primary border-primary/20',
  },
  purple: {
    border: 'border-purple-500/25 hover:border-purple-500/50',
    bg: 'bg-purple-500/[0.04]',
    text: 'text-purple-500',
    badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  teal: {
    border: 'border-teal-500/25 hover:border-teal-500/50',
    bg: 'bg-teal-500/[0.04]',
    text: 'text-teal-500',
    badge: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  },
  amber: {
    border: 'border-amber-500/25 hover:border-amber-500/50',
    bg: 'bg-amber-500/[0.04]',
    text: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  default: {
    border: 'border-border hover:border-border',
    bg: 'bg-surface',
    text: 'text-foreground',
    badge: 'bg-surface-elevated text-foreground border-border',
  },
};

export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({ cards }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
      {cards.map((card, idx) => {
        const theme = THEME_MAP[card.color || 'default'] || THEME_MAP.default;
        return (
          <div
            key={idx}
            className={`relative overflow-hidden bg-surface border ${theme.border} ${theme.bg} rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md group`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {card.label}
              </span>
              {card.icon && (
                <span className={`text-base p-1 rounded-md border ${theme.badge} flex items-center justify-center`}>
                  {card.icon}
                </span>
              )}
            </div>

            <div>
              <div className={`text-xl font-bold tracking-tight ${theme.text} truncate`}>
                {card.value}
              </div>
              {card.subValue && (
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  {card.subValue}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
