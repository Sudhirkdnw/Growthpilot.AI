export interface ElectronAPI {
  invoke: (channel: string, payload?: any) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
