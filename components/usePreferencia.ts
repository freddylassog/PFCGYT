'use client';
import { useCallback, useSyncExternalStore } from 'react';

const EVENTO = 'pf-preferencia';

/** Preferencia guardada en el navegador (localStorage) sin desajustes de hidratación. */
export function usePreferencia<T extends string>(clave: string, porDefecto: T, validas: readonly T[]): [T, (v: T) => void] {
  const leer = useCallback((): T => {
    try {
      const v = localStorage.getItem(clave) as T | null;
      return v && validas.includes(v) ? v : porDefecto;
    } catch { return porDefecto; }
  }, [clave, porDefecto, validas]);
  const suscribir = useCallback((cb: () => void) => {
    window.addEventListener(EVENTO, cb);
    window.addEventListener('storage', cb);
    return () => { window.removeEventListener(EVENTO, cb); window.removeEventListener('storage', cb); };
  }, []);
  const valor = useSyncExternalStore(suscribir, leer, () => porDefecto);
  const fijar = useCallback((v: T) => {
    try { localStorage.setItem(clave, v); } catch {}
    window.dispatchEvent(new Event(EVENTO));
  }, [clave]);
  return [valor, fijar];
}
