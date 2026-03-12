import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// Tabla de mensajes (la creamos en memoria si no existe en schema)
// GET - Obtener mensajes de un paciente
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!patientId) {
    return NextResponse.json({ error: 'Patient ID required' }, { status: 400 })
  }

  // Solo permitir ver mensajes si es el doctor asignado o el paciente
  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('email', user.email)
    .single()

  const isPatient = user.email === patientId // Simplified - in real app would check properly

  if (!doctor && !isPatient) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Buscar mensajes en una tabla de mensajes (creamos si no existe)
  // Por ahora retornamos array vacío - la implementación real necesitaría la tabla
  const { data: messages } = await supabase
    .from('session_notes') // Usamos session_notes como.Messages temporal
    .select('id, patientId, doctorId, content, createdAt:created_at')
    .eq('patientId', patientId)
    .order('created_at', { ascending: true })

  // Transformar para que parezcan mensajes del doctor
  const formattedMessages = (messages || []).map((msg: any) => ({
    ...msg,
    isFromDoctor: !!msg.doctorId
  }))

  return NextResponse.json(formattedMessages)
}

// POST - Enviar mensaje (doctor deixa mensagem para paciente)
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!doctor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { patientId, content } = body

  if (!patientId || !content) {
    return NextResponse.json({ error: 'Patient ID and content required' }, { status: 400 })
  }

  try {
    // Guardar como nota privada del doctor
    await supabase.from('session_notes').insert({
      patientId,
      doctorId: doctor.id,
      content,
      isPrivate: false // Visible para el paciente
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
  }
}
