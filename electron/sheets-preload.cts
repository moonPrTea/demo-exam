import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('sheetDesktop', {
  menu: (language: string, sheet: string, count: number) =>
    ipcRenderer.send('sheet-menu', language, sheet, count),
  newDocument: (language: string) =>
    ipcRenderer.send('sheet-new-document', language),
  onCommand: (callback: (command: string, sheet?: string) => void) => {
    ipcRenderer.on('sheet-command', (_event, command: string, sheet?: string) =>
      callback(command, sheet),
    );
  },
});
