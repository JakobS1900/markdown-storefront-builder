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
 *
 * Version 2 adds `assets`, the first thing this database has ever held that is
 * not text. The two stores are strangers: nothing in the upgrade reads, rewrites
 * or migrates a page, because `pages` holding text is a promise made to somebody
 * whose page this version cannot parse, and an upgrade that touched it would be
 * the one code path able to break that promise.
 */

const DB_NAME = "markdown-storefront";
const DB_VERSION = 2;
const STORE = "pages";
const ASSETS = "assets";

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

/**
 * A picture the seller chose from their own device.
 *
 * `bytes` repeats the length of `data` on purpose. The storage view totals what
 * every picture costs, and reading the pictures out of the store to ask their
 * size would mean loading every photograph on the device to draw one number.
 *
 * THE PICTURE IS HELD AS AN `ArrayBuffer`, NOT A `Blob`, and that is a
 * deliberate departure from `specs/024-menu-file/data-model.md`, which named a
 * `Blob`. Two reasons, in order of weight:
 *
 * 1. It is what can be tested. `fake-indexeddb` does not round trip a `Blob`:
 *    a record written with one comes back carrying an object with no `size` and
 *    no `arrayBuffer`, so every assertion about what was actually stored, EXIF
 *    included, would have been impossible to write. A store this project cannot
 *    test is a store this project has already learned not to trust.
 * 2. Blob support in IndexedDB has a history. Safari has shipped versions that
 *    stored one and handed back something unreadable, and the bytes here are a
 *    seller's only copy of a picture.
 *
 * Nothing is lost by it: `mime` carries the type, and a `Blob` is one
 * constructor call away wherever one is wanted.
 */
export interface StoredAsset {
  /** The identifier a document refers to. Minted in the app, never the engine. */
  readonly id: string;
  /** The picture itself, after `normalise()`. */
  readonly data: ArrayBuffer;
  /** One of the four types `assets.ts` accepts. */
  readonly mime: string;
  /** `data.byteLength`, denormalised. */
  readonly bytes: number;
  /** For ordering the storage view. Supplied by the caller, never read here. */
  readonly createdAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Both stores are created if missing rather than switched on
    // `event.oldVersion`. A browser arriving at version 2 from nothing and one
    // arriving from version 1 then take the same path, and neither can leave a
    // store out. Creating a store is the only thing that happens here: no page
    // is read, rewritten or migrated.
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [STORE, ASSETS]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("could not open storage"));
    request.onblocked = () =>
      reject(new Error("Another tab has this open with an older version. Close it and try again."));
  });
}

function run<T>(
  name: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(name, mode);
        const request = work(tx.objectStore(name));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("storage request failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

export function listPages(): Promise<StoredPage[]> {
  return run<StoredPage[]>(STORE, "readonly", (s) => s.getAll() as IDBRequest<StoredPage[]>).then((pages) =>
    [...pages].sort((a, b) => b.updatedAt - a.updatedAt),
  );
}

export function readPage(id: string): Promise<StoredPage | undefined> {
  return run<StoredPage | undefined>(STORE, "readonly", (s) => s.get(id) as IDBRequest<StoredPage | undefined>);
}

/**
 * Writes a page.
 *
 * The caller has already serialized it, which means the writer has already
 * refused to produce anything that could not be read back (guarantee G7). A
 * page that would not load can therefore never reach storage.
 */
export function writePage(page: StoredPage): Promise<void> {
  return run(STORE, "readwrite", (s) => s.put(page) as IDBRequest<IDBValidKey>).then(() => undefined);
}

/**
 * Deletes a page.
 *
 * The only place in the application that removes an artist's work, and it is
 * reached only from an explicit action by them. Nothing calls this to recover
 * from an error.
 */
export function deletePage(id: string): Promise<void> {
  return run(STORE, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
}

/**
 * Writes a picture.
 *
 * A stored asset is immutable: editing a picture means storing a new one under
 * a new identifier, so nothing here ever overwrites bytes a document is already
 * pointing at.
 */
export function writeAsset(asset: StoredAsset): Promise<void> {
  return run(ASSETS, "readwrite", (s) => s.put(asset) as IDBRequest<IDBValidKey>).then(() => undefined);
}

export function readAsset(id: string): Promise<StoredAsset | undefined> {
  return run<StoredAsset | undefined>(ASSETS, "readonly", (s) => s.get(id) as IDBRequest<StoredAsset | undefined>);
}

/** Every stored picture, newest first, for the storage view. */
export function listAssets(): Promise<StoredAsset[]> {
  return run<StoredAsset[]>(ASSETS, "readonly", (s) => s.getAll() as IDBRequest<StoredAsset[]>).then((assets) =>
    [...assets].sort((a, b) => b.createdAt - a.createdAt),
  );
}

/**
 * Deletes a picture.
 *
 * The second and last place in this application that removes something of the
 * seller's, and like `deletePage` it is reached only from an explicit action by
 * them. Nothing calls this to reclaim space, and research D6 records that as a
 * decision rather than an oversight: a document may point at a picture that is
 * gone, and FR-088 makes that an ordinary state rather than damage.
 */
export function deleteAsset(id: string): Promise<void> {
  return run(ASSETS, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>).then(() => undefined);
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
