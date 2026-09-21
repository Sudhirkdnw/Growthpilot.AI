import React, { useState, useEffect } from 'react';
import {
  Users,
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
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  UserCheck,
  RotateCcw,
  Scale,
  Calendar,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  CustomerDTO,
  CustomerLedgerDTO,
  CustomerPaymentDTO,
  CustomerStatementDTO,
  CustomerReceivablesSummaryDTO,
  CustomerReconciliationDTO,
  PaymentMethod,
} from '../../../../shared/types';

export function CustomerKhataView() {
  const { session, settings } = useAuthStore();
  const currencySymbol = settings?.company?.currencySymbol || '₹';
  const isAdmin = session?.user?.role === 'ADMIN';

  // Master State
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [summary, setSummary] = useState<CustomerReceivablesSummaryDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'OUTSTANDING' | 'SETTLED' | 'INACTIVE'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected Customer for Details / Khata Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [detailTab, setDetailTab] = useState<'ledger' | 'statement' | 'reconcile'>('ledger');
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerDTO[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);

  // Statement State
  const [statementStartDate, setStatementStartDate] = useState<string>('');
  const [statementEndDate, setStatementEndDate] = useState<string>('');
  const [statementData, setStatementData] = useState<CustomerStatementDTO | null>(null);

  // Reconciliation State
  const [reconciliation, setReconciliation] = useState<CustomerReconciliationDTO | null>(null);
  const [reconciling, setReconciling] = useState<boolean>(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerDTO | null>(null);

  // Form State: Create Customer
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    openingBalance: 0,
  });

  // Form State: Record Payment
  const [paymentForm, setPaymentForm] = useState<{
    amount: string;
    paymentMethod: PaymentMethod;
    reference: string;
    notes: string;
    paymentDate: string;
  }>({
    amount: '',
    paymentMethod: 'CASH',
    reference: '',
    notes: '',
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  // Fetch Customers & Receivables Summary
  const loadCustomers = async () => {
    try {
      setLoading(true);
      const res = await (window as any).electronAPI.invoke('customers:list', {
        search: searchQuery || undefined,
        status: filterType === 'INACTIVE' ? 'INACTIVE' : 'ALL',
        hasOutstanding: filterType === 'OUTSTANDING' ? true : undefined,
        token: session?.token,
        pageSize: 100,
      });

      if (res && res.data) {
        let filtered = res.data;
        if (filterType === 'SETTLED') {
          filtered = filtered.filter((c: CustomerDTO) => c.currentBalance <= 0);
        }
        setCustomers(filtered);
      }

      // Load Summary
      const sumRes = await (window as any).electronAPI.invoke('customers:getReceivablesSummary', {
        token: session?.token,
      });
      if (sumRes && !sumRes.error) {
        setSummary(sumRes);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery, filterType]);

  // Load Ledger Entries for Selected Customer
  const loadCustomerLedger = async (customerId: string) => {
    try {
      setLedgerLoading(true);
      const res = await (window as any).electronAPI.invoke('customers:getLedger', {
        customerId,
        token: session?.token,
        pageSize: 50,
      });
      if (res && res.data) {
        setLedgerEntries(res.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load customer ledger' });
    } finally {
      setLedgerLoading(false);
    }
  };

  // Load Statement
  const loadStatement = async (customerId: string) => {
    try {
      setLedgerLoading(true);
      const res = await (window as any).electronAPI.invoke('customers:getStatement', {
        customerId,
        startDate: statementStartDate || undefined,
        endDate: statementEndDate || undefined,
        token: session?.token,
      });
      if (res && !res.error) {
        setStatementData(res);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load account statement' });
    } finally {
      setLedgerLoading(false);
    }
  };

  // Check Reconciliation
  const checkReconciliation = async (customerId: string, autoFix = false) => {
    try {
      setReconciling(true);
      const res = await (window as any).electronAPI.invoke('customers:reconcile', {
        customerId,
        autoFix,
        token: session?.token,
      });
      if (res && !res.error) {
        setReconciliation(res);
        if (autoFix) {
          setFeedback({ type: 'success', message: 'Customer balance repaired successfully.' });
          loadCustomers();
          if (selectedCustomer) {
            setSelectedCustomer((prev) => prev ? { ...prev, currentBalance: res.cachedBalance } : null);
          }
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Reconciliation failed' });
    } finally {
      setReconciling(false);
    }
  };

  // Open Khata Details Drawer
  const handleOpenKhata = (customer: CustomerDTO) => {
    setSelectedCustomer(customer);
    setDetailTab('ledger');
    loadCustomerLedger(customer.id);
  };

  // Handle Create Customer Submit
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await (window as any).electronAPI.invoke('customers:create', {
        customer: {
          name: createForm.name,
          phone: createForm.phone || undefined,
          email: createForm.email || undefined,
          address: createForm.address || undefined,
          openingBalance: Number(createForm.openingBalance || 0),
        },
        token: session?.token,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setFeedback({ type: 'success', message: `Customer "${res.name}" created successfully.` });
      setShowCreateModal(false);
      setCreateForm({ name: '', phone: '', email: '', address: '', openingBalance: 0 });
      loadCustomers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to create customer' });
    } finally {
      setLoading(false);
    }
  };

  // Open Record Payment Modal
  const handleOpenPayment = (customer: CustomerDTO) => {
    setPaymentCustomer(customer);
    setPaymentForm({
      amount: customer.currentBalance > 0 ? customer.currentBalance.toFixed(2) : '',
      paymentMethod: 'CASH',
      reference: '',
      notes: '',
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;

    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive payment amount.' });
      return;
    }

    if (amt > paymentCustomer.currentBalance) {
      setFeedback({
        type: 'error',
        message: `Payment amount (${currencySymbol}${amt.toFixed(2)}) exceeds outstanding receivable (${currencySymbol}${paymentCustomer.currentBalance.toFixed(2)}). Overpayment is not allowed.`,
      });
      return;
    }

    try {
      setLoading(true);
      const res = await (window as any).electronAPI.invoke('customers:recordPayment', {
        payment: {
          customerId: paymentCustomer.id,
          amount: amt,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference || undefined,
          notes: paymentForm.notes || undefined,
          paymentDate: paymentForm.paymentDate ? new Date(paymentForm.paymentDate).toISOString() : undefined,
        },
        token: session?.token,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setFeedback({
        type: 'success',
        message: `Payment of ${currencySymbol}${amt.toFixed(2)} received. New Balance: ${currencySymbol}${res.newBalance.toFixed(2)}.`,
      });
      setShowPaymentModal(false);
      loadCustomers();
      if (selectedCustomer && selectedCustomer.id === paymentCustomer.id) {
        setSelectedCustomer((prev) => prev ? { ...prev, currentBalance: res.newBalance } : null);
        loadCustomerLedger(paymentCustomer.id);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Payment recording failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Deactivate Customer
  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate customer "${name}"?`)) return;
    try {
      const res = await (window as any).electronAPI.invoke('customers:update', {
        id,
        customer: { status: 'INACTIVE' },
        token: session?.token,
      });
      if (res.error) throw new Error(res.error);
      setFeedback({ type: 'success', message: `Customer "${name}" deactivated.` });
      loadCustomers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Deactivation failed' });
    }
  };

  // Delete Customer (Safe Protection)
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete customer "${name}"? This is only allowed if no sales or ledger history exists.`)) return;
    try {
      const res = await (window as any).electronAPI.invoke('customers:delete', {
        id,
        token: session?.token,
      });
      if (res.error) throw new Error(res.error);
      setFeedback({ type: 'success', message: res.message || `Customer "${name}" deleted.` });
      loadCustomers();
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Delete failed' });
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

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Total Accounts Receivable</span>
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {currencySymbol}
            {summary ? summary.totalReceivables.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Outstanding Store Credit Due</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Debtor Customers</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-primary mt-2">
            {summary ? summary.customersWithOutstanding : 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Accounts with Due Balance</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Fully Paid Accounts</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {summary ? summary.fullyPaidCustomers : 0}
          </div>
          <div className="text-xs text-emerald-500/80 mt-1">Zero Balance / Settled</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Total Registered Customers</span>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {summary ? summary.totalCustomers : 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Active Retail Accounts</div>
        </div>
      </div>

      {/* Main Table & Filter Controls */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers by name, phone, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Filter Tabs */}
            <div className="bg-input border border-border p-1 rounded-lg flex items-center space-x-1 text-xs font-medium">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filterType === 'ALL' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('OUTSTANDING')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filterType === 'OUTSTANDING' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                With Due Balance
              </button>
              <button
                onClick={() => setFilterType('SETTLED')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filterType === 'SETTLED' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Fully Settled
              </button>
              <button
                onClick={() => setFilterType('INACTIVE')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  filterType === 'INACTIVE' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Inactive
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-1.5 bg-primary hover:bg-primary-hover text-primary-foreground px-3.5 py-2 rounded-lg text-sm font-semibold shadow-md shadow-primary/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Phone / Contact</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-right">Opening Bal.</th>
                <th className="py-3 px-4 text-right">Outstanding Receivable</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>Loading customer accounts...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <span>No customer records found.</span>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const hasDue = c.currentBalance > 0;
                  return (
                    <tr key={c.id} className="hover:bg-surface-elevated transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{c.name}</div>
                        {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-foreground">
                        {c.phone ? (
                          <span className="flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            <span>{c.phone}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">
                        {c.address || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-muted-foreground">
                        {currencySymbol}
                        {c.openingBalance.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg ${
                            hasDue
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                              : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                          }`}
                        >
                          {currencySymbol}
                          {c.currentBalance.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : 'bg-surface-elevated text-muted-foreground'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {hasDue && c.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleOpenPayment(c)}
                              title="Receive Payment"
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-sm transition-all flex items-center space-x-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pay</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenKhata(c)}
                            title="View Khata / Ledger"
                            className="p-1.5 bg-surface-elevated hover:bg-surface-muted text-foreground hover:text-primary rounded transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              {c.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleDeactivate(c.id, c.name)}
                                  title="Deactivate Customer"
                                  className="p-1.5 bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-amber-400 rounded transition-colors"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCustomer(c.id, c.name)}
                                title="Delete Customer (No History Only)"
                                className="p-1.5 bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-rose-400 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Khata & Statement Detail Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Drawer Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-bold text-white shadow-md">
                  {selectedCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center space-x-2">
                    <span>{selectedCustomer.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">({selectedCustomer.phone || 'No phone'})</span>
                  </h3>
                  <div className="text-xs text-muted-foreground flex items-center space-x-3 mt-0.5">
                    <span>Opening: {currencySymbol}{selectedCustomer.openingBalance.toFixed(2)}</span>
                    <span>•</span>
                    <span className="font-semibold text-rose-400">
                      Due: {currencySymbol}{selectedCustomer.currentBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {selectedCustomer.currentBalance > 0 && selectedCustomer.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleOpenPayment(selectedCustomer)}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 bg-surface-elevated hover:bg-surface-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Ledger / Statement / Reconcile */}
            <div className="px-5 border-b border-border flex items-center space-x-6 bg-surface text-xs font-semibold">
              <button
                onClick={() => {
                  setDetailTab('ledger');
                  loadCustomerLedger(selectedCustomer.id);
                }}
                className={`py-3 border-b-2 transition-all ${
                  detailTab === 'ledger'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Authoritative Ledger Trail
              </button>
              <button
                onClick={() => {
                  setDetailTab('statement');
                  loadStatement(selectedCustomer.id);
                }}
                className={`py-3 border-b-2 transition-all ${
                  detailTab === 'statement'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Account Statement
              </button>
              <button
                onClick={() => {
                  setDetailTab('reconcile');
                  checkReconciliation(selectedCustomer.id, false);
                }}
                className={`py-3 border-b-2 transition-all flex items-center space-x-1.5 ${
                  detailTab === 'reconcile'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Reconciliation Audit</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-5 overflow-y-auto">
              {/* TAB 1: LEDGER */}
              {detailTab === 'ledger' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Double-entry chronological transaction log (Source of Truth)</span>
                    <span>Total Entries: {ledgerEntries.length}</span>
                  </div>

                  <div className="border border-border rounded-xl overflow-hidden bg-surface-muted">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-input text-muted-foreground uppercase font-semibold">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reference / Notes</th>
                          <th className="py-2.5 px-3 text-right">Debit (+)</th>
                          <th className="py-2.5 px-3 text-right">Credit (-)</th>
                          <th className="py-2.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {ledgerLoading ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
                              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-1" />
                              <span>Loading ledger...</span>
                            </td>
                          </tr>
                        ) : ledgerEntries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
                              No financial ledger transactions recorded.
                            </td>
                          </tr>
                        ) : (
                          ledgerEntries.map((e) => (
                            <tr key={e.id} className="hover:bg-surface-elevated font-mono">
                              <td className="py-2 px-3 text-muted-foreground">
                                {new Date(e.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    e.type === 'INVOICE'
                                      ? 'bg-amber-950/60 text-amber-400'
                                      : e.type === 'PAYMENT_RECEIVED'
                                      ? 'bg-emerald-950/60 text-emerald-400'
                                      : e.type === 'SALES_RETURN'
                                      ? 'bg-blue-950/60 text-blue-400'
                                      : 'bg-surface-elevated text-foreground'
                                  }`}
                                >
                                  {e.type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-foreground font-sans max-w-[220px] truncate">
                                {e.notes || e.referenceId}
                              </td>
                              <td className="py-2 px-3 text-right text-amber-400">
                                {e.debit > 0 ? `${currencySymbol}${e.debit.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-400">
                                {e.credit > 0 ? `${currencySymbol}${e.credit.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-foreground">
                                {currencySymbol}{e.balance.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: STATEMENT */}
              {detailTab === 'statement' && (
                <div className="space-y-5">
                  <div className="flex items-center space-x-4 bg-surface-muted p-3 rounded-xl border border-border text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">From:</span>
                      <input
                        type="date"
                        value={statementStartDate}
                        onChange={(e) => setStatementStartDate(e.target.value)}
                        className="bg-surface border border-border rounded px-2 py-1 text-foreground"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">To:</span>
                      <input
                        type="date"
                        value={statementEndDate}
                        onChange={(e) => setStatementEndDate(e.target.value)}
                        className="bg-surface border border-border rounded px-2 py-1 text-foreground"
                      />
                    </div>
                    <button
                      onClick={() => loadStatement(selectedCustomer.id)}
                      className="bg-primary hover:bg-primary-hover text-primary-foreground px-3 py-1 rounded font-semibold transition-colors"
                    >
                      Filter
                    </button>
                  </div>

                  {statementData && (
                    <div className="space-y-4">
                      {/* Statement Summary Cards */}
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div className="bg-input p-3 rounded-lg border border-border">
                          <div className="text-muted-foreground">Opening Balance</div>
                          <div className="font-mono font-bold text-sm text-foreground mt-1">
                            {currencySymbol}{statementData.openingBalance.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-input p-3 rounded-lg border border-border">
                          <div className="text-muted-foreground">Total Debits (Sales)</div>
                          <div className="font-mono font-bold text-sm text-amber-400 mt-1">
                            {currencySymbol}{statementData.totalDebit.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-input p-3 rounded-lg border border-border">
                          <div className="text-muted-foreground">Total Credits (Paid/Return)</div>
                          <div className="font-mono font-bold text-sm text-emerald-400 mt-1">
                            {currencySymbol}{statementData.totalCredit.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-input p-3 rounded-lg border border-border">
                          <div className="text-muted-foreground">Closing Balance</div>
                          <div className="font-mono font-bold text-sm text-rose-400 mt-1">
                            {currencySymbol}{statementData.closingBalance.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Statement Entries */}
                      <div className="border border-border rounded-xl overflow-hidden bg-surface-muted">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-border bg-input text-muted-foreground font-sans uppercase font-semibold">
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Description</th>
                              <th className="py-2.5 px-3 text-right">Debit</th>
                              <th className="py-2.5 px-3 text-right">Credit</th>
                              <th className="py-2.5 px-3 text-right">Running Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {statementData.entries.map((item) => (
                              <tr key={item.id} className="hover:bg-surface-elevated">
                                <td className="py-2 px-3 text-muted-foreground">
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-2 px-3 font-sans text-foreground">
                                  {item.notes || item.type}
                                </td>
                                <td className="py-2 px-3 text-right text-amber-400">
                                  {item.debit > 0 ? `${currencySymbol}${item.debit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right text-emerald-400">
                                  {item.credit > 0 ? `${currencySymbol}${item.credit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-foreground">
                                  {currencySymbol}{item.balance.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: RECONCILIATION */}
              {detailTab === 'reconcile' && (
                <div className="space-y-4 text-sm">
                  <div className="p-4 bg-input rounded-xl border border-border space-y-3">
                    <h4 className="font-semibold text-foreground">Balance Integrity Verification</h4>
                    <p className="text-xs text-muted-foreground">
                      The ledger is the immutable single source of truth. The customer's active balance cache is verified against the net sum of all ledger debits and credits:
                      <code className="ml-1 text-primary font-mono">Calculated = Σ(Debits) - Σ(Credits)</code>.
                    </p>

                    {reconciliation && (
                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                        <div>
                          <span className="text-xs text-muted-foreground block">Cached Balance:</span>
                          <span className="text-lg font-mono font-bold text-foreground">
                            {currencySymbol}{reconciliation.cachedBalance.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Ledger Authoritative Sum:</span>
                          <span className="text-lg font-mono font-bold text-amber-400">
                            {currencySymbol}{reconciliation.calculatedBalance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {reconciliation && (
                      <div
                        className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
                          reconciliation.isBalanced
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {reconciliation.isBalanced ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          )}
                          <span>
                            {reconciliation.isBalanced
                              ? 'Authoritative ledger and cached balance are 100% synchronized.'
                              : `Mismatch detected! Discrepancy: ${currencySymbol}${reconciliation.discrepancy.toFixed(2)}.`}
                          </span>
                        </div>

                        {!reconciliation.isBalanced && isAdmin && (
                          <button
                            onClick={() => checkReconciliation(selectedCustomer.id, true)}
                            disabled={reconciling}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                          >
                            Repair Balance Cache
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE CUSTOMER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
              <h3 className="font-bold text-base text-foreground flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Add New Customer</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-surface-elevated rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="e.g. customer@example.com"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Street address, city"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Opening Receivable Balance ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.openingBalance}
                  onChange={(e) => setCreateForm({ ...createForm, openingBalance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Creates an initial OPENING_BALANCE ledger entry if &gt; 0.
                </span>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg text-xs font-semibold shadow-md transition-all flex items-center space-x-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && paymentCustomer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted">
              <h3 className="font-bold text-base text-foreground flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <span>Receive Customer Payment</span>
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 hover:bg-surface-elevated rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-sm">
              <div className="bg-input p-3 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">{paymentCustomer.name}</div>
                  <div className="text-xs text-muted-foreground">{paymentCustomer.phone || 'No phone'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Current Due</div>
                  <div className="font-mono font-bold text-base text-rose-400">
                    {currencySymbol}{paymentCustomer.currentBalance.toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Payment Amount ({currencySymbol}) *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: paymentCustomer.currentBalance.toFixed(2),
                      })
                    }
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Pay Full Due
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={paymentCustomer.currentBalance}
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground font-mono text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as PaymentMethod })
                  }
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Reference / Transaction No.
                </label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="UPI Ref ID, Cheque No, Bank Txn"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Optional cashier notes"
                  className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-foreground rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center space-x-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
