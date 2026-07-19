import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

import { isNative } from "@/lib/native/platform";

const MEDIA_DATABASE = "paso-journal-media";
const MEDIA_STORE = "photos";
const MEDIA_DIRECTORY = "journal-photos";
const MAX_DATA_URL_LENGTH = 14 * 1024 * 1024;

type StoredWebPhoto = {
  id: string;
  dataUrl: string;
  createdAt: string;
};

function parseImageDataUrl(dataUrl: string) {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([a-z0-9+/=\r\n]+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Photo must be a base64 image data URL.");
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Photo is too large to store safely.");
  }

  const type = match[1].toLowerCase();
  return {
    base64: match[2].replace(/[\r\n]/g, ""),
    extension: type === "jpeg" || type === "jpg" ? "jpg" : type,
    mimeType: type === "jpg" ? "image/jpeg" : `image/${type}`,
  };
}

function createPhotoId(extension: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `photo-${suffix}.${extension}`;
}

function photoPath(photoId: string) {
  if (!/^photo-[a-z0-9-]+\.(jpg|png|webp)$/i.test(photoId)) {
    throw new Error("Invalid journal photo id.");
  }
  return `${MEDIA_DIRECTORY}/${photoId}`;
}

function mimeTypeForPhotoId(photoId: string) {
  const extension = photoId.split(".").pop()?.toLowerCase();
  if (extension === "jpg") return "image/jpeg";
  if (extension === "png" || extension === "webp") return `image/${extension}`;
  throw new Error("Invalid journal photo id.");
}

function openMediaDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DATABASE, 1);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEDIA_STORE)) {
        database.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function withWebStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openMediaDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(MEDIA_STORE, mode);
      const request = operation(transaction.objectStore(MEDIA_STORE));
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
      transaction.addEventListener("abort", () => reject(transaction.error));
    });
  } finally {
    database.close();
  }
}

export async function saveJournalPhoto(dataUrl: string) {
  const { base64, extension } = parseImageDataUrl(dataUrl);
  const id = createPhotoId(extension);

  if (isNative()) {
    const result = await Filesystem.writeFile({
      path: photoPath(id),
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return { id, previewUrl: Capacitor.convertFileSrc(result.uri) };
  }

  await withWebStore("readwrite", (store) =>
    store.put({ id, dataUrl, createdAt: new Date().toISOString() } satisfies StoredWebPhoto),
  );
  return { id, previewUrl: dataUrl };
}

export async function getJournalPhotoUrl(photoId: string) {
  if (isNative()) {
    try {
      const result = await Filesystem.getUri({
        path: photoPath(photoId),
        directory: Directory.Data,
      });
      return Capacitor.convertFileSrc(result.uri);
    } catch {
      return null;
    }
  }

  const photo = await withWebStore<StoredWebPhoto | undefined>("readonly", (store) =>
    store.get(photoId),
  );
  return photo?.dataUrl ?? null;
}

export async function deleteJournalPhoto(photoId: string) {
  if (isNative()) {
    try {
      await Filesystem.deleteFile({
        path: photoPath(photoId),
        directory: Directory.Data,
      });
    } catch {
      // Deleting an already missing photo is idempotent.
    }
    return;
  }

  await withWebStore("readwrite", (store) => store.delete(photoId));
}

export async function readJournalPhotoData(photoId: string) {
  if (isNative()) {
    try {
      const result = await Filesystem.readFile({
        path: photoPath(photoId),
        directory: Directory.Data,
      });
      if (typeof result.data !== "string") {
        throw new Error("Native photo data could not be read as base64.");
      }
      return `data:${mimeTypeForPhotoId(photoId)};base64,${result.data}`;
    } catch (error) {
      if (error instanceof Error && error.message.includes("could not be read")) {
        throw error;
      }
      return null;
    }
  }

  const photo = await withWebStore<StoredWebPhoto | undefined>("readonly", (store) =>
    store.get(photoId),
  );
  return photo?.dataUrl ?? null;
}

export async function restoreJournalPhotoData(photoId: string, dataUrl: string) {
  const parsed = parseImageDataUrl(dataUrl);
  const expectedMime = mimeTypeForPhotoId(photoId);
  if (parsed.mimeType !== expectedMime) {
    throw new Error("Journal photo type does not match its id.");
  }

  if (isNative()) {
    await Filesystem.writeFile({
      path: photoPath(photoId),
      data: parsed.base64,
      directory: Directory.Data,
      recursive: true,
    });
    return;
  }

  await withWebStore("readwrite", (store) =>
    store.put({
      id: photoId,
      dataUrl,
      createdAt: new Date().toISOString(),
    } satisfies StoredWebPhoto),
  );
}

export async function clearJournalPhotos() {
  if (isNative()) {
    try {
      await Filesystem.rmdir({
        path: MEDIA_DIRECTORY,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      // The media directory is optional until the first photo is saved.
    }
    return;
  }

  await withWebStore("readwrite", (store) => store.clear());
}
