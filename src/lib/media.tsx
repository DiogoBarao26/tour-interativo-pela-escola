import { useEffect, useState } from 'react';

const DB_NAME = 'tour-images';
const STORE = 'files';
const cache = new Map<string, string>();

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível guardar a foto neste navegador.'));
  });
}

export async function saveImage(file: Blob) {
  const id = crypto.randomUUID();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível guardar a foto neste navegador.'));
  });
  db.close();
  return `idb:${id}`;
}

export async function resolveMedia(url: string | null | undefined) {
  if (!url) return '';
  if (!url.startsWith('idb:')) return url;
  const id = url.slice(4);
  const cached = cache.get(id);
  if (cached) return cached;
  const db = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir a foto.'));
  });
  db.close();
  if (!blob) return '';
  const objectUrl = URL.createObjectURL(blob);
  cache.set(id, objectUrl);
  return objectUrl;
}

export function useMediaUrl(url: string | null | undefined) {
  const [resolved, setResolved] = useState(!url || url.startsWith('idb:') ? '' : url);
  useEffect(() => {
    let cancel = false;
    setResolved(!url || url.startsWith('idb:') ? '' : url);
    void resolveMedia(url).then((next) => {
      if (!cancel) setResolved(next);
    });
    return () => {
      cancel = true;
    };
  }, [url]);
  return resolved;
}

export function Media({ url, className, alt = '' }: { url: string | null | undefined; className?: string; alt?: string }) {
  const src = useMediaUrl(url);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
