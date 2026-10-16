import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('sheetDesktop', {
  menu: (language: string) => ipcRenderer.send('sheet-menu', language),
  newDocument: (language: string) =>
    ipcRenderer.send('sheet-new-document', language),
  onCommand: (callback: (command: string) => void) => {
    ipcRenderer.on('sheet-command', (_event, command: string) =>
      callback(command),
    );
  },
});
