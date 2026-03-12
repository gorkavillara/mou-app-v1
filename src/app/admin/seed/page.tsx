"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, DatabaseIcon, CheckCircleIcon, LoaderIcon } from 'lucide-react'

export default function AdminSeedPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{success: boolean, message: string} | null>(null)

  const handleSeed = async () => {
    if (!confirm('Esto creará datos de prueba. ¿Continuar?')) return
    
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/admin/seed', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      setResult({ success: false, message: 'Error al ejecutar seed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon size={20} />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">
              Seed de Datos de Demo
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <DatabaseIcon size={32} className="text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Generar Datos de Prueba
            </h2>
            <p className="text-gray-500 mt-2">
              Crea usuarios, doctores, mutuas y pacientes ficticios para pruebas
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Se creará:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                1 Administrador (admin@mou.com)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                2 Doctores con especialidades
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                3 Mutuas (Mapfre, Sanitas, Allianz)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                10 Pacientes con diagnósticos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                Asignaciones doctor-paciente
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon size={16} className="text-green-500" />
                Ejercicios de ejemplo
              </li>
            </ul>
          </div>

          {result && (
            <div className={`rounded-xl p-4 mb-6 ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.message}
            </div>
          )}

          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#007AFF] text-white rounded-xl hover:bg-[#0069D9] disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <LoaderIcon size={20} className="animate-spin" />
                Generando datos...
              </>
            ) : (
              <>
                <DatabaseIcon size={20} />
                Ejecutar Seed
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Los datos se almacenarán en Supabase. Puedes eliminarlos manualmente.
          </p>
        </div>
      </div>
    </div>
  )
}
