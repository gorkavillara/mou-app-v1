"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon, StethoscopeIcon } from 'lucide-react'

interface Doctor {
  id: string
  name: string
  email: string
  specialization: string | null
  isActive: boolean
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/doctors')
      .then(res => res.json())
      .then(data => setDoctors(data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon size={20} />
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">
              Doctores
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando...</div>
        ) : doctors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <StethoscopeIcon size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay doctores registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map(doctor => (
              <div key={doctor.id} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                    <StethoscopeIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                    <p className="text-sm text-gray-500">{doctor.specialization || 'Sin especialidad'}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">{doctor.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
