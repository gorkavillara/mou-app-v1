export default function DoctorHome() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
        <p className="text-sm text-gray-500">
          Lista de pacientes activos. Pendiente de implementar (F-03).
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">
          Aún no hay vista de pacientes. La construiremos en la próxima tarea (F-03).
        </p>
      </div>
    </div>
  );
}
