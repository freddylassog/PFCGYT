'use server';
import { redirect } from 'next/navigation';
import { cerrarSesiones } from '@/lib/sesion';

export async function salir(): Promise<void> {
  await cerrarSesiones();
  redirect('/');
}
