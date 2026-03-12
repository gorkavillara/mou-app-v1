'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { checkPatientConsent, acceptPatientConsent } from '@/lib/consent-integration'

type ConsentGuardProps = {
  children: React.ReactNode
}

export function ConsentGuard({ children }: ConsentGuardProps) {
  const [consentStatus, setConsentStatus] = useState<string>('UNKNOWN')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const verify = async () => {
      const result = await checkPatientConsent()
      if (result.hasConsent) {
        setConsentStatus('ACTIVE')
      } else if (result.status !== 'UNKNOWN') {
        setConsentStatus(result.status)
      }
      setLoading(false)
    }
    verify()
  }, [])

  const handleAccept = async () => {
    await acceptPatientConsent()
    setConsentStatus('ACTIVE')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  if (consentStatus !== 'ACTIVE') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Consentimiento Informado
              </h2>
              <p className="text-sm text-gray-500">
                Requerido para continuar
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-gray-600 mb-6">
            <p>
              Para utilizar las funciones de rehabilitación de mano, necesitas aceptar nuestros términos:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Procesamiento local de tus datos biométricos (no se transmite video)</li>
              <li>Cifrado AES-256 de tus datos de sesión</li>
              <li>Derecho a revocar consentimiento en cualquier momento</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500">
              Al aceptar, consientes el tratamiento de tus datos de rehabilitación conforme a nuestra política de privacidad. Tus datos se cifrarán automáticamente para tu protección.
            </p>
          </div>

          <button
            onClick={handleAccept}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Aceptar y Continuar
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
