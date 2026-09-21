import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Plus,
  Search,
  Receipt,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  Building2,
  Trash2,
  Ban,
  Eye,
  Loader2,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  PieChart,
  Tag,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  ExpenseCategoryDTO,
  ExpenseDTO,
  ProfitSummaryDTO,
  PaymentMethod,
} from '../../../../shared/types';

export function ExpenseProfitView() {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';
  const isAdmin = session?.user?.role === 'ADMIN';

  // Active view tab: 'profit_expenses' or 'categories'
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

  // Profit Summary State
  const [profitPeriod, setProfitPeriod] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [profitSummary, setProfitSummary] = useState<ProfitSummaryDTO | null>(null);
  const [profitLoading, setProfitLoading] = useState<boolean>(false);

  // Expenses List State
  const [expenses, setExpenses] = useState<ExpenseDTO[]>([]);
  const [expensesLoading, setExpensesLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'POSTED' | 'CANCELLED' | 'ALL'>('ALL');

  // Categories State
  const [categories, setCategories] = useState<ExpenseCategoryDTO[]>([]);

  // Modals State
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [expenseToCancel, setExpenseToCancel] = useState<ExpenseDTO | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Form State: Record Expense
  const [expenseForm, setExpenseForm] = useState<{
    categoryId: string;
    amount: string;
    paymentMethod: PaymentMethod;
    date: string;
    description: string;
    reference: string;
  }>({
    categoryId: '',
    amount: '',
    paymentMethod: 'CASH',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    reference: '',
  });

  // Form State: Category
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryDTO | null>(null);
  const [categoryForm, setCategoryForm] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  const loadProfitSummary = async () => {
    try {
      setProfitLoading(true);
      const res = await (window as any).electronAPI.invoke('reports:getProfitSummary', {
        period: profitPeriod,
        startDate: profitPeriod === 'CUSTOM' ? customStartDate : undefined,
        endDate: profitPeriod === 'CUSTOM' ? customEndDate : undefined,
        token: session?.token,
      });
      if (res && !res.error) {
        setProfitSummary(res);
      }
    } catch (err: any) {
      console.error('Failed to load profit summary:', err);
    } finally {
      setProfitLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await (window as any).electronAPI.invoke('expenseCategories:list', {
        token: session?.token,
      });
      if (Array.isArray(res)) {
        setCategories(res);
        if (res.length > 0 && !expenseForm.categoryId) {
          setExpenseForm((prev) => ({ ...prev, categoryId: res[0].id }));
        }
      }
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadExpenses = async () => {
    try {
      setExpensesLoading(true);
      const res = await (window as any).electronAPI.invoke('expenses:list', {
        search: searchQuery || undefined,
        categoryId: categoryFilter || undefined,
        status: statusFilter,
        token: session?.token,
        pageSize: 50,
      });
      if (res && res.data) {
        setExpenses(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load expenses:', err);
    } finally {
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    loadProfitSummary();
  }, [profitPeriod, customStartDate, customEndDate]);

  useEffect(() => {
    loadCategories();
    loadExpenses();
  }, [searchQuery, categoryFilter, statusFilter]);

  // --------------------------------------------------------------------------
  // ACTIONS: RECORD EXPENSE
  // --------------------------------------------------------------------------
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive expense amount.' });
      return;
    }

    try {
      const res = await (window as any).electronAPI.invoke('expenses:create', {
        expense: {
          categoryId: expenseForm.categoryId,
          amount: amt,
          paymentMethod: expenseForm.paymentMethod,
          date: expenseForm.date ? new Date(expenseForm.date).toISOString() : undefined,
          description: expenseForm.description.trim(),
          reference: expenseForm.reference.trim() || undefined,
        },
        token: session?.token,
      });

      if (res.error) throw new Error(res.error);

      setFeedback({
        type: 'success',
        message: `Expense ${res.expenseNumber} (₹${amt.toFixed(2)}) recorded successfully.`,
      });
      setShowRecordModal(false);
      setExpenseForm({
        categoryId: categories[0]?.id || '',
        amount: '',
        paymentMethod: 'CASH',
        date: new Date().toISOString().slice(0, 10),
        description: '',
        reference: '',
      });
      loadExpenses();
      loadProfitSummary();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to record expense' });
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: CANCEL EXPENSE
  // --------------------------------------------------------------------------
  const handleCancelExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseToCancel) return;
    if (!cancelReason.trim()) {
      setFeedback({ type: 'error', message: 'A cancellation reason is required.' });
      return;
    }

    try {
      const res = await (window as any).electronAPI.invoke('expenses:cancel', {
        id: expenseToCancel.id,
        reason: cancelReason.trim(),
        token: session?.token,
      });

      if (res.error) throw new Error(res.error);

      setFeedback({
        type: 'success',
        message: `Expense ${res.expenseNumber} cancelled successfully.`,
      });
      setShowCancelModal(false);
      setExpenseToCancel(null);
      setCancelReason('');
      loadExpenses();
      loadProfitSummary();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to cancel expense' });
    }
  };

  // --------------------------------------------------------------------------
  // ACTIONS: CATEGORIES
  // --------------------------------------------------------------------------
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    try {
      let res;
      if (editingCategory) {
        res = await (window as any).electronAPI.invoke('expenseCategories:update', {
          id: editingCategory.id,
          category: {
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || undefined,
          },
          token: session?.token,
        });
      } else {
        res = await (window as any).electronAPI.invoke('expenseCategories:create', {
          category: {
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || undefined,
          },
          token: session?.token,
        });
      }

      if (res.error) throw new Error(res.error);

      setFeedback({
        type: 'success',
        message: `Category "${res.name}" ${editingCategory ? 'updated' : 'created'} successfully.`,
      });
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '' });
      loadCategories();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to save category' });
    }
  };

  const handleDeactivateCategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate category "${name}"?`)) return;
    try {
      const res = await (window as any).electronAPI.invoke('expenseCategories:update', {
        id,
        category: { status: 'INACTIVE' },
        token: session?.token,
      });
      if (res.error) throw new Error(res.error);
      setFeedback({ type: 'success', message: `Category "${name}" deactivated.` });
      loadCategories();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to deactivate category' });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete category "${name}"? Only allowed if no expenses reference it.`)) return;
    try {
      const res = await (window as any).electronAPI.invoke('expenseCategories:delete', {
        id,
        token: session?.token,
      });
      if (res.error) throw new Error(res.error);
      setFeedback({ type: 'success', message: res.message || `Category "${name}" deleted.` });
      loadCategories();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to delete category' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800/80 text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Time Period Filter Bar */}
      <div className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <span className="text-muted-foreground uppercase tracking-wider mr-2">Profit Period:</span>
          {(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setProfitPeriod(period)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                profitPeriod === period
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-input text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {period.replace('_', ' ')}
            </button>
          ))}
        </div>

        {profitPeriod === 'CUSTOM' && (
          <div className="flex items-center space-x-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-input border border-border rounded px-2.5 py-1 text-foreground"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-input border border-border rounded px-2.5 py-1 text-foreground"
            />
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md shadow-primary/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Executive Profit & Loss Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Net Sales */}
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Net Revenue</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-primary mt-2">
            {currencySymbol}
            {profitSummary ? profitSummary.netSales.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
            <span>Gross: {currencySymbol}{profitSummary?.grossSales.toFixed(0) || 0}</span>
            <span>Ret: {currencySymbol}{profitSummary?.salesReturns.toFixed(0) || 0}</span>
          </div>
        </div>

        {/* COGS (Historical Cost) */}
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Historical COGS</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {currencySymbol}
            {profitSummary ? profitSummary.cogs.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Cost of Sold Goods</div>
        </div>

        {/* Gross Profit */}
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Gross Profit</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {currencySymbol}
            {profitSummary ? profitSummary.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">
            {profitSummary?.grossMarginPercent.toFixed(1)}% Gross Margin
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Expenses</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-2">
            {currencySymbol}
            {profitSummary ? profitSummary.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {profitSummary?.totalExpensesCount || 0} Posted Records
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-surface border border-border p-4 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Net Profit</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-2 ${
              (profitSummary?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {currencySymbol}
            {profitSummary ? profitSummary.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {profitSummary?.netMarginPercent.toFixed(1)}% Net Margin
          </div>
        </div>
      </div>

      {/* Main View: Sub-Tabs for Expenses Ledger & Category Management */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Navigation Tabs */}
        <div className="px-5 border-b border-border flex items-center justify-between bg-surface-muted">
          <div className="flex items-center space-x-6 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-3.5 border-b-2 transition-all ${
                activeTab === 'expenses'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Operating Expenses Ledger
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-3.5 border-b-2 transition-all ${
                activeTab === 'categories'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Expense Categories ({categories.length})
            </button>
          </div>

          {activeTab === 'categories' && (
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: '', description: '' });
                setShowCategoryModal(true);
              }}
              className="flex items-center space-x-1.5 bg-surface-elevated hover:bg-surface-muted text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Category</span>
            </button>
          )}
        </div>

        {/* TAB 1: EXPENSES LEDGER */}
        {activeTab === 'expenses' && (
          <div>
            {/* Filters Toolbar */}
            <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3 text-xs">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search description, reference, EXP#..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-input border border-border rounded-lg px-2.5 py-1.5 text-foreground"
                >
                  <option value="ALL">All Status</option>
                  <option value="POSTED">Posted Only</option>
                  <option value="CANCELLED">Cancelled Only</option>
                </select>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted uppercase font-semibold text-muted-foreground">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Expense #</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Method / Ref</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {expensesLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                        <span>Loading expenses...</span>
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        <Receipt className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <span>No expense records found.</span>
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-surface-elevated font-mono">
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {new Date(exp.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-primary">
                          {exp.expenseNumber}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-foreground">
                          <span className="bg-surface-elevated px-2 py-0.5 rounded text-[11px]">
                            {exp.categoryName || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-sans text-foreground max-w-xs truncate">
                          {exp.description}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-muted-foreground">
                          {exp.paymentMethod}
                          {exp.reference && <span className="text-muted-foreground text-[11px] block">{exp.reference}</span>}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-foreground">
                          {currencySymbol}{exp.amount.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              exp.status === 'POSTED'
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            }`}
                          >
                            {exp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-sans">
                          {isAdmin && exp.status === 'POSTED' && (
                            <button
                              onClick={() => {
                                setExpenseToCancel(exp);
                                setCancelReason('');
                                setShowCancelModal(true);
                              }}
                              title="Cancel Expense"
                              className="p-1 hover:bg-surface-elevated text-muted-foreground hover:text-rose-400 rounded transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: CATEGORY MANAGEMENT */}
        {activeTab === 'categories' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-muted uppercase font-semibold text-muted-foreground">
                  <th className="py-2.5 px-4">Category Name</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-center">Expenses Count</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-surface-elevated">
                    <td className="py-2.5 px-4 font-semibold text-foreground">{cat.name}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{cat.description || '—'}</td>
                    <td className="py-2.5 px-4 text-center font-mono text-foreground">
                      {cat.expenseCount || 0}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cat.status === 'ACTIVE'
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'bg-surface-elevated text-muted-foreground'
                        }`}
                      >
                        {cat.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCategoryForm({
                                name: cat.name,
                                description: cat.description || '',
                              });
                              setShowCategoryModal(true);
                            }}
                            className="p-1 hover:bg-surface-elevated text-muted-foreground hover:text-foreground rounded"
                          >
                            Edit
                          </button>
                          {cat.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleDeactivateCategory(cat.id, cat.name)}
                              className="p-1 hover:bg-surface-elevated text-muted-foreground hover:text-amber-400 rounded"
                            >
                              Deactivate
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1 hover:bg-surface-elevated text-muted-foreground hover:text-rose-400 rounded"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD EXPENSE MODAL */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
              <h3 className="font-bold text-base text-foreground flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-primary" />
                <span>Record Operating Expense</span>
              </h3>
              <button
                onClick={() => setShowRecordModal(false)}
                className="p-1 hover:bg-surface-elevated rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Expense Category *
                </label>
                <select
                  required
                  value={expenseForm.categoryId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                >
                  {categories.filter((c) => c.status === 'ACTIVE').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground font-mono text-base focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Payment Method
                </label>
                <select
                  value={expenseForm.paymentMethod}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Expense Business Date
                </label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. September Shop Rent, Internet bill"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reference / Receipt Number
                </label>
                <input
                  type="text"
                  value={expenseForm.reference}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                  placeholder="Optional bill or transaction reference"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL EXPENSE MODAL */}
      {showCancelModal && expenseToCancel && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
              <h3 className="font-bold text-base text-rose-400 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <span>Cancel Expense ({expenseToCancel.expenseNumber})</span>
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-1 hover:bg-surface-elevated rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCancelExpense} className="p-5 space-y-4 text-sm">
              <p className="text-xs text-foreground">
                Are you sure you want to cancel this posted expense? The original record is preserved in history, and it will be excluded from profit calculations.
              </p>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why this expense is being cancelled (e.g. Duplicate entry, bill voided)..."
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CATEGORY MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
              <h3 className="font-bold text-base text-foreground">
                {editingCategory ? 'Edit Category' : 'New Expense Category'}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 hover:bg-surface-elevated rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Shop Electricity, Staff Lunch"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
