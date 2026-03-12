import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createSupabaseServerClient()

  // Verificar que es admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .single()

  if (!admin) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  try {
    // 1. Crear doctores
    const doctors = [
      { id: 'doc-1', email: 'doctor1@mou.com', name: 'Dr. Carlos García', specialization: 'Cirujano de Mano' },
      { id: 'doc-2', email: 'doctor2@mou.com', name: 'Dra. María López', specialization: 'Fisioterapeuta' }
    ]

    for (const doc of doctors) {
      const { error } = await supabase.from('doctors').upsert(doc, { onConflict: 'id' })
      if (error) console.error('Error creating doctor:', error)
    }

    // 2. Crear mutuas
    const insurances = [
      { id: 'ins-1', adminId: admin.id, name: 'Mapfre', slug: 'mapfre', contactEmail: 'mapfre@mou.com' },
      { id: 'ins-2', adminId: admin.id, name: 'Sanitas', slug: 'sanitas', contactEmail: 'sanitas@mou.com' },
      { id: 'ins-3', adminId: admin.id, name: 'Allianz', slug: 'allianz', contactEmail: 'allianz@mou.com' }
    ]

    for (const ins of insurances) {
      const { error } = await supabase.from('insurances').upsert(ins, { onConflict: 'id' })
      if (error) console.error('Error creating insurance:', error)
    }

    // 3. Crear pacientes
    const patients = [
      { id: 'pat-1', insuranceId: 'ins-1', name: 'Juan Pérez', email: 'juan@paciente.com', phone: '612345678', diagnosis: 'Lesión tendón flexor', ifrm: 65, adherence: 0.8 },
      { id: 'pat-2', insuranceId: 'ins-1', name: 'Ana Martínez', email: 'ana@paciente.com', phone: '612345679', diagnosis: 'Cirugía túnel carpiano', ifrm: 72, adherence: 0.9 },
      { id: 'pat-3', insuranceId: 'ins-1', name: 'Luis Sánchez', email: 'luis@paciente.com', phone: '612345680', diagnosis: 'Fractura metacarpiano', ifrm: 58, adherence: 0.7 },
      { id: 'pat-4', insuranceId: 'ins-2', name: 'Carmen Rodríguez', email: 'carmen@paciente.com', phone: '612345681', diagnosis: 'Tendinitis', ifrm: 80, adherence: 0.85 },
      { id: 'pat-5', insuranceId: 'ins-2', name: 'Pedro Gómez', email: 'pedro@paciente.com', phone: '612345682', diagnosis: 'Lesión extensor', ifrm: 45, adherence: 0.6 },
      { id: 'pat-6', insuranceId: 'ins-2', name: 'María Fernández', email: 'maria@paciente.com', phone: '612345683', diagnosis: 'Post-quirúrgico', ifrm: 55, adherence: 0.75 },
      { id: 'pat-7', insuranceId: 'ins-3', name: 'Javier Torres', email: 'javier@paciente.com', phone: '612345684', diagnosis: 'Síndrome de Quervain', ifrm: 68, adherence: 0.82 },
      { id: 'pat-8', insuranceId: 'ins-3', name: 'Sofia Ramírez', email: 'sofia@paciente.com', phone: '612345685', diagnosis: 'Contractura', ifrm: 62, adherence: 0.78 },
      { id: 'pat-9', insuranceId: 'ins-3', name: 'Miguel Ruiz', email: 'miguel@paciente.com', phone: '612345686', diagnosis: 'Lesiónsports', ifrm: 70, adherence: 0.88 },
      { id: 'pat-10', insuranceId: 'ins-1', name: 'Laura Díaz', email: 'laura@paciente.com', phone: '612345687', diagnosis: 'Artritis', ifrm: 40, adherence: 0.5 }
    ]

    for (const pat of patients) {
      const { error } = await supabase.from('patients').upsert(pat, { onConflict: 'id' })
      if (error) console.error('Error creating patient:', error)
    }

    // 4. Crear asignaciones doctor-paciente
    const assignments = [
      { patientId: 'pat-1', doctorId: 'doc-1', insuranceId: 'ins-1', status: 'ACTIVE' },
      { patientId: 'pat-2', doctorId: 'doc-1', insuranceId: 'ins-1', status: 'ACTIVE' },
      { patientId: 'pat-3', doctorId: 'doc-1', insuranceId: 'ins-1', status: 'ACTIVE' },
      { patientId: 'pat-4', doctorId: 'doc-2', insuranceId: 'ins-2', status: 'ACTIVE' },
      { patientId: 'pat-5', doctorId: 'doc-2', insuranceId: 'ins-2', status: 'ACTIVE' },
      { patientId: 'pat-6', doctorId: 'doc-2', insuranceId: 'ins-2', status: 'ACTIVE' },
      { patientId: 'pat-7', doctorId: 'doc-1', insuranceId: 'ins-3', status: 'ACTIVE' },
      { patientId: 'pat-8', doctorId: 'doc-1', insuranceId: 'ins-3', status: 'ACTIVE' },
      { patientId: 'pat-9', doctorId: 'doc-2', insuranceId: 'ins-3', status: 'ACTIVE' },
      { patientId: 'pat-10', doctorId: 'doc-1', insuranceId: 'ins-1', status: 'ACTIVE' }
    ]

    for (const assign of assignments) {
      const { error } = await supabase.from('patient_assignments').upsert(assign, { onConflict: 'patientId,doctorId,insuranceId' })
      if (error) console.error('Error creating assignment:', error)
    }

    // 5. Crear ejercicios
    const exercises = [
      { id: 'MP_IP_BLOCKED', name: 'Flexión Metacarpofalángica', description: 'Flexiona las articulaciones MP e IF bloqueando las demás', targetReps: 10 },
      { id: 'FINGERS_NO_IP_BLOCK', name: 'Flexión Individual de Dedos', description: 'Flexiona cada dedo independientemente', targetReps: 10 },
      { id: 'WRIST_FLEXION', name: 'Flexión de Muñeca', description: 'Flexiona y extiende la muñeca', targetReps: 15 },
      { id: 'THUMB_OPPOSITION', name: 'Oposición del Pulgar', description: 'Toca el pulgar con cada dedo', targetReps: 10 }
    ]

    for (const ex of exercises) {
      const { error } = await supabase.from('exercises').upsert(ex, { onConflict: 'id' })
      if (error) console.error('Error creating exercise:', error)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Seed completado: 2 doctores, 3 mutuas, 10 pacientes, 4 ejercicios' 
    })

  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, message: 'Error al ejecutar seed' }, { status: 500 })
  }
}
