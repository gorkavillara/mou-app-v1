'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  open: boolean;
  onClose: () => void;
};

const ID_PATTERN = /^[A-Za-z0-9_\-/]+$/;

export function NewPatientDialog({ open, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [externalId, setExternalId] = useState('');
  const [pathology, setPathology] = useState<'' | 'flexor' | 'extensor' | 'otros'>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      // Defer focus until dialog is in the DOM tree.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    if (!open && dlg.open) dlg.close();
  }, [open]);

  function reset() {
    setExternalId('');
    setPathology('');
    setError(null);
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const id = externalId.trim();
    if (!id) {
      setError('El ID es obligatorio.');
      return;
    }
    if (!ID_PATTERN.test(id)) {
      setError('Solo letras, números y - _ / están permitidos.');
      return;
    }

    setSubmitting(true);
    try {
      const body: { external_id: string; pathology_code?: 'flexor' | 'extensor' | 'otros' } = {
        external_id: id,
      };
      if (pathology) body.pathology_code = pathology;

      const res = await fetch('/api/doctor/patients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const body = (await res.json()) as { patient: { id: string } };
        reset();
        onClose();
        router.push(`/doctor/pacientes/${body.patient.id}`);
        router.refresh();
        return;
      }

      if (res.status === 409) {
        setError('Ya tienes un paciente con ese ID. Usa otro identificador.');
      } else {
        const body = await res.json().catch(() => ({}) as { error?: string });
        setError(body?.error ?? 'No se pudo crear el paciente. Inténtalo de nuevo.');
      }
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onCancel={handleClose}
      className="m-auto rounded-2xl p-0 backdrop:bg-gray-900/40 backdrop:backdrop-blur-sm w-[calc(100vw-2rem)] max-w-md border border-gray-100 shadow-xl"
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold tracking-tight">Nuevo paciente</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <p className="text-xs text-gray-500">
            Identifica al paciente con su nº de historia clínica o un código correlativo. No
            guardes nombre ni datos personales.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="external_id" className="block text-[13px] font-medium text-gray-500 ml-1">
              ID del paciente
            </label>
            <input
              id="external_id"
              ref={inputRef}
              type="text"
              required
              autoComplete="off"
              pattern="[A-Za-z0-9_\-/]+"
              placeholder="HC-48721"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              className="w-full h-11 px-4 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 placeholder-[#C7C7CC] focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pathology" className="block text-[13px] font-medium text-gray-500 ml-1">
              Patología (opcional)
            </label>
            <select
              id="pathology"
              value={pathology}
              onChange={(e) =>
                setPathology(e.target.value as '' | 'flexor' | 'extensor' | 'otros')
              }
              className="w-full h-11 px-3 bg-white border border-[#E5E5EA] rounded-[10px] text-[17px] text-gray-900 focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] focus:outline-none"
            >
              <option value="">Sin especificar</option>
              <option value="flexor">Flexor</option>
              <option value="extensor">Extensor</option>
              <option value="otros">Otros</option>
            </select>
          </div>

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
            type="submit"
            disabled={submitting || !externalId}
            className="h-10 px-4 bg-[#007AFF] hover:bg-[#0069D9] active:bg-[#005BB5] disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl"
          >
            {submitting ? 'Creando…' : 'Crear paciente'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
