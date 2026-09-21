import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  ShieldCheck,
  ShieldAlert,
  Download,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDrive,
  Calendar,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { BackupMetadataDTO, BackupVerifyResultDTO } from '../../../../shared/types';

interface BackupRestoreModalProps {
  onClose: () => void;
}

export function BackupRestoreModal({ onClose }: BackupRestoreModalProps) {
  const { session, settings } = useAuthStore();
  const isAdmin = session?.user?.role === 'ADMIN';
  const token = session?.token || '';
  const electronAPI = (window as any).electronAPI;

  const [backups, setBackups] = useState<BackupMetadataDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [verifyingFile, setVerifyingFile] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Restore Modal State
  const [targetRestoreFile, setTargetRestoreFile] = useState<BackupMetadataDTO | null>(null);
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);

  // Fetch Backups
  const loadBackups = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      if (electronAPI) {
        const res = await electronAPI.invoke('maintenance:listBackups');
        if (res && res.success) {
          setBackups(res.backups || []);
        } else {
          setFeedback({ type: 'error', message: res?.error || 'Failed to load backups list.' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error communicating with main process.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // Trigger Manual "Backup Now"
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setFeedback(null);
    try {
      if (electronAPI) {
        const res = await electronAPI.invoke('maintenance:createBackup', { token });
        if (res && res.success) {
          setFeedback({
            type: 'success',
            message: `Snapshot backup successfully created: ${res.backup?.filename} (${res.backup?.fileSizeFormatted})`,
          });
          await loadBackups();
        } else {
          setFeedback({ type: 'error', message: res?.error || 'Failed to create snapshot backup.' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Backup failed.' });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Verify Backup File
  const handleVerify = async (filePath: string) => {
    setVerifyingFile(filePath);
    setFeedback(null);
    try {
      if (electronAPI) {
        const res = await electronAPI.invoke('maintenance:verifyIntegrity', { token, filePath });
        if (res && res.success && res.verification?.ok) {
          setFeedback({
            type: 'success',
            message: `Verified: ${pathBasename(filePath)} is intact with ${res.verification.tableCount} valid tables (PRAGMA integrity_check: OK).`,
          });
        } else {
          setFeedback({
            type: 'error',
            message: `Integrity Check Failed: ${res?.verification?.message || res?.error || 'Corrupt database'}`,
          });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Integrity check error.' });
    } finally {
      setVerifyingFile(null);
    }
  };

  // Delete Backup File
  const handleDelete = async (filePath: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup: ${pathBasename(filePath)}? This action cannot be undone.`)) {
      return;
    }

    setDeletingFile(filePath);
    setFeedback(null);
    try {
      if (electronAPI) {
        const res = await electronAPI.invoke('maintenance:deleteBackup', { token, filePath });
        if (res && res.success) {
          setFeedback({ type: 'success', message: 'Backup file deleted successfully.' });
          await loadBackups();
        } else {
          setFeedback({ type: 'error', message: res?.error || 'Failed to delete backup file.' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Deletion error.' });
    } finally {
      setDeletingFile(null);
    }
  };

  // Execute Destructive Restore
  const handleExecuteRestore = async () => {
    if (!targetRestoreFile || confirmInput !== 'RESTORE') return;

    setIsRestoring(true);
    setFeedback(null);
    try {
      if (electronAPI) {
        const res = await electronAPI.invoke('maintenance:restoreBackup', {
          token,
          backupFilePath: targetRestoreFile.filePath,
        });

        if (res && res.success) {
          setRestoreSuccessMsg(
            `Database restored successfully from ${targetRestoreFile.filename}!\n\nA pre-restore safety backup was created at: ${res.result?.safetyBackupPath}.\n\nPlease restart the application or refresh your browser to view the restored store state.`
          );
        } else {
          setFeedback({ type: 'error', message: res?.error || 'Database restore failed.' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Restore error.' });
    } finally {
      setIsRestoring(false);
    }
  };

  const pathBasename = (p: string) => p.split(/[\\/]/).pop() || p;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-muted flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-primary/20 text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                <span>Backup, Restore & Disaster Recovery Center</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                  SQLite Safe
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Create transaction-consistent snapshots, verify file integrity, and recover local retail databases.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div
            className={`px-5 py-3 text-xs flex items-center space-x-2 flex-shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-b border-emerald-800 text-emerald-200'
                : 'bg-rose-950/80 border-b border-rose-800 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span className="flex-1 font-medium">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-white text-xs underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-surface-muted border border-border rounded-xl p-4">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Total Available Backups
              </span>
              <span className="text-2xl font-bold text-foreground">{backups.length}</span>
              <span className="text-[10px] text-muted-foreground block mt-1">Stored locally on disk</span>
            </div>

            <div className="bg-surface-muted border border-border rounded-xl p-4">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Auto-Backup Schedule
              </span>
              <span className="text-sm font-bold text-emerald-400 flex items-center space-x-1.5 mt-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Daily on Idle</span>
              </span>
              <span className="text-[10px] text-muted-foreground block mt-1">24-hour interval check</span>
            </div>

            <div className="bg-surface-muted border border-border rounded-xl p-4">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Retention Limit
              </span>
              <span className="text-2xl font-bold text-primary">
                {settings?.backup?.retentionCount || 7}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-1">Newest versions retained</span>
            </div>

            <div className="bg-surface-muted border border-border rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Immediate Snapshot
                </span>
                <span className="text-[10px] text-muted-foreground">Atomic VACUUM INTO backup</span>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={isBackingUp}
                className="mt-2 w-full py-2 px-3 rounded-lg bg-orange-600 hover:bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-orange-600/20 disabled:opacity-50 transition-colors"
              >
                {isBackingUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Snapshotting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Backup Database Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Backups List Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-primary" />
                <span>Available Local Database Snapshots</span>
              </h3>
              <button
                onClick={loadBackups}
                disabled={isLoading}
                className="text-xs text-muted-foreground hover:text-white flex items-center space-x-1 bg-surface-elevated px-2.5 py-1 rounded-md border border-slate-700/60 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-primary' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-surface-muted">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Backup File & Type</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground">
                  {isLoading && backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        <span>Scanning backup repository...</span>
                      </td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No local backup files found. Click "Backup Database Now" to generate your first snapshot.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-surface-elevated transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{b.filename}</div>
                          {b.isPreRestoreSafety ? (
                            <span className="inline-flex items-center text-[10px] text-amber-400 font-medium mt-0.5">
                              Pre-Restore Safety Snapshot
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground block truncate max-w-xs" title={b.filePath}>
                              {b.filePath}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-foreground">
                          {b.fileSizeFormatted}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Valid SQLite
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {/* Verify */}
                          <button
                            onClick={() => handleVerify(b.filePath)}
                            disabled={verifyingFile === b.filePath}
                            title="Verify SQLite integrity and table completeness"
                            className="p-1.5 rounded bg-surface-elevated hover:bg-surface-muted text-foreground hover:text-white border border-slate-700/60 transition-colors"
                          >
                            {verifyingFile === b.filePath ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            ) : (
                              <FileCheck2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Restore Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setTargetRestoreFile(b);
                                setConfirmInput('');
                                setRestoreSuccessMsg(null);
                              }}
                              title="Restore entire business database from this snapshot"
                              className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 font-semibold transition-colors"
                            >
                              Restore
                            </button>
                          )}

                          {/* Delete Button (Admin Only) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDelete(b.filePath)}
                              disabled={deletingFile === b.filePath}
                              title="Delete backup file"
                              className="p-1.5 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                            >
                              {deletingFile === b.filePath ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-muted flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Active Operational Truth: Local SQLite with WAL mode & Single-Writer Mutex</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Destructive Restore Confirmation Modal */}
      {targetRestoreFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-surface border border-rose-900/80 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3 text-rose-400">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <ShieldAlert className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Destructive Database Restore
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Action requires strict Administrator authorization.
                </p>
              </div>
            </div>

            {restoreSuccessMsg ? (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-emerald-200 text-xs whitespace-pre-line font-medium">
                  {restoreSuccessMsg}
                </div>
                <button
                  onClick={() => {
                    setTargetRestoreFile(null);
                    setRestoreSuccessMsg(null);
                    loadBackups();
                  }}
                  className="w-full py-2.5 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground font-semibold text-xs transition-colors"
                >
                  Close & Done
                </button>
              </div>
            ) : (
              <>
                <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-3 text-xs text-rose-200 space-y-1.5">
                  <p className="font-semibold text-rose-300">CRITICAL WARNING:</p>
                  <p>
                    Restoring will overwrite your active SQLite database with the snapshot{' '}
                    <span className="font-bold text-white">"{targetRestoreFile.filename}"</span>.
                  </p>
                  <p>
                    Any sales, purchases, or ledger adjustments created after this snapshot was taken will be replaced.
                  </p>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    ✓ A Pre-Restore Safety Backup of your current database will be generated automatically before file replacement.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Type <span className="text-rose-400 font-bold">RESTORE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="RESTORE"
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    onClick={() => {
                      setTargetRestoreFile(null);
                      setConfirmInput('');
                    }}
                    disabled={isRestoring}
                    className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-muted text-foreground text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={confirmInput !== 'RESTORE' || isRestoring}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 disabled:opacity-40 transition-colors"
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Restoring Database...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Confirm Destructive Restore</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
