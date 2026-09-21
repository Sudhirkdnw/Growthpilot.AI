import React, { useState } from 'react';
import {
  Store,
  Building2,
  DollarSign,
  Receipt,
  Printer,
  ShieldAlert,
  FolderArchive,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function FirstRunWizard() {
  const completeFirstRun = useAuthStore((s) => s.completeFirstRun);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Store Profile
    shopName: 'RS Super Store',
    address: 'Shop No. 12, Commercial Complex, Main Market',
    phone: '9876543210',
    email: 'info@rsstore.local',
    gstin: '27AABCR1234F1Z5',
    // Currency & Tax
    currency: 'INR',
    currencySymbol: '₹',
    defaultTaxRate: 18,
    // Invoice
    prefix: 'INV-',
    startingSequence: 1,
    format: 'THERMAL_80MM' as 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM',
    footerNotes: 'Thank you for shopping with us! Visit again.',
    termsAndConditions: 'Items can be returned within 7 days with invoice receipt.',
    // Printer
    printerName: 'Default Windows Thermal Receipt Printer',
    // Admin Credentials
    username: 'admin',
    fullName: 'Store Administrator',
    password: '',
    confirmPassword: '',
    // Backup
    backupDirectory: './backups',
    autoBackupDaily: true,
    retentionCount: 7,
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleNext = () => {
    // Step validation
    if (step === 2) {
      if (!formData.shopName.trim()) return setError('Shop name is required');
      if (!formData.phone.trim()) return setError('Contact phone number is required');
    }
    if (step === 6) {
      if (!formData.username.trim()) return setError('Username is required');
      if (formData.password.length < 6) return setError('Password must be at least 6 characters');
      if (formData.password !== formData.confirmPassword) return setError('Passwords do not match');
    }
    setError(null);
    setStep((s) => Math.min(s + 1, 8));
  };

  const handleBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const wizardPayload = {
      company: {
        shopName: formData.shopName,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        gstin: formData.gstin,
        currency: formData.currency,
        currencySymbol: formData.currencySymbol,
      },
      invoice: {
        prefix: formData.prefix,
        startingSequence: Number(formData.startingSequence) || 1,
        format: formData.format,
        footerNotes: formData.footerNotes,
        termsAndConditions: formData.termsAndConditions,
      },
      admin: {
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
      },
      pos: {
        negativeStockPolicy: 'BLOCK',
        defaultPaymentMethod: 'CASH',
      },
      backup: {
        backupDirectory: formData.backupDirectory,
        autoBackupDaily: formData.autoBackupDaily,
        retentionCount: Number(formData.retentionCount) || 7,
      },
    };

    const res = await completeFirstRun(wizardPayload);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || 'Initialization failed. Please try again.');
    }
  };

  const stepsList = [
    { num: 1, label: 'Welcome', icon: Store },
    { num: 2, label: 'Store Details', icon: Building2 },
    { num: 3, label: 'Currency & Tax', icon: DollarSign },
    { num: 4, label: 'Invoice Style', icon: Receipt },
    { num: 5, label: 'Hardware Printer', icon: Printer },
    { num: 6, label: 'Admin Security', icon: ShieldAlert },
    { num: 7, label: 'Local Backup', icon: FolderArchive },
    { num: 8, label: 'Initialize', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen w-screen bg-input text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[620px]">
        {/* Header with Step Progress */}
        <div className="bg-surface-elevated border-b border-border px-8 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-bold text-white shadow-md shadow-primary/20">
                RS
              </div>
              <div>
                <h1 className="font-bold text-base text-foreground">RS Inventory – Solo Setup Wizard</h1>
                <p className="text-xs text-muted-foreground">Step {step} of 8: {stepsList[step - 1].label}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary bg-primary-muted border border-primary/30 px-2.5 py-1 rounded-md">
              Single-Shop Edition
            </span>
          </div>

          {/* Progress Indicators */}
          <div className="grid grid-cols-8 gap-2">
            {stepsList.map((s) => {
              const Icon = s.icon;
              const isDone = s.num < step;
              const isCurrent = s.num === step;
              return (
                <div
                  key={s.num}
                  className={`flex flex-col items-center p-1.5 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'border-primary bg-orange-500/10 text-primary font-semibold'
                      : isDone
                      ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-400'
                      : 'border-border bg-surface-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mb-1" />
                  <span className="text-[10px] hidden md:block truncate w-full">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-sm flex items-center space-x-2">
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Welcome */}
          {step === 1 && (
            <div className="space-y-6 max-w-2xl mx-auto text-center py-6">
              <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/20">
                <Store className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-50">Welcome to RS Inventory – Solo</h2>
              <p className="text-sm text-foreground leading-relaxed">
                Thank you for choosing RS Inventory – Solo by <strong>RS ORANGE TECH PVT LTD</strong>.
                This application is engineered specifically for single retail shops with a robust,{' '}
                <strong>100% offline-first architecture</strong>. All your inventory, POS billing, customer ledgers,
                and financial transactions are safely stored on this computer's local SQLite database.
              </p>
              <div className="p-4 rounded-xl bg-input border border-border text-left space-y-2 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">What happens during this setup:</div>
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>We configure your shop details, currency, and tax percentage.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>We initialize your first Administrator security credentials.</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>We seed system defaults (Cash Customer, Standard Units, Invoice Sequences).</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Store Details */}
          {step === 2 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-2">Store / Company Details</h2>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Shop / Business Name *</label>
                <input
                  type="text"
                  value={formData.shopName}
                  onChange={(e) => handleChange('shopName', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder="e.g. RS Mart"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Store Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={2}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder="Street, Area, City, Pincode"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => handleChange('gstin', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="e.g. 27AAAAA0000A1Z5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Store Email (Optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder="store@example.com"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Currency & Tax */}
          {step === 3 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-2">Currency & Tax Configuration</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Currency Code</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="INR, USD, EUR"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={formData.currencySymbol}
                    onChange={(e) => handleChange('currencySymbol', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="₹, $, €"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Default Tax / GST Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.defaultTaxRate}
                  onChange={(e) => handleChange('defaultTaxRate', Number(e.target.value))}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Individual products can override this tax rate.</p>
              </div>
            </div>
          )}

          {/* STEP 4: Invoice Preferences */}
          {step === 4 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-2">Invoice & Receipt Preferences</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.prefix}
                    onChange={(e) => handleChange('prefix', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="INV-"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Starting Sequence Number</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.startingSequence}
                    onChange={(e) => handleChange('startingSequence', Number(e.target.value))}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Receipt Paper Format</label>
                <select
                  value={formData.format}
                  onChange={(e) => handleChange('format', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="THERMAL_80MM">Thermal 80mm Receipt (Most Popular)</option>
                  <option value="THERMAL_58MM">Thermal 58mm Receipt</option>
                  <option value="A4">Standard A4 Full Page Invoice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Footer Message</label>
                <input
                  type="text"
                  value={formData.footerNotes}
                  onChange={(e) => handleChange('footerNotes', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Hardware Printer */}
          {step === 5 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-2">Printer Detection</h2>
              <div className="p-4 rounded-xl bg-input border border-border space-y-3">
                <div className="flex items-center space-x-3 text-sm font-semibold text-foreground">
                  <Printer className="w-5 h-5 text-primary" />
                  <span>Configured Printer:</span>
                </div>
                <input
                  type="text"
                  value={formData.printerName}
                  onChange={(e) => handleChange('printerName', e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground">
                  You can change or calibrate your specific USB or ESC/POS thermal printer anytime in Settings.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: Admin Account */}
          {step === 6 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-2">Create First Administrator</h2>
              <p className="text-xs text-muted-foreground">
                This administrator account will hold root permissions to configure taxes, manage inventory, restore backups, and unlock sensitive settings.
              </p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder="e.g. Ramesh Sharma"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Admin Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder="e.g. admin"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Password (min 6 chars) *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Local Backup Directory */}
          {step === 7 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <h2 className="text-lg font-bold text-foreground mb-2">Local Backup & Data Safety</h2>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Backup Directory</label>
                <input
                  type="text"
                  value={formData.backupDirectory}
                  onChange={(e) => handleChange('backupDirectory', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center space-x-3 p-3 bg-input border border-border rounded-lg">
                <input
                  type="checkbox"
                  id="autoBackup"
                  checked={formData.autoBackupDaily}
                  onChange={(e) => handleChange('autoBackupDaily', e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-border focus:ring-0"
                />
                <label htmlFor="autoBackup" className="text-sm text-foreground">
                  Enable automatic daily SQLite snapshot backups on application shutdown
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Retained Backups Count</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.retentionCount}
                  onChange={(e) => handleChange('retentionCount', Number(e.target.value))}
                  className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* STEP 8: Confirmation & Launch */}
          {step === 8 && (
            <div className="space-y-6 max-w-xl mx-auto py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full mx-auto flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Ready to Initialize Your Shop</h2>
                <p className="text-xs text-muted-foreground">Review your key parameters below and click Finish Setup.</p>
              </div>

              <div className="p-4 bg-input rounded-xl border border-border space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Business Name:</span>
                  <span className="font-semibold text-foreground">{formData.shopName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Phone & GSTIN:</span>
                  <span className="font-semibold text-foreground">{formData.phone} | {formData.gstin || 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Currency & Tax:</span>
                  <span className="font-semibold text-foreground">{formData.currencySymbol} ({formData.currency}) | {formData.defaultTaxRate}% Default Tax</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Invoice Format:</span>
                  <span className="font-semibold text-foreground">{formData.prefix}{formData.startingSequence} ({formData.format})</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Root Admin:</span>
                  <span className="font-semibold text-primary">{formData.username} ({formData.fullName})</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-surface border-t border-border px-8 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1 || submitting}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {step < 8 ? (
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-primary/20 transition-all"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-7 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initializing Shop Database...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Setup & Open POS</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
