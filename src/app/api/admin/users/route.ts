import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// GET - Listar todos los usuarios
export async function GET() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Obtener usuarios de todas las tablas
  const [doctors, patients, insurances] = await Promise.all([
    supabase.from('doctors').select('id, email, name, created_at'),
    supabase.from('patients').select('id, email, name, created_at'),
    supabase.from('insurances').select('id, contact_email, name, created_at')
  ])

  const allUsers = [
    ...(doctors.data || []).map(d => ({ ...d, role: 'doctor' as const })),
    ...(patients.data || []).map(p => ({ ...p, role: 'patient' as const })),
    ...(insurances.data || []).map(i => ({ 
      id: i.id, 
      email: i.contact_email || '', 
      name: i.name, 
      created_at: i.created_at,
      role: 'mutua' as const 
    }))
  ]

  return NextResponse.json(allUsers)
}

// POST - Crear nuevo usuario
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, email, password, role, specialization, phone, insuranceId } = body

  try {
    // 1. Crear usuario en Auth de Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role }
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('No se pudo crear el usuario')

    // 2. Crear registro en la tabla correspondiente
    if (role === 'doctor') {
      await supabase.from('doctors').insert({
        id: authData.user.id,
        email,
        name,
        specialization: specialization || null
      })
    } else if (role === 'patient') {
      await supabase.from('patients').insert({
        id: authData.user.id,
        email,
        name,
        phone: phone || '',
        insuranceId: insuranceId || null
      })
    } else if (role === 'mutua') {
      await supabase.from('insurances').insert({
        id: authData.user.id,
        name,
        contactEmail: email
      })
    }

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}

// DELETE - Eliminar usuario
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('id')

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Eliminar de la tabla correcta (intentamos todas)
    await supabase.from('doctors').delete().eq('id', userId)
    await supabase.from('patients').delete().eq('id', userId)
    await supabase.from('insurances').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
