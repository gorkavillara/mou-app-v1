// Consent integration for exercises page
import { createClient } from '@/lib/supabase'

const supabase = createClient()

export async function checkPatientConsent(): Promise<{hasConsent: boolean, status: string}> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      return { hasConsent: false, status: 'UNKNOWN' }
    }
    
    const res = await fetch(`/api/patients?email=${user.email}`)
    const patientList = await res.json()
    if (patientList.length === 0) {
      return { hasConsent: false, status: 'UNKNOWN' }
    }
    
    const patientId = patientList[0].id
    const consentRes = await fetch(`/api/consent?patientId=${patientId}`)
    const consentData = await consentRes.json()
    
    return {
      hasConsent: consentData.status === 'ACTIVE',
      status: consentData.status
    }
  } catch (error) {
    console.error('Error checking consent:', error)
    return { hasConsent: false, status: 'UNKNOWN' }
  }
}

export async function acceptPatientConsent(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return
  
  const res = await fetch(`/api/patients?email=${user.email}`)
  const patientList = await res.json()
  if (patientList.length === 0) return
  
  await fetch('/api/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: patientList[0].id }),
  })
}
