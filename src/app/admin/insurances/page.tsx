"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, Building2Icon } from 'lucide-react'

interface Insurance {
  id: string
  name: string
  slug: string
  contactEmail: string | null
  isActive: boolean
}

export default function AdminInsurancesPage() {
  const [insurances, setInsurances] = useState<Insurance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/insurances')
      .then(res => res.json())
      .then(data => setInsurances(data))
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
              Mutuas
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando...</div>
        ) : insurances.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Building2Icon size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay mutuas registradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insurances.map(insurance => (
              <div key={insurance.id} className="bg-white rounded-xl border border-gray-100 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-500">
                    <Building2Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{insurance.name}</h3>
                    <p className="text-sm text-gray-500">{insurance.slug}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">{insurance.contactEmail || 'Sin email'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
