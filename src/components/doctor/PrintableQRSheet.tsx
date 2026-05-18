import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * F-14 — A4-friendly print sheet.
 *
 * Hidden on screen (`hidden`) and shown only when printing (`print:flex`).
 * Designed to live inside the patient detail page tree so `window.print()`
 * picks it up without any extra setup. Together with `print:hidden` on the
 * rest of the page, this is the only thing the printer renders.
 */
type Props = {
  externalId: string;
  qrSrc: string;
  /** ISO 8601 date — patient.started_at. */
  issuedAt: string;
};

export function PrintableQRSheet({ externalId, qrSrc, issuedAt }: Props) {
  let issuedLabel = issuedAt;
  try {
    issuedLabel = format(new Date(issuedAt), "d 'de' LLLL 'de' yyyy", { locale: es });
  } catch {
    // Fall back to the raw ISO string if parsing fails.
  }

  return (
    <section
      data-testid="printable-qr-sheet"
      // Hidden in normal view; flex in print. Layout is intentionally simple:
      // a single-page A4 sheet with the QR centered, caption above, IDs below.
      className="hidden print:fixed print:inset-0 print:z-[9999] print:flex print:flex-col print:items-center print:justify-between print:bg-white print:p-16 print:text-black"
      aria-hidden="true"
    >
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Escanea para empezar tu rehabilitación
        </h1>
        <p className="mt-2 text-base text-gray-600">
          Apunta la cámara de tu móvil al código QR.
        </p>
      </header>

      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl border border-gray-200 p-6">
          <Image
            src={qrSrc}
            alt={`QR del paciente ${externalId}`}
            width={420}
            height={420}
            unoptimized
            // 420×420 is large enough to scan reliably from a printed A4 even
            // when the printer downsamples; the page padding keeps a healthy
            // quiet-zone around it.
            className="h-[420px] w-[420px] object-contain"
          />
        </div>
        <p className="text-center text-base text-gray-700">
          <span className="font-semibold">ID paciente:</span>{' '}
          <span className="font-mono">{externalId}</span>
        </p>
        <p className="text-center text-sm text-gray-500">
          Emitido el {issuedLabel}
        </p>
      </div>

      <footer className="text-center text-xs uppercase tracking-[0.2em] text-gray-400">
        Mou — rehabilitación de mano
      </footer>
    </section>
  );
}
