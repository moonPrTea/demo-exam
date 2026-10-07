import type {DesktopApi} from './core/types.js';

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
