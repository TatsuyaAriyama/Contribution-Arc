const persistentCacheName = "contribution-arc-persistent-cache";
const persistentCacheVersion = 1;
const persistentStoreNames = ["dailyReports", "posts"] as const;

export type PersistentStoreName = (typeof persistentStoreNames)[number];

let persistentDbPromise: Promise<IDBDatabase | null> | null = null;

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openPersistentDb() {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  if (persistentDbPromise) {
    return persistentDbPromise;
  }

  persistentDbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const request = window.indexedDB.open(persistentCacheName, persistentCacheVersion);

    request.onupgradeneeded = () => {
      const database = request.result;
      persistentStoreNames.forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.info("Persistent cache unavailable.", request.error);
      resolve(null);
    };
    request.onblocked = () => resolve(null);
  });

  return persistentDbPromise;
}

export async function readPersistentItems<T extends { id: string }>(storeName: PersistentStoreName) {
  const database = await openPersistentDb();
  if (!database) {
    return [];
  }

  try {
    const transaction = database.transaction(storeName, "readonly");
    return await requestToPromise<T[]>(transaction.objectStore(storeName).getAll());
  } catch (error) {
    console.info("Persistent cache read skipped.", { storeName, error });
    return [];
  }
}

export async function putPersistentItem<T extends { id: string }>(storeName: PersistentStoreName, item: T) {
  const database = await openPersistentDb();
  if (!database) {
    return false;
  }

  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestToPromise(transaction.objectStore(storeName).put(item));
    return true;
  } catch (error) {
    console.info("Persistent cache write skipped.", { storeName, error });
    return false;
  }
}

export async function putPersistentItems<T extends { id: string }>(storeName: PersistentStoreName, items: T[]) {
  const database = await openPersistentDb();
  if (!database) {
    return false;
  }

  try {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    await Promise.all(items.map((item) => requestToPromise(store.put(item))));
    return true;
  } catch (error) {
    console.info("Persistent cache batch write skipped.", { storeName, error });
    return false;
  }
}

export async function deletePersistentItem(storeName: PersistentStoreName, id: string) {
  const database = await openPersistentDb();
  if (!database) {
    return false;
  }

  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestToPromise(transaction.objectStore(storeName).delete(id));
    return true;
  } catch (error) {
    console.info("Persistent cache delete skipped.", { storeName, id, error });
    return false;
  }
}
