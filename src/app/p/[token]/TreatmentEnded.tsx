/**
 * 410 view — patient has been discharged or every prescription has expired.
 * Intentionally has no link to anything internal: the URL is the patient's
 * only credential and we don't want them poking around.
 */
export function TreatmentEnded() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 text-3xl">
          {/* check, no emoji */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-6 text-2xl font-semibold text-gray-900 tracking-tight">
          Tu rehabilitación ha terminado
        </h1>
        <p className="mt-3 text-gray-600 leading-relaxed">
          Gracias por tu constancia durante el tratamiento. Si tu doctor necesita
          que continúes, te dará un nuevo enlace en consulta.
        </p>
      </div>
    </main>
  );
}
