import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('rangeWindow', {
  setPicking: (active: boolean) =>
    ipcRenderer.send('sheet-range-picking', active),
});
