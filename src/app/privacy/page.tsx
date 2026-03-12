'use client'

import { createClient } from '@/lib/supabase'
import { PrivacySettings } from '@/components/privacy/PrivacySettings'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  const [patientId, setPatientId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: {user}} = await supabase.auth.getUser()
      if (user?.email) {
        const res = await fetch(`/api/patients?email=${user.email}`)
        const patients = await res.json()
        if (patients.length > 0) {
          setPatientId(patients[0].id)
        }
      }
    }
    getUser()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Configuración de Privacidad
        </h1>
        <p className="text-gray-600 mb-8">
          Gestiona tu consentimiento y protección de datos
        </p>

        {patientId ? (
          <PrivacySettings patientId={patientId} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            Cargando...
          </div>
        )}
      </div>
    </div>
  )
}
