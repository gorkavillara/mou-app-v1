import { createSupabaseServerClient } from './supabase/server'
import type { UserProfile, UserRole } from './types'

/**
 * Obtiene el perfil del usuario basado en su email
 * Busca en las tablas de admin, doctors, patients e insurances
 */
export async function getUserProfile(email: string): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient()

  // 1. Buscar en admins
  const { data: admin } = await supabase
    .from('admins')
    .select('id, email, name')
    .eq('email', email)
    .single()

  if (admin) {
    return {
      id: admin.id,
      email: admin.email,
      role: 'admin',
      name: admin.name
    }
  }

  // 2. Buscar en doctors
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, email, name, specialization, license_number')
    .eq('email', email)
    .single()

  if (doctor) {
    return {
      id: doctor.id,
      email: doctor.email,
      role: 'doctor',
      name: doctor.name,
      specialization: doctor.specialization,
      licenseNumber: doctor.license_number
    }
  }

  // 3. Buscar en patients
  const { data: patient } = await supabase
    .from('patients')
    .select('id, email, name')
    .eq('email', email)
    .single()

  if (patient) {
    return {
      id: patient.id,
      email: patient.email || '',
      role: 'patient',
      name: patient.name,
      patientId: patient.id
    }
  }

  // 4. Buscar en insurances (mutua)
  const { data: insurance } = await supabase
    .from('insurances')
    .select('id, name, contact_email')
    .eq('contact_email', email)
    .single()

  if (insurance) {
    return {
      id: insurance.id,
      email: insurance.contact_email || '',
      role: 'mutua',
      name: insurance.name,
      insuranceId: insurance.id
    }
  }

  // Usuario no encontrado
  return null
}

/**
 * Obtiene el perfil del usuario actual desde la sesión
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) {
    return null
  }

  return getUserProfile(user.email)
}

/**
 * Obtiene el ID de la entidad relacionada según el rol
 * - doctor: returns doctor ID
 * - patient: returns patient ID
 * - mutua: returns insurance ID
 * - admin: returns admin ID
 */
export function getEntityId(profile: UserProfile): string | null {
  switch (profile.role) {
    case 'doctor':
      return profile.id
    case 'patient':
      return profile.patientId || null
    case 'mutua':
      return profile.insuranceId || null
    case 'admin':
      return profile.id
    default:
      return null
  }
}
