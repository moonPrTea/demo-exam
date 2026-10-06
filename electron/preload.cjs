const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  exportDataset: (config, delimiter) => ipcRenderer.invoke('export-dataset', config, delimiter)
});
