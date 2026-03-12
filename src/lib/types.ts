// ============================================
// TIPOS DE ROLES Y USUARIOS
// ============================================

export type UserRole = 'admin' | 'doctor' | 'patient' | 'mutua'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  name?: string
  // Para doctor
  specialization?: string
  licenseNumber?: string
  // Para patient
  patientId?: string
  // Para mutua
  insuranceId?: string
}

// ============================================
// RUTAS POR ROL
// ============================================

export const roleRoutes: Record<UserRole, string> = {
  admin: '/admin',
  doctor: '/doctor',
  patient: '/dashboard',
  mutua: '/mutua'
}

export const roleNames: Record<UserRole, string> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  patient: 'Patient',
  mutua: 'Insurance'
}

// ============================================
// VERIFICACIÓN DE ROL
// ============================================

export function hasRole(profile: UserProfile | null, role: UserRole): boolean {
  return profile?.role === role
}

export function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === 'admin'
}

export function isDoctor(profile: UserProfile | null): boolean {
  return profile?.role === 'doctor'
}

export function isPatient(profile: UserProfile | null): boolean {
  return profile?.role === 'patient'
}

export function isMutua(profile: UserProfile | null): boolean {
  return profile?.role === 'mutua'
}

export function getDashboardRoute(profile: UserProfile | null): string {
  if (!profile) return '/login'
  return roleRoutes[profile.role] || '/login'
}
