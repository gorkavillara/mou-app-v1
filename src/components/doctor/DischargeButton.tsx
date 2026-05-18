'use client';

import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  patientId: string;
  externalId: string;
  dischargedAt: string | null;
};

export function DischargeButton({ patientId, externalId, dischargedAt }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  if (dischargedAt) return null;

  function handleClose() {
    setOpen(false);
    setError(null);
    setSubmitting(false);
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/discharge`, {
        method: 'POST',
      });
      if (res.ok) {
        handleClose();
        router.refresh();
        return;
      }
      const errBody = await res.json().catch(() => ({}) as { error?: string });
      setError(errBody?.error ?? 'No se pudo finalizar el tratamiento.');
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-lg"
      >
        <CheckCircle2 size={16} />
        Finalizar rehabilitación
      </button>

      <dialog
        ref={dialogRef}
        onClose={handleClose}
        onCancel={handleClose}
        className="m-auto rounded-2xl p-0 backdrop:bg-gray-900/40 backdrop:backdrop-blur-sm w-[calc(100vw-2rem)] max-w-md border border-gray-100 shadow-xl"
      >
        <div className="bg-white rounded-2xl">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight">Finalizar rehabilitación</h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          <div className="px-5 pb-5 space-y-3">
            <p className="text-sm text-gray-700">
              ¿Finalizar la rehabilitación de{' '}
              <span className="font-semibold">{externalId}</span>? La URL del paciente dejará de
              estar accesible.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="h-10 px-4 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="h-10 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl"
            >
              {submitting ? 'Finalizando…' : 'Sí, finalizar'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
