'use client';
import { useState, useTransition } from 'react';
import type { Resultado } from '@/lib/tipos';

/** Ejecuta una acción de servidor mostrando estado de espera y error. */
export function useAccion() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T>(fn: () => Promise<Resultado<T>>, ok?: (datos: T | undefined) => void) {
    start(async () => {
      setError(null);
      try {
        const r = await fn();
        if (!r.ok) setError(r.error || 'No se pudo completar la acción.');
        else ok?.(r.datos);
      } catch (e) {
        setError((e as Error).message || 'No se pudo completar la acción.');
      }
    });
  }
  return { pending, error, run, setError };
}
