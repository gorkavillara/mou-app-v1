import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) {
    return NextResponse.json({ role: 'patient', name: null })
  }

  // 1. Buscar en admins
  const { data: admin } = await supabase
    .from('admins')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (admin) {
    return NextResponse.json({ role: 'admin', name: admin.name })
  }

  // 2. Buscar en doctors
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (doctor) {
    return NextResponse.json({ role: 'doctor', name: doctor.name })
  }

  // 3. Buscar en patients
  const { data: patient } = await supabase
    .from('patients')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (patient) {
    return NextResponse.json({ role: 'patient', name: patient.name, patientId: patient.id })
  }

  // 4. Buscar en insurances
  const { data: insurance } = await supabase
    .from('insurances')
    .select('id, name')
    .eq('contact_email', user.email)
    .single()

  if (insurance) {
    return NextResponse.json({ role: 'mutua', name: insurance.name })
  }

  // Default
  return NextResponse.json({ role: 'patient', name: null })
}
