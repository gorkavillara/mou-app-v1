import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Obtener pacientes del doctor actual
export async function GET() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Buscar el doctor
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!doctor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Obtener pacientes asignados a este doctor
  const { data: assignments } = await supabase
    .from('patient_assignments')
    .select('patientId, status')
    .eq('doctorId', doctor.id)
    .eq('status', 'ACTIVE')

  if (!assignments || assignments.length === 0) {
    return NextResponse.json([])
  }

  const patientIds = assignments.map(a => a.patientId)

  // Obtener datos de pacientes
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, email, phone, diagnosis, ifrm, adherence, created_at')
    .in('id', patientIds)

  return NextResponse.json(patients || [])
}

// POST - Crear nuevo paciente (doctor crea paciente y envía invitación)
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, name')
    .eq('email', user.email)
    .single()

  if (!doctor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, phone, diagnosis } = body

  try {
    // 1. Crear usuario en Auth
    const tempPassword = Math.random().toString(36).slice(-8)
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: { name, role: 'patient' }
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No se pudo crear el usuario')

    // 2. Obtener una mutua por defecto
    const { data: insurance } = await supabase
      .from('insurances')
      .select('id')
      .limit(1)
      .single()

    // 3. Crear paciente
    await supabase.from('patients').insert({
      id: authData.user.id,
      name,
      email,
      phone,
      diagnosis: diagnosis || null,
      insuranceId: insurance?.id || null
    })

    // 4. Asignar al doctor actual
    await supabase.from('patient_assignments').insert({
      patientId: authData.user.id,
      doctorId: doctor.id,
      insuranceId: insurance?.id || null,
      status: 'ACTIVE'
    })

    // 5. Enviar email de invitación
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/reset-password`
    })

    return NextResponse.json({ success: true, message: 'Paciente creado e invitación enviada' })
  } catch (error) {
    console.error('Error creating patient:', error)
    return NextResponse.json({ error: 'Error al crear paciente' }, { status: 500 })
  }
}
