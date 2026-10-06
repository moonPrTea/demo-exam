const { app, BrowserWindow, protocol, net, ipcMain, dialog, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'forma', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const root = path.resolve(__dirname, '../src');
const trusted = 'forma://app/index.html';

async function setup() {
  protocol.handle('forma', request => {
    const url = new URL(request.url);
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (url.host !== 'app' || !file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  ipcMain.handle('export-dataset', async (event, config, delimiter) => {
    if (event.senderFrame?.url !== trusted || event.senderFrame !== event.sender.mainFrame) throw new Error('Untrusted request');
    const { exportFiles } = await import('../src/core/generator.js');
    const files = exportFiles(config, delimiter);
    const choice = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { title: 'Куда сохранить учебный вариант?', properties: ['openDirectory', 'createDirectory'] });
    if (choice.canceled) return { canceled: true };
    const directory = await fs.mkdtemp(path.join(choice.filePaths[0], 'forma-'));
    try {
      for (const file of files) await fs.writeFile(path.join(directory, file.name), file.content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      throw new Error(`Не удалось записать весь набор в ${directory}: ${error.message}`);
    }
    return { directory, count: files.length };
  });
}

function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 960, minWidth: 900, minHeight: 650, title: 'Forma — подготовка к экзамену', backgroundColor: '#101012', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== trusted) event.preventDefault(); });
  window.loadURL(trusted);
  return window;
}

if (require.main === module && !app.requestSingleInstanceLock()) {
  app.quit();
} else if (require.main === module) {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(async () => {
    await setup();
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ label: 'Forma', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }] : []),
      { label: 'Правка', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'Вид', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] }
    ]));
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
module.exports = { setup, createWindow };
