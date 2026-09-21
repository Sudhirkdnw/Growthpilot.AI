import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { AppSettingsDTO, PrinterSettings } from '../../../../shared/types';

interface PrinterInfo {
  name: string;
  displayName: string;
  isDefault: boolean;
}

interface PrinterSettingsModalProps {
  onClose: () => void;
}

export function PrinterSettingsModal({ onClose }: PrinterSettingsModalProps) {
  const { settings, session, updateSettings } = useAuthStore();
  const isAdmin = session?.user?.role === 'ADMIN';
  const electronAPI = (window as any).electronAPI;

  const [activeTab, setActiveTab] = useState<'printer' | 'invoice' | 'company'>('printer');
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Local Form State initialized from settings store
  const [companyData, setCompanyData] = useState({
    shopName: settings?.company?.shopName || '',
    address: settings?.company?.address || '',
    phone: settings?.company?.phone || '',
    email: settings?.company?.email || '',
    gstin: settings?.company?.gstin || '',
    currency: settings?.company?.currency || 'INR',
    currencySymbol: settings?.company?.currencySymbol || '₹',
  });

  const [invoiceData, setInvoiceData] = useState({
    prefix: settings?.invoice?.prefix || 'INV-',
    format: settings?.invoice?.format || 'THERMAL_80MM',
    footerNotes: settings?.invoice?.footerNotes || 'Thank you for shopping with us!',
    termsAndConditions:
      settings?.invoice?.termsAndConditions ||
      'Goods once sold cannot be returned without original receipt.',
  });

  const [printerData, setPrinterData] = useState<PrinterSettings>({
    printerName: settings?.printer?.printerName || '',
    paperFormat: settings?.printer?.paperFormat || 'THERMAL_80MM',
    copies: settings?.printer?.copies || 1,
    silent: settings?.printer?.silent || false,
    showPreview: settings?.printer?.showPreview ?? true,
  });

  // Load system printers
  useEffect(() => {
    async function loadPrinters() {
      if (electronAPI?.invoke) {
        try {
          const list: PrinterInfo[] = await electronAPI.invoke('printer:getPrinters');
          if (Array.isArray(list)) {
            setPrinters(list);
          }
        } catch (err) {
          console.warn('[Printer Settings] Failed to load printers:', err);
        }
      }
    }
    loadPrinters();
  }, [electronAPI]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Only administrators can update store settings.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: Partial<AppSettingsDTO> = {
        company: {
          ...settings?.company,
          ...companyData,
        } as any,
        invoice: {
          ...settings?.invoice,
          ...invoiceData,
          startingSequence: settings?.invoice?.startingSequence || 1,
        } as any,
        printer: {
          ...printerData,
        },
      };

      const res = await electronAPI.invoke('settings:update', {
        settings: payload,
        token: session?.token,
      });

      if (res?.success && res.settings) {
        updateSettings(res.settings);
        setFeedback({ type: 'success', message: 'Printer & Invoice settings saved successfully.' });
      } else {
        setFeedback({
          type: 'error',
          message: res?.error || 'Failed to persist settings.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error updating configuration.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface-elevated flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-primary/30 flex items-center justify-center text-primary">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Printer & Invoice Settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure default receipt formats, Windows printers, and company details
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin Warning if Cashier */}
        {!isAdmin && (
          <div className="bg-amber-950/70 border-b border-amber-800/80 px-6 py-2.5 flex items-center space-x-2 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              You are logged in as <strong>{session?.user?.role}</strong>. Configuration settings are
              read-only. Admin credentials are required to modify settings.
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-surface-muted px-6 pt-3 space-x-2">
          <button
            onClick={() => setActiveTab('printer')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-t-2 ${
              activeTab === 'printer'
                ? 'bg-surface border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Hardware & Printing</span>
          </button>

          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-t-2 ${
              activeTab === 'invoice'
                ? 'bg-surface border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Invoice Layout & Terms</span>
          </button>

          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-t-2 ${
              activeTab === 'company'
                ? 'bg-surface border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Company Branding</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 p-6 overflow-y-auto space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
                  : 'bg-red-950/80 border border-red-800 text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* TAB 1: PRINTER SETTINGS */}
          {activeTab === 'printer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Default Hardware Printer
                </label>
                <select
                  disabled={!isAdmin}
                  value={printerData.printerName}
                  onChange={(e) =>
                    setPrinterData({ ...printerData, printerName: e.target.value })
                  }
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                >
                  <option value="">(Default Windows Printer)</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name} {p.isDefault ? '★ (System Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Select your thermal receipt printer or leave as default to use the OS default
                  printer.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Default Paper Format
                  </label>
                  <select
                    disabled={!isAdmin}
                    value={printerData.paperFormat}
                    onChange={(e) =>
                      setPrinterData({
                        ...printerData,
                        paperFormat: e.target.value as any,
                      })
                    }
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  >
                    <option value="THERMAL_80MM">Thermal 80mm (Standard POS)</option>
                    <option value="THERMAL_58MM">Thermal 58mm (Narrow Receipt)</option>
                    <option value="A4">A4 Full Page (Enterprise Invoice)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Default Copies
                  </label>
                  <input
                    disabled={!isAdmin}
                    type="number"
                    min="1"
                    max="9"
                    value={printerData.copies}
                    onChange={(e) =>
                      setPrinterData({
                        ...printerData,
                        copies: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    disabled={!isAdmin}
                    type="checkbox"
                    checked={printerData.showPreview}
                    onChange={(e) =>
                      setPrinterData({ ...printerData, showPreview: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-surface-elevated border-border text-primary focus:ring-0 focus:ring-offset-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      Show Print Preview Dialog upon Checkout
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      If enabled, a high-fidelity preview modal appears after creating a sale.
                      Otherwise, silent print is triggered immediately.
                    </p>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    disabled={!isAdmin}
                    type="checkbox"
                    checked={printerData.silent}
                    onChange={(e) =>
                      setPrinterData({ ...printerData, silent: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-surface-elevated border-border text-primary focus:ring-0 focus:ring-offset-0"
                  />
                  <div>
                    <span className="text-xs font-medium text-foreground">
                      Silent Printing (Bypass Windows Print Dialog)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Directly dispatches print jobs to the selected printer without displaying the
                      OS print prompt.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICE SETTINGS */}
          {activeTab === 'invoice' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Invoice Number Prefix
                </label>
                <input
                  disabled={!isAdmin}
                  type="text"
                  value={invoiceData.prefix}
                  onChange={(e) => setInvoiceData({ ...invoiceData, prefix: e.target.value })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  placeholder="e.g. INV-"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Receipt Footer Note
                </label>
                <textarea
                  disabled={!isAdmin}
                  rows={2}
                  value={invoiceData.footerNotes}
                  onChange={(e) => setInvoiceData({ ...invoiceData, footerNotes: e.target.value })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  placeholder="e.g. Thank you for shopping with us!"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Terms & Conditions (Printed on A4 Invoices)
                </label>
                <textarea
                  disabled={!isAdmin}
                  rows={3}
                  value={invoiceData.termsAndConditions}
                  onChange={(e) =>
                    setInvoiceData({ ...invoiceData, termsAndConditions: e.target.value })
                  }
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  placeholder="e.g. Goods once sold cannot be returned without original receipt."
                />
              </div>
            </div>
          )}

          {/* TAB 3: COMPANY BRANDING */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Store / Shop Name *
                </label>
                <input
                  disabled={!isAdmin}
                  type="text"
                  required
                  value={companyData.shopName}
                  onChange={(e) => setCompanyData({ ...companyData, shopName: e.target.value })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Store Address
                </label>
                <textarea
                  disabled={!isAdmin}
                  rows={2}
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Phone Number
                  </label>
                  <input
                    disabled={!isAdmin}
                    type="text"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    GSTIN / Tax ID
                  </label>
                  <input
                    disabled={!isAdmin}
                    type="text"
                    value={companyData.gstin}
                    onChange={(e) => setCompanyData({ ...companyData, gstin: e.target.value })}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Email Address
                  </label>
                  <input
                    disabled={!isAdmin}
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Currency Symbol
                  </label>
                  <input
                    disabled={!isAdmin}
                    type="text"
                    value={companyData.currencySymbol}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, currencySymbol: e.target.value })
                    }
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            {isAdmin && (
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Save className="w-4 h-4 text-white" />
                )}
                <span>Save Settings</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
