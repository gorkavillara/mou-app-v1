import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PatientHome } from './PatientHome';
import { TreatmentEnded } from './TreatmentEnded';
import type { PatientHomePayload } from './types';

/**
 * F-08 — Patient entry page.
 *
 * Server component. Resolves the access token, calls B-11, and decides
 * what to render:
 *   - 200 → <PatientHome /> (client)
 *   - 404 → notFound()
 *   - 410 → <TreatmentEnded />
 *
 * No nav header on this branch — the patient flow is intentionally minimal.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mou — Mi rehabilitación',
};

async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  if (!host) {
    // Fallback: when called outside an HTTP request (very rare for a server
    // component), rely on env. Keeps types honest.
    const env = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3500';
    return env.replace(/\/$/, '');
  }
  return `${proto}://${host}`;
}

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PatientPage({ params }: PageProps) {
  const { token } = await params;
  const base = await resolveBaseUrl();

  const res = await fetch(`${base}/api/patient/${encodeURIComponent(token)}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (res.status === 404) {
    notFound();
  }

  if (res.status === 410) {
    return <TreatmentEnded />;
  }

  if (!res.ok) {
    // Generic failure — show a friendly message but keep the patient on this
    // route so a refresh recovers naturally.
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Algo ha fallado</h1>
          <p className="mt-3 text-gray-600">
            No hemos podido cargar tu rehabilitación. Vuelve a intentarlo en unos
            segundos.
          </p>
        </div>
      </main>
    );
  }

  const payload = (await res.json()) as PatientHomePayload;

  return (
    <PatientHome
      token={token}
      patient={payload.patient}
      prescriptions={payload.prescriptions}
      today={payload.today}
    />
  );
}
