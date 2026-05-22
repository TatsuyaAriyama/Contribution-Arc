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
    notify: (payload) => {
      if (!payload || typeof payload !== "object") {
        return Promise.resolve(false);
      }

      const title = typeof payload.title === "string" ? payload.title : "";
      const body = typeof payload.body === "string" ? payload.body : "";

      if (!title || !body) {
        return Promise.resolve(false);
      }

      return ipcRenderer.invoke("contribution-arc:notify", { title, body });
    },
  }),
);
