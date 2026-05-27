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
    iap: Object.freeze({
      canMakePayments: () =>
        ipcRenderer.invoke("contribution-arc:iap-can-make-payments"),
      getProducts: (productIds) =>
        ipcRenderer.invoke("contribution-arc:iap-get-products", productIds),
      purchase: (productId) =>
        ipcRenderer.invoke("contribution-arc:iap-purchase", productId),
      finalize: (transactionDate) =>
        ipcRenderer.invoke("contribution-arc:iap-finalize", transactionDate),
      onTransaction: (callback) => {
        if (typeof callback !== "function") {
          return () => {};
        }
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on("contribution-arc:iap-transaction", listener);
        return () => {
          ipcRenderer.removeListener("contribution-arc:iap-transaction", listener);
        };
      },
    }),
  }),
);
