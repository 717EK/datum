/**
 * "Recently opened" list, persisted in IndexedDB.
 *
 * A web page can't reopen a file from its path, so each entry remembers the
 * best re-open route the browser offers:
 *  - a FileSystemFileHandle (Chromium desktop/Android: picker, drag-drop and
 *    "Open with" launches all provide one) — reopening asks permission once;
 *  - otherwise the file bytes themselves (Safari / iOS / Firefox), capped so
 *    the store can't balloon: files over BLOB_MAX_BYTES are listed but must be
 *    opened again by hand.
 * A small thumbnail captured from the viewer is stored with each entry.
 */

const DB_NAME = "step-viewer-recents";
const DB_VERSION = 1;
const STORE = "entries";
const BLOBS = "blobs";

export const MAX_ENTRIES = 12;
export const BLOB_MAX_BYTES = 64 * 1024 * 1024; // keep bytes for files up to 64 MB
export const BLOB_TOTAL_BYTES = 256 * 1024 * 1024; // …and 256 MB across all entries

export interface RecentEntry {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  openedAt: number;
  /** Chromium: re-openable handle (structured-cloneable into IDB). */
  handle?: FileSystemFileHandle;
  /** Bytes are stored in the `blobs` store under the same id. */
  hasBlob: boolean;
  /** data: URL PNG, ~160px. */
  thumb?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, run: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out: T | undefined;
    const r = run(t);
    if (r) r.onsuccess = () => (out = r.result);
    t.oncomplete = () => resolve(out as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export function entryId(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export class RecentsStore {
  private dbp: Promise<IDBDatabase> | null = null;
  private db(): Promise<IDBDatabase> {
    if (!this.dbp) this.dbp = open().catch((e) => { this.dbp = null; throw e; });
    return this.dbp;
  }

  async list(): Promise<RecentEntry[]> {
    try {
      const db = await this.db();
      const all = await tx<RecentEntry[]>(db, [STORE], "readonly", (t) => t.objectStore(STORE).getAll());
      return all.sort((a, b) => b.openedAt - a.openedAt);
    } catch {
      return [];
    }
  }

  /** Record an open. Keeps bytes when no handle is available and the file is small enough. */
  async remember(file: File, handle?: FileSystemFileHandle): Promise<RecentEntry | null> {
    try {
      const db = await this.db();
      const id = entryId(file);
      const existing = await tx<RecentEntry | undefined>(db, [STORE], "readonly", (t) => t.objectStore(STORE).get(id));
      const keepBytes = !handle && file.size <= BLOB_MAX_BYTES;
      const entry: RecentEntry = {
        id,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        openedAt: Date.now(),
        handle: handle ?? existing?.handle,
        hasBlob: keepBytes || (existing?.hasBlob ?? false),
        thumb: existing?.thumb,
      };
      await tx(db, [STORE, BLOBS], "readwrite", (t) => {
        t.objectStore(STORE).put(entry);
        if (keepBytes) t.objectStore(BLOBS).put(file, id);
      });
      await this.prune(db);
      return entry;
    } catch (err) {
      console.warn("[recents] could not save", err);
      return null;
    }
  }

  async setThumb(id: string, thumb: string): Promise<void> {
    try {
      const db = await this.db();
      const e = await tx<RecentEntry | undefined>(db, [STORE], "readonly", (t) => t.objectStore(STORE).get(id));
      if (!e) return;
      e.thumb = thumb;
      await tx(db, [STORE], "readwrite", (t) => t.objectStore(STORE).put(e));
    } catch {
      /* ignore */
    }
  }

  async remove(id: string): Promise<void> {
    const db = await this.db();
    await tx(db, [STORE, BLOBS], "readwrite", (t) => {
      t.objectStore(STORE).delete(id);
      t.objectStore(BLOBS).delete(id);
    });
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await tx(db, [STORE, BLOBS], "readwrite", (t) => {
      t.objectStore(STORE).clear();
      t.objectStore(BLOBS).clear();
    });
  }

  /**
   * Get the File back. Returns null when neither route works (the caller then
   * asks the user to open it again). Handles need a permission grant, which
   * must be requested from a user gesture — call this from a click handler.
   */
  async reopen(entry: RecentEntry): Promise<File | null> {
    if (entry.handle) {
      try {
        const h = entry.handle as FileSystemFileHandle & {
          queryPermission?(o: { mode: string }): Promise<string>;
          requestPermission?(o: { mode: string }): Promise<string>;
        };
        let perm = (await h.queryPermission?.({ mode: "read" })) ?? "granted";
        if (perm !== "granted") perm = (await h.requestPermission?.({ mode: "read" })) ?? "denied";
        if (perm === "granted") return await h.getFile();
      } catch (err) {
        console.warn("[recents] handle reopen failed", err);
      }
    }
    if (entry.hasBlob) {
      try {
        const db = await this.db();
        const blob = await tx<Blob | File | undefined>(db, [BLOBS], "readonly", (t) => t.objectStore(BLOBS).get(entry.id));
        if (blob) return blob instanceof File ? blob : new File([blob], entry.name, { lastModified: entry.lastModified });
      } catch (err) {
        console.warn("[recents] blob reopen failed", err);
      }
    }
    return null;
  }

  /** Enforce the entry count and total stored bytes (oldest first). */
  private async prune(db: IDBDatabase): Promise<void> {
    const all = (await tx<RecentEntry[]>(db, [STORE], "readonly", (t) => t.objectStore(STORE).getAll())).sort(
      (a, b) => b.openedAt - a.openedAt,
    );
    const drop: string[] = [];
    const dropBlob: string[] = [];
    let bytes = 0;
    all.forEach((e, i) => {
      if (i >= MAX_ENTRIES) {
        drop.push(e.id);
        return;
      }
      if (e.hasBlob) {
        bytes += e.size;
        if (bytes > BLOB_TOTAL_BYTES) {
          dropBlob.push(e.id);
          e.hasBlob = false;
        }
      }
    });
    if (!drop.length && !dropBlob.length) return;
    await tx(db, [STORE, BLOBS], "readwrite", (t) => {
      for (const id of drop) {
        t.objectStore(STORE).delete(id);
        t.objectStore(BLOBS).delete(id);
      }
      for (const id of dropBlob) {
        t.objectStore(BLOBS).delete(id);
        const e = all.find((x) => x.id === id);
        if (e) t.objectStore(STORE).put(e);
      }
    });
  }
}
