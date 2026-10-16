import {BrowserWindow, dialog} from 'electron';

let editor: BrowserWindow | null = null;
export function openSheets() {
  if (editor) {
    if (editor.isMinimized()) editor.restore();
    editor.show();
    editor.focus();
    return;
  }
  const url = 'forma://app/sheets/index.html';
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  editor = window;
  window.webContents.setWindowOpenHandler(({url: target}) =>
    target === 'forma://app/sheets/wizard.html'
      ? {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: window,
            modal: true,
            width: 700,
            height: 680,
            minWidth: 360,
            minHeight: 400,
            webPreferences: {
              sandbox: true,
              contextIsolation: true,
              nodeIntegration: false,
            },
          },
        }
      : {action: 'deny'},
  );
  window.webContents.on('did-create-window', child => {
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
    editor = null;
  });
  void window.loadURL(url);
}
