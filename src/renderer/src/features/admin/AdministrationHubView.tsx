import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Store,
  Monitor,
  Share2,
  HardDrive,
  Activity,
  Globe,
  Building2,
  Palette,
  Calendar,
  DollarSign,
  Receipt,
  Sliders,
  Lock,
  Code2,
  Scale,
  MapPin,
  Award,
  Tag,
  Hash,
  Mail,
  MessageSquare,
  CreditCard,
  Layers,
  Database,
  Clock,
  DownloadCloud,
  Key,
  FileText,
  Check,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw,
  Eye,
  Trash2,
  Plus,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { AppSettingsDTO, UserManagementDTO, SystemHealthDTO, Role, Status } from '../../../../shared/types';
import { formatCurrency } from '../../utils/formatCurrency';
import { RoleManagementSection } from './RoleManagementSection';
import { getAccessibleForegroundColor } from '../../theme/ThemeEngine';

export function AdministrationHubView() {
  const { session, settings, updateSettings } = useAuthStore();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('company');
  const [formData, setFormData] = useState<AppSettingsDTO | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // User Management State
  const [usersList, setUsersList] = useState<UserManagementDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>(['CASHIER', 'MANAGER', 'ADMIN']);
  const [showAddUserModal, setShowAddUserModal] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', fullName: '', role: 'CASHIER' as Role });
  const [userModalError, setUserModalError] = useState<string | null>(null);


  // System Health State
  const [systemHealth, setSystemHealth] = useState<SystemHealthDTO | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  // SMTP Test State
  const [smtpTesting, setSmtpTesting] = useState<boolean>(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Gateway Test State
  const [gatewayTesting, setGatewayTesting] = useState<'STRIPE' | 'RAZORPAY' | 'CASHFREE' | null>(null);
  const [gatewayFeedback, setGatewayFeedback] = useState<Record<string, { success: boolean; message: string } | null>>({});

  // Barcode Scale Testing State
  const [scaleTestInput, setScaleTestInput] = useState<string>('2000123004506');

  // Legal Modal State
  const [legalPreviewDoc, setLegalPreviewDoc] = useState<{ title: string; html: string } | null>(null);

  // Initialize form data from store
  useEffect(() => {
    if (settings) {
      setFormData(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  // Load Users when on Users tab
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'health') {
      loadSystemHealth();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;
    setUsersLoading(true);
    try {
      const res = await electronAPI.invoke('admin:listUsers', { token: session.token });
      if (res.success && res.users) {
        setUsersList(res.users);
      }
      const rolesRes = await electronAPI.invoke('admin:listRoles', { token: session.token });
      if (rolesRes.success && rolesRes.roles) {
        const roleNames = rolesRes.roles.map((r: any) => r.name);
        if (roleNames.length > 0) {
          setAvailableRoles(roleNames);
        }
      }
    } catch (e: any) {
      console.warn('[Admin] Failed to load users or roles:', e);
    } finally {
      setUsersLoading(false);
    }
  };


  const loadSystemHealth = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;
    setHealthLoading(true);
    try {
      const res = await electronAPI.invoke('admin:getSystemHealth', { token: session.token });
      if (res.success && res.health) {
        setSystemHealth(res.health);
      }
    } catch (e: any) {
      console.warn('[Admin] Failed to load health:', e);
    } finally {
      setHealthLoading(false);
    }
  };

  // Field updater
  const updateField = (path: string, value: any) => {
    if (!formData) return;
    setFormData((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let current = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return next;
    });
    setHasChanges(true);
  };

  // Save Settings
  const handleSave = async () => {
    if (!formData || !session) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await electronAPI.invoke('settings:update', {
        settings: formData,
        token: session.token,
      });

      if (res.success && res.settings) {
        updateSettings(res.settings);
        setFormData(JSON.parse(JSON.stringify(res.settings)));
        setHasChanges(false);
        setFeedback({ type: 'success', message: 'Settings successfully saved and applied to runtime!' });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to update settings.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Reset to Defaults
  const handleResetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset settings to documented factory defaults? Unsaved changes will be replaced.')) {
      return;
    }
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;
    try {
      const raw = await electronAPI.invoke('settings:get');
      setFormData(raw);
      setHasChanges(true);
      setFeedback({ type: 'success', message: 'Loaded factory defaults. Click "Save Changes" to persist.' });
    } catch (e: any) {
      setFeedback({ type: 'error', message: 'Could not reset settings.' });
    }
  };

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    try {
      const res = await electronAPI.invoke('admin:createUser', {
        user: newUserForm,
        token: session.token,
      });
      if (res.success) {
        setShowAddUserModal(false);
        setNewUserForm({ username: '', password: '', fullName: '', role: 'CASHIER' });
        loadUsers();
        setFeedback({ type: 'success', message: `User "${res.user.username}" created successfully.` });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setUserModalError(res.error || 'Failed to create user');
      }
    } catch (err: any) {
      setUserModalError(err?.message || 'Error creating user');
    }
  };

  // Toggle User Status
  const handleToggleUserStatus = async (user: UserManagementDTO) => {
    const nextStatus: Status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !session) return;

    try {
      const res = await electronAPI.invoke('admin:updateUser', {
        id: user.id,
        updates: { status: nextStatus },
        token: session.token,
      });
      if (res.success) {
        loadUsers();
        setFeedback({ type: 'success', message: `User status updated to ${nextStatus}.` });
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Status update failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Status update failed' });
    }
  };

  // Test SMTP
  const handleTestSmtp = async () => {
    if (!formData || !session) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    setSmtpTesting(true);
    setSmtpFeedback(null);
    try {
      const res = await electronAPI.invoke('settings:testSmtp', {
        config: formData.smtp,
        token: session.token,
      });
      setSmtpFeedback(res);
    } catch (e: any) {
      setSmtpFeedback({ success: false, message: e?.message || 'SMTP connection failed' });
    } finally {
      setSmtpTesting(false);
    }
  };

  // Test Payment Gateway
  const handleTestGateway = async (gateway: 'STRIPE' | 'RAZORPAY' | 'CASHFREE') => {
    if (!formData || !session) return;
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    setGatewayTesting(gateway);
    setGatewayFeedback((prev) => ({ ...prev, [gateway]: null }));

    const configMap: Record<string, any> = {
      STRIPE: formData.gateways.stripe,
      RAZORPAY: formData.gateways.razorpay,
      CASHFREE: (formData.gateways as any).cashfree,
    };

    try {
      const res = await electronAPI.invoke('gateways:test', {
        gateway,
        config: configMap[gateway],
        token: session.token,
      });
      setGatewayFeedback((prev) => ({ ...prev, [gateway]: res }));
    } catch (e: any) {
      setGatewayFeedback((prev) => ({
        ...prev,
        [gateway]: { success: false, message: e?.message || `${gateway} connection test failed` },
      }));
    } finally {
      setGatewayTesting(null);
    }
  };

  // Scale Barcode Decoder
  const decodeScaleBarcode = (barcode: string) => {
    const scale = formData?.scale;
    if (!scale || !scale.enabled) {
      return { valid: false, error: 'Weighing scale is disabled in settings' };
    }
    if (!barcode.startsWith(scale.prefix)) {
      return { valid: false, error: `Barcode does not start with configured scale prefix "${scale.prefix}"` };
    }

    try {
      let offset = scale.prefix.length;
      const plu = barcode.slice(offset, offset + scale.pluDigits);
      offset += scale.pluDigits + scale.digitsToSkip;
      const rawVal = barcode.slice(offset, offset + scale.valueDigits);
      const divisor = Math.pow(10, scale.valueDecimals);
      const parsedVal = parseInt(rawVal, 10) / divisor;

      return {
        valid: true,
        plu,
        value: parsedVal,
        type: scale.embeddedValue === 'WEIGHT' ? 'Weight (kg)' : 'Price',
      };
    } catch {
      return { valid: false, error: 'Invalid barcode structure' };
    }
  };

  if (!formData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-input text-muted-foreground space-x-2">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Loading configuration...</span>
      </div>
    );
  }

  // Navigation Items Definition
  const adminNav = [
    { id: 'users', label: 'Users', icon: Users, desc: 'Manage operators & cashiers' },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield, desc: 'View server RBAC matrix' },
    { id: 'store', label: 'Store Profile', icon: Store, desc: 'Single-shop store identity' },
    { id: 'terminals', label: 'Terminals', icon: Monitor, desc: 'Workstation POS parameters' },
    { id: 'channels', label: 'Sales Channels', icon: Share2, desc: 'In-store retail channel' },
    { id: 'hardware', label: 'Hardware', icon: HardDrive, desc: 'Printers, scanners & scale' },
    { id: 'health', label: 'System Health', icon: Activity, desc: 'SQLite diagnostics & stats' },
    { id: 'languages', label: 'Languages', icon: Globe, desc: 'English & locale configs' },
  ];

  const settingsNav = [
    { id: 'company', label: 'Company Profile', icon: Building2, desc: 'Name, address, tax ID & logo' },
    { id: 'branding', label: 'Branding & Theme', icon: Palette, desc: 'Accent color, logos, theme' },
    { id: 'regional', label: 'Regional', icon: Calendar, desc: 'Timezone, date & time format' },
    { id: 'currency', label: 'Currency & Formatting', icon: DollarSign, desc: 'Symbol, decimals & separators' },
    { id: 'receipt', label: 'Receipt Template', icon: Receipt, desc: 'Paper size, header, footer' },
    { id: 'cashier', label: 'Cashier (POS)', icon: Sliders, desc: 'Tile size, cart position, theme' },
    { id: 'security', label: 'Security', icon: Lock, desc: 'Single-session mode, timeout' },
    { id: 'scripts', label: 'Scripts', icon: Code2, desc: 'Header & footer scripts' },
    { id: 'scale', label: 'Weighing Scale', icon: Scale, desc: 'Barcode prefixes & PLU parser' },
    { id: 'locations', label: 'Stock Locations', icon: MapPin, desc: 'Aisle, rack, shelf & bin' },
    { id: 'loyalty', label: 'Loyalty Points', icon: Award, desc: 'Earn rate & redemption rules' },
    { id: 'pricing', label: 'Pricing', icon: Tag, desc: 'Product/batch pricing modes' },
    { id: 'numbering', label: 'Numbering', icon: Hash, desc: 'Invoice sequences & formats' },
    { id: 'smtp', label: 'Email & SMTP', icon: Mail, desc: 'Mail driver & credentials' },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, desc: 'Cloud API & message templates' },
    { id: 'payments', label: 'Payment Methods', icon: CreditCard, desc: 'Enable/disable tender methods' },
    { id: 'gateways', label: 'Payment Gateways', icon: Layers, desc: 'Stripe, Razorpay, Cashfree' },
    { id: 'backup', label: 'Backup & Restore', icon: Database, desc: 'Scheduled snapshots & retention' },
    { id: 'scheduler', label: 'Scheduler', icon: Clock, desc: 'Desktop background jobs' },
    { id: 'updates', label: 'Updates', icon: DownloadCloud, desc: 'Release channel & auto-check' },
    { id: 'license', label: 'License', icon: Key, desc: 'Activation & offline grace' },
    { id: 'legal', label: 'Privacy & Terms', icon: FileText, desc: 'Sanitized legal policies' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 px-6 bg-surface border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/40 flex items-center justify-center text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center space-x-2">
              <span>Administration & System Settings</span>
              {hasChanges && (
                <span className="text-[10px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Unsaved Changes</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-foreground-muted">Production-grade configuration engine with instant runtime propagation</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-muted text-xs font-semibold text-foreground-secondary hover:bg-surface-hover transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-md ${
              hasChanges
                ? 'bg-accent hover:bg-accent-hover text-accent-foreground shadow-accent'
                : 'bg-surface-muted text-foreground-subtle cursor-not-allowed border border-border'
            }`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace: Navigation Sidebar + Detail Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto flex-shrink-0 p-3 space-y-6">
          {/* Master Administration Section */}
          <div>
            <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-sidebar-muted">Administration</span>
            <div className="mt-2 space-y-1">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-accent text-accent-foreground font-semibold shadow-sm shadow-accent'
                        : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settings Section */}
          <div>
            <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-sidebar-muted">Settings</span>
            <div className="mt-2 space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-accent text-accent-foreground font-semibold shadow-sm shadow-accent'
                        : 'text-sidebar-muted hover:text-sidebar-text hover:bg-surface-muted'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Detail Panel */}
        <main className="flex-1 overflow-y-auto p-8 bg-background">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* 1. USERS MANAGEMENT */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">User Accounts & Access</h2>
                    <p className="text-xs text-muted-foreground">Manage cashier and administrator logins for this solo workstation</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:bg-accent-hover shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                </div>

                {usersLoading ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">Loading user accounts...</div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden bg-surface-elevated/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface border-b border-border text-muted-foreground uppercase font-semibold">
                        <tr>
                          <th className="py-3 px-4">Username</th>
                          <th className="py-3 px-4">Full Name</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 text-foreground">
                        {usersList.map((u) => (
                          <tr key={u.id} className="hover:bg-surface-elevated">
                            <td className="py-3 px-4 font-mono font-bold text-foreground">{u.username}</td>
                            <td className="py-3 px-4">{u.fullName}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.role === 'ADMIN'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className="text-xs text-muted-foreground hover:text-foreground underline ml-2"
                              >
                                {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 2. ROLES & PERMISSIONS */}
            {activeTab === 'roles' && (
              <RoleManagementSection
                sessionToken={session?.token}
                onNotify={(type, msg) => {
                  setFeedback({ type, message: msg });
                  setTimeout(() => setFeedback(null), 4000);
                }}
              />
            )}


            {/* 3. STORE PROFILE */}
            {activeTab === 'store' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Store Profile</h2>
                  <p className="text-xs text-muted-foreground">RS Inventory – Solo single store physical establishment profile</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Store Name</label>
                      <input
                        type="text"
                        value={formData.store.storeName}
                        onChange={(e) => updateField('store.storeName', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Legal Entity Name</label>
                      <input
                        type="text"
                        value={formData.store.legalName}
                        onChange={(e) => updateField('store.legalName', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">GSTIN / Tax Registration</label>
                      <input
                        type="text"
                        value={formData.store.taxNumber}
                        onChange={(e) => updateField('store.taxNumber', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Store Contact Phone</label>
                      <input
                        type="text"
                        value={formData.store.phone}
                        onChange={(e) => updateField('store.phone', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">Physical Address</label>
                      <input
                        type="text"
                        value={formData.store.address}
                        onChange={(e) => updateField('store.address', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. TERMINALS */}
            {activeTab === 'terminals' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Workstation Terminal Setup</h2>
                  <p className="text-xs text-muted-foreground">Configure local workstation identification and default hardware assignments</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Terminal Identifier</label>
                      <input
                        type="text"
                        value={formData.terminal.terminalName}
                        onChange={(e) => updateField('terminal.terminalName', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.terminal.active}
                          onChange={(e) => updateField('terminal.active', e.target.checked)}
                          className="rounded bg-input border-border text-accent focus:ring-0"
                        />
                        <span className="text-xs font-semibold text-foreground">Terminal Station Active</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. SALES CHANNELS */}
            {activeTab === 'channels' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Sales Channels</h2>
                  <p className="text-xs text-muted-foreground">RS Inventory – Solo offline-first workstation retail sales channel</p>
                </div>
                <div className="border border-border rounded-xl overflow-hidden bg-surface-elevated/40 p-5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                      POS
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">In-Store Workstation (Primary Offline)</h3>
                      <p className="text-[11px] text-muted-foreground">Operates 100% offline with instant SQLite writes</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    ACTIVE
                  </span>
                </div>
              </div>
            )}

            {/* 6. HARDWARE */}
            {activeTab === 'hardware' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Hardware Integration Diagnostics</h2>
                  <p className="text-xs text-muted-foreground">Configure POS barcode scanner thresholds, cash drawer, and printers</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Barcode Scanner (Keyboard Wedge)</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Min Length</label>
                      <input
                        type="number"
                        value={formData.pos.scanner.minBarcodeLength}
                        onChange={(e) => updateField('pos.scanner.minBarcodeLength', parseInt(e.target.value) || 3)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Timing Threshold (ms)</label>
                      <input
                        type="number"
                        value={formData.pos.scanner.interCharTimingThresholdMs}
                        onChange={(e) => updateField('pos.scanner.interCharTimingThresholdMs', parseInt(e.target.value) || 60)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Buffer Timeout (ms)</label>
                      <input
                        type="number"
                        value={formData.pos.scanner.bufferTimeoutMs}
                        onChange={(e) => updateField('pos.scanner.bufferTimeoutMs', parseInt(e.target.value) || 300)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. SYSTEM HEALTH */}
            {activeTab === 'health' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">SQLite System Health & Database Diagnostics</h2>
                    <p className="text-xs text-muted-foreground">Read-only diagnostic health checks on live local SQLite storage</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadSystemHealth}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-semibold text-foreground hover:bg-surface-muted"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin text-accent' : ''}`} />
                    <span>Run Diagnostics</span>
                  </button>
                </div>

                {systemHealth && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-surface-elevated/40 border border-border p-4 rounded-xl">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Integrity Check</span>
                        <div className="mt-1 flex items-center space-x-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              systemHealth.databaseIntegrity === 'OK' ? 'bg-emerald-400' : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-sm font-bold text-foreground">
                            {systemHealth.databaseIntegrity === 'OK' ? 'PRAGMA Passed' : 'Corrupted'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-surface-elevated/40 border border-border p-4 rounded-xl">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Database File Size</span>
                        <div className="mt-1 text-sm font-mono font-bold text-foreground">{systemHealth.databaseSizeFormatted}</div>
                      </div>

                      <div className="bg-surface-elevated/40 border border-border p-4 rounded-xl">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Disk Headroom</span>
                        <div className="mt-1 text-sm font-mono font-bold text-emerald-400">{systemHealth.diskFreeFormatted}</div>
                      </div>

                      <div className="bg-surface-elevated/40 border border-border p-4 rounded-xl">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase">Backup Health</span>
                        <div className="mt-1 text-sm font-bold text-foreground">{systemHealth.lastBackupStatus}</div>
                      </div>
                    </div>

                    <div className="bg-surface-elevated/40 border border-border p-5 rounded-xl">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Live Table Record Counts</h3>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        {Object.entries(systemHealth.tableCounts).map(([table, count]) => (
                          <div key={table} className="flex items-center justify-between p-2 rounded bg-input border border-border">
                            <span className="font-mono text-muted-foreground">{table}</span>
                            <span className="font-bold text-foreground">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 8. LANGUAGES */}
            {activeTab === 'languages' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Languages & Regional Localization</h2>
                  <p className="text-xs text-muted-foreground">Configure application display language and locale fallbacks</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-foreground">English (India / International)</h3>
                    <p className="text-[11px] text-muted-foreground">Primary workstation UI language with custom currency symbols</p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-accent/20 text-accent border border-accent/30 text-xs font-bold">
                    DEFAULT ACTIVE
                  </span>
                </div>
              </div>
            )}

            {/* 9. COMPANY PROFILE */}
            {activeTab === 'company' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Company Profile</h2>
                  <p className="text-xs text-muted-foreground">Appears on invoices, reports, receipts, customer ledger statements, and application headers</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Business Shop Name *</label>
                      <input
                        type="text"
                        value={formData.company.shopName}
                        onChange={(e) => updateField('company.shopName', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Contact Phone *</label>
                      <input
                        type="text"
                        value={formData.company.phone}
                        onChange={(e) => updateField('company.phone', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Contact Email</label>
                      <input
                        type="email"
                        value={formData.company.email || ''}
                        onChange={(e) => updateField('company.email', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Tax Registration / GSTIN</label>
                      <input
                        type="text"
                        value={formData.company.gstin || ''}
                        onChange={(e) => updateField('company.gstin', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">Store Address *</label>
                      <textarea
                        rows={2}
                        value={formData.company.address}
                        onChange={(e) => updateField('company.address', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 10. BRANDING & THEME */}
            {activeTab === 'branding' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Branding & Theme Engine</h2>
                  <p className="text-xs text-foreground-muted">
                    Controls global visual presentation across the entire application in real-time. Changes propagate instantly upon saving without requiring application restart, rebuild, or reload!
                  </p>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 space-y-6 shadow-sm">
                  {/* Theme Mode Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Theme Mode</label>
                    <p className="text-[11px] text-foreground-muted mb-2">
                      Choose your default visual mode or follow the operating system appearance automatically.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'dark', label: 'Dark Mode', desc: 'Optimized for POS displays & night shifts' },
                        { id: 'light', label: 'Light Mode', desc: 'Clean, high-visibility daylight interface' },
                        { id: 'system', label: 'Match Device (System)', desc: 'Automatically matches OS appearance' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => updateField('branding.theme', mode.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            formData.branding.theme === mode.id
                              ? 'border-accent bg-accent-muted text-accent font-semibold shadow-sm ring-2 ring-accent/30'
                              : 'border-border bg-surface-muted/50 text-foreground-secondary hover:bg-surface-hover'
                          }`}
                        >
                          <div className="text-xs font-bold">{mode.label}</div>
                          <div className="text-[11px] opacity-75 mt-0.5">{mode.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preset Swatches */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">Accent Color Presets</label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {[
                        { name: 'RS Orange', hex: '#F97316' },
                        { name: 'Sky Cyan', hex: '#00AEEF' },
                        { name: 'Emerald', hex: '#10B981' },
                        { name: 'Indigo', hex: '#6366F1' },
                        { name: 'Rose Pink', hex: '#EC4899' },
                        { name: 'Purple', hex: '#8B5CF6' },
                        { name: 'Amber Gold', hex: '#F59E0B' },
                        { name: 'Teal', hex: '#14B8A6' },
                      ].map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => {
                            updateField('branding.accentColor', swatch.hex);
                            const autoFg = getAccessibleForegroundColor(swatch.hex);
                            updateField('branding.accentTextColor', autoFg);
                          }}
                          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                            formData.branding.accentColor.toUpperCase() === swatch.hex.toUpperCase()
                              ? 'border-primary ring-2 ring-primary/40 shadow-sm text-foreground font-bold'
                              : 'border-border text-foreground-secondary hover:text-foreground'
                          }`}
                          style={{ backgroundColor: swatch.hex + '18' }}
                        >
                          <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: swatch.hex }} />
                          <span>{swatch.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Customization Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Custom Primary Accent Color (Hex)
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.branding.accentColor}
                          onChange={(e) => {
                            const newAccent = e.target.value;
                            updateField('branding.accentColor', newAccent);
                            const autoFg = getAccessibleForegroundColor(newAccent);
                            updateField('branding.accentTextColor', autoFg);
                          }}
                          className="w-10 h-10 rounded border border-border bg-surface cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={formData.branding.accentColor}
                          onChange={(e) => {
                            const newAccent = e.target.value;
                            updateField('branding.accentColor', newAccent);
                            if (newAccent.length >= 4) {
                              const autoFg = getAccessibleForegroundColor(newAccent);
                              updateField('branding.accentTextColor', autoFg);
                            }
                          }}
                          className="flex-1 bg-input border border-input-border rounded-lg px-3 py-2 text-xs font-mono uppercase text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                      <p className="text-[10px] text-foreground-muted mt-1">
                        Drives buttons, active tabs, links, focus rings, checkboxes, switches, and POS primary actions.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Base Text Color Override (Optional)
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={formData.branding.textColor || (formData.branding.theme?.toLowerCase() === 'light' ? '#0F172A' : '#F8FAFC')}
                          onChange={(e) => updateField('branding.textColor', e.target.value)}
                          className="w-10 h-10 rounded border border-border bg-surface cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          placeholder={formData.branding.theme?.toLowerCase() === 'light' ? '#0F172A (Auto Black)' : '#F8FAFC (Auto White)'}
                          value={formData.branding.textColor || ''}
                          onChange={(e) => updateField('branding.textColor', e.target.value)}
                          className="flex-1 bg-input border border-input-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                        />
                        {formData.branding.textColor && (
                          <button
                            type="button"
                            onClick={() => updateField('branding.textColor', '')}
                            className="px-2 py-1.5 rounded text-[10px] text-foreground-muted hover:text-foreground border border-border"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-foreground-muted mt-1">
                        Auto: Black (#0F172A) in Light theme, White (#F8FAFC) in Dark theme.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Application Name</label>
                      <input
                        type="text"
                        value={formData.branding.appName}
                        onChange={(e) => updateField('branding.appName', e.target.value)}
                        className="w-full bg-input border border-input-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <p className="text-[10px] text-foreground-muted mt-1">Displayed in title bar, sidebar brand header, and login.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Footer Brand Text</label>
                      <input
                        type="text"
                        value={formData.branding.footerText}
                        onChange={(e) => updateField('branding.footerText', e.target.value)}
                        className="w-full bg-input border border-input-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <p className="text-[10px] text-foreground-muted mt-1">Displayed in printouts, receipt footers, and legal copyright notices.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Light Theme Logo URL</label>
                      <input
                        type="text"
                        placeholder="https://... or data:image/png;base64,..."
                        value={formData.branding.lightLogoUrl || ''}
                        onChange={(e) => updateField('branding.lightLogoUrl', e.target.value)}
                        className="w-full bg-input border border-input-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <p className="text-[10px] text-foreground-muted mt-1">Automatically displayed when Light Mode is active.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Dark Theme Logo URL</label>
                      <input
                        type="text"
                        placeholder="https://... or data:image/png;base64,..."
                        value={formData.branding.darkLogoUrl || ''}
                        onChange={(e) => updateField('branding.darkLogoUrl', e.target.value)}
                        className="w-full bg-input border border-input-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <p className="text-[10px] text-foreground-muted mt-1">Automatically displayed when Dark Mode is active.</p>
                    </div>
                  </div>

                  {/* Comprehensive Dual Light & Dark Theme Live Preview */}
                  <div className="pt-4 border-t border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground-muted">
                        Live Preview (Instant Response)
                      </span>
                      <span className="text-xs text-foreground-secondary font-mono">
                        Accent: <strong>{formData.branding.accentColor}</strong> | Contrast FG:{' '}
                        <strong>{getAccessibleForegroundColor(formData.branding.accentColor)}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Dark Preview Card */}
                      <div className="p-4 rounded-xl border border-border bg-input text-foreground space-y-3 shadow-inner">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <span className="text-xs font-bold text-foreground">Dark Theme Preview</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-muted-foreground font-mono">#090D16</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold shadow transition"
                            style={{
                              backgroundColor: formData.branding.accentColor,
                              color: getAccessibleForegroundColor(formData.branding.accentColor),
                            }}
                          >
                            Primary Button
                          </button>
                          <div
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                            style={{
                              backgroundColor: formData.branding.accentColor + '20',
                              borderColor: formData.branding.accentColor + '50',
                              color: formData.branding.accentColor,
                            }}
                          >
                            Active Tab
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-surface border border-border text-xs space-y-1">
                          <div className="text-foreground font-semibold">Elevated Card Surface</div>
                          <div className="text-muted-foreground text-[11px]">Secondary description text in dark mode.</div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value="Sample Input"
                            className="bg-surface border border-border rounded px-2 py-1 text-xs text-foreground w-full"
                          />
                        </div>
                      </div>

                      {/* Light Preview Card */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-900 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold text-slate-800">Light Theme Preview</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-muted-foreground font-mono">#FFFFFF</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold shadow transition"
                            style={{
                              backgroundColor: formData.branding.accentColor,
                              color: getAccessibleForegroundColor(formData.branding.accentColor),
                            }}
                          >
                            Primary Button
                          </button>
                          <div
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                            style={{
                              backgroundColor: formData.branding.accentColor + '15',
                              borderColor: formData.branding.accentColor + '40',
                              color: formData.branding.accentColor,
                            }}
                          >
                            Active Tab
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                          <div className="text-slate-900 font-semibold">Elevated Card Surface</div>
                          <div className="text-muted-foreground text-[11px]">Secondary description text in light mode.</div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value="Sample Input"
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 11. REGIONAL */}
            {activeTab === 'regional' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Regional & Date/Time Standards</h2>
                  <p className="text-xs text-muted-foreground">Database timestamps remain strictly UTC while display formatting adapts to your store</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Timezone</label>
                      <select
                        value={formData.regional.timezone}
                        onChange={(e) => updateField('regional.timezone', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                        <option value="UTC">UTC (Universal Coordinated Time)</option>
                        <option value="America/New_York">America/New_York (EST / EDT)</option>
                        <option value="Europe/London">Europe/London (GMT / BST)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Date Format</label>
                      <select
                        value={formData.regional.dateFormat}
                        onChange={(e) => updateField('regional.dateFormat', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 19/09/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/19/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Time Format</label>
                      <select
                        value={formData.regional.timeFormat}
                        onChange={(e) => updateField('regional.timeFormat', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="12h">12-Hour Clock (e.g. 02:30 PM)</option>
                        <option value="24h">24-Hour Clock (e.g. 14:30)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Financial Year Start Month</label>
                      <select
                        value={formData.regional.financialYearStartMonth}
                        onChange={(e) => updateField('regional.financialYearStartMonth', parseInt(e.target.value))}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value={4}>April (India & UK fiscal year)</option>
                        <option value={1}>January (Calendar year)</option>
                        <option value={7}>July (Australia fiscal year)</option>
                        <option value={10}>October (US fiscal year)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 12. CURRENCY & FORMATTING */}
            {activeTab === 'currency' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Currency & Numeric Formatting</h2>
                  <p className="text-xs text-muted-foreground">
                    Consumed by POS, Reports, Invoices, Customer Khata, and Expenses through a single centralized service
                  </p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Base Currency Code</label>
                      <input
                        type="text"
                        value={formData.currency.baseCurrency}
                        onChange={(e) => updateField('currency.baseCurrency', e.target.value.toUpperCase())}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono uppercase text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Currency Symbol</label>
                      <input
                        type="text"
                        value={formData.currency.symbol}
                        onChange={(e) => {
                          updateField('currency.symbol', e.target.value);
                          updateField('company.currencySymbol', e.target.value);
                        }}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Decimal Places</label>
                      <select
                        value={formData.currency.decimalPlaces}
                        onChange={(e) => updateField('currency.decimalPlaces', parseInt(e.target.value))}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value={0}>0 (e.g. ₹100)</option>
                        <option value={2}>2 (Standard e.g. ₹100.50)</option>
                        <option value={3}>3 (e.g. KD 1.250)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Thousands Separator</label>
                      <select
                        value={formData.currency.thousandSeparator}
                        onChange={(e) => updateField('currency.thousandSeparator', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value=",">Comma (,)</option>
                        <option value=".">Dot (.)</option>
                        <option value=" ">Space ( )</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Decimal Separator</label>
                      <select
                        value={formData.currency.decimalSeparator}
                        onChange={(e) => updateField('currency.decimalSeparator', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value=".">Dot (.)</option>
                        <option value=",">Comma (,)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Symbol Position</label>
                      <select
                        value={formData.currency.symbolPosition}
                        onChange={(e) => updateField('currency.symbolPosition', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="prefix">Prefix (e.g. ₹1,250.00)</option>
                        <option value="suffix">Suffix (e.g. 1,250.00 ₹)</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Dynamic Preview */}
                  <div className="pt-4 border-t border-border">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live Preview Output</span>
                    <div className="mt-2 p-4 rounded-xl bg-input border border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Sample Financial Amount (1234567.89):</span>
                      <span className="text-base font-mono font-bold text-emerald-400">
                        {formatCurrency(1234567.89, formData)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 13. RECEIPT TEMPLATE */}
            {activeTab === 'receipt' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Thermal Receipt & Invoice Template</h2>
                  <p className="text-xs text-muted-foreground">Controls paper size and optional field visibility across Phase 12 printing and PDF generators</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Paper Format</label>
                      <select
                        value={formData.receipt.paperSize}
                        onChange={(e) => {
                          updateField('receipt.paperSize', e.target.value);
                          updateField('invoice.format', e.target.value === 'A4' ? 'A4' : e.target.value === '58mm' ? 'THERMAL_58MM' : 'THERMAL_80MM');
                        }}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="80mm">Thermal 80mm (Standard POS)</option>
                        <option value="58mm">Thermal 58mm (Compact)</option>
                        <option value="A4">A4 Full Page (Enterprise)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-foreground">Optional Header & Content Fields</label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { key: 'receipt.showLogo', label: 'Store Logo' },
                          { key: 'receipt.showCustomerDetails', label: 'Customer Details' },
                          { key: 'receipt.showCashier', label: 'Cashier Name' },
                          { key: 'receipt.showTaxBreakdown', label: 'Tax Summary' },
                          { key: 'receipt.showBarcode', label: 'Sale Barcode' },
                          { key: 'receipt.showQrCode', label: 'UPI / QR Code' },
                          { key: 'receipt.showSku', label: 'Product SKU' },
                          { key: 'receipt.showHsn', label: 'HSN Codes' },
                        ].map((field) => (
                          <label key={field.key} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.key.split('.').reduce((acc: any, part) => acc?.[part], formData)}
                              onChange={(e) => updateField(field.key, e.target.checked)}
                              className="rounded bg-input border-border text-accent focus:ring-0"
                            />
                            <span className="text-foreground">{field.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">Receipt Footer Note</label>
                      <input
                        type="text"
                        value={formData.receipt.footerText}
                        onChange={(e) => {
                          updateField('receipt.footerText', e.target.value);
                          updateField('invoice.footerNotes', e.target.value);
                        }}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">Store Return Policy Text</label>
                      <input
                        type="text"
                        value={formData.receipt.returnPolicy}
                        onChange={(e) => {
                          updateField('receipt.returnPolicy', e.target.value);
                          updateField('invoice.termsAndConditions', e.target.value);
                        }}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 14. CASHIER (POS) */}
            {activeTab === 'cashier' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Cashier POS Display & Layout Preferences</h2>
                  <p className="text-xs text-muted-foreground">Controls cashier workstation layout and product catalog tile density</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Cart Billing Position</label>
                      <select
                        value={formData.cashierPos.cartPosition}
                        onChange={(e) => updateField('cashierPos.cartPosition', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="counter">Counter (Standard Right Column)</option>
                        <option value="lane">Lane (Left Column)</option>
                        <option value="beam">Beam (Bottom Bar)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Product Grid Tile Density</label>
                      <select
                        value={formData.cashierPos.tileSize}
                        onChange={(e) => updateField('cashierPos.tileSize', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="compact">Compact (High density for large inventories)</option>
                        <option value="comfortable">Comfortable (Balanced for touch and mouse)</option>
                        <option value="spacious">Spacious (Large buttons for touchscreens)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Negative Stock Policy</label>
                      <select
                        value={formData.pos.negativeStockPolicy}
                        onChange={(e) => updateField('pos.negativeStockPolicy', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="BLOCK">BLOCK (Strict: Cannot sell out-of-stock items)</option>
                        <option value="ALLOW_WITH_WARNING">ALLOW_WITH_WARNING (Permit with supervisor warning)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 15. SECURITY */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Security & Session Policy</h2>
                  <p className="text-xs text-muted-foreground">Enforce workstation lockouts and concurrent session policies</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-border">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Allow Only One Active Signed-In Session Per Account</h3>
                      <p className="text-[11px] text-muted-foreground">When enabled, signing in terminates any other active sessions for that account</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.security.singleSessionPerAccount}
                        onChange={(e) => updateField('security.singleSessionPerAccount', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Inactivity Screen Lockout Timeout (Minutes)</label>
                    <input
                      type="number"
                      min={1}
                      max={480}
                      value={formData.security.sessionTimeoutMinutes}
                      onChange={(e) => updateField('security.sessionTimeoutMinutes', parseInt(e.target.value) || 15)}
                      className="w-48 bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 16. SCRIPTS */}
            {activeTab === 'scripts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Custom Header & Footer Scripts</h2>
                  <p className="text-xs text-muted-foreground">
                    Restricted desktop policy: Scripts are sanitized and never executed on POS, payment, or auth surfaces
                  </p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Enable Custom Scripts</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.scripts.enabled}
                        onChange={(e) => updateField('scripts.enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Header Scripts (HTML / JS)</label>
                    <textarea
                      rows={3}
                      value={formData.scripts.headerScript}
                      onChange={(e) => updateField('scripts.headerScript', e.target.value)}
                      placeholder="<!-- Custom analytics or external fonts -->"
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Footer Scripts (HTML / JS)</label>
                    <textarea
                      rows={3}
                      value={formData.scripts.footerScript}
                      onChange={(e) => updateField('scripts.footerScript', e.target.value)}
                      placeholder="<!-- Custom support widget scripts -->"
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 17. WEIGHING SCALE */}
            {activeTab === 'scale' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Weighing Scale Embedded Barcode Decoder</h2>
                  <p className="text-xs text-muted-foreground">
                    Parses deli and produce scale barcodes (e.g. prefix 20) with embedded weight or total price
                  </p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Enable Scale Barcode Interpretation</h3>
                      <p className="text-[11px] text-muted-foreground">Exact product barcodes always take precedence</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.scale.enabled}
                        onChange={(e) => updateField('scale.enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Prefix (2 digits)</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.scale.prefix}
                        onChange={(e) => updateField('scale.prefix', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">PLU Digits</label>
                      <input
                        type="number"
                        value={formData.scale.pluDigits}
                        onChange={(e) => updateField('scale.pluDigits', parseInt(e.target.value) || 5)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Embedded Value</label>
                      <select
                        value={formData.scale.embeddedValue}
                        onChange={(e) => updateField('scale.embeddedValue', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="WEIGHT">WEIGHT (Quantity in kg)</option>
                        <option value="TOTAL_PRICE">TOTAL_PRICE (Total price in currency)</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Barcode Testing */}
                  <div className="pt-4 border-t border-border space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Barcode Decoder Simulator</span>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={scaleTestInput}
                        onChange={(e) => setScaleTestInput(e.target.value)}
                        placeholder="Scan or enter 13-digit scale barcode"
                        className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    {scaleTestInput && (
                      <div className="p-3 rounded-lg bg-input border border-border text-xs">
                        {(() => {
                          const decoded = decodeScaleBarcode(scaleTestInput);
                          if (!decoded.valid) {
                            return <span className="text-rose-400 font-medium">{decoded.error}</span>;
                          }
                          return (
                            <div className="flex items-center space-x-6">
                              <div>
                                <span className="text-muted-foreground block">Decoded PLU:</span>
                                <span className="font-mono font-bold text-foreground">{decoded.plu}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block">{decoded.type}:</span>
                                <span className="font-mono font-bold text-emerald-400">{decoded.value}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold ml-auto">
                                VALID SCALE FORMAT
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 18. STOCK LOCATIONS */}
            {activeTab === 'locations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Stock Storage Locations</h2>
                  <p className="text-xs text-muted-foreground">Configurable physical warehousing coordinates (Aisle, Rack, Shelf, Bin)</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {['aisle', 'rack', 'shelf', 'bin'].map((fieldKey) => {
                      const field = (formData.stockLocations.fields as any)[fieldKey];
                      return (
                        <div key={fieldKey} className="p-3 bg-input border border-border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-foreground">{fieldKey}</span>
                            <label className="flex items-center space-x-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.enabled}
                                onChange={(e) => updateField(`stockLocations.fields.${fieldKey}.enabled`, e.target.checked)}
                                className="rounded bg-surface border-border text-accent focus:ring-0"
                              />
                              <span className="text-[11px] text-muted-foreground">Enabled</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(`stockLocations.fields.${fieldKey}.label`, e.target.value)}
                            className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 19. LOYALTY POINTS */}
            {activeTab === 'loyalty' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Customer Loyalty Points</h2>
                  <p className="text-xs text-muted-foreground">Safe integer-based reward earning and POS redemption rules</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Enable Customer Loyalty Program</h3>
                      <p className="text-[11px] text-muted-foreground">Registered customers earn points upon invoice posting</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.loyalty.enabled}
                        onChange={(e) => updateField('loyalty.enabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Points Earned</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.loyalty.pointsPerAmount}
                        onChange={(e) => updateField('loyalty.pointsPerAmount', parseInt(e.target.value) || 1)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Per Spent Threshold ({formData.currency.symbol})</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.loyalty.amountThreshold}
                        onChange={(e) => updateField('loyalty.amountThreshold', parseInt(e.target.value) || 100)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Max Sale Discount %</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.loyalty.maxRedeemSalePercentage}
                        onChange={(e) => updateField('loyalty.maxRedeemSalePercentage', parseInt(e.target.value) || 50)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 20. PRICING */}
            {activeTab === 'pricing' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Pricing & Margin Settings</h2>
                  <p className="text-xs text-muted-foreground">Historical financial purchase costs are strictly preserved</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Default "Update Selling Prices" on Inward Receive</h3>
                      <p className="text-[11px] text-muted-foreground">Can still be manually overridden per purchase order</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.pricing.defaultUpdateSellingPricesOnReceive}
                        onChange={(e) => updateField('pricing.defaultUpdateSellingPricesOnReceive', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 21. NUMBERING */}
            {activeTab === 'numbering' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Document Numbering Sequences</h2>
                  <p className="text-xs text-muted-foreground">Configurable sequence templates with mandatory &#123;seq&#125; placeholders</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Sales Invoices Format</label>
                      <input
                        type="text"
                        value={formData.numbering.saleInvoiceFormat}
                        onChange={(e) => updateField('numbering.saleInvoiceFormat', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Sales Returns Format</label>
                      <input
                        type="text"
                        value={formData.numbering.refundFormat}
                        onChange={(e) => updateField('numbering.refundFormat', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 22. SMTP & EMAIL */}
            {activeTab === 'smtp' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Email & Outgoing SMTP Configuration</h2>
                    <p className="text-xs text-muted-foreground">Passwords are encrypted at rest and never exposed in plaintext</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={smtpTesting}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-semibold text-foreground hover:bg-surface-muted"
                  >
                    {smtpTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    <span>Test SMTP Connection</span>
                  </button>
                </div>

                {smtpFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium ${
                      smtpFeedback.success ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {smtpFeedback.message}
                  </div>
                )}

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Driver</label>
                      <select
                        value={formData.smtp.driver}
                        onChange={(e) => updateField('smtp.driver', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="LOG">Log to File (Offline Testing)</option>
                        <option value="SMTP">SMTP Live Delivery</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Encryption</label>
                      <select
                        value={formData.smtp.encryption}
                        onChange={(e) => updateField('smtp.encryption', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="TLS">TLS (Port 587)</option>
                        <option value="SSL">SSL (Port 465)</option>
                        <option value="NONE">None (Plaintext)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={formData.smtp.host}
                        onChange={(e) => updateField('smtp.host', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={formData.smtp.port}
                        onChange={(e) => updateField('smtp.port', parseInt(e.target.value) || 587)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Username</label>
                      <input
                        type="text"
                        value={formData.smtp.username}
                        onChange={(e) => updateField('smtp.username', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Password {formData.smtp.isPasswordConfigured && <span className="text-emerald-400 font-normal">(Configured)</span>}
                      </label>
                      <input
                        type="password"
                        placeholder={formData.smtp.isPasswordConfigured ? '••••••••' : 'Enter SMTP password'}
                        value={formData.smtp.password || ''}
                        onChange={(e) => updateField('smtp.password', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                      {formData.smtp.host?.toLowerCase().includes('gmail') && (
                        <p className="text-[10px] text-amber-400/90 mt-1 leading-relaxed">
                          💡 <strong>Gmail:</strong> Google requires a 16-character <strong>App Password</strong> (from Google Account &gt; Security &gt; 2-Step Verification &gt; App passwords), not your normal login password.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        From Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="noreply@yourstore.com"
                        value={formData.smtp.fromAddress || ''}
                        onChange={(e) => updateField('smtp.fromAddress', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Shown in the "From" header of all outgoing emails.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">From Name</label>
                      <input
                        type="text"
                        placeholder="RS Inventory"
                        value={formData.smtp.fromName || ''}
                        onChange={(e) => updateField('smtp.fromName', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Display name shown alongside the From Address.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 23. WHATSAPP */}
            {activeTab === 'whatsapp' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">WhatsApp Dispatch & Meta Cloud API</h2>
                  <p className="text-xs text-muted-foreground">Post-commit asynchronous dispatch via whatsapp_queue</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Delivery Mode</label>
                      <select
                        value={formData.whatsapp.mode}
                        onChange={(e) => updateField('whatsapp.mode', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="CLICK_TO_CHAT">Click-to-Chat (wa.me web intent)</option>
                        <option value="CLOUD_API">Official Meta Cloud API</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Phone Number ID</label>
                      <input
                        type="text"
                        value={formData.whatsapp.phoneNumberId || ''}
                        onChange={(e) => updateField('whatsapp.phoneNumberId', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Access Token {formData.whatsapp.isTokenConfigured && <span className="text-emerald-400 font-normal">(Configured)</span>}
                      </label>
                      <input
                        type="password"
                        placeholder={formData.whatsapp.isTokenConfigured ? '••••••••' : 'Enter Meta system user access token'}
                        value={formData.whatsapp.accessToken || ''}
                        onChange={(e) => updateField('whatsapp.accessToken', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 24. PAYMENT METHODS */}
            {activeTab === 'payments' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Dynamic Payment Methods</h2>
                  <p className="text-xs text-muted-foreground">
                    Disabling a payment method causes it to immediately disappear from the POS tender buttons
                  </p>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-surface-elevated/40">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface border-b border-border text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="py-3 px-4">Method Name</th>
                        <th className="py-3 px-4">Tender Type</th>
                        <th className="py-3 px-4 text-center">Reference Required</th>
                        <th className="py-3 px-4 text-center">Active in POS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground">
                      {formData.paymentMethods.map((method, idx) => (
                        <tr key={method.id} className="hover:bg-surface-elevated">
                          <td className="py-3 px-4 font-bold text-foreground">{method.name}</td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">{method.type}</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={method.requiresReference}
                              onChange={(e) => {
                                const copy = [...formData.paymentMethods];
                                copy[idx].requiresReference = e.target.checked;
                                updateField('paymentMethods', copy);
                              }}
                              className="rounded bg-input border-border text-accent focus:ring-0"
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={method.active}
                              onChange={(e) => {
                                const copy = [...formData.paymentMethods];
                                copy[idx].active = e.target.checked;
                                updateField('paymentMethods', copy);
                              }}
                              className="rounded bg-input border-border text-accent focus:ring-0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* UPI VPA Config */}
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">UPI QR Code Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Store UPI VPA</label>
                      <input
                        type="text"
                        placeholder="merchant@okhdfcbank"
                        value={formData.paymentMethods.find((m) => m.type === 'UPI')?.upiVpa || ''}
                        onChange={(e) => {
                          const copy = [...formData.paymentMethods];
                          const item = copy.find((m) => m.type === 'UPI');
                          if (item) item.upiVpa = e.target.value;
                          updateField('paymentMethods', copy);
                        }}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">UPI Payee Display Name</label>
                      <input
                        type="text"
                        placeholder="RS Retail Store"
                        value={formData.paymentMethods.find((m) => m.type === 'UPI')?.upiPayeeName || ''}
                        onChange={(e) => {
                          const copy = [...formData.paymentMethods];
                          const item = copy.find((m) => m.type === 'UPI');
                          if (item) item.upiPayeeName = e.target.value;
                          updateField('paymentMethods', copy);
                        }}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 25. PAYMENT GATEWAYS */}
            {activeTab === 'gateways' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Payment Gateway Integrations</h2>
                  <p className="text-xs text-muted-foreground">Complete integrations for Stripe, Razorpay, and Cashfree with dynamic QR & POS links</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* 1. Stripe Card */}
                  <div className="p-5 rounded-xl bg-surface-elevated/40 border border-border flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div>
                          <h3 className="text-xs font-bold text-foreground">Stripe Gateway</h3>
                          <span className="text-[10px] text-muted-foreground">Cards, Apple Pay, Google Pay</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.gateways.stripe.enabled}
                            onChange={(e) => updateField('gateways.stripe.enabled', e.target.checked)}
                            className="rounded bg-input border-border text-accent focus:ring-0"
                          />
                          <span className="text-xs text-foreground font-semibold">Enabled</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Environment Mode</label>
                        <select
                          value={formData.gateways.stripe.mode || 'TEST'}
                          onChange={(e) => updateField('gateways.stripe.mode', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                        >
                          <option value="TEST">Test (Sandbox)</option>
                          <option value="LIVE">Live (Production)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Publishable Key</label>
                        <input
                          type="text"
                          placeholder="pk_test_..."
                          value={formData.gateways.stripe.publishableKey}
                          onChange={(e) => updateField('gateways.stripe.publishableKey', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Secret Key {formData.gateways.stripe.isSecretKeyConfigured && <span className="text-emerald-400 font-normal">(Configured)</span>}
                        </label>
                        <input
                          type="password"
                          placeholder={formData.gateways.stripe.isSecretKeyConfigured ? '••••••••' : 'sk_test_...'}
                          value={formData.gateways.stripe.secretKey || ''}
                          onChange={(e) => updateField('gateways.stripe.secretKey', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Webhook Secret (Optional)</label>
                        <input
                          type="text"
                          placeholder="whsec_..."
                          value={formData.gateways.stripe.webhookSecret || ''}
                          onChange={(e) => updateField('gateways.stripe.webhookSecret', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border space-y-2">
                      <button
                        type="button"
                        onClick={() => handleTestGateway('STRIPE')}
                        disabled={gatewayTesting === 'STRIPE'}
                        className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-surface-elevated border border-border hover:bg-surface-muted text-xs font-semibold text-foreground transition-all"
                      >
                        {gatewayTesting === 'STRIPE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>Test Stripe Connection</span>
                      </button>

                      {gatewayFeedback['STRIPE'] && (
                        <div
                          className={`p-2.5 rounded-lg text-[11px] font-medium leading-relaxed ${
                            gatewayFeedback['STRIPE'].success
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {gatewayFeedback['STRIPE'].message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Razorpay Card */}
                  <div className="p-5 rounded-xl bg-surface-elevated/40 border border-border flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div>
                          <h3 className="text-xs font-bold text-foreground">Razorpay Gateway</h3>
                          <span className="text-[10px] text-muted-foreground">UPI QR, NetBanking, Cards</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.gateways.razorpay.enabled}
                            onChange={(e) => updateField('gateways.razorpay.enabled', e.target.checked)}
                            className="rounded bg-input border-border text-accent focus:ring-0"
                          />
                          <span className="text-xs text-foreground font-semibold">Enabled</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Environment Mode</label>
                        <select
                          value={formData.gateways.razorpay.mode || 'TEST'}
                          onChange={(e) => updateField('gateways.razorpay.mode', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                        >
                          <option value="TEST">Test Mode</option>
                          <option value="LIVE">Live Mode</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Key ID</label>
                        <input
                          type="text"
                          placeholder="rzp_test_..."
                          value={formData.gateways.razorpay.keyId}
                          onChange={(e) => updateField('gateways.razorpay.keyId', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Key Secret {formData.gateways.razorpay.isKeySecretConfigured && <span className="text-emerald-400 font-normal">(Configured)</span>}
                        </label>
                        <input
                          type="password"
                          placeholder={formData.gateways.razorpay.isKeySecretConfigured ? '••••••••' : 'Enter Key Secret'}
                          value={formData.gateways.razorpay.keySecret || ''}
                          onChange={(e) => updateField('gateways.razorpay.keySecret', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Webhook Secret (Optional)</label>
                        <input
                          type="text"
                          placeholder="Secret from Razorpay Webhook dashboard"
                          value={formData.gateways.razorpay.webhookSecret || ''}
                          onChange={(e) => updateField('gateways.razorpay.webhookSecret', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border space-y-2">
                      <button
                        type="button"
                        onClick={() => handleTestGateway('RAZORPAY')}
                        disabled={gatewayTesting === 'RAZORPAY'}
                        className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-surface-elevated border border-border hover:bg-surface-muted text-xs font-semibold text-foreground transition-all"
                      >
                        {gatewayTesting === 'RAZORPAY' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>Test Razorpay Connection</span>
                      </button>

                      {gatewayFeedback['RAZORPAY'] && (
                        <div
                          className={`p-2.5 rounded-lg text-[11px] font-medium leading-relaxed ${
                            gatewayFeedback['RAZORPAY'].success
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {gatewayFeedback['RAZORPAY'].message}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Cashfree Card */}
                  <div className="p-5 rounded-xl bg-surface-elevated/40 border border-border flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div>
                          <h3 className="text-xs font-bold text-foreground">Cashfree Payments</h3>
                          <span className="text-[10px] text-muted-foreground">Dynamic UPI, QR, Instant Settlement</span>
                        </div>
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.gateways.cashfree?.enabled || false}
                            onChange={(e) => updateField('gateways.cashfree.enabled', e.target.checked)}
                            className="rounded bg-input border-border text-accent focus:ring-0"
                          />
                          <span className="text-xs text-foreground font-semibold">Enabled</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Environment Mode</label>
                        <select
                          value={formData.gateways.cashfree?.mode || 'TEST'}
                          onChange={(e) => updateField('gateways.cashfree.mode', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                        >
                          <option value="TEST">Sandbox (Test)</option>
                          <option value="LIVE">Production (Live)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">App ID / Client ID</label>
                        <input
                          type="text"
                          placeholder="TEST... or PROD..."
                          value={formData.gateways.cashfree?.appId || ''}
                          onChange={(e) => updateField('gateways.cashfree.appId', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Secret Key {formData.gateways.cashfree?.isSecretKeyConfigured && <span className="text-emerald-400 font-normal">(Configured)</span>}
                        </label>
                        <input
                          type="password"
                          placeholder={formData.gateways.cashfree?.isSecretKeyConfigured ? '••••••••' : 'Enter Cashfree Secret Key'}
                          value={formData.gateways.cashfree?.secretKey || ''}
                          onChange={(e) => updateField('gateways.cashfree.secretKey', e.target.value)}
                          className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div className="p-2.5 rounded-lg bg-input border border-border text-[10px] text-muted-foreground space-y-1">
                        <p className="font-semibold text-foreground">💡 Cashfree POS Features:</p>
                        <p>Generates dynamic UPI QR codes and short checkout links directly on the POS screen.</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border space-y-2">
                      <button
                        type="button"
                        onClick={() => handleTestGateway('CASHFREE')}
                        disabled={gatewayTesting === 'CASHFREE'}
                        className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-surface-elevated border border-border hover:bg-surface-muted text-xs font-semibold text-foreground transition-all"
                      >
                        {gatewayTesting === 'CASHFREE' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>Test Cashfree Connection</span>
                      </button>

                      {gatewayFeedback['CASHFREE'] && (
                        <div
                          className={`p-2.5 rounded-lg text-[11px] font-medium leading-relaxed ${
                            gatewayFeedback['CASHFREE'].success
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {gatewayFeedback['CASHFREE'].message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 26. BACKUP & RECOVERY */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Backup & Disaster Recovery</h2>
                  <p className="text-xs text-muted-foreground">Integrated with the Phase 13 SQLite-safe VACUUM INTO backup engine</p>
                </div>

                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Backup Storage Directory</label>
                      <input
                        type="text"
                        value={formData.backup.backupDirectory}
                        onChange={(e) => updateField('backup.backupDirectory', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Backup Retention Count</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.backup.retentionCount}
                        onChange={(e) => updateField('backup.retentionCount', parseInt(e.target.value) || 7)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="col-span-2 pt-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.backup.autoBackupDaily}
                          onChange={(e) => updateField('backup.autoBackupDaily', e.target.checked)}
                          className="rounded bg-input border-border text-accent focus:ring-0"
                        />
                        <span className="text-xs font-semibold text-foreground">Automatic Daily Background Snapshots</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 27. SCHEDULER */}
            {activeTab === 'scheduler' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Application Task Scheduler</h2>
                  <p className="text-xs text-muted-foreground">Desktop interval jobs for automatic snapshots and inventory monitoring</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="space-y-3">
                    {[
                      { key: 'scheduler.autoBackupEnabled', label: 'Automated Snapshot Backups', desc: 'Checks every hour and runs if due' },
                      { key: 'scheduler.lowStockAlertsEnabled', label: 'Low-Stock Notifications', desc: 'Alerts cashier when items fall below reorder thresholds' },
                      { key: 'scheduler.updateChecksEnabled', label: 'Update Availability Checks', desc: 'Periodically queries official release manifest' },
                    ].map((job) => (
                      <div key={job.key} className="flex items-center justify-between p-3 rounded-lg bg-input border border-border">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{job.label}</h4>
                          <p className="text-[11px] text-muted-foreground">{job.desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={job.key.split('.').reduce((acc: any, part) => acc?.[part], formData)}
                          onChange={(e) => updateField(job.key, e.target.checked)}
                          className="rounded bg-surface border-border text-accent focus:ring-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 28. UPDATES */}
            {activeTab === 'updates' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Software Updates & Channel</h2>
                  <p className="text-xs text-muted-foreground">Electron desktop update preferences and release channels</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">Installed Version</span>
                      <span className="text-sm font-mono font-bold text-foreground">v{formData.updates.currentVersion}</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">Release Channel</label>
                      <select
                        value={formData.updates.releaseChannel}
                        onChange={(e) => updateField('updates.releaseChannel', e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                      >
                        <option value="STABLE">Stable (Recommended for retail POS)</option>
                        <option value="BETA">Beta (Early feature access)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 29. LICENSE */}
            {activeTab === 'license' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">License & Device Activation</h2>
                  <p className="text-xs text-muted-foreground">Local cached activation state with 30-day offline grace protection</p>
                </div>
                <div className="bg-surface-elevated/40 border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-border">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">RS Inventory – Solo License</h3>
                      <p className="text-[11px] text-muted-foreground">Licensed for Single Workstation Windows POS</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                      {formData.license.status}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Purchase Code</label>
                    <input
                      type="text"
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      value={formData.license.purchaseCode || ''}
                      onChange={(e) => updateField('license.purchaseCode', e.target.value)}
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 30. LEGAL (PRIVACY & TERMS) */}
            {activeTab === 'legal' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Legal Documents & Privacy Terms</h2>
                  <p className="text-xs text-muted-foreground">Sanitized HTML documents suitable for customer compliance and receipt footers</p>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-xl bg-surface-elevated/40 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Privacy Policy</span>
                      <button
                        type="button"
                        onClick={() => setLegalPreviewDoc({ title: 'Privacy Policy', html: formData.legal.privacyPolicyHtml })}
                        className="text-xs text-accent hover:underline flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Document</span>
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={formData.legal.privacyPolicyHtml}
                      onChange={(e) => updateField('legal.privacyPolicyHtml', e.target.value)}
                      className="w-full bg-input border border-border rounded-lg p-3 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="p-5 rounded-xl bg-surface-elevated/40 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">Terms of Service</span>
                      <button
                        type="button"
                        onClick={() => setLegalPreviewDoc({ title: 'Terms of Service', html: formData.legal.termsOfServiceHtml })}
                        className="text-xs text-accent hover:underline flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Document</span>
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={formData.legal.termsOfServiceHtml}
                      onChange={(e) => updateField('legal.termsOfServiceHtml', e.target.value)}
                      className="w-full bg-input border border-border rounded-lg p-3 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Create New User Account</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {userModalError && (
              <div className="p-2.5 rounded bg-rose-950/80 text-rose-300 text-xs font-medium border border-rose-800">
                {userModalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">User Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as Role })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent"
                >
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>


              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-bold hover:bg-accent-hover shadow-sm"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legal Preview Modal */}
      {legalPreviewDoc && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">{legalPreviewDoc.title}</h3>
              <button onClick={() => setLegalPreviewDoc(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto text-xs text-foreground space-y-3 prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: legalPreviewDoc.html }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
