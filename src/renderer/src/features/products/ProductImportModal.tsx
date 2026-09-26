import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  HelpCircle,
  Package,
} from 'lucide-react';
import { UnitDTO, ProductImportRow, ProductImportOptions, ProductImportResult } from '../../../../shared/types';
import { useAuthStore } from '../../stores/authStore';
import {
  parseCsv,
  normalizeProductRows,
  downloadSampleCsvTemplate,
} from '../../utils/csvHelper';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: UnitDTO[];
  onImportComplete: () => void;
}

export const ProductImportModal: React.FC<ProductImportModalProps> = ({
  isOpen,
  onClose,
  units,
  onImportComplete,
}) => {
  const session = useAuthStore((s) => s.session);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow State: 'upload' | 'preview' | 'result'
  const [stage, setStage] = useState<'upload' | 'preview' | 'result'>('upload');

  // Parsed Data State
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ProductImportRow[]>([]);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Import Options
  const [updateExistingSku, setUpdateExistingSku] = useState(true);
  const [autoCreateCategories, setAutoCreateCategories] = useState(true);
  const [autoCreateBrands, setAutoCreateBrands] = useState(true);
  const [defaultUnitId, setDefaultUnitId] = useState<string>(() => {
    const pcUnit = units.find(
      (u) =>
        u.shortCode.toLowerCase() === 'pcs' ||
        u.shortCode.toLowerCase() === 'pc' ||
        u.name.toLowerCase().includes('piece')
    );
    return pcUnit?.id || (units.length > 0 ? units[0].id : '');
  });

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStage('upload');
    setFileName('');
    setParsedRows([]);
    setUnmappedHeaders([]);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setParseError(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a valid CSV file (.csv)');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim() === '') {
          setParseError('The selected CSV file is empty.');
          return;
        }

        const rawRows = parseCsv(text);
        if (rawRows.length < 2) {
          setParseError('CSV must have a header row and at least one data row.');
          return;
        }

        const { products, unmappedColumns } = normalizeProductRows(rawRows);

        if (products.length === 0) {
          setParseError('No valid product rows could be recognized in this file.');
          return;
        }

        setParsedRows(products);
        setUnmappedHeaders(unmappedColumns);
        setStage('preview');
      } catch (err: any) {
        setParseError(`Failed to parse CSV file: ${err?.message || 'Invalid format'}`);
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read the uploaded file.');
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    if (!session?.token) {
      setParseError('User session expired. Please log in again.');
      return;
    }

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      setParseError('Electron API is not available.');
      return;
    }

    setIsSubmitting(true);
    setParseError(null);

    try {
      const options: ProductImportOptions = {
        updateExistingSku,
        autoCreateCategories,
        autoCreateBrands,
        defaultUnitId: defaultUnitId || undefined,
      };

      const res = await electronAPI.invoke('products:importCsv', {
        products: parsedRows,
        options,
        token: session.token,
      });

      if (res.error) {
        throw new Error(res.error);
      }

      setImportResult(res);
      setStage('result');
      onImportComplete();
    } catch (err: any) {
      setParseError(err?.message || 'An error occurred while importing products.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation helpers
  const validCount = parsedRows.filter((r) => r.name && r.salePrice !== undefined && r.salePrice >= 0).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-elevated/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Import Products from CSV</h2>
              <p className="text-xs text-muted-foreground">
                Bulk upload catalog items, prices, barcodes, and stock levels
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-surface-elevated transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STAGE 1: UPLOAD & TEMPLATE */}
          {stage === 'upload' && (
            <div className="space-y-6">
              {/* Template Download Card */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Need the standard CSV format?</span>
                    <span className="text-[11px] text-muted-foreground">
                      Download our ready-made template pre-filled with sample product data
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCsvTemplate}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary-hover transition shrink-0 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/60 bg-surface-elevated/40 hover:bg-surface-elevated/70 transition rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">
                  Click to choose file or drag & drop here
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Upload your spreadsheet saved as <strong>.CSV</strong> (Comma Separated Values)
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-[11px] text-muted-foreground font-mono border border-border">
                  <span>Supports: Product Name, SKU, Barcode, Price, Category, Unit, Stock</span>
                </div>
              </div>

              {parseError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: PREVIEW & CONFIGURE */}
          {stage === 'preview' && (
            <div className="space-y-5">
              {/* Summary Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface-elevated/60 border border-border rounded-xl">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground font-mono">{fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-elevated text-foreground font-medium border border-border">
                    {parsedRows.length} total rows
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {validCount} ready
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {invalidCount} incomplete
                    </span>
                  )}
                </div>
              </div>

              {/* Import Configuration Options */}
              <div className="p-4 bg-surface-elevated/40 border border-border rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Import Settings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={updateExistingSku}
                      onChange={(e) => setUpdateExistingSku(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-foreground font-medium">
                      Update existing products if SKU matches
                    </span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCreateCategories}
                      onChange={(e) => setAutoCreateCategories(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-foreground font-medium">
                      Auto-create missing Categories & Brands
                    </span>
                  </label>
                </div>

                <div className="pt-2 border-t border-border flex items-center gap-3">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Default Unit (if missing in row):
                  </span>
                  <select
                    value={defaultUnitId}
                    onChange={(e) => setDefaultUnitId(e.target.value)}
                    className="bg-input border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.shortCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">
                    Data Preview (First 10 items)
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Showing {Math.min(parsedRows.length, 10)} of {parsedRows.length} items
                  </span>
                </div>

                <div className="border border-border rounded-xl overflow-x-auto max-h-60">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-muted sticky top-0 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2 px-3 text-center">#</th>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Barcode</th>
                        <th className="py-2 px-3 text-right">Sale Price</th>
                        <th className="py-2 px-3 text-right">Cost Price</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3 text-right">Opening Stock</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {parsedRows.slice(0, 10).map((row, idx) => {
                        const isValid = row.name && row.salePrice !== undefined && row.salePrice >= 0;
                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-surface-elevated transition-colors ${
                              !isValid ? 'bg-rose-500/5' : ''
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-medium text-foreground">
                              {row.name ? (
                                row.name
                              ) : (
                                <span className="text-rose-500 italic font-normal">Missing Name</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-muted-foreground">
                              {row.sku || <span className="italic text-primary/70">AUTO</span>}
                            </td>
                            <td className="py-2 px-3 font-mono text-muted-foreground">
                              {row.barcode || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                              {row.salePrice !== undefined ? (
                                row.salePrice.toFixed(2)
                              ) : (
                                <span className="text-rose-500 italic font-normal">Required</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                              {row.purchasePrice !== undefined ? row.purchasePrice.toFixed(2) : '0.00'}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">
                              {row.categoryName || '—'}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">
                              {row.unitCode || 'PCS'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                              {row.openingStock || 0}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isValid ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                                  Valid
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500">
                                  Error
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {parseError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: RESULT SUMMARY */}
          {stage === 'result' && importResult && (
            <div className="space-y-5 py-4">
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Products Import Completed</h3>
                <p className="text-xs text-muted-foreground">
                  Your product catalog has been updated successfully.
                </p>

                <div className="grid grid-cols-3 gap-3 pt-3 max-w-sm mx-auto">
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Created</span>
                    <span className="text-lg font-bold font-mono text-emerald-500">{importResult.created}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Updated</span>
                    <span className="text-lg font-bold font-mono text-primary">{importResult.updated}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-border">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Skipped</span>
                    <span className="text-lg font-bold font-mono text-amber-500">{importResult.skipped}</span>
                  </div>
                </div>
              </div>

              {/* Error list if any rows were skipped */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{importResult.errors.length} Warnings / Skipped Rows</span>
                  </span>
                  <div className="max-h-36 overflow-y-auto border border-border rounded-xl p-2.5 bg-surface-elevated/40 space-y-1 font-mono text-[11px]">
                    {importResult.errors.map((e, idx) => (
                      <div key={idx} className="text-muted-foreground">
                        <span className="text-rose-400 font-semibold">Row {e.row}: </span>
                        <span>{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-surface-elevated/50 shrink-0">
          {stage === 'upload' && (
            <>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Supports UTF-8 CSV from Excel or Google Sheets</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
              >
                Cancel
              </button>
            </>
          )}

          {stage === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition disabled:opacity-50"
              >
                Back / Choose Other File
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isSubmitting || validCount === 0}
                  className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-primary-foreground px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing Products...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Import {validCount} Products</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {stage === 'result' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary-hover transition shadow-md shadow-primary/20"
              >
                Done & View Products
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
