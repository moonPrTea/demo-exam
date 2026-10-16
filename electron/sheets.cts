import {
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  type Rectangle,
  type WebContents,
  type IpcMainEvent,
} from 'electron';
import path from 'node:path';

let editor: BrowserWindow | null = null;
const editors = new Set<BrowserWindow>();
let documentNumber = 0;
function trustedEditor(event: IpcMainEvent, language: unknown) {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window &&
    editors.has(window) &&
    event.senderFrame === event.sender.mainFrame &&
    (language === 'ru' || language === 'en')
    ? window
    : null;
}
ipcMain.on('sheet-new-document', (event, language: unknown) => {
  if (trustedEditor(event, language)) createEditor(true, language as string);
});
ipcMain.on('sheet-menu', (event, language: unknown) => {
  const window = trustedEditor(event, language);
  if (!window) return;
  Menu.buildFromTemplate([
    {
      label: language === 'ru' ? 'Создать новый лист' : 'New sheet',
      click: () => {
        if (!window.isDestroyed())
          window.webContents.send('sheet-command', 'add-sheet');
      },
    },
  ]).popup({window});
});
const expanded = new WeakMap<BrowserWindow, Rectangle>();
ipcMain.on('sheet-range-picking', (event, active: unknown) => {
  const child = BrowserWindow.fromWebContents(event.sender);
  if (
    typeof active !== 'boolean' ||
    !child ||
    !editors.has(child.getParentWindow()!) ||
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== 'forma://app/sheets/wizard.html'
  )
    return;
  if (active && !expanded.has(child)) {
    expanded.set(child, child.getBounds());
    child.setMinimumSize(360, 96);
    const zoom = child.webContents.getZoomFactor();
    child.setContentSize(Math.round(420 * zoom), Math.round(90 * zoom));
    child.setAlwaysOnTop(true);
    child.getParentWindow()?.focus();
  } else if (!active && expanded.has(child)) {
    child.setMinimumSize(360, 400);
    child.setBounds(expanded.get(child)!);
    expanded.delete(child);
    child.setAlwaysOnTop(false);
    child.focus();
  }
});
export function openSheets() {
  if (editor) {
    if (editor.isMinimized()) editor.restore();
    editor.show();
    editor.focus();
    return;
  }
  createEditor();
}
function createEditor(blank = false, language = 'ru') {
  const url =
    'forma://app/sheets/index.html' +
    (blank ? `?blank=1&language=${language}&document=${++documentNumber}` : '');
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'sheets-preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  editor = window;
  editors.add(window);
  window.on('focus', () => {
    editor = window;
  });
  const shortcut = (contents: WebContents) =>
    contents.on('before-input-event', (event, input) => {
      if (
        input.type === 'keyDown' &&
        (input.meta || input.control) &&
        !input.alt &&
        !input.shift &&
        (input.code === 'KeyN' || input.key.toLowerCase() === 'n')
      ) {
        event.preventDefault();
        if (!input.isAutoRepeat)
          window.webContents.send('sheet-command', 'new-document');
      }
    });
  shortcut(window.webContents);
  window.webContents.setWindowOpenHandler(({url: target}) =>
    target === 'forma://app/sheets/wizard.html'
      ? {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: window,
            modal: false,
            width: 700,
            height: 680,
            minWidth: 360,
            minHeight: 400,
            webPreferences: {
              preload: path.join(__dirname, 'wizard-preload.cjs'),
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false,
            },
          },
        }
      : {action: 'deny'},
  );
  window.webContents.on('did-create-window', child => {
    shortcut(child.webContents);
    child.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    child.webContents.on('will-navigate', (event, target) => {
      if (target !== 'forma://app/sheets/wizard.html') event.preventDefault();
    });
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (target !== url) event.preventDefault();
  });
  window.webContents.on('will-prevent-unload', event => {
    const response = dialog.showMessageBoxSync(window, {
      type: 'warning',
      message: 'Изменения не сохранены / Unsaved changes',
      detail:
        'Эта версия хранит книгу только в памяти / This version keeps the workbook in memory only',
      buttons: ['Остаться / Stay', 'Закрыть / Close'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response === 1) event.preventDefault();
  });
  window.on('closed', () => {
    editors.delete(window);
    if (editor === window) editor = [...editors].at(-1) ?? null;
  });
  void window.loadURL(url);
}
