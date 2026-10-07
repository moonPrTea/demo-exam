import {
  app,
  BrowserWindow,
  protocol,
  net,
  ipcMain,
  dialog,
  session,
  Menu,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import type {ConfigInput, ExportResult} from '../src/core/types.js';

// Keep the existing profile and origin so the rename preserves progress.
app.setPath(
  'userData',
  path.join(app.getPath('appData'), app.isPackaged ? 'Forma' : 'forma-exam'),
);
app.setName('formatted');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'forma',
    privileges: {standard: true, secure: true, supportFetchAPI: true},
  },
]);
const root = path.resolve(__dirname, '../src');
const trusted = 'forma://app/index.html';

async function setup() {
  if (process.platform === 'darwin' && app.dock)
    app.dock.setIcon(path.join(root, 'assets/forma.png'));
  protocol.handle('forma', request => {
    const url = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (url.host !== 'app' || !file.startsWith(root + path.sep))
      return new Response('Forbidden', {status: 403});
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle(
    'export-dataset',
    async (
      event,
      config: ConfigInput,
      delimiter: string,
    ): Promise<ExportResult> => {
      if (
        event.senderFrame?.url !== trusted ||
        event.senderFrame !== event.sender.mainFrame
      )
        throw new Error('Untrusted request');
      const {exportFiles} = await import('../src/core/generator.js');
      const files = exportFiles(config, delimiter);
      const parent = BrowserWindow.fromWebContents(event.sender);
      if (!parent) throw new Error('Window unavailable');
      const choice = await dialog.showOpenDialog(parent, {
        title: 'Куда сохранить учебный вариант?',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (choice.canceled) return {canceled: true};
      const directory = await fs.mkdtemp(
        path.join(choice.filePaths[0], 'formatted-'),
      );
      try {
        for (const file of files)
          await fs.writeFile(path.join(directory, file.name), file.content, {
            encoding: 'utf8',
            flag: 'wx',
          });
      } catch (error) {
        throw new Error(
          `Не удалось записать весь набор в ${directory}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return {directory, count: files.length};
    },
  );
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    icon: path.join(root, 'assets/forma.png'),
    title: 'formatted - подготовка к экзамену',
    backgroundColor: '#f1f4f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== trusted) event.preventDefault();
  });
  void window.loadURL(trusted);
  return window;
}

if (require.main === module && !app.requestSingleInstanceLock()) {
  app.quit();
} else if (require.main === module) {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      await setup();
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === 'darwin'
            ? [
                {
                  label: 'formatted',
                  submenu: [
                    {role: 'about' as const},
                    {type: 'separator' as const},
                    {role: 'quit' as const},
                  ],
                },
              ]
            : []),
          {
            label: 'Правка',
            submenu: [
              {role: 'undo'},
              {role: 'redo'},
              {type: 'separator'},
              {role: 'cut'},
              {role: 'copy'},
              {role: 'paste'},
              {role: 'selectAll'},
            ],
          },
          {
            label: 'Вид',
            submenu: [
              {role: 'reload'},
              {role: 'resetZoom'},
              {role: 'zoomIn'},
              {role: 'zoomOut'},
              {role: 'togglefullscreen'},
            ],
          },
        ]),
      );
      createWindow();
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length) createWindow();
      });
    })
    .catch((error: unknown) => {
      dialog.showErrorBox('Не удалось открыть formatted', String(error));
      app.exit(1);
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
export {setup, createWindow};
