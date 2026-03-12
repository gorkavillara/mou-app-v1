export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admins: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          createdAt: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role?: string
          createdAt?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          createdAt?: string
        }
      }
      doctors: {
        Row: {
          id: string
          email: string
          name: string
          specialization: string | null
          licenseNumber: string | null
          phone: string | null
          avatar: string | null
          isActive: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          specialization?: string | null
          licenseNumber?: string | null
          phone?: string | null
          avatar?: string | null
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          specialization?: string | null
          licenseNumber?: string | null
          phone?: string | null
          avatar?: string | null
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      patients: {
        Row: {
          id: string
          insuranceId: string
          name: string
          email: string | null
          phone: string
          birthDate: string | null
          diagnosis: string | null
          injuryDate: string | null
          notes: string | null
          isActive: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          insuranceId: string
          name: string
          email?: string | null
          phone: string
          birthDate?: string | null
          diagnosis?: string | null
          injuryDate?: string | null
          notes?: string | null
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          insuranceId?: string
          name?: string
          email?: string | null
          phone?: string
          birthDate?: string | null
          diagnosis?: string | null
          injuryDate?: string | null
          notes?: string | null
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      sessions: {
        Row: {
          id: string
          patientId: string
          exerciseId: string
          doctorId: string | null
          startedAt: string
          endedAt: string | null
          targetReps: number
          status: string
          rom: number | null
          maxFlexion: number | null
          maxExtension: number | null
          repetitions: number | null
          progress: number | null
        }
        Insert: {
          id?: string
          patientId: string
          exerciseId: string
          doctorId?: string | null
          startedAt?: string
          endedAt?: string | null
          targetReps?: number
          status?: string
          rom?: number | null
          maxFlexion?: number | null
          maxExtension?: number | null
          repetitions?: number | null
          progress?: number | null
        }
        Update: {
          id?: string
          patientId?: string
          exerciseId?: string
          doctorId?: string | null
          startedAt?: string
          endedAt?: string | null
          targetReps?: number
          status?: string
          rom?: number | null
          maxFlexion?: number | null
          maxExtension?: number | null
          repetitions?: number | null
          progress?: number | null
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type UserRole = 'admin' | 'doctor' | 'patient'

export interface User {
  id: string
  email: string
  role: UserRole
  name?: string
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at?: number
  token_type: string
  user: User
}
