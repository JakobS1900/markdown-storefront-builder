/**
 * Local persistence. IndexedDB, no account, no network.
 *
 * Constitution Principle V is the whole design brief here. Two rules shape
 * everything below:
 *
 *   - No failure path may delete or overwrite a saved page to recover.
 *   - A page that cannot be loaded MUST still be retrievable as its raw stored
 *     content (FR-018 of feature 001, raised by review R-4).
 *
 * That second rule is why records are stored as TEXT rather than as structured
 * objects. IndexedDB could hold the object directly, but then a record the
 * current version cannot validate would be unreadable in a useful sense: we
 * could not hand the artist back the exact bytes they saved. Storing the
 * serialized form means the escape hatch always exists.
 */

const DB_NAME = "markdown-storefront";
const DB_VERSION = 1;
const STORE = "pages";

export interface StoredPage {
  /** Stable identifier for this saved page. Not the Document's own content. */
  readonly id: string;
  /** The canonical serialization. Text, deliberately. See the note above. */
  readonly json: string;
  /** For the page list. Falls back to a placeholder when the page has no title. */
  readonly title: string;
  /** Milliseconds since the epoch. Supplied by the caller, never read here. */
  readonly updatedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("could not open storage"));
    request.onblocked = () =>
      reject(new Error("Another tab has this open with an older version. Close it and try again."));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("storage request failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

export function listPages(): Promise<StoredPage[]> {
  return run<StoredPage[]>("readonly", (s) => s.getAll() as IDBRequest<StoredPage[]>).then((pages) =>
    [...pages].sort((a, b) => b.updatedAt - a.updatedAt),
  );
}

export function readPage(id: string): Promise<StoredPage | undefined> {
  return run<StoredPage | undefined>("readonly", (s) => s.get(id) as IDBRequest<StoredPage | undefined>);
}

/**
 * Writes a page.
 *
 * The caller has already serialized it, which means the writer has already
 * refused to produce anything that could not be read back (guarantee G7). A
 * page that would not load can therefore never reach storage.
 */
export function writePage(page: StoredPage): Promise<void> {
  return run("readwrite", (s) => s.put(page) as IDBRequest<IDBValidKey>).then(() => undefined);
}

/**
 * Deletes a page.
 *
 * The only place in the application that removes an artist's work, and it is
 * reached only from an explicit action by them. Nothing calls this to recover
 * from an error.
 */
export function deletePage(id: string): Promise<void> {
  return run("readwrite", (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
}

/**
 * Whether storage is available at all.
 *
 * Private browsing modes and locked-down configurations can refuse IndexedDB
 * entirely. Knowing that up front lets the app say so plainly rather than
 * appearing to save and silently losing everything on reload.
 */
export async function storageAvailable(): Promise<boolean> {
  try {
    const db = await open();
    db.close();
    return true;
  } catch {
    return false;
  }
}
