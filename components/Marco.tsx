import type { CSSProperties, ElementType, ReactNode } from 'react';

/** Caja "blueprint": borde fino con marcas + en las esquinas. */
export function Marco({
  as: Tag = 'div', className = '', style, children, ...rest
}: { as?: ElementType; className?: string; style?: CSSProperties; children?: ReactNode } & Record<string, unknown>) {
  return (
    <Tag className={`blueprint ${className}`} style={style} {...rest}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      {children}
    </Tag>
  );
}

export function Esquinas() {
  return <><i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" /></>;
}
