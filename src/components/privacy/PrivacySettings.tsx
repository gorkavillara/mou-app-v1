'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldOff, Lock, History, AlertTriangle } from 'lucide-react'

type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'PENDING' | 'EXPIRED'

type PrivacySettingsProps = {
  patientId: string
}

export function PrivacySettings({ patientId }: PrivacySettingsProps) {
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>('PENDING')
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    fetchConsentStatus()
  }, [patientId])

  const fetchConsentStatus = async () => {
    try {
      const res = await fetch(`/api/consent?patientId=${patientId}`)
      const data = await res.json()
      setConsentStatus(data.status)
    } catch (error) {
      console.error('Error fetching consent:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!confirm('¿Estás seguro de que quieres revocar el consentimiento? No podrás usar los ejercicios hasta que vuelvas a aceptar.')) {
      return
    }

    setRevoking(true)
    try {
      await fetch(`/api/consent?patientId=${patientId}`, { method: 'DELETE' })
      setConsentStatus('REVOKED')
    } catch (error) {
      console.error('Error revoking consent:', error)
    } finally {
      setRevoking(false)
    }
  }

  const handleAccept = async () => {
    try {
      await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      setConsentStatus('ACTIVE')
    } catch (error) {
      console.error('Error accepting consent:', error)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {consentStatus === 'ACTIVE' ? (
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <ShieldOff className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">Estado de Privacidad</h3>
              <p className="text-sm text-gray-500">
                {consentStatus === 'ACTIVE' && 'Consentimiento activo'}
                {consentStatus === 'PENDING' && 'Pendiente de aceptación'}
                {consentStatus === 'REVOKED' && 'Consentimiento revocado'}
                {consentStatus === 'EXPIRED' && 'Consentimiento expirado'}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              consentStatus === 'ACTIVE'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {consentStatus}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Lock className="w-4 h-4" />
          <span>Todos tus datos están cifrados con AES-256</span>
        </div>

        {consentStatus !== 'ACTIVE' && (
          <button
            onClick={handleAccept}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Aceptar Consentimiento
          </button>
        )}

        {consentStatus === 'ACTIVE' && (
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="w-full border border-red-200 text-red-600 py-3 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
          >
            {revoking ? 'Revocando...' : 'Revocar Consentimiento'}
          </button>
        )}
      </div>

      {consentStatus === 'REVOKED' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">Funciones limitadas</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Has revocado tu consentimiento. Los ejercicios de rehabilitación están desactivados hasta que vuelvas a aceptar los términos.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
