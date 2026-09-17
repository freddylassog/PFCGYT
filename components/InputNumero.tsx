'use client';
import { useState, type InputHTMLAttributes } from 'react';

/** Campo numérico que se puede borrar y volver a escribir sin que salte al mínimo.
 *  Mientras se escribe guarda el texto; avisa el número solo cuando es válido y, al salir, lo ajusta al rango. */
export function InputNumero({ value, min, max, onChange, ...rest }: { value: number; min: number; max: number; onChange: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'min' | 'max' | 'onChange' | 'type'>) {
  const [texto, setTexto] = useState(String(value));
  const [ultimo, setUltimo] = useState(value);
  if (value !== ultimo) { // el valor cambió desde afuera (p. ej. ajuste del reparto): se refleja en el texto
    setUltimo(value);
    setTexto(String(value));
  }
  const valido = (t: string) => { const n = Number(t); return t.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null; };
  return (
    <input
      {...rest}
      className={rest.className ?? 'input'}
      type="number" inputMode="numeric" min={min} max={max} step={1}
      value={texto}
      onFocus={(e) => e.target.select()}
      onChange={(e) => { const t = e.target.value; setTexto(t); const n = valido(t); if (n !== null) { setUltimo(n); onChange(n); } }}
      onBlur={() => { if (valido(texto) === null) { const n = Math.max(min, Math.min(max, Math.round(Number(texto)) || min)); setTexto(String(n)); setUltimo(n); onChange(n); } }}
    />
  );
}
