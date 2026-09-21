import React from 'react';
import { Calendar } from 'lucide-react';

export type ReportPeriod =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'CUSTOM';

interface DateRangePickerProps {
  value: ReportPeriod;
  startDate?: string;
  endDate?: string;
  onChange: (period: ReportPeriod, startDate?: string, endDate?: string) => void;
  disabled?: boolean;
}

const PERIODS: { label: string; value: ReportPeriod }[] = [
  { label: 'Today', value: 'TODAY' },
  { label: 'Yesterday', value: 'YESTERDAY' },
  { label: 'This Week', value: 'THIS_WEEK' },
  { label: 'This Month', value: 'THIS_MONTH' },
  { label: 'Last Month', value: 'LAST_MONTH' },
  { label: 'This Year', value: 'THIS_YEAR' },
  { label: 'Custom Range', value: 'CUSTOM' },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  startDate,
  endDate,
  onChange,
  disabled,
}) => {
  const handlePeriodChange = (period: ReportPeriod) => {
    if (period !== 'CUSTOM') {
      onChange(period, undefined, undefined);
    } else {
      onChange(period, startDate, endDate);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 bg-surface border border-border p-2.5 rounded-xl shadow-sm">
      <div className="flex items-center space-x-1.5 pl-1.5 pr-2 border-r border-border text-muted-foreground">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Period</span>
      </div>

      {/* Preset Period Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => {
          const isActive = value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => handlePeriodChange(p.value)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated bg-surface-muted'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Inputs */}
      {value === 'CUSTOM' && (
        <div className="flex items-center space-x-2 ml-auto pl-3 border-l border-border">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-muted-foreground">From:</span>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => onChange('CUSTOM', e.target.value, endDate)}
              disabled={disabled}
              className="bg-input border border-border text-foreground text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-muted-foreground">To:</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => onChange('CUSTOM', startDate, e.target.value)}
              disabled={disabled}
              className="bg-input border border-border text-foreground text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
};
