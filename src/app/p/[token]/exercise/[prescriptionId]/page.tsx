import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ExerciseSession } from './ExerciseSession';
import type { PatientHomePayload } from '../../types';

/**
 * F-10 — Exercise session entry.
 *
 * Server component reads the patient's API again (cache: 'no-store') and locates
 * the prescription by ID. Anything unhappy (404 / discharged / prescription not
 * active) → redirect back to /p/[token].
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mou — Ejercicio',
};

async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  if (!host) {
    const env = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3500';
    return env.replace(/\/$/, '');
  }
  return `${proto}://${host}`;
}

type PageProps = {
  params: Promise<{ token: string; prescriptionId: string }>;
};

export default async function ExercisePage({ params }: PageProps) {
  const { token, prescriptionId } = await params;
  const base = await resolveBaseUrl();

  const res = await fetch(`${base}/api/patient/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (res.status === 404) notFound();
  if (res.status === 410) redirect(`/p/${token}`);
  if (!res.ok) redirect(`/p/${token}`);

  const payload = (await res.json()) as PatientHomePayload;
  const prescription = payload.prescriptions.find((p) => p.id === prescriptionId);

  if (!prescription || !prescription.exercise) {
    redirect(`/p/${token}`);
  }

  return (
    <ExerciseSession
      token={token}
      prescription={prescription}
      patient={payload.patient}
    />
  );
}
