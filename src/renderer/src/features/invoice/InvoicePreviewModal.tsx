import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  FileDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Receipt,
  FileText,
  Loader2,
} from 'lucide-react';
import { InvoiceDocumentDTO, PrintResultDTO, SavePdfResultDTO } from '../../../../shared/types';
import { renderInvoiceHtml } from './invoice-templates';
import { useAuthStore } from '../../stores/authStore';

interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  status: number;
}

interface InvoicePreviewModalProps {
  document: InvoiceDocumentDTO;
  onClose: () => void;
  initialFormat?: 'A4' | 'THERMAL_58MM' | 'THERMAL_80MM';
  onOpenSettings?: () => void;
}

export function InvoicePreviewModal({
  document,
  onClose,
  initialFormat,
  onOpenSettings,
}: InvoicePreviewModalProps) {
  const { settings, session } = useAuthStore();

  const defaultFmt =
    initialFormat ||
    settings?.printer?.paperFormat ||
    settings?.invoice?.format ||
    'THERMAL_80MM';

  const [paperFormat, setPaperFormat] = useState<'A4' | 'THERMAL_58MM' | 'THERMAL_80MM'>(
    defaultFmt
  );
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(
    settings?.printer?.printerName || ''
  );
  const [copies, setCopies] = useState<number>(settings?.printer?.copies || 1);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isSavingPdf, setIsSavingPdf] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const electronAPI = (window as any).electronAPI;

  // Fetch installed printers
  useEffect(() => {
    async function loadPrinters() {
      if (electronAPI?.invoke) {
        try {
          const list: PrinterInfo[] = await electronAPI.invoke('printer:getPrinters');
          if (Array.isArray(list)) {
            setPrinters(list);
            if (!selectedPrinter) {
              const def = list.find((p) => p.isDefault);
              if (def) setSelectedPrinter(def.name);
            }
          }
        } catch (err) {
          console.warn('[Printer] Could not enumerate printers:', err);
        }
      }
    }
    loadPrinters();
  }, [electronAPI]);

  // Generate HTML for active format
  const currentHtml = renderInvoiceHtml(document, paperFormat);

  // Update iframe preview content
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(currentHtml);
        doc.close();
      }
    }
  }, [currentHtml]);

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

  // 1. Native Print Handler
  const handlePrint = async () => {
    setIsPrinting(true);
    setFeedback(null);

    try {
      if (electronAPI?.invoke) {
        const res: PrintResultDTO = await electronAPI.invoke('printer:print', {
          htmlContent: currentHtml,
          printerName: selectedPrinter || undefined,
          silent: settings?.printer?.silent ?? false,
          copies,
          paperFormat,
          documentNumber: document.documentNumber,
          userId: session?.user?.id,
        });

        if (res.success) {
          setFeedback({
            type: 'success',
            message: `Print job sent successfully to ${selectedPrinter || 'default printer'}.`,
          });
        } else if (res.code === 'PRINT_CANCELLED') {
          setFeedback({ type: 'info', message: 'Print job cancelled.' });
        } else {
          setFeedback({
            type: 'error',
            message: `Print failed (${res.code || 'ERROR'}): ${res.error || 'Unknown error'}`,
          });
        }
      } else {
        // Fallback for browser testing
        iframeRef.current?.contentWindow?.print();
        setFeedback({ type: 'success', message: 'Triggered browser print.' });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Print failure: ${err?.message || 'Failed to communicate with printer.'}`,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // 2. Save PDF Handler
  const handleSavePdf = async () => {
    setIsSavingPdf(true);
    setFeedback(null);

    try {
      if (electronAPI?.invoke) {
        const defaultName = `${document.documentNumber}_${document.documentType}.pdf`;
        const res: SavePdfResultDTO = await electronAPI.invoke('printer:savePdf', {
          htmlContent: currentHtml,
          paperFormat,
          defaultFileName: defaultName,
          documentNumber: document.documentNumber,
          userId: session?.user?.id,
        });

        if (res.success && res.filePath) {
          setFeedback({
            type: 'success',
            message: `Invoice PDF saved to: ${res.filePath}`,
          });
        } else if (res.cancelled) {
          setFeedback({ type: 'info', message: 'PDF export cancelled.' });
        } else {
          setFeedback({
            type: 'error',
            message: `Failed to save PDF: ${res.error || 'File write error'}`,
          });
        }
      } else {
        setFeedback({
          type: 'info',
          message: 'PDF saving requires Electron native environment.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `PDF generation error: ${err?.message || 'Error creating PDF.'}`,
      });
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-surface-elevated flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-primary/30 flex items-center justify-center text-primary">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-foreground text-base">Print Preview & Output</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-primary-muted border border-orange-700/50 text-primary font-mono font-semibold">
                  {document.documentNumber}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold ${
                    document.status === 'CANCELLED'
                      ? 'bg-red-950/80 border border-red-700/50 text-red-300'
                      : 'bg-emerald-950/80 border border-emerald-700/50 text-emerald-300'
                  }`}
                >
                  {document.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {document.title} • {document.party.name} • {document.currencySymbol}
                {document.grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Printer & Invoice Settings"
                className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="px-6 py-3 border-b border-border bg-surface-muted flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          {/* Format Selector Pills */}
          <div className="flex items-center space-x-1 bg-surface-elevated p-1 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setPaperFormat('A4')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                paperFormat === 'A4'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Full Page</span>
            </button>

            <button
              onClick={() => setPaperFormat('THERMAL_80MM')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                paperFormat === 'THERMAL_80MM'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Thermal 80mm</span>
            </button>

            <button
              onClick={() => setPaperFormat('THERMAL_58MM')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                paperFormat === 'THERMAL_58MM'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Thermal 58mm</span>
            </button>
          </div>

          {/* Printer Destination & Copies */}
          <div className="flex items-center space-x-3">
            {printers.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Printer:</span>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="bg-surface-elevated border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary max-w-[180px] truncate"
                >
                  <option value="">(Default Windows Printer)</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name} {p.isDefault ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-1.5">
              <span className="text-xs text-muted-foreground">Copies:</span>
              <input
                type="number"
                min="1"
                max="9"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 bg-surface-elevated border border-border text-foreground text-xs rounded-lg px-2 py-1.5 text-center focus:outline-none focus:border-primary"
              />
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleSavePdf}
              disabled={isSavingPdf || isPrinting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground border border-border text-xs font-semibold transition-all disabled:opacity-50"
            >
              {isSavingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-primary" />
              )}
              <span>Save as PDF</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting || isSavingPdf}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 transition-all disabled:opacity-50"
            >
              {isPrinting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-white" />
              )}
              <span>Print Invoice</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : feedback.type === 'error'
                ? 'bg-red-950/80 border-red-800 text-red-200'
                : 'bg-blue-950/80 border-blue-800 text-blue-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            {feedback.type === 'error' && (
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={handlePrint}
                  className="px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white font-semibold text-[11px] flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Print</span>
                </button>
                <button
                  onClick={handleSavePdf}
                  className="px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-muted text-white font-semibold text-[11px]"
                >
                  Save as PDF
                </button>
              </div>
            )}
          </div>
        )}

        {/* Document Preview Viewport */}
        <div className="flex-1 bg-input p-6 overflow-auto flex justify-center items-start">
          <div
            className={`bg-white shadow-2xl transition-all rounded-sm overflow-hidden border border-slate-700/60 ${
              paperFormat === 'A4'
                ? 'w-[210mm] min-h-[297mm]'
                : paperFormat === 'THERMAL_80MM'
                ? 'w-[80mm] min-h-[140mm]'
                : 'w-[58mm] min-h-[120mm]'
            }`}
          >
            <iframe
              ref={iframeRef}
              title="Invoice Preview Frame"
              className="w-full h-full min-h-[85vh] border-0"
            />
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3 border-t border-border bg-surface-elevated/70 flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
          <span>Press [Esc] to return to workstation</span>
          <span>RS Inventory – Solo Authoritative Document Engine</span>
        </div>
      </div>
    </div>
  );
}
