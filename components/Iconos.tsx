// Iconos Lucide (trazo 1.5) como SVG en línea.
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export function IconoCandado({ size = 12 }: P) {
  return <svg {...base(size)}><rect x="3" y="11" width="18" height="11" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
}
export function IconoInfo({ size = 18 }: P) {
  return <svg {...base(size)}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>;
}
export function IconoAlerta({ size = 18 }: P) {
  return <svg {...base(size)}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>;
}
export function IconoCalendario({ size = 18 }: P) {
  return <svg {...base(size)}><rect x="3" y="4" width="18" height="18" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}
export function IconoCerrar({ size = 18 }: P) {
  return <svg {...base(size)}><path d="M18 6 6 18M6 6l12 12" /></svg>;
}
export function IconoCorreo({ size = 14 }: P) {
  return <svg {...base(size)}><rect x="2" y="4" width="20" height="16" /><path d="m22 7-10 7L2 7" /></svg>;
}
export function IconoCopiar({ size = 14 }: P) {
  return <svg {...base(size)}><rect x="9" y="9" width="13" height="13" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}
export function IconoDescargar({ size = 14 }: P) {
  return <svg {...base(size)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
}
