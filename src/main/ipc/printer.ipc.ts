import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { dispatchFastify } from '../fastify/server';
import { auditService } from '../modules/audit/audit.service';
import { PrintResultDTO, SavePdfResultDTO } from '../../shared/types';

export function registerPrinterIpc() {
  /**
   * 1. Enumerate installed system printers
   */
  ipcMain.handle('printer:getPrinters', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        const printers = await win.webContents.getPrintersAsync();
        return printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          description: p.description || '',
          isDefault: Boolean(p.isDefault),
          status: p.status,
        }));
      }
      return [];
    } catch (err: any) {
      console.error('[Printer IPC] Failed to enumerate printers:', err);
      return [];
    }
  });

  /**
   * 2. Native Electron printing (A4, 80mm, 58mm)
   */
  ipcMain.handle(
    'printer:print',
    async (
      _,
      {
        htmlContent,
        printerName,
        silent = false,
        copies = 1,
        paperFormat = 'A4',
        documentNumber,
        userId,
      }
    ): Promise<PrintResultDTO> => {
      return new Promise(async (resolve) => {
        let printWin: BrowserWindow | null = null;
        let timeoutTimer: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (printWin && !printWin.isDestroyed()) {
            try {
              printWin.close();
            } catch {
              // Ignore
            }
            printWin = null;
          }
        };

        try {
          // Check printer existence if specified
          if (printerName && printerName.trim()) {
            const win = BrowserWindow.getAllWindows()[0];
            if (win && !win.isDestroyed()) {
              const installed = await win.webContents.getPrintersAsync();
              const found = installed.find(
                (p) => p.name.toLowerCase() === printerName.trim().toLowerCase()
              );
              if (!found) {
                return resolve({
                  success: false,
                  code: 'PRINTER_NOT_FOUND',
                  error: `Selected printer "${printerName}" was not found on this system.`,
                });
              }
            }
          }

          printWin = new BrowserWindow({
            show: false,
            width: paperFormat === 'A4' ? 800 : 400,
            height: 900,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
            },
          });

          // Timeout safety: 30 seconds max for print dialog
          timeoutTimer = setTimeout(() => {
            cleanup();
            resolve({
              success: false,
              code: 'PRINT_FAILED',
              error: 'Print operation timed out.',
            });
          }, 30000);

          printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

          printWin.webContents.on('did-finish-load', () => {
            if (!printWin || printWin.isDestroyed()) return;

            const printOptions: any = {
              silent: Boolean(silent),
              printBackground: true,
              copies: Math.max(1, Number(copies || 1)),
            };

            if (printerName && printerName.trim()) {
              printOptions.deviceName = printerName.trim();
            }

            if (paperFormat === 'A4') {
              printOptions.pageSize = 'A4';
              printOptions.margins = { marginType: 'printableArea' };
            } else if (paperFormat === 'THERMAL_58MM') {
              printOptions.pageSize = { width: 58000, height: 297000 };
              printOptions.margins = { marginType: 'none' };
            } else {
              // THERMAL_80MM default
              printOptions.pageSize = { width: 80000, height: 297000 };
              printOptions.margins = { marginType: 'none' };
            }

            printWin.webContents.print(printOptions, async (success, failureReason) => {
              cleanup();

              if (!success) {
                if (failureReason === 'cancelled') {
                  return resolve({
                    success: false,
                    code: 'PRINT_CANCELLED',
                    error: 'Print operation was cancelled by user.',
                  });
                }
                return resolve({
                  success: false,
                  code: 'PRINT_FAILED',
                  error: failureReason || 'Printer error encountered.',
                });
              }

              // Audit logging
              try {
                await auditService.log({
                  userId: userId || null,
                  action: 'INVOICE_PRINTED',
                  entityType: 'Invoice',
                  entityId: documentNumber || null,
                  reason: `Printed document ${documentNumber || ''} via ${printerName || 'default printer'}`,
                });
              } catch (auditErr) {
                console.error('[Audit] Failed to log invoice print:', auditErr);
              }

              resolve({ success: true, code: 'OK' });
            });
          });

          printWin.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
            cleanup();
            resolve({
              success: false,
              code: 'PRINT_FAILED',
              error: `Failed to render invoice: ${errorDescription} (${errorCode})`,
            });
          });
        } catch (err: any) {
          cleanup();
          resolve({
            success: false,
            code: 'PRINT_FAILED',
            error: err?.message || 'Print subsystem failure',
          });
        }
      });
    }
  );

  /**
   * 3. Native PDF generation and safe file save dialog
   */
  ipcMain.handle(
    'printer:savePdf',
    async (
      _,
      {
        htmlContent,
        paperFormat = 'A4',
        defaultFileName = 'Invoice.pdf',
        documentNumber,
        userId,
      }
    ): Promise<SavePdfResultDTO> => {
      let printWin: BrowserWindow | null = null;
      try {
        printWin = new BrowserWindow({
          show: false,
          width: paperFormat === 'A4' ? 800 : 400,
          height: 900,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });

        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        const pdfOptions: any = {
          printBackground: true,
          landscape: false,
        };

        if (paperFormat === 'A4') {
          pdfOptions.pageSize = 'A4';
          pdfOptions.margins = {
            marginType: 'default',
          };
        } else if (paperFormat === 'THERMAL_58MM') {
          pdfOptions.pageSize = { width: 58000, height: 297000 };
          pdfOptions.margins = { marginType: 'none' };
        } else {
          pdfOptions.pageSize = { width: 80000, height: 297000 };
          pdfOptions.margins = { marginType: 'none' };
        }

        const pdfBuffer = await printWin.webContents.printToPDF(pdfOptions);

        if (!printWin.isDestroyed()) {
          printWin.close();
        }
        printWin = null;

        // Prompt native save file dialog
        const mainWin = BrowserWindow.getAllWindows()[0];
        const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
          title: 'Save Invoice as PDF',
          defaultPath: defaultFileName.endsWith('.pdf') ? defaultFileName : `${defaultFileName}.pdf`,
          filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }],
        });

        if (canceled || !filePath) {
          return { success: false, cancelled: true };
        }

        // Validate path and save file
        const resolvedPath = path.resolve(filePath);
        await fs.promises.writeFile(resolvedPath, pdfBuffer);

        // Audit log
        try {
          await auditService.log({
            userId: userId || null,
            action: 'INVOICE_PDF_GENERATED',
            entityType: 'Invoice',
            entityId: documentNumber || null,
            reason: `Saved invoice PDF ${documentNumber || ''} to ${resolvedPath}`,
          });
        } catch (auditErr) {
          console.error('[Audit] Failed to log PDF generation:', auditErr);
        }

        return { success: true, filePath: resolvedPath };
      } catch (err: any) {
        if (printWin && !printWin.isDestroyed()) {
          try {
            printWin.close();
          } catch {
            // Ignore
          }
        }
        console.error('[Printer IPC] PDF generation failed:', err);
        return {
          success: false,
          code: 'FILE_SAVE_FAILED',
          error: err?.message || 'Failed to generate or save PDF document.',
        };
      }
    }
  );

  /**
   * 4. Retrieve Invoice Document via Fastify injection
   */
  ipcMain.handle('invoice:getDocument', async (_, { documentType, id, token }) => {
    return await dispatchFastify(
      'GET',
      `/api/invoices/document?type=${encodeURIComponent(documentType)}&id=${encodeURIComponent(id)}`,
      undefined,
      token ? { authorization: token } : undefined
    );
  });

  /**
   * 5. Backwards-compatible printReceipt handler
   */
  ipcMain.handle('printer:printReceipt', async (_, { htmlContent, silent = false }) => {
    return new Promise((resolve) => {
      try {
        const printWin = new BrowserWindow({
          show: false,
          width: 450,
          height: 700,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });

        printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        printWin.webContents.on('did-finish-load', () => {
          printWin.webContents.print(
            {
              silent: Boolean(silent),
              printBackground: true,
              margins: {
                marginType: 'none',
              },
            },
            (success, failureReason) => {
              try {
                if (!printWin.isDestroyed()) {
                  printWin.close();
                }
              } catch {
                // Window already destroyed
              }

              if (!success && failureReason !== 'cancelled') {
                resolve({ success: false, error: failureReason });
              } else {
                resolve({ success: true });
              }
            }
          );
        });

        printWin.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
          try {
            if (!printWin.isDestroyed()) {
              printWin.close();
            }
          } catch {
            // Window already destroyed
          }
          resolve({ success: false, error: `${errorDescription} (${errorCode})` });
        });
      } catch (err: any) {
        resolve({ success: false, error: err?.message || 'Print failure' });
      }
    });
  });
}
