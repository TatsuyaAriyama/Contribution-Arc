const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "contributionArcDesktop",
  Object.freeze({
    isElectron: true,
    platform: process.platform,
    versions: Object.freeze({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    }),
    onOpenSettings: (callback) => {
      if (typeof callback !== "function") {
        return () => {};
      }

      const listener = () => callback();
      ipcRenderer.on("contribution-arc:open-settings", listener);

      return () => {
        ipcRenderer.removeListener("contribution-arc:open-settings", listener);
      };
    },
  }),
);
