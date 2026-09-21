import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { initializeDatabasePragmas } from './database/client';
import { registerAllIpcHandlers } from './ipc';
import { autoBackupScheduler } from './modules/backup/auto-backup.scheduler';

const require = createRequire(import.meta.url);
(globalThis as any).require = require;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'RS Inventory – Solo (RS ORANGE TECH PVT LTD)',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  // Load Vite dev server or production index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  try {
    await initializeDatabasePragmas();
    registerAllIpcHandlers();
    autoBackupScheduler.start();
    await createWindow();
  } catch (err) {
    console.error('[Main] Failed to initialize application:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
