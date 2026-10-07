import type {DesktopApi} from '../src/core/types.js';
import {contextBridge, ipcRenderer} from 'electron';
const desktop: DesktopApi = {
  exportDataset: (config, delimiter) =>
    ipcRenderer.invoke('export-dataset', config, delimiter),
};
contextBridge.exposeInMainWorld('desktop', desktop);
