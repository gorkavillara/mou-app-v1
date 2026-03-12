'use client'

import { useRouter } from 'next/navigation'
import { Shield, X } from 'lucide-react'

type ConsentBannerProps = {
  onAccept: () => void
}

export function ConsentBanner({ onAccept }: ConsentBannerProps) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
              Required para continuar
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

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/privacy')}
            className="flex-1px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Configuración
          </button>
          <button
            onClick={onAccept}
            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Aceptar y Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
