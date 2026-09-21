import React, { useState } from 'react';
import {
  ShoppingCart,
  Truck,
  Package,
  Users,
  Building2,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { SalesReportView } from './SalesReportView';
import { PurchasesReportView } from './PurchasesReportView';
import { InventoryReportView } from './InventoryReportView';
import { CustomerReportView } from './CustomerReportView';
import { SupplierReportView } from './SupplierReportView';
import { ExpenseReportView } from './ExpenseReportView';
import { ProfitReportView } from './ProfitReportView';

type ReportTab =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'profit';

interface ReportsHubViewProps {
  token: string;
}

const TABS: { label: string; value: ReportTab; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Sales Reports', value: 'sales', icon: ShoppingCart },
  { label: 'Purchases & Payables', value: 'purchases', icon: Truck },
  { label: 'Inventory & Stock', value: 'inventory', icon: Package },
  { label: 'Customers (Khata/AR)', value: 'customers', icon: Users },
  { label: 'Suppliers (AP)', value: 'suppliers', icon: Building2 },
  { label: 'Operating Expenses', value: 'expenses', icon: Wallet },
  { label: 'Profit & Tax (P&L)', value: 'profit', icon: TrendingUp },
];

export const ReportsHubView: React.FC<ReportsHubViewProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border gap-2">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center space-x-2">
            <span>Executive Business Intelligence & Financial Hub</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Authoritative, real-time single-source of truth computed directly by backend domain services.
          </p>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center space-x-1.5 p-1 bg-surface border border-border rounded-xl overflow-x-auto shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'sales' && <SalesReportView token={token} />}
        {activeTab === 'purchases' && <PurchasesReportView token={token} />}
        {activeTab === 'inventory' && <InventoryReportView token={token} />}
        {activeTab === 'customers' && <CustomerReportView token={token} />}
        {activeTab === 'suppliers' && <SupplierReportView token={token} />}
        {activeTab === 'expenses' && <ExpenseReportView token={token} />}
        {activeTab === 'profit' && <ProfitReportView token={token} />}
      </div>
    </div>
  );
};
