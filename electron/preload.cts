import type {DesktopApi} from '../src/core/types.js';
import {contextBridge, ipcRenderer} from 'electron';
const desktop: DesktopApi = {
  platform: process.platform,
  calcStatus: () => ipcRenderer.invoke('calc-status'),
  openCalcLesson: step => ipcRenderer.invoke('calc-lesson', step),
  downloadAiModel: () => ipcRenderer.invoke('ai-download'),
  aiStatus: () => ipcRenderer.invoke('ai-status'),
  generateAiTheme: (config, topic) =>
    ipcRenderer.invoke('ai-generate', config, topic),
  cancelAiTheme: () => ipcRenderer.invoke('ai-cancel'),
  exportDataset: (config, delimiter) =>
    ipcRenderer.invoke('export-dataset', config, delimiter),
};
contextBridge.exposeInMainWorld('desktop', desktop);
